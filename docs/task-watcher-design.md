# Task Watcher 设计文档

## 功能概述

创建一个守护进程，定时监听任务页面（如投诉系统、工单系统），发现新任务后自动触发 Claude 执行处理流程。

## 使用场景

- 投诉处理：定时检查新的投诉工单
- 工单处理：自动发现并处理新工单
- 通知监听：实时接收系统通知并响应

## 架构

```
┌─────────────────────────────────────────┐
│   leafcli-task-watcher daemon           │
│   (监听任务页面)                          │
└─────────────────────────────────────────┘
           ↓ 发现新任务
┌─────────────────────────────────────────┐
│   Claude Desktop                         │
│   (接收指令并执行)                        │
└─────────────────────────────────────────┘
```

## 命令设计

### 1. 启动任务监听器

```bash
leafcli task-watcher start
```

启动守护进程，监听配置的任务页面。

### 2. 配置任务监听

```bash
leafcli task-watcher config add <site-url> <trigger-template>
leafcli task-watcher config list
leafcli task-watcher config remove <site-url>
```

配置要监听的页面和触发模板。

示例：
```bash
leafcli task-watcher config add complaint.example.com "发现新的投诉工单: {{title}}，请处理。工单编号: {{id}}"
```

### 3. 查看状态

```bash
leafcli task-watcher status
```

显示当前监听的页面、检查频率、最近发现的任务。

### 4. 停止监听

```bash
leafcli task-watcher stop
```

停止守护进程。

## 配置文件

配置文件位于 `~/.leafcli/task-watcher.json`：

```json
{
  "watchers": [
    {
      "url": "https://complaint.example.com",
      "intervalSeconds": 30,
      "triggerTemplate": "发现新的投诉工单: {{title}}，请处理。工单编号: {{id}}",
      "targetAI": "claude",
      "taskSelector": ".task-item-new",
      "taskFields": {
        "id": ".task-id",
        "title": ".task-title",
        "priority": ".task-priority"
      },
      "filters": {
        "priority": ["high", "medium"],
        "status": ["pending"]
      }
    }
  ],
  "settings": {
    "daemonPort": 19826,
    "logLevel": "info",
    "maxRetries": 3,
    "cooldownSeconds": 10
  }
}
```

## 实现组件

### 1. Task Watcher Daemon (`src/task-watcher-daemon.ts`)

独立守护进程，监听 HTTP 端口 19826，提供：
- `/status` - 查看当前状态
- `/watchers` - 查看监听配置
- `/tasks` - 查看发现的任务
- `/shutdown` - 停止守护进程

### 2. Task Checker (`src/task-checker.ts`)

定时检查任务页面的逻辑：
- 使用 `leafcli browser` 打开页面
- 获取任务列表 DOM
- 提取新任务（对比上次状态）
- 触发 AI

### 3. Trigger Engine (`src/trigger-engine.ts`)

触发 Claude 执行：
- 调用 `leafcli claude ask <prompt>`
- 支持自定义模板
- 处理执行结果

### 4. 配置管理 (`src/task-watcher-config.ts`)

管理监听配置：
- 添加/删除监听页面
- 更新检查频率
- 配置触发模板

## 工作流程

1. 启动守护进程
2. 根据配置，定时打开任务页面
3. 获取任务列表 DOM，提取任务信息
4. 对比上次状态，识别新任务
5. 使用模板生成触发指令
6. 调用 Claude 执行指令
7. 记录执行结果，等待下一个检查周期

## 与现有 Daemon 的关系

- Task Watcher Daemon 是**独立的守护进程**（端口 19826）
- 不与现有的 Browser Daemon（端口 19825）冲突
- Task Watcher 使用 Browser Daemon 来操作浏览器

## 扩展性

支持多种 AI 目标：
- Claude Desktop
- Claude.ai
- TRAE IDE
- Cursor
- 其他 AI 工具

支持多种任务检测方式：
- WebSocket 监听
- DOM 轮询
- API 接口
- 网络拦截