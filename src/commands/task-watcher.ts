/**
 * CLI commands for Task Watcher:
 *   leafcli task-watcher start   — 启动任务监听守护进程
 *   leafcli task-watcher stop    — 停止守护进程
 *   leafcli task-watcher status  — 查看状态
 *   leafcli task-watcher config  — 配置监听页面
 */

import { spawn } from 'node:child_process';
import { fetch } from 'undici';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { log } from '../logger.js';
import { PKG_VERSION } from '../version.js';
import {
  loadConfig,
  saveConfig,
  addWatcher,
  removeWatcher,
  type WatcherEntry,
} from '../task-watcher-config.js';

const DAEMON_PORT = 19826;
const DAEMON_URL = `http://127.0.0.1:${DAEMON_PORT}`;
const CONFIG_PATH = join(homedir(), '.leafcli', 'task-watcher.json');

/**
 * 启动任务监听守护进程
 */
export async function taskWatcherStart(): Promise<void> {
  // Check if daemon is already running
  const status = await fetchDaemonStatus();
  if (status) {
    log.warn('Task Watcher daemon is already running (PID ${status.pid})');
    log.info('Run `leafcli task-watcher status` to check the current state.');
    return;
  }

  // Start daemon
  log.info('Starting Task Watcher daemon...');

  const proc = spawn('node', [
    join(__dirname, '..', 'task-watcher-daemon.js'),
  ], {
    detached: true,
    stdio: 'ignore',
  });

  proc.unref();

  // Wait for daemon to start
  await sleep(2000);

  const newStatus = await fetchDaemonStatus();
  if (newStatus) {
    log.success(`Task Watcher daemon started (PID ${newStatus.pid})`);
    const config = loadConfig(CONFIG_PATH);
    if (config.watchers.length === 0) {
      log.info('No watchers configured. Run `leafcli task-watcher config add` to add a task page to monitor.');
    } else {
      log.info(`Monitoring ${config.watchers.length} task pages.`);
    }
  } else {
    log.error('Failed to start Task Watcher daemon.');
    process.exitCode = 1;
  }
}

/**
 * 停止任务监听守护进程
 */
export async function taskWatcherStop(): Promise<void> {
  const status = await fetchDaemonStatus();
  if (!status) {
    log.info('Task Watcher daemon is not running.');
    return;
  }

  log.info('Stopping Task Watcher daemon...');

  const ok = await requestDaemonShutdown();
  if (ok) {
    log.success('Task Watcher daemon stopped.');
  } else {
    log.error('Failed to stop Task Watcher daemon.');
    process.exitCode = 1;
  }
}

/**
 * 查看状态
 */
export async function taskWatcherStatus(): Promise<void> {
  const status = await fetchDaemonStatus();
  if (!status) {
    console.log('Task Watcher: not running');
    console.log('\nRun `leafcli task-watcher start` to start the daemon.');
    return;
  }

  console.log(`Task Watcher: running (PID ${status.pid})`);
  console.log(`Version: ${status.daemonVersion || 'unknown'}`);
  console.log(`Uptime: ${Math.round(status.uptime)}s`);
  console.log(`Memory: ${status.memoryMB} MB`);

  if (status.watchers && status.watchers.length > 0) {
    console.log('\nWatchers:');
    for (const watcher of status.watchers) {
      console.log(`  - ${watcher.url}`);
      console.log(`    Checks: ${watcher.checkCount}, Found: ${watcher.tasksFound}, Triggered: ${watcher.tasksTriggered}`);
      console.log(`    Pending tasks: ${watcher.pendingTasks}`);
    }
  } else {
    console.log('\nNo watchers configured.');
  }

  console.log(`\nPort: ${status.port}`);
}

/**
 * 配置监听页面
 */
export async function taskWatcherConfigAdd(
  url: string,
  triggerTemplate: string,
  options: {
    interval?: number;
    targetAI?: string;
    taskSelector?: string;
  }
): Promise<void> {
  const watcher: WatcherEntry = {
    url,
    intervalSeconds: options.interval || 30,
    triggerTemplate,
    targetAI: options.targetAI || 'claude',
    taskSelector: options.taskSelector,
  };

  const added = addWatcher(CONFIG_PATH, watcher);
  if (added) {
    log.success(`Added watcher for ${url}`);

    // If daemon is running, add to running state via HTTP
    const status = await fetchDaemonStatus();
    if (status) {
      try {
        const response = await fetch(`${DAEMON_URL}/watchers/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-leafcli': '1' },
          body: JSON.stringify(watcher),
        });
        const result = await response.json() as any;
        if (result.ok) {
          log.info('Watcher added to running daemon.');
        } else {
          log.warn(`Failed to add to running daemon: ${result.error}`);
        }
      } catch (err) {
        log.warn(`Failed to communicate with daemon: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } else {
    log.warn(`Watcher for ${url} already exists.`);
  }
}

/**
 * 移除监听配置
 */
export async function taskWatcherConfigRemove(url: string): Promise<void> {
  const removed = removeWatcher(CONFIG_PATH, url);
  if (removed) {
    log.success(`Removed watcher for ${url}`);

    // If daemon is running, remove from running state via HTTP
    const status = await fetchDaemonStatus();
    if (status) {
      try {
        const response = await fetch(`${DAEMON_URL}/watchers/remove`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-leafcli': '1' },
          body: JSON.stringify({ url }),
        });
        const result = await response.json() as any;
        if (result.ok) {
          log.info('Watcher removed from running daemon.');
        } else {
          log.warn(`Failed to remove from running daemon: ${result.error}`);
        }
      } catch (err) {
        log.warn(`Failed to communicate with daemon: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } else {
    log.warn(`Watcher for ${url} not found.`);
  }
}

/**
 * 查看配置
 */
export async function taskWatcherConfigList(): Promise<void> {
  const config = loadConfig(CONFIG_PATH);

  if (config.watchers.length === 0) {
    console.log('No watchers configured.');
    console.log('\nRun `leafcli task-watcher config add <url> <template>` to add a watcher.');
    return;
  }

  console.log(`Configured watchers (${config.watchers.length}):`);
  for (const watcher of config.watchers) {
    console.log(`\n  URL: ${watcher.url}`);
    console.log(`  Interval: ${watcher.intervalSeconds}s`);
    console.log(`  Target AI: ${watcher.targetAI}`);
    console.log(`  Template: ${watcher.triggerTemplate.substring(0, 80)}...`);
    if (watcher.taskSelector) {
      console.log(`  Selector: ${watcher.taskSelector}`);
    }
  }
}

// ─── Helper Functions ────────────────────────────────────────────────

async function fetchDaemonStatus(): Promise<any | null> {
  try {
    const response = await fetch(`${DAEMON_URL}/status`, {
      headers: { 'X-leafcli': '1' },
    });
    if (response.status !== 200) return null;
    const data = await response.json() as any;
    return data.ok ? data : null;
  } catch {
    return null;
  }
}

async function requestDaemonShutdown(): Promise<boolean> {
  try {
    const response = await fetch(`${DAEMON_URL}/shutdown`, {
      method: 'POST',
      headers: { 'X-leafcli': '1' },
    });
    const data = await response.json() as any;
    return data.ok === true;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}