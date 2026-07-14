#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""LeafCLI 安装引导程序"""

import argparse
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# ==================== 主题色 ====================
PRIMARY   = '\033[96m'   # 青色
SECONDARY = '\033[94m'   # 蓝色
OK        = '\033[92m'   # 绿色
WARN      = '\033[93m'   # 黄色
ERR       = '\033[91m'   # 红色
DIM       = '\033[2m'    # 暗淡
BOLD      = '\033[1m'    # 加粗
RST       = '\033[0m'    # 重置

# ==================== 配置 ====================
PROGRESS_FILE = Path.home() / '.leafcli' / 'install_progress.json'
NETWORK_TIMEOUT = 10
COMMAND_TIMEOUT = 300
SKILLS_TIMEOUT = 180
NPM_MIRRORS = {
    'official': 'https://registry.npmjs.org',
    'taobao': 'https://registry.npmmirror.com',
}
SKILLS_URL = "https://gitee.com/Yangshengzhou/leaf-cli.git"
LEAFCLI_PACKAGE = "@yangshengzhou/leafcli"

# 平台信息缓存（避免重复调用）
IS_WINDOWS = platform.system() == "Windows"
DEFAULT_ENCODING = 'utf-8' if IS_WINDOWS else None

# 安装步骤顺序（用于断点续传）
STEPS_ORDER = [
    "environment_checked",
    "leafcli_installed",
    "installation_verified",
    "skills_installed",
]

BANNER = (
    "\n"
    "     ██╗     ███████╗ █████╗ ███████╗ ███████╗██╗     ██║\n"
    "     ██║     ██╔════╝██╔══██╗██╔════╝ ██║     ██║     ██║\n"
    "     ██║     █████╗  ███████║█████╗   ██║     ██║     ██║\n"
    "     ██║     ██╔══╝  ██╔══██║██╔══╝   ██║     ██║     ██║\n"
    "     ███████╗███████╗██║  ██║██║      ███████╗███████╗██║\n"
    "     ╚══════╝╚══════╝╚═╝  ╚═╝╚═╝      ╚══════╝╚══════╝╚═╝\n"
    "\n"
)

# ==================== 进度管理 ====================
def save_progress(step: str) -> None:
    PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump({'step': step, 'time': datetime.now().isoformat()}, f, ensure_ascii=False)

def load_progress() -> Optional[dict]:
    if not PROGRESS_FILE.exists():
        return None
    try:
        with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None

def clear_progress() -> None:
    if PROGRESS_FILE.exists():
        PROGRESS_FILE.unlink()

def is_step_done(step: str, completed_step: Optional[str]) -> bool:
    """判断某步骤是否已完成（基于步骤顺序）"""
    if not completed_step:
        return False
    try:
        return STEPS_ORDER.index(step) <= STEPS_ORDER.index(completed_step)
    except ValueError:
        return False

# ==================== 输出函数 ====================
def ok(msg: str) -> None:
    print(f"  {OK}[OK]{RST} {msg}")

def error(msg: str) -> None:
    print(f"  {ERR}[X]{RST}  {msg}")

def warn(msg: str) -> None:
    print(f"  {WARN}[!]{RST}  {msg}")

def info(msg: str) -> None:
    print(f"  {SECONDARY}[i]{RST}  {msg}")

def ask_user(prompt: str, default: str = "y") -> bool:
    hint = "[Y/n]" if default.lower() == "y" else f"[{default}]"
    while True:
        try:
            resp = input(f"  {PRIMARY}{prompt} {hint}?{RST} ").strip().lower()
            if not resp:
                return default.lower() == "y"
            return resp in ("y", "yes", "ok")
        except KeyboardInterrupt:
            print(f"\n  {WARN}安装已取消{RST}")
            sys.exit(0)

def print_header() -> None:
    os.system('cls' if IS_WINDOWS else 'clear')
    print(BANNER)
    print()
    print(f"  {DIM}{'~' * 40}{RST}")
    print(f"  {SECONDARY}让 AI 帮你操作浏览器，一句话搞定重复操作{RST}")
    print()

def print_step(current: int, total: int, desc: str) -> None:
    print()
    print(f"  {PRIMARY}{BOLD}[{current}/{total}] {desc}{RST}")
    print(f"  {DIM}{'-' * 40}{RST}")

# ==================== 错误诊断 ====================
ERROR_SOLUTIONS: Dict[str, Tuple[str, List[str]]] = {
    'TLS':            ('TLS/SSL 连接错误', ['检查网络和代理设置', '尝试使用国内镜像源', 'Windows: 检查防火墙']),
    'ENOTFOUND':      ('无法解析域名',     ['检查网络连接', 'npm config set registry https://registry.npmmirror.com']),
    'ETIMEDOUT':      ('网络连接超时',     ['检查网络速度', '尝试国内镜像源', '稍后重试']),
    'EACCES':         ('权限不足',         ['Windows: 以管理员运行', 'Linux/Mac: sudo 或修复 npm 权限']),
    'ENOENT':         ('找不到命令',       ['确认 Node.js 已安装', '重启终端', '检查 PATH 配置']),
    'npm ERR!':       ('npm 安装失败',     ['npm cache clean --force', 'npm install -g npm@latest', '检查 node 版本']),
    'SSL':            ('SSL 错误',         ['检查网络和代理', '尝试国内镜像源']),
    'Failed to clone':('Git 克隆失败',     ['检查网络连接', '尝试代理或镜像', '稍后重试']),
    'network':        ('网络错误',         ['检查网络', '尝试国内镜像源', '检查防火墙']),
}

def print_diagnosis(error_msg: str) -> None:
    if not error_msg:
        return
    lower = error_msg.lower()
    for key, (problem, solutions) in ERROR_SOLUTIONS.items():
        if key.lower() in lower:
            print()
            print(f"  {BOLD}{ERR}问题：{problem}{RST}")
            print(f"  {PRIMARY}建议：{RST}")
            for i, s in enumerate(solutions, 1):
                print(f"    {i}. {s}")
            print()
            return

# ==================== 加载动画 ====================
class Spinner:
    def __init__(self, msg: str = "处理中"):
        self.msg = msg
        self.running = False
        self.thread: Optional[threading.Thread] = None

    def _spin(self) -> None:
        chars = '-\\|/'
        idx = 0
        while self.running:
            print(f"\r  {SECONDARY}{chars[idx % 4]} {self.msg}...{RST}", end='', flush=True)
            time.sleep(0.1)
            idx += 1

    def start(self) -> None:
        self.running = True
        self.thread = threading.Thread(target=self._spin, daemon=True)
        self.thread.start()

    def stop(self, success: bool = True, final: Optional[str] = None) -> None:
        self.running = False
        if self.thread:
            self.thread.join(timeout=0.5)
        # 清除当前行（覆盖 spinner 残留）
        line_len = len(self.msg) + 15
        print(f"\r{' ' * line_len}\r", end='', flush=True)
        if final:
            ok(final) if success else error(final)

# ==================== 网络检测 ====================
def _probe_mirror(name: str, url: str) -> Tuple[str, float]:
    """探测单个镜像源的响应时间"""
    try:
        start = time.time()
        urllib.request.urlopen(url, timeout=NETWORK_TIMEOUT)
        return name, time.time() - start
    except Exception:
        return name, float('inf')

def select_best_npm_mirror() -> Tuple[str, str]:
    """并行选择最快的 npm 镜像源"""
    results: Dict[str, float] = {}
    with ThreadPoolExecutor(max_workers=len(NPM_MIRRORS)) as pool:
        futures = [pool.submit(_probe_mirror, n, u) for n, u in NPM_MIRRORS.items()]
        for f in futures:
            name, latency = f.result()
            results[name] = latency

    available = {k: v for k, v in results.items() if v < float('inf')}
    if not available:
        return 'official', NPM_MIRRORS['official']
    # 国内镜像若足够快则优先使用
    if 'taobao' in available and available['taobao'] < 5.0:
        return 'taobao', NPM_MIRRORS['taobao']
    best = min(available, key=available.get)
    return best, NPM_MIRRORS[best]

# ==================== 命令执行 ====================
def run_command(command: str, show_output: bool = True, timeout: int = COMMAND_TIMEOUT) -> Tuple[bool, str]:
    """运行命令，返回 (成功, 输出)"""
    try:
        if show_output:
            print(f"  {DIM}$ {command}{RST}")
            subprocess.run(command, shell=True, check=True, text=True,
                          encoding=DEFAULT_ENCODING, errors='replace', timeout=timeout)
            return True, ""

        result = subprocess.run(command, shell=True, check=True, capture_output=True,
                              text=True, encoding=DEFAULT_ENCODING, errors='replace', timeout=timeout)
        return True, result.stdout

    except subprocess.CalledProcessError as e:
        print_diagnosis(e.stderr or str(e))
        return False, e.stderr or str(e)
    except subprocess.TimeoutExpired:
        error("命令执行超时")
        return False, "timeout"
    except Exception as e:
        error(f"未知错误: {e}")
        return False, str(e)

# ==================== 依赖检查 ====================
def check_dependency(name: str, cmd: str, version_re: Optional[str] = None,
                    min_ver: Optional[int] = None) -> Tuple[bool, Optional[str]]:
    info(f"正在检查 {name}...")
    # 先用 shutil.which 快速判断命令是否存在，避免子进程异常
    cmd_name = cmd.split()[0]
    if not shutil.which(cmd_name):
        error(f"{name} 未安装")
        return False, None
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True,
                          check=True, encoding=DEFAULT_ENCODING, errors='replace', timeout=10)
        ver = r.stdout.strip()

        if version_re and min_ver:
            m = re.match(version_re, ver)
            if m and int(m.group(1)) < min_ver:
                warn(f"{name} 版本过低: {ver}，需要 >= v{min_ver}.0.0")
                return False, ver

        ok(f"{name}: {ver}")
        return True, ver
    except subprocess.CalledProcessError:
        error(f"{name} 未安装")
        return False, None
    except Exception as e:
        error(f"检查 {name} 失败: {e}")
        return False, None

# ==================== 安装 ====================
def install_package(name: str, command: str) -> bool:
    info(f"正在安装 {name}...")
    if 'npm' in command:
        mirror, url = select_best_npm_mirror()
        if mirror != 'official':
            command += f" --registry {url}"
    success, _ = run_command(command, show_output=True)
    if success:
        ok(f"{name} 安装成功")
    else:
        error(f"{name} 安装失败")
    return success

# ==================== AI 工具检测 ====================
AI_TOOLS: Dict[str, Tuple[str, List[str], Optional[str]]] = {
    'claude-code': ('Claude Code',    ['.claude', '.claude/skills'], 'claude --version'),
    'codex':       ('Codex',          ['.codex'], None),
    'cursor':      ('Cursor',         ['.cursor'], None),
    'trae':        ('TRAE',           ['.trae', '.trae-cn'], None),
}

def _check_ai_tool(tid: str, tinfo: Tuple[str, List[str], Optional[str]], home: Path) -> Dict:
    name, paths, cmd = tinfo
    detected = False
    if cmd:
        # 先用 shutil.which 过滤，减少无效子进程
        cmd_name = cmd.split()[0]
        if shutil.which(cmd_name):
            try:
                r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=2)
                if r.returncode == 0:
                    detected = True
            except Exception:
                pass
    if not detected:
        for p in paths:
            if (home / p).exists():
                detected = True
                break
    return {'id': tid, 'name': name, 'detected': detected}

def detect_ai_tools() -> List[Dict]:
    """并行检测系统中已安装的 AI 工具"""
    info("正在检测已安装的 AI 工具...")
    home = Path.home()
    found: List[Dict] = []

    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = [pool.submit(_check_ai_tool, tid, tinfo, home)
                   for tid, tinfo in AI_TOOLS.items()]
        for f in futures:
            r = f.result()
            if r['detected']:
                found.append(r)
                ok(r['name'])

    if not found:
        warn("未检测到已安装的 AI 工具")
    return found

# ==================== 完成界面 ====================
def show_complete() -> None:
    print()
    print(f"  {PRIMARY}{BOLD}{'=' * 40}{RST}")
    print(f"  {PRIMARY}{BOLD}  安装完成！{RST}")
    print(f"  {PRIMARY}{BOLD}{'=' * 40}{RST}")
    print()
    print(f"  {BOLD}快速上手：{RST}")
    print()
    print(f"  1. 安装浏览器扩展")
    print(f"     {DIM}Chrome 应用商店搜索 'leafcli'{RST}")
    print(f"     {DIM}https://chromewebstore.google.com/detail/leafcli/ildkmabpimmkaediidaifkhjpohdnifk{RST}")
    print()
    print(f"  2. 打开 Claude Code，说句话试试")
    print(f"     {SECONDARY}\"帮我看看 Hacker News 今天有什么热门\"{RST}")
    print()
    print(f"  3. 让 AI 帮你盯任务")
    print(f"     {SECONDARY}\"这个网站是我们的投诉系统，有投诉就是我需要处理的\"{RST}")
    print(f"     {SECONDARY}\"你帮我持续关注，每5分钟看一次\"{RST}")
    print()
    print(f"  {BOLD}常用命令：{RST}")
    print(f"     leafcli list                查看所有命令")
    print(f"     leafcli doctor             检查环境")
    print(f"     leafcli task-watcher start 启动任务监听")
    print()
    print(f"  {DIM}{'~' * 40}{RST}")

# ==================== 主流程 ====================
def main() -> None:
    parser = argparse.ArgumentParser(description='LeafCLI 安装向导')
    parser.add_argument('--skip-checks', action='store_true', help='跳过环境检查')
    parser.add_argument('--silent', action='store_true', help='静默安装')
    parser.add_argument('--resume', action='store_true', help='从上次中断处继续')
    args = parser.parse_args()

    # 断点续传：读取上次完成的步骤
    completed_step: Optional[str] = None
    if args.resume:
        p = load_progress()
        if p:
            if args.silent or ask_user("是否从上次中断处继续"):
                completed_step = p.get('step')
                info(f"将从「{completed_step}」之后继续")
        else:
            info("未找到上次安装进度，从头开始")

    print_header()

    total_steps = 4

    # 1. 检查环境
    if not args.skip_checks and not is_step_done("environment_checked", completed_step):
        print_step(1, total_steps, "检查运行环境")

        node_ok, _ = check_dependency("Node.js", "node --version",
                                     r'v(\d+)\.(\d+)\.(\d+)', min_ver=20)
        if not node_ok:
            warn("需要安装 Node.js 20+")
            info("请访问: https://nodejs.org/")
            if not args.silent:
                input("  安装完成后按回车继续...")
            return

        npm_ok, _ = check_dependency("npm", "npm --version", r'(\d+)\.(\d+)\.(\d+)')
        if not npm_ok:
            warn("npm 未安装")
        save_progress("environment_checked")

    # 2. 安装 LeafCLI
    if not is_step_done("leafcli_installed", completed_step):
        print_step(2, total_steps, "安装 LeafCLI")
        if args.silent or ask_user("是否自动安装 LeafCLI"):
            if not install_package("LeafCLI", f"npm install -g {LEAFCLI_PACKAGE}"):
                error(f"请手动运行: npm install -g {LEAFCLI_PACKAGE}")
                sys.exit(1)
            save_progress("leafcli_installed")
        else:
            info(f"请手动运行: npm install -g {LEAFCLI_PACKAGE}")
            sys.exit(0)

    # 3. 验证安装
    if not is_step_done("installation_verified", completed_step):
        print_step(3, total_steps, "验证安装")
        spinner = Spinner("验证安装")
        spinner.start()
        success, _ = run_command("leafcli doctor", show_output=False)
        spinner.stop(success=success, final="安装验证成功" if success else "验证未通过，但可能已正常安装")
        save_progress("installation_verified")

    # 4. 安装 Skills
    if not is_step_done("skills_installed", completed_step):
        print_step(4, total_steps, "为 AI 工具安装 Skills")
        tools = detect_ai_tools()

        if tools:
            info(f"检测到 {len(tools)} 个 AI 工具")
            if args.silent or ask_user("确认安装 LeafCLI Skills"):
                cmd = f"npx skills add {SKILLS_URL} --all --yes -g"
                info("正在安装 Skills 到全局目录并自动链接到 AI 工具...")
                success, _ = run_command(cmd, show_output=True, timeout=SKILLS_TIMEOUT)
                if success:
                    ok("Skills 安装完成")
                else:
                    ok("Skills 已安装到全局目录")
                info("Eve/PromptScript 如提示不支持全局安装，可忽略。")
                save_progress("skills_installed")
        else:
            warn("未检测到 AI 工具")
            info("请先安装 AI 工具，然后运行:")
            info(f"  npx skills add {SKILLS_URL} --all --yes -g")

    clear_progress()
    show_complete()
    input(f"\n  {DIM}按回车退出...{RST}")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n  {WARN}安装已取消{RST}")
        sys.exit(0)
    except Exception as e:
        error(f"安装出错: {e}")
        print_diagnosis(str(e))
        sys.exit(1)
