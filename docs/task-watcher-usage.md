# Task Watcher 使用指南

## 功能简介

Task Watcher 是 leafcli 的一个守护进程，用于**定时监听任务页面**（如投诉处理、工单处理），发现新任务后**自动触发 Claude 执行处理流程**。

## 适用场景

你只需要一句话就能启动监控：

> "这个网站是我们的客服系统，有买家来咨询就是我需要处理的。你帮我持续关注，每5分钟看一次。"

典型场景：

- **客服**：有买家来咨询时，自动触发 Claude 回复
- **投诉处理**：出现新的投诉时，自动触发 Claude 处理
- **工程师**：有工单派过来时，自动触发 Claude 接单
- **通知监听**：收到系统通知时，自动触发响应
- **任务调度**：定时检查任务队列，有新任务自动执行

## 快速开始

### 1. 启动守护进程

```bash
leafcli task-watcher start
```

启动后，守护进程会在后台运行（端口 19826），定时检查配置的任务页面。

### 2. 配置监听页面

```bash
leafcli task-watcher config add <url> <trigger-template>
```

示例：

```bash
leafcli task-watcher config add complaint.example.com "发现新的投诉工单: {{title}}，请处理。工单编号: {{id}}"
```

参数说明：
- `<url>`：任务页面的 URL（如 `complaint.example.com`）
- `<trigger-template>`：触发模板，支持占位符：
  - `{{id}}`：任务 ID
  - `{{title}}`：任务标题
  - `{{priority}}`：任务优先级
  - `{{status}}`：任务状态
  - 其他自定义字段

可选参数：
- `--interval <seconds>`：检查间隔（默认 30 秒）
- `--target-ai <ai>`：目标 AI（默认 `claude`）
- `--selector <css>`：CSS 选择器，指定任务元素

### 3. 查看状态

```bash
leafcli task-watcher status
```

显示：
- 守护进程 PID、版本、运行时间
- 监听的页面列表
- 发现的任务数量
- 已触发 Claude 的次数

### 4. 查看配置

```bash
leafcli task-watcher config list
```

显示所有配置的任务监听页面。

### 5. 移除监听

```bash
leafcli task-watcher config remove <url>
```

移除指定 URL 的监听配置。

### 6. 停止守护进程

```bash
leafcli task-watcher stop
```

停止后台运行的守护进程。

## 工作原理

```
┌─────────────────────────────────────────┐
│   Task Watcher Daemon (端口 19826)      │
│   - 定时检查配置的任务页面                │
│   - 发现新任务后提取信息                  │
│   - 使用模板生成触发指令                  │
└─────────────────────────────────────────┘
           ↓ 检查任务页面
┌─────────────────────────────────────────┐
│   Chrome Browser (通过 Browser Daemon)  │
│   - 打开 complaint.example.com          │
│   - 获取任务列表 DOM                     │
│   - 提取新任务信息                       │
└─────────────────────────────────────────┘
           ↓ 发现新任务
┌─────────────────────────────────────────┐
│   Claude Desktop / Claude.ai            │
│   - 接收指令："处理投诉 #12345"          │
│   - 自动执行处理流程                     │
│   - 返回处理结果                         │
└─────────────────────────────────────────┘
```

## 配置文件

配置文件位于：`~/.leafcli/task-watcher.json`

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

## 状态文件

状态文件位于：`~/.leafcli/task-watcher-state.json`

记录：
- 已发现的任务列表
- 任务首次发现时间
- 是否已触发 Claude
- 触发时间

## 示例流程

### 投诉处理场景

1. 启动守护进程：
   ```bash
   leafcli task-watcher start
   ```

2. 配置投诉页面监听：
   ```bash
   leafcli task-watcher config add complaint.example.com "发现新的投诉工单: {{title}}，优先级: {{priority}}，请立即处理。工单编号: {{id}}" --interval 60
   ```

3. 查看状态：
   ```bash
   leafcli task-watcher status
   ```

4. 守护进程自动工作：
   - 每 60 秒检查 `complaint.example.com` 页面
   - 发现新的投诉工单（如 "工单 #12345: 客户投诉产品质量"）
   - 提取工单信息（ID: 12345, Title: 客户投诉产品质量, Priority: high）
   - 生成触发指令："发现新的投诉工单: 客户投诉产品质量，优先级: high，请立即处理。工单编号: 12345"
   - 调用 `leafcli claude ask` 发送给 Claude
   - Claude 自动处理投诉

### 工单处理场景

```bash
leafcli task-watcher config add work-order.example.com "新工单: {{title}}, 类型: {{type}}, 请分配处理" --selector ".work-order-item"
```

## 高级配置

### 自定义任务字段

如果任务页面有自定义字段，可以通过 `taskFields` 配置提取：

```json
{
  "taskFields": {
    "id": ".task-id",
    "title": ".task-title",
    "type": ".task-type",
    "assignee": ".task-assignee",
    "dueDate": ".task-due-date"
  }
}
```

在模板中使用：
```bash
"新工单: {{title}}, 类型: {{type}}, 负责人: {{assignee}}, 截止日期: {{dueDate}}"
```

### 过滤条件

只触发符合特定条件的任务：

```json
{
  "filters": {
    "priority": ["high", "medium"],
    "status": ["pending", "new"],
    "type": ["complaint", "urgent"]
  }
}
```

### 多页面监听

可以配置多个监听页面：

```bash
leafcli task-watcher config add complaint.example.com "投诉: {{title}}"
leafcli task-watcher config add work-order.example.com "工单: {{title}}"
leafcli task-watcher config add notifications.company.com "通知: {{content}}"
```

## 常见问题

### Q: 守护进程启动后没有发现任务？

A: 检查：
1. 是否配置了监听页面：`leafcli task-watcher config list`
2. 页面是否可访问：用浏览器打开 URL
3. CSS 选择器是否正确：`--selector` 参数
4. 检查频率是否合适：`--interval` 参数

### Q: 触发 Claude 失败？

A: 检查：
1. Claude Desktop 是否运行
2. 是否登录 Claude
3. `leafcli claude ask` 是否能正常工作

### Q: 如何测试？

A: 手动添加一个测试任务到页面，观察是否触发 Claude。也可以查看日志：

```bash
# 查看守护进程状态（包含最近发现的任务）
leafcli task-watcher status

# 查看 Browser Daemon 日志
leafcli daemon logs
```

### Q: 如何停止特定监听？

A:
```bash
leafcli task-watcher config remove complaint.example.com
```

守护进程会自动停止监听该页面。

## 与现有架构的关系

Task Watcher Daemon **独立运行**（端口 19826），不与 Browser Daemon（端口 19825）冲突。

Task Watcher **使用** Browser Daemon 来操作浏览器：
- Task Watcher → 调用 Browser Daemon → 打开页面、获取 DOM
- Task Watcher → 调用 Claude → 发送指令、触发处理

## 未来扩展

支持更多目标 AI：
- TRAE IDE
- Cursor
- Windsurf
- 其他 AI 工具

支持更多任务检测方式：
- WebSocket 实时监听
- API 接口轮询
- 邮件监听
- 消息队列集成

## 技术细节

详见设计文档：[task-watcher-design.md](./task-watcher-design.md)