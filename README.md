# LeafCLI

[![npm version](https://img.shields.io/npm/v/@yangshengzhou/leafcli?style=flat-square&logo=npm)](https://www.npmjs.com/package/@yangshengzhou/leafcli) [![Node.js Version](https://img.shields.io/node/v/@yangshengzhou/leafcli?style=flat-square&logo=node.js)](https://nodejs.org) [![GitHub stars](https://img.shields.io/github/stars/YangShengzhou03/LeafCLI?style=flat-square&logo=github)](https://github.com/YangShengzhou03/LeafCLI/stargazers)

**让 AI 帮你操作浏览器，一句话搞定重复操作。**

---

## 它能做什么

你有没有过这样的经历——每天打开同一个网站，看看有没有新消息，有没有新的东西要处理，然后发现大部分时间都是白等？

LeafCLI 就是来解决这个问题的。

你只需要告诉 AI 一句话，它就会帮你盯着那个页面，有新情况了自动处理。

比如说，你是个客服，每天要盯着后台看有没有买家来问问题。以前你得自己一遍一遍刷新。

现在你只需要说一句：

> "这个网站是我们的客服系统，有买家来咨询就是我需要处理的。你帮我持续关注，每5分钟看一次。"

然后你就可以去忙别的事了。有买家来问的时候，Claude 会自动帮你处理。

再比如你是做投诉处理的，不用整天盯着屏幕等投诉进来。

跟 AI 说一声，它就帮你盯着，有新的投诉进来了自动处理。

工程师也一样，不用老刷工单系统。

跟 AI 说一声，有新的工单派过来了它自动帮你接。

说到底就一句话的事：**告诉 AI 你要盯什么、什么情况算需要处理，剩下的交给它。**

---

## 除了盯任务，还能干嘛

当然，LeafCLI 不只能盯任务。你还可以用它来：

- 浏览技术新闻——"帮我看看 Hacker News 今天有什么热门文章"
- 批量下载图片——"帮我下载这个小红书笔记的所有图片"
- 查看社交媒体——"帮我看看知乎热榜"
- 价格监控、舆情分析，等等

总之，凡是你需要打开浏览器去做的重复操作，都可以一句话交给 AI。

---

## 支持 100+ 网站

国内国外主流平台基本都支持：

- **国内**：小红书、知乎、微博、B站、抖音、闲鱼、淘宝、京东、豆瓣
- **国外**：Twitter/X、Reddit、Hacker News、LinkedIn、Instagram、YouTube、GitHub
- **桌面应用**：Claude Desktop、Cursor、ChatGPT、豆包

---

## 快速安装

### 方式一：自动安装（推荐）

**Windows 用户**直接下载 `leafcli-install.exe` 双击运行即可。

也可以用 Python 运行安装脚本：

```powershell
python install.py
```

### 方式二：手动安装

**1. 安装 Node.js 20+**

访问 https://nodejs.org/ 下载安装

**2. 安装 LeafCLI**

```powershell
npm install -g @yangshengzhou/leafcli
```

**3. 安装浏览器扩展**

Chrome 应用商店搜索 "leafcli" 或访问：
https://chromewebstore.google.com/detail/leafcli/ildkmabpimmkaediidaifkhjpohdnifk

**4. 安装 Claude Code（可选）**

```powershell
npm install -g claude-code
npx skills add https://gitee.com/Yangshengzhou/leaf-cli.git --all --yes -g
```

---

## 怎么用

### 配合 Claude Code（推荐）

打开 Claude Code，直接说人话就行：

```
帮我看看 Hacker News 今天有什么热门文章
帮我下载这个小红书笔记的所有图片
```

要做任务监控的话，就说类似这样的话：

```
这个网站是我们的投诉处理系统，出现待处理的投诉就是我需要处理的。你帮我持续关注，每5分钟看一次。
```

就这样，不用写代码，不用配什么复杂的东西。

### 命令行使用

如果你更喜欢命令行：

```powershell
# 查看所有支持的网站和命令
leafcli list

# 查看 Hacker News 热门
leafcli hackernews top --limit 5

# 查看守护进程状态
leafcli doctor
```

---

## 常见问题

### 安装问题

**npm 安装很慢？**

换个镜像源：

```powershell
npm config set registry https://registry.npmmirror.com
```

**Node.js 版本太低？**

需要 Node.js 20+，去 nodejs.org 下载新版本就行。

**权限错误？**

以管理员权限运行 PowerShell。

### 使用问题

**浏览器扩展连不上？**

先确认 Chrome 打开了、扩展启用了，然后跑一下 `leafcli doctor` 看看哪里有问题。

**需要登录的网站？**

在浏览器里手动登录一次就行，LeafCLI 会自动用你的登录状态。

**下载速度慢？**

有些网站本身会限速，LeafCLI 会自动调整。也可以降低并发数试试。

**任务监控没反应？**

检查一下你跟 AI 说的那句话，是不是把"什么网站"和"什么情况算需要处理"都说清楚了。也可以调一下检查间隔，或者看看日志排查问题。

### 安全问题

**数据安全吗？**

所有操作都在你本地进行，不会往上传数据。用的是你自己浏览器的登录状态，不会碰你的密码。

**会封号吗？**

LeafCLI 自带防封机制，会控制访问速度、模拟正常用户行为。正常使用不会有问题，别搞那种几百次疯狂访问就行。

---

## 技术栈

- TypeScript 6.0 / Node.js 20+ / Chrome Extension / WebSocket / AI Skills

---

## 文档

- [安装指南](./docs/INSTALL-GUIDE.md)
- [任务监听用法](./docs/task-watcher-usage.md)
- [技术设计文档](./docs/task-watcher-design.md)

---

## 支持

- **问题反馈**：https://github.com/YangShengzhou03/LeafCLI/issues
- **命令帮助**：`leafcli <command> --help`

---

## 许可证

[Apache-2.0](./LICENSE)

---

**安装 → 打开 Claude Code → 说句话 → 自动完成**
