---
name: leafcli-task-watcher
description: 持续监听任务页面（投诉系统、工单系统、通知页面等），自动检测新任务并触发 Claude 处理。适用于需要实时响应的场景，如客服投诉处理、工单分派、订单监控等。
allowed-tools: Bash(leafcli:*), Read, Write
---

# leafcli-task-watcher

这是一个**任务监听器**，帮助您持续关注网页上的任务变化，一旦发现新任务就自动通知 Claude 进行处理。

## 核心功能

1. **实时监听**：持续监控指定网页的任务列表
2. **智能检测**：自动识别新任务、状态变化
3. **自动触发**：发现新任务时自动调用 Claude Code
4. **灵活配置**：支持多种任务源和触发条件

## 典型应用场景

- **客服投诉系统**：监听投诉列表，有新投诉自动处理
- **工单系统**：监控新工单，自动分配或处理
- **订单管理**：实时跟踪订单状态变化
- **通知中心**：自动处理重要通知消息

## 快速开始

### 1. 基础监听

```bash
# 监听指定页面的任务列表
leafcli task-watcher start <url> --interval 30
```

### 2. 配置监听规则

创建配置文件 `~/.leafcli/task-watcher.yaml`：

```yaml
watchers:
  - name: "投诉处理"
    url: "https://example.com/complaints"
    interval: 60  # 检查间隔（秒）
    trigger:
      - type: "new_item"
      - type: "status_change"
        from: "pending"
        to: "urgent"
    action: "claude"  # 触发 Claude 处理
    template: "有新的投诉需要处理：{title}"

  - name: "工单监控"
    url: "https://example.com/tickets"
    interval: 120
    trigger:
      - type: "new_item"
    action: "claude"
    template: "发现新工单：{id} - {title}"
```

### 3. 启动监听服务

```bash
# 启动单个监听器
leafcli task-watcher start "https://example.com/complaints" --name "投诉处理"

# 启动所有配置的监听器
leafcli task-watcher start-all

# 查看监听状态
leafcli task-watcher status

# 停止监听
leafcli task-watcher stop <name>
```

## 工作流程

1. **初始化**：加载配置，建立监听任务
2. **页面抓取**：定期访问目标页面，提取任务列表
3. **变化检测**：对比上次结果，识别新任务或状态变化
4. **触发通知**：符合条件时调用 Claude Code
5. **持续运行**：循环监听，直到手动停止

## 任务检测规则

### 支持的触发类型

| 类型 | 描述 | 配置示例 |
|------|------|---------|
| `new_item` | 检测新任务 | `trigger: [{type: "new_item"}]` |
| `status_change` | 状态变化 | `trigger: [{type: "status_change", from: "pending", to: "urgent"}]` |
| `keyword_match` | 关键词匹配 | `trigger: [{type: "keyword_match", keywords: ["紧急", "重要"]}]` |
| `threshold` | 数量阈值 | `trigger: [{type: "threshold", count: 10}]` |

### 任务提取模式

使用 CSS 选择器或 XPath 提取任务信息：

```yaml
extraction:
  items_selector: ".task-list .task-item"
  fields:
    id: ".task-id"
    title: ".task-title"
    status: ".task-status"
    priority: ".task-priority"
    time: ".task-time"
```

## Claude 触发方式

### 方式1：直接调用 Claude Code

```bash
# 自动打开 Claude Code 并发送消息
claude "发现新投诉，请查看：{url}"
```

### 方式2：通过 API 触发

```yaml
action:
  type: "api"
  endpoint: "http://localhost:3000/api/claude/trigger"
  method: "POST"
  body:
    message: "有新任务需要处理"
    context: "{task_details}"
```

### 方式3：写入通知文件

```yaml
action:
  type: "file"
  path: "~/.claude/notifications.txt"
  format: "[{timestamp}] {message}"
```

## 高级配置

### 1. 过滤规则

```yaml
filters:
  - field: "priority"
    operator: "equals"
    value: "high"
  - field: "status"
    operator: "not_equals"
    value: "closed"
```

### 2. 批处理

```yaml
batch:
  enabled: true
  size: 5  # 累积5个任务后一起处理
  timeout: 300  # 或等待5分钟后处理
```

### 3. 失败重试

```yaml
retry:
  max_attempts: 3
  delay: 60
  backoff: exponential
```

## 监控和日志

### 查看日志

```bash
# 实时日志
leafcli task-watcher logs --follow

# 查看历史日志
leafcli task-watcher logs --since "2024-01-01"

# 过滤日志
leafcli task-watcher logs --filter "投诉处理"
```

### 统计信息

```bash
# 监听统计
leafcli task-watcher stats

# 导出报告
leafcli task-watcher report --output report.json
```

## 最佳实践

### 1. 合理设置检查间隔

- **高频任务**（如客服投诉）：30-60秒
- **中频任务**（如工单系统）：60-120秒
- **低频任务**（如周报通知）：300-600秒

### 2. 精确的触发条件

避免过于宽泛的触发条件，减少误报：

```yaml
# 好的配置
trigger:
  - type: "new_item"
    filters:
      - field: "priority"
        value: "high"
      - field: "category"
        value: "投诉"

# 不好的配置（过于宽泛）
trigger:
  - type: "new_item"  # 任何新任务都触发
```

### 3. 处理失败的情况

配置失败处理策略：

```yaml
on_failure:
  action: "notify"
  message: "任务处理失败，请人工介入"
  retry: true
  max_retry: 3
```

### 4. 性能优化

- 使用增量检测（只检查变化部分）
- 合理设置并发监听器数量
- 避免在高峰时段执行高频检查

## 故障排查

### 常见问题

1. **监听器启动失败**
   - 检查 URL 是否可访问
   - 验证选择器配置是否正确
   - 查看日志中的错误信息

2. **任务检测不准确**
   - 调整选择器配置
   - 检查页面结构是否变化
   - 增加调试日志输出

3. **Claude 触发失败**
   - 确认 Claude Code 已正确安装
   - 检查 API 端点是否可用
   - 验证通知权限配置

### 调试模式

```bash
# 启用调试日志
leafcli task-watcher start <url> --debug

# 输出详细检测信息
leafcli task-watcher start <url> --verbose
```

## 安全建议

1. **访问控制**：限制监听器的访问权限
2. **敏感信息**：避免在配置中存储明文密码
3. **频率限制**：避免过于频繁的请求导致封禁
4. **数据隐私**：妥善处理任务中的敏感信息

## 相关 Skills

- **leafcli-browser**：用于页面交互和数据提取
- **leafcli-adapter-author**：为目标网站创建适配器
- **smart-search**：智能路由任务处理请求

## 更新日志

查看最新功能和修复：`leafcli task-watcher changelog`