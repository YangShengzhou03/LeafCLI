# LeafCLI 安装指南

## 快速安装（推荐新手）

### 方式1：使用安装引导程序

**Windows 用户：**
- 双击运行 `install-wizard.exe`（后期打包）
- 或运行 `python install-wizard.py`

安装引导程序会自动：
1. 检查 Node.js 环境
2. 检查 npm
3. 安装 leafcli
4. 配置 Claude Desktop
5. 安装 Skills

**全程傻瓜式操作，适合新手用户！**

### 方式2：手动安装

如果安装引导程序无法运行，可以手动安装：

#### 第一步：安装 Node.js

1. 访问 https://nodejs.org/
2. 下载 **LTS 版本**（长期支持版）
3. 运行安装程序
4. 安装完成后，打开命令提示符输入：
   ```bash
   node --version
   ```
   应显示类似 `v20.10.0`（版本号 >= 20）

#### 第二步：安装 leafcli

打开命令提示符（PowerShell 或 cmd），输入：
```bash
npm install -g @yangshengzhou/leafcli
```

等待几分钟，安装完成。

#### 第三步：安装浏览器扩展

1. 打开 Chrome 浏览器
2. 访问 Chrome 应用商店：https://chromewebstore.google.com/detail/leafcli/ildkmabpimmkaediidaifkhjpohdnifk
3. 点击 "添加至 Chrome"

#### 第四步：验证安装

在命令提示符输入：
```bash
leafcli doctor
```

如果显示 "OK"，说明安装成功！

## 快速上手

### 基础使用

**查看所有命令：**
```bash
leafcli list
```

**查看 Hacker News 热门文章：**
```bash
leafcli hackernews top --limit 5
```

**下载小红书图片：**
```bash
leafcli xiaohongshu download "笔记链接" --output ./downloads
```

### Claude Desktop 自动化（推荐）

**前提：** 安装 Claude Desktop
- Windows: https://claude.ai/download
- 安装完成后登录 Claude

**使用方式：** 打开 Claude Desktop，直接说：

**示例对话：**
```
你："帮我查看小红书的热门帖子"

Claude：好的，我来帮你查看小红书的热门帖子...
[自动使用 leafcli 执行，显示结果]

你："帮我打开知乎，搜索关于 AI 的话题"

Claude：正在打开知乎并搜索...
[自动操作浏览器]
```

**无需学习任何命令，直接用自然语言对话！**

### 自动任务监听（投诉处理/工单处理）

**场景：** 你希望持续监控投诉系统，有新投诉自动处理。

**对 Claude 说：**
```
你："这个网站是我们的投诉处理系统，出现待处理的投诉就是我需要处理的。你帮我持续关注，每5分钟看一次。"

Claude：好的，我来配置自动监听...
[自动分析网站、配置守护进程]

已配置投诉监听：
- 页面：complaint.example.com
- 检查频率：每 5 分钟
- 发现新投诉自动通知你

守护进程已启动，正在监控...
```

**Claude 会自动完成所有配置，你无需了解任何技术细节！**

### 手动配置任务监听

如果不喜欢用 Claude 自动配置，也可以手动配置：

```bash
# 启动守护进程
leafcli task-watcher start

# 配置监听页面
leafcli task-watcher config add complaint.example.com "发现新投诉: {{title}}，请处理"

# 查看状态
leafcli task-watcher status
```

## 常见问题

### Q: Node.js 版本过低怎么办？

**A:** 卸载旧版本，重新安装 Node.js LTS 版本（>= 20）

### Q: npm install 失败？

**A:** 尝试：
1. 检查网络连接
2. 使用镜像源：`npm config set registry https://registry.npmmirror.com`
3. 重新安装：`npm install -g @yangshengzhou/leafcli`

### Q: leafcli doctor 显示错误？

**A:** 常见问题：
- 浏览器扩展未安装 → 先安装扩展
- Chrome 未打开 → 打开 Chrome 浏览器
- 权限问题 → 以管理员权限运行

### Q: Claude Desktop 中 leafcli 不工作？

**A:** 检查：
1. Claude Desktop 是否已安装并登录
2. Skills 是否已安装：运行 `npx skills add YangShengzhou03/LeafCLI`
3. 在 Claude 中说："帮我查看 leafcli 的使用方法"

### Q: 如何卸载？

**A:** 
```bash
npm uninstall -g @yangshengzhou/leafcli
```

然后删除浏览器扩展。

## 进阶使用

### 支持的网站列表

leafcli 支持 100+ 网站，包括：
- 社交媒体：小红书、知乎、微博、抖音
- 视频平台：Bilibili、YouTube、Twitter
- 工具：Hacker News、Reddit、LinkedIn
- 桌面应用：Cursor、Claude、ChatGPT

完整列表：运行 `leafcli list`

### 自定义命令

如果某个网站不支持，可以：
1. 对 Claude 说："帮我为这个网站编写适配器"
2. Claude 会自动使用 leafcli 创建新命令

### 插件扩展

安装社区插件：
```bash
leafcli plugin install github:user/leafcli-plugin-my-tool
```

## 获取帮助

- **文档：** README.md
- **问题反馈：** https://github.com/YangShengzhou03/LeafCLI/issues
- **命令帮助：** `leafcli <command> --help`

## 下一步

1. 安装 leafcli
2. 安装浏览器扩展
3. 安装 Claude Desktop
4. 在 Claude 中说："帮我打开小红书查看热门帖子"
5. 尝试自动任务监听："请帮我持续关注 xxx 网站"

**开始你的浏览器自动化之旅！**