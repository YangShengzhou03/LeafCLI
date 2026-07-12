/**
 * Trigger Engine - 触发 AI 执行任务
 *
 * 调用 leafcli claude ask 发送指令
 */

import { spawn } from 'node:child_process';
import { log } from './logger.js';
import type { WatcherEntry } from './task-watcher-config.js';
import type { TaskInfo } from './task-checker.js';

interface TriggerResult {
  ok: boolean;
  response?: string;
  error?: string;
}

/**
 * 触发 Claude 执行任务
 */
export async function triggerClaude(config: WatcherEntry, task: TaskInfo): Promise<TriggerResult> {
  try {
    // Build prompt from template
    const prompt = buildPrompt(config.triggerTemplate, task);

    log.info(`[trigger] Sending to Claude: ${prompt}`);

    // Call leafcli claude ask
    const result = await runClaudeAsk(prompt, config.targetAI);

    if (result.ok) {
      log.success(`[trigger] Claude response: ${result.response?.substring(0, 100)}...`);
    } else {
      log.error(`[trigger] Claude failed: ${result.error}`);
    }

    return result;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 从模板构建提示词
 */
function buildPrompt(template: string, task: TaskInfo): string {
  let prompt = template;

  // Replace placeholders
  prompt = prompt.replace(/\{\{id\}\}/g, task.id);
  prompt = prompt.replace(/\{\{title\}\}/g, task.title || 'Unknown');
  prompt = prompt.replace(/\{\{priority\}\}/g, task.priority || 'normal');
  prompt = prompt.replace(/\{\{status\}\}/g, task.status || 'pending');

  // Replace custom fields
  if (task.data) {
    for (const [key, value] of Object.entries(task.data)) {
      prompt = prompt.replace(/\{\{${key}\}\}/g, value);
    }
  }

  return prompt;
}

/**
 * 运行 leafcli claude ask 命令
 */
async function runClaudeAsk(prompt: string, targetAI: string): Promise<TriggerResult> {
  // Determine which AI to use
  let command = 'claude';
  let args: string[];

  if (targetAI === 'claude' || targetAI === 'claude-desktop') {
    command = 'claude';
    args = ['ask', prompt, '--timeout', '300'];
  } else if (targetAI === 'trae') {
    // TRAE IDE integration
    // TODO: Implement TRAE trigger
    return { ok: false, error: 'TRAE integration not implemented yet' };
  } else if (targetAI === 'cursor') {
    // Cursor integration
    // TODO: Implement Cursor trigger
    return { ok: false, error: 'Cursor integration not implemented yet' };
  } else {
    return { ok: false, error: `Unknown target AI: ${targetAI}` };
  }

  return new Promise((resolve) => {
    const proc = spawn(`leafcli`, [command, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ ok: true, response: stdout });
      } else {
        resolve({ ok: false, error: stderr || `Command failed with code ${code}` });
      }
    });

    proc.on('error', (err) => {
      resolve({ ok: false, error: err.message });
    });
  });
}

export { TriggerResult };