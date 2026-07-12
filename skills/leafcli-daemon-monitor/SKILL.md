---
name: leafcli-daemon-monitor
description: Daemon process for continuously monitoring task pages (complaint systems, work order systems, ticket systems). Checks every 1-5 minutes, notifies Claude when pending items appear. Ideal for dispatch-style systems with unpredictable task arrival times.
allowed-tools: Bash(leafcli:*), Read, Write, RunCommand
---

# leafcli-daemon-monitor

This skill creates a **daemon process** that continuously monitors task pages (complaint systems, work order systems, etc.) and notifies Claude when pending items are detected.

---

## Typical Use Case

You just need to say one sentence:

> "This website is our complaint handling system, pending complaints are what I need to handle. Please keep monitoring it, check every 5 minutes."

Typical scenarios:

- **Customer service**: Buyer comes to consult → auto-trigger Claude to respond
- **Complaint handling**: New complaint appears → auto-trigger Claude to process
- **Engineer**: New work order assigned → auto-trigger Claude to pick up
- **Notification monitoring**: System notification received → auto-trigger response

---

## Quick Start

### 1. Start Daemon Monitor

```bash
# Basic monitoring (1 minute interval)
leafcli daemon-monitor start complaint.example.com --interval 60

# Advanced monitoring with Claude notification
leafcli daemon-monitor start complaint.example.com \
  --interval 60 \
  --trigger "待处理" \
  --notify claude \
  --message "发现待处理工单，请查看处理"
```

### 2. Daemon Configuration

Create configuration file `~/.leafcli/daemon-monitor.yaml`:

```yaml
monitors:
  - name: "Complaint System"
    url: "https://complaint.example.com"
    type: websocket  # WebSocket-based site
    interval: 60  # Check every 1 minute

    # Detection rules
    detection:
      - type: "keyword"
        pattern: "待处理"
      - type: "list_change"
        selector: ".ticket-list"

    # Notification
    notification:
      target: "claude"
      method: "message"  # Send message to Claude
      template: "发现待处理工单：{tickets}"
      include_details: true

    # Daemon options
    daemon:
      persistent: true  # Keep running after restart
      log_file: "~/.leafcli/logs/complaint-monitor.log"
      pid_file: "~/.leafcli/daemon/complaint.pid"
```

### 3. Control Daemon

```bash
# Start all configured monitors
leafcli daemon-monitor start-all

# Check daemon status
leafcli daemon-monitor status

# View logs
leafcli daemon-monitor logs --follow

# Stop specific monitor
leafcli daemon-monitor stop complaint

# Stop all monitors
leafcli daemon-monitor stop-all
```

---

## Daemon Architecture

### Process Structure

```
leafcli daemon-monitor (主进程)
  ├─ Monitor Worker 1 (complaint.example.com)
  │   ├─ WebSocket Connection
  │   ├─ State Tracker
  │   └─ Notification Handler
  ├─ Monitor Worker 2 (workorder.example.com)
  │   ├─ WebSocket Connection
  │   ├─ State Tracker
  │   └─ Notification Handler
  └─ Daemon Controller
      ├─ Health Check
      ├─ Process Management
      └─ Log Aggregation
```

### Workflow

1. **Initialization**: Load config, create daemon process
2. **WebSocket Connection**: Establish persistent connection to target site
3. **State Tracking**: Monitor page content changes
4. **Detection**: Check for pending tickets every interval
5. **Notification**: Trigger Claude when tickets appear
6. **Logging**: Record all activities and detections
7. **Health Check**: Ensure daemon keeps running

---

## Detection Methods

### 1. Keyword Detection

Detect specific keywords like "待处理":

```yaml
detection:
  - type: "keyword"
    pattern: "待处理"
    negate: false  # Trigger when keyword appears
```

### 2. List Change Detection

Detect changes in ticket list:

```yaml
detection:
  - type: "list_change"
    selector: ".ticket-list"
    compare_with: "previous_state"
```

### 3. State Change Detection

Monitor page state transitions:

```yaml
detection:
  - type: "state_change"
    from: "无待处理工单"
    to: "有待处理工单"
```

---

## Notification Options

### 1. Claude Message

Send message directly to Claude Code:

```yaml
notification:
  target: "claude"
  method: "message"
  template: "发现待处理工单：{count}个"
```

### 2. File Notification

Write to notification file:

```yaml
notification:
  target: "file"
  path: "~/.claude/notifications.txt"
  format: "[{timestamp}] {message}"
```

### 3. API Trigger

Call Claude via API:

```yaml
notification:
  target: "api"
  endpoint: "http://localhost:3000/api/claude"
  method: "POST"
  body:
    message: "待处理工单通知"
```

---

## Interval Settings

Recommended intervals for different scenarios:

- **High-frequency tasks**: 60 seconds (1 minute)
- **Medium-frequency tasks**: 120-300 seconds (2-5 minutes)
- **Low-frequency tasks**: 600 seconds (10 minutes)

---

## Daemon Management

### Auto-restart

Configure daemon to restart automatically:

```yaml
daemon:
  auto_restart: true
  max_restart_attempts: 5
  restart_delay: 30
```

### Health Check

Periodic health checks:

```yaml
daemon:
  health_check:
    interval: 300
    timeout: 10
    on_failure: "restart"
```

### Resource Management

Limit resource usage:

```yaml
daemon:
  max_memory: "100MB"
  max_cpu: "10%"
  log_rotation: "daily"
```

---

## WebSocket Handling

Special considerations for WebSocket-based sites:

### Connection Management

```yaml
websocket:
  reconnect_on_disconnect: true
  ping_interval: 30
  max_reconnect_attempts: 10
  reconnect_delay: 5
```

### State Persistence

```yaml
websocket:
  state_storage: "~/.leafcli/state/{site}/last_state.json"
  compare_method: "snapshot"
```

---

## Logging

### Log Levels

```bash
# Verbose logging
leafcli daemon-monitor start --log-level debug

# Normal logging
leafcli daemon-monitor start --log-level info

# Quiet mode (errors only)
leafcli daemon-monitor start --log-level error
```

### Log Content

Logs include:
- Connection status
- Detection results
- Notification events
- Error messages
- Performance metrics

---

## Troubleshooting

### Common Issues

#### Daemon Won't Start
- Check WebSocket connection
- Verify URL accessibility
- Review configuration syntax
- Check log files for errors

#### Detection Not Working
- Adjust detection patterns
- Increase check interval
- Verify WebSocket data format
- Add debug logging

#### Claude Not Notified
- Check notification method
- Verify Claude Code running
- Test notification manually
- Review message template

### Debug Mode

```bash
# Enable debug logging
leafcli daemon-monitor start --debug

# Test detection manually
leafcli daemon-monitor test-detection complaint.example.com

# Test notification
leafcli daemon-monitor test-notification claude
```

---

## Example: Complete Configuration

```yaml
monitors:
  - name: "Complaint Monitor"
    url: "https://complaint.example.com"
    type: websocket

    interval: 60  # Check every minute

    detection:
      - type: "keyword"
        pattern: "待处理"
      - type: "list_change"
        selector: ".ticket-list"

    notification:
      target: "claude"
      method: "message"
      template: "发现待处理工单，请及时处理"
      include_details: true

    daemon:
      persistent: true
      auto_restart: true
      log_file: "~/.leafcli/logs/complaint.log"
```

---

## Related Skills

- **leafcli-browser**: Navigate and interact with websites
- **leafcli-sitemap-author**: Create site navigation maps
- **leafcli-adapter-author**: Build site-specific adapters

---

## Security Notes

- Daemon runs locally, no external data transmission
- Uses existing browser login session
- Logs stored locally only
- Can be stopped at any time

---

**Usage Pattern**: User specifies site → Daemon monitors → Pending tasks detected → Claude notified automatically
