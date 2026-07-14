/**
 * Task Watcher 配置管理
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface WatcherEntry {
  url: string;
  intervalSeconds: number;
  triggerTemplate: string;
  targetAI: string;
  taskSelector?: string;
  taskFields?: Record<string, string>;
  filters?: Record<string, string[]>;
}

export interface TaskWatcherConfig {
  watchers: WatcherEntry[];
  settings?: {
    daemonPort?: number;
    logLevel?: string;
    maxRetries?: number;
    cooldownSeconds?: number;
  };
}

const DEFAULT_CONFIG: TaskWatcherConfig = {
  watchers: [],
  settings: {
    daemonPort: 19826,
    logLevel: 'info',
    maxRetries: 3,
    cooldownSeconds: 10,
  },
};

/**
 * 加载配置文件
 */
export function loadConfig(path: string): TaskWatcherConfig {
  try {
    if (!existsSync(path)) {
      // Create default config
      const leafcliDir = join(homedir(), '.leafcli');
      mkdirSync(leafcliDir, { recursive: true });
      writeFileSync(path, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
      return DEFAULT_CONFIG;
    }

    const content = readFileSync(path, 'utf-8');
    const config = JSON.parse(content);

    // Merge with defaults
    return {
      watchers: config.watchers || [],
      settings: {
        ...DEFAULT_CONFIG.settings,
        ...config.settings,
      },
    };
  } catch (err) {
    console.warn(`Failed to load config: ${err instanceof Error ? err.message : String(err)}`);
    return DEFAULT_CONFIG;
  }
}

/**
 * 保存配置文件
 */
export function saveConfig(path: string, config: TaskWatcherConfig): void {
  try {
    const leafcliDir = join(homedir(), '.leafcli');
    mkdirSync(leafcliDir, { recursive: true });
    writeFileSync(path, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.warn(`Failed to save config: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * 添加监听配置
 */
export function addWatcher(path: string, watcher: WatcherEntry): boolean {
  const config = loadConfig(path);
  const existing = config.watchers.find(w => w.url === watcher.url);
  if (existing) return false;

  config.watchers.push(watcher);
  saveConfig(path, config);
  return true;
}

/**
 * 移除监听配置
 */
export function removeWatcher(path: string, url: string): boolean {
  const config = loadConfig(path);
  const index = config.watchers.findIndex(w => w.url === url);
  if (index === -1) return false;

  config.watchers.splice(index, 1);
  saveConfig(path, config);
  return true;
}