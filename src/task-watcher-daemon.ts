/**
 * Task Watcher Daemon - 监听任务页面并自动触发 AI
 *
 * Architecture:
 *   - 独立守护进程，监听端口 19826
 *   - 定时检查任务页面（通过 Browser Daemon）
 *   - 发现新任务后触发 Claude 执行
 *
 * Security:
 *   - Origin check (same as Browser Daemon)
 *   - X-leafcli header required
 *   - Body size limit
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, homedir } from 'node:path';
import { log } from './logger.js';
import { EXIT_CODES } from './errors.js';
import { PKG_VERSION } from './version.js';
import { checkTasks, type TaskCheckResult } from './task-checker.js';
import { triggerClaude, type TriggerResult } from './trigger-engine.js';
import {
  type TaskWatcherConfig,
  type WatcherEntry,
  loadConfig,
  saveConfig,
} from './task-watcher-config.js';

const PORT = 19826;
const CONFIG_PATH = join(homedir(), '.leafcli', 'task-watcher.json');
const STATE_PATH = join(homedir(), '.leafcli', 'task-watcher-state.json');

// ─── State ───────────────────────────────────────────────────────────

interface TaskState {
  id: string;
  title: string;
  priority?: string;
  status?: string;
  firstSeen: number;
  lastChecked: number;
  triggered?: boolean;
  triggeredAt?: number;
}

interface DaemonState {
  watchers: Map<string, {
    config: WatcherEntry;
    lastCheck: number;
    checkCount: number;
    tasksFound: number;
    tasksTriggered: number;
    tasks: TaskState[];
  }>;
  running: boolean;
  startTime: number;
}

const state: DaemonState = {
  watchers: new Map(),
  running: true,
  startTime: Date.now(),
};

let checkInterval: ReturnType<typeof setInterval> | null = null;

// ─── HTTP Server ─────────────────────────────────────────────────────

const MAX_BODY = 1024 * 1024;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let aborted = false;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        aborted = true;
        req.destroy();
        reject(new Error('Body too large'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!aborted) resolve(Buffer.concat(chunks).toString('utf-8'));
    });
    req.on('error', (err) => {
      if (!aborted) reject(err);
    });
  });
}

function jsonResponse(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const origin = req.headers['origin'] as string | undefined;
  if (origin && !origin.startsWith('chrome-extension://')) {
    jsonResponse(res, 403, { ok: false, error: 'Forbidden: cross-origin request blocked' });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url ?? '/';
  const pathname = url.split('?')[0];

  // Health check - no X-leafcli required
  if (req.method === 'GET' && pathname === '/ping') {
    jsonResponse(res, 200, { ok: true, daemon: 'task-watcher', version: PKG_VERSION });
    return;
  }

  // Require X-leafcli header
  if (!req.headers['x-leafcli']) {
    jsonResponse(res, 403, { ok: false, error: 'Forbidden: missing X-leafcli header' });
    return;
  }

  // Status endpoint
  if (req.method === 'GET' && pathname === '/status') {
    const uptime = process.uptime();
    const mem = process.memoryUsage();
    const watchers = Array.from(state.watchers.entries()).map(([url, data]) => ({
      url,
      lastCheck: data.lastCheck,
      checkCount: data.checkCount,
      tasksFound: data.tasksFound,
      tasksTriggered: data.tasksTriggered,
      pendingTasks: data.tasks.filter(t => !t.triggered).length,
    }));
    jsonResponse(res, 200, {
      ok: true,
      pid: process.pid,
      uptime,
      daemonVersion: PKG_VERSION,
      running: state.running,
      startTime: state.startTime,
      watchers,
      memoryMB: Math.round(mem.rss / 1024 / 1024 * 10) / 10,
      port: PORT,
    });
    return;
  }

  // Get watchers config
  if (req.method === 'GET' && pathname === '/watchers') {
    const config = loadConfig(CONFIG_PATH);
    jsonResponse(res, 200, { ok: true, watchers: config.watchers });
    return;
  }

  // Add watcher
  if (req.method === 'POST' && pathname === '/watchers/add') {
    try {
      const body = JSON.parse(await readBody(req));
      if (!body.url || !body.triggerTemplate) {
        jsonResponse(res, 400, { ok: false, error: 'Missing url or triggerTemplate' });
        return;
      }
      const config = loadConfig(CONFIG_PATH);
      const existing = config.watchers.find(w => w.url === body.url);
      if (existing) {
        jsonResponse(res, 409, { ok: false, error: 'Watcher already exists' });
        return;
      }
      const watcher: WatcherEntry = {
        url: body.url,
        intervalSeconds: body.intervalSeconds || 30,
        triggerTemplate: body.triggerTemplate,
        targetAI: body.targetAI || 'claude',
        taskSelector: body.taskSelector,
        taskFields: body.taskFields,
        filters: body.filters,
      };
      config.watchers.push(watcher);
      saveConfig(CONFIG_PATH, config);
      state.watchers.set(watcher.url, {
        config: watcher,
        lastCheck: 0,
        checkCount: 0,
        tasksFound: 0,
        tasksTriggered: 0,
        tasks: [],
      });
      jsonResponse(res, 200, { ok: true, watcher });
    } catch (err) {
      jsonResponse(res, 400, { ok: false, error: err instanceof Error ? err.message : 'Invalid request' });
    }
    return;
  }

  // Remove watcher
  if (req.method === 'POST' && pathname === '/watchers/remove') {
    try {
      const body = JSON.parse(await readBody(req));
      if (!body.url) {
        jsonResponse(res, 400, { ok: false, error: 'Missing url' });
        return;
      }
      const config = loadConfig(CONFIG_PATH);
      const index = config.watchers.findIndex(w => w.url === body.url);
      if (index === -1) {
        jsonResponse(res, 404, { ok: false, error: 'Watcher not found' });
        return;
      }
      config.watchers.splice(index, 1);
      saveConfig(CONFIG_PATH, config);
      state.watchers.delete(body.url);
      jsonResponse(res, 200, { ok: true });
    } catch (err) {
      jsonResponse(res, 400, { ok: false, error: err instanceof Error ? err.message : 'Invalid request' });
    }
    return;
  }

  // Get discovered tasks
  if (req.method === 'GET' && pathname === '/tasks') {
    const tasks = Array.from(state.watchers.values()).flatMap(w =>
      w.tasks.map(t => ({
        ...t,
        sourceUrl: w.config.url,
      }))
    );
    jsonResponse(res, 200, { ok: true, tasks });
    return;
  }

  // Shutdown
  if (req.method === 'POST' && pathname === '/shutdown') {
    jsonResponse(res, 200, { ok: true, message: 'Shutting down' });
    setTimeout(() => shutdown(), 100);
    return;
  }

  jsonResponse(res, 404, { error: 'Not found' });
}

// ─── Task Checking Logic ─────────────────────────────────────────────

async function checkAllWatchers(): Promise<void> {
  if (!state.running) return;

  const now = Date.now();
  for (const [url, watcherState] of state.watchers) {
    const interval = watcherState.config.intervalSeconds * 1000;
    if (now - watcherState.lastCheck < interval) continue;

    try {
      log.info(`[task-watcher] Checking ${url}`);
      watcherState.lastCheck = now;
      watcherState.checkCount++;

      const result = await checkTasks(watcherState.config);
      if (!result.ok) {
        log.warn(`[task-watcher] Check failed for ${url}: ${result.error}`);
        continue;
      }

      // Find new tasks
      const newTasks = result.tasks.filter(newTask =>
        !watcherState.tasks.some(existing =>
          existing.id === newTask.id && existing.firstSeen > now - 60000
        )
      );

      if (newTasks.length > 0) {
        log.info(`[task-watcher] Found ${newTasks.length} new tasks on ${url}`);
        watcherState.tasksFound += newTasks.length;

        // Add new tasks to state
        for (const task of newTasks) {
          const taskState: TaskState = {
            id: task.id,
            title: task.title || 'Unknown Task',
            priority: task.priority,
            status: task.status,
            firstSeen: now,
            lastChecked: now,
            triggered: false,
          };
          watcherState.tasks.push(taskState);
        }

        // Trigger Claude for new tasks
        for (const task of newTasks) {
          const triggerResult = await triggerClaude(watcherState.config, task);
          if (triggerResult.ok) {
            log.success(`[task-watcher] Triggered Claude for task ${task.id}`);
            watcherState.tasksTriggered++;
            const taskState = watcherState.tasks.find(t => t.id === task.id);
            if (taskState) {
              taskState.triggered = true;
              taskState.triggeredAt = now;
            }
          } else {
            log.error(`[task-watcher] Failed to trigger Claude: ${triggerResult.error}`);
          }
        }
      }

      // Update last checked for existing tasks
      for (const task of watcherState.tasks) {
        task.lastChecked = now;
      }
    } catch (err) {
      log.error(`[task-watcher] Error checking ${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Save state to disk
  saveState();
}

function saveState(): void {
  try {
    const stateData = {
      watchers: Array.from(state.watchers.entries()).map(([url, data]) => ({
        url,
        lastCheck: data.lastCheck,
        checkCount: data.checkCount,
        tasksFound: data.tasksFound,
        tasksTriggered: data.tasksTriggered,
        tasks: data.tasks,
      })),
      startTime: state.startTime,
    };
    mkdirSync(join(homedir(), '.leafcli'), { recursive: true });
    writeFileSync(STATE_PATH, JSON.stringify(stateData, null, 2), 'utf-8');
  } catch (err) {
    log.warn(`[task-watcher] Failed to save state: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function loadState(): void {
  try {
    if (!existsSync(STATE_PATH)) return;
    const data = JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
    if (data.watchers) {
      for (const entry of data.watchers) {
        const config = loadConfig(CONFIG_PATH).watchers.find(w => w.url === entry.url);
        if (config) {
          state.watchers.set(entry.url, {
            config,
            lastCheck: entry.lastCheck || 0,
            checkCount: entry.checkCount || 0,
            tasksFound: entry.tasksFound || 0,
            tasksTriggered: entry.tasksTriggered || 0,
            tasks: entry.tasks || [],
          });
        }
      }
    }
  } catch (err) {
    log.warn(`[task-watcher] Failed to load state: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── Start ───────────────────────────────────────────────────────────

function startTaskWatcher(): void {
  const config = loadConfig(CONFIG_PATH);

  // Initialize watchers from config
  for (const watcher of config.watchers) {
    state.watchers.set(watcher.url, {
      config: watcher,
      lastCheck: 0,
      checkCount: 0,
      tasksFound: 0,
      tasksTriggered: 0,
      tasks: [],
    });
  }

  // Load previous state
  loadState();

  // Start checking interval
  checkInterval = setInterval(checkAllWatchers, 5000);
  log.info(`[task-watcher] Started with ${state.watchers.size} watchers`);
}

const httpServer = createServer((req, res) => {
  handleRequest(req, res).catch(() => {
    res.writeHead(500);
    res.end();
  });
});

httpServer.listen(PORT, '127.0.0.1', () => {
  log.info(`[task-watcher] Listening on http://127.0.0.1:${PORT}`);
  startTaskWatcher();
});

httpServer.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    log.error(`[task-watcher] Port ${PORT} already in use. Exiting.`);
    process.exit(EXIT_CODES.SERVICE_UNAVAIL);
  }
  log.error(`[task-watcher] Server error: ${err.message}`);
  process.exit(EXIT_CODES.GENERIC_ERROR);
});

// Graceful shutdown
function shutdown(): void {
  state.running = false;
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  saveState();
  httpServer.close(() => process.exit(EXIT_CODES.SUCCESS));
  setTimeout(() => {
    httpServer.closeIdleConnections?.();
    setTimeout(() => process.exit(EXIT_CODES.SUCCESS), 500).unref();
  }, 100).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);