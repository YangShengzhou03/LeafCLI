---
description: How to automate Antigravity using leafcli
---

# Antigravity Automation Skill

This skill allows AI agents to control the [Antigravity](https://github.com/chengazhen/Antigravity) desktop app (and any Electron app with CDP enabled) programmatically via leafcli. 

## Requirements
leafcli automatically detects, launches (with `--remote-debugging-port=9234`), and connects to Antigravity.
If Antigravity is already running without CDP, leafcli will prompt to restart it.

If the endpoint exposes multiple inspectable targets, set:
\`\`\`bash
export leafcli_CDP_TARGET="antigravity"
\`\`\`

## High-Level Capabilities
1. **Send Messages (`leafcli antigravity send <message>`)**: Type and send a message directly into the chat UI.
2. **Read History (`leafcli antigravity read`)**: Scrape the raw chat transcript from the main UI container.
3. **Extract Code (`leafcli antigravity extract-code`)**: Automatically isolate and extract source code text blocks from the AI's recent answers.
4. **Switch Models (`leafcli antigravity model <name>`)**: Instantly toggle the active LLM (e.g., \`gemini\`, \`claude\`).
5. **Clear Context (`leafcli antigravity new`)**: Start a fresh conversation.

## Examples for Automated Workflows

### Generating and Saving Code
\`\`\`bash
leafcli antigravity send "Write a python script to fetch HN top stories"
# wait ~10-15 seconds for output to render
leafcli antigravity extract-code > hn_fetcher.py
\`\`\`

### Reading Real-time Logs
Agents can run long-running streaming watch instances:
\`\`\`bash
leafcli antigravity watch
\`\`\`
