<div align="center">

<img src="assets/logo.png" width="640" alt="Resource Monitor logo" />

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Built with Claude Code](https://img.shields.io/badge/Built%20with-Claude%20Code-19C37D)
![Type](https://img.shields.io/badge/Type-VSCode%20Extension-0078D4)

</div>

# Resource Monitor

> VSCode 扩展：监控整台 Mac（CPU / 内存 / 磁盘 / GPU），用 AI 把数据翻译成可勾选的清理动作（卸载扩展、清缓存、结束进程），勾选确认后由扩展安全执行。

[English](README.md)

## 为什么需要

8GB 内存的小机器跑 VSCode（或 Trae 等 fork）偶尔卡顿，元凶在整台机器之间游走——一会儿 CPU、一会儿内存压力、一会儿是某个扩展的缓存膨胀。光看数字不知道「该删什么」。本扩展盯住整台机器，并由 AI 助手把快照翻译成具体、可执行的清理步骤，你勾选后一键跑掉。

## 功能

- **整机仪表盘**：编辑器区面板实时显示 CPU / 内存 / 磁盘 / GPU，含占用最高的进程
- **AI 清理建议**：把快照发给你的模型（z.ai / GLM 走 Anthropic 兼容端点，或任意 OpenAI 兼容端点），拿回一份可勾选的清理清单——每条带原因、风险等级、可直接执行的命令
- **勾选即安全执行**：挑你信得过的建议，确认后扩展执行。每条命令都过严格白名单（卸载扩展 / 清具体 `globalStorage` 缓存 / kill 进程），`rm -rf /`、管道注入、越界路径一律拒绝
- **阈值与告警间隔可调**：CPU / 内存 / 磁盘阈值和告警间隔都能在面板上调，附带建议值和取值范围
- **两个入口**：状态栏告警的「查看详情」、左侧栏扩展图标，都能打开面板

## 平台要求

- **macOS**（用系统自带的 `top` / `ps` / `df` / `ioreg` / `system_profiler`，无需 `sudo`、无需 Xcode 命令行工具）
- 进程级 GPU 占用和 GPU 功耗无 sudo 读不到，面板如实标注「不支持」，不硬编

## 快速开始（开发调试）

```bash
npm install
npm run build      # 或 npm run watch 持续构建
# 在 VSCode 里按 F5 打开扩展开发宿主窗口
```

打包成 `.vsix` 安装：

```bash
npm install -g @vscode/vsce
npm run package
# 在 VSCode「扩展 → 从 VSIX 安装」选择 dist/*.vsix
```

## 命令

| 命令 | 说明 |
|---|---|
| Resource Monitor: 打开资源面板 | 打开资源仪表盘 |
| Resource Monitor: 开始 / 停止监控 | 启动 / 停止巡检 |
| Resource Monitor: 立即诊断（AI 清理建议） | 采集快照并让 AI 给出清理建议 |
| Resource Monitor: 设置 API Key | 录入 AI 接口 key（SecretStorage 加密存储） |

## 配置

| 项 | 默认 | 说明 |
|---|---|---|
| `resourceMonitor.interval` | `5` | 巡检间隔（秒） |
| `resourceMonitor.alertCooldown` | `300` | 同一资源项两次告警的最小间隔（秒，面板可调） |
| `resourceMonitor.threshold.cpuTotal` | `75` | 整机 CPU% 告警阈值（高于） |
| `resourceMonitor.threshold.cpuProcess` | `80` | 单进程 CPU% 告警阈值（高于） |
| `resourceMonitor.threshold.memoryFree` | `20` | 内存可用率% 告警阈值（低于） |
| `resourceMonitor.threshold.diskUsed` | `85` | 磁盘使用率% 告警阈值（高于） |
| `resourceMonitor.ai.baseUrl` | `https://api.z.ai/api/anthropic` | AI 接口 Base URL |
| `resourceMonitor.ai.model` | `glm-5.2` | AI 模型 ID |
| `resourceMonitor.ai.protocol` | `anthropic` | `anthropic` 或 `openai` |

## 工作原理

- 采集器（`src/collectors/`）通过 shell 命令读取 CPU / 内存 / 磁盘 / GPU / VSCode 进程——零运行时依赖
- `src/ai/` 用 Node 18 自带 `fetch` 直调你的模型，API key 存 `SecretStorage`，不落配置、不入日志
- `src/cleaner.ts` 是安全闸：执行前用命令白名单拒绝一切危险操作
- 完整设计、能力边界和安全模型见 [DESIGN.md](DESIGN.md)

## 版权与署名

版权所有 (c) 2026 All Contributors，基于 [MIT 协议](LICENSE.md)授权。

**署名方式**：如果本项目对你有帮助，欢迎在 GitHub 点 ⭐，并请保留版权声明。衍生作品中请注明来源「Resource Monitor (https://github.com/xhqing/ResourceMonitor)」。

**引用本项目**：

```
Resource Monitor — VSCode 整机资源监控与 AI 辅助清理扩展。
https://github.com/xhqing/ResourceMonitor
```
