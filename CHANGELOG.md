# Changelog

本文件记录 Resource Monitor 的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [0.2.1] - 2026-07-19

修复扩展采集时反复在 Dock 弹出 VSCode 图标的问题。

### Fixed

- **采集方式改用 ps**：VSCode 扩展子进程的采集从 `code --status` 改为 `ps -axo %cpu,pid,command`。`code` CLI 每次会启动 VSCode.app bundle 内的主可执行文件，被 macOS LaunchServices 登记为「VSCode.app 被激活」，从而刷新 Dock「最近使用的应用程序」——多窗口并行轮询时会反复弹出 VSCode 图标。`ps` 只读进程列表、不启动任何 .app bundle，根治该问题，且输出比 `code --status` 更稳定（后者 Mem 列在本机已知有格式 bug）。
- **过滤系统扩展**：ps 全进程列表中只认 VSCode 扩展子进程（命令行带 `Visual Studio Code` 应用路径或 `.vscode/extensions`），排除 macOS 系统扩展（`.appex` / `.dext` 等，命令行带 `/System/Library/.../extensions/`）。

## [0.2.0] - 2026-07-18

资源监控面板改为侧边栏常驻视图，点活动栏图标即展开，无需再走「打开」按钮。

### Changed

- **面板形态重构**：资源监控面板从中央编辑器区的 WebviewPanel 改为侧边栏 WebviewView（`PanelController` 实现 `WebviewViewProvider`），点活动栏图标即展开常驻侧栏，不再需要先点「打开资源面板」按钮。
- **开屏即有数据**：扩展端缓存最新资源快照与 AI 清理建议，侧边栏视图首次展开（`resolveWebviewView`）时立即刷入，避免开屏空白。
- **「打开资源面板」命令**：改为聚焦 / 展开侧边栏视图（`reveal`）；视图尚未展开时触发 `focus` 命令将其展开，展开后再刷新一帧最新数据。
- **「清理勾选」按钮位置**：从「立即诊断」按钮旁边移到清理建议列表下方，更贴近勾选操作的位置。

### Removed

- 移除侧边栏欢迎页（`viewsWelcome`）：视图本身已常驻侧栏，不再需要欢迎页引导点「打开」按钮。

## [0.1.0] - 2026-07-18

整体重构为整机资源监控，并加入 AI 驱动的清理建议。

### Added

- **整机资源仪表盘**：独立大面板（编辑器区 Webview）实时展示整机 CPU、内存占用、磁盘使用、GPU 占用，以及进程占用 Top 表。
- **AI 清理建议**：采集资源快照后调用 AI 模型分析，给出可勾选的清理建议（标题、风险等级、把握度、原因、影响、命令），勾选后一键执行，执行结果回传面板。
- **阈值与告警可调**：面板内滑块调节整机 CPU、进程 CPU、内存可用率、磁盘使用率的告警阈值，以及告警冷却间隔。
- **命令**：打开监控面板、开始 / 停止监控、AI 诊断、设置 API Key。
- **配置项**：`resourceMonitor.threshold`（cpuTotal / cpuProcess / memoryFree / diskUsed）、`interval`（巡检间隔）、`alertCooldown`（告警冷却）。

### Changed

- **活动栏图标**：改为 24×24 单色 SVG（`assets/activity-icon.svg`），由 VSCode 按亮 / 暗主题自动反色，修复深色主题下图标显示为黑色方块的问题。
- **清理按钮交互**：「清理勾选」按钮初始隐藏，AI 诊断出建议后才显示；点击即执行，移除原先的二次确认弹窗与「执行勾选清理」文案。

### Removed

- 移除旧版「VSCode 渲染进程 CPU 监控 + 调用栈抓取」相关功能（产品方向调整为整机资源监控 + AI 清理）。

## [0.0.1] - 2026-07-17

首个版本：实时监控 VSCode 渲染进程 CPU，超阈值告警并一键抓取调用栈。

### Added

- **渲染进程 CPU 监控**：按可配置间隔巡检各渲染进程占用，单个进程超过阈值即弹出告警。
- **一键抓栈**：抓取最吃 CPU 的渲染进程调用栈，用于定位 V8/GC、Blink 重绘或扩展 webview 热点；采样时长可配，产物默认存扩展私有目录，亦可存工作区目录。
- **告警冷却**：同一进程两次告警之间设冷却时间，避免告警轰炸。
- **命令**：开始监控、停止监控、抓取最吃 CPU 的渲染进程、打开抓栈产物目录。
- **配置项**：`resourceMonitor.threshold`（CPU 阈值）、`interval`（巡检间隔）、`sampleDuration`（采样时长）、`alertCooldown`（告警冷却）、`captureToWorkspace`（产物存放位置）。
- **文档与包装**：中英双语 README、MIT LICENSE.md、Logo 与标准徽章。
- **工程脚手架**：Claude Code 本地配置（AutoMemory 目录、通用规则、命令）、项目 CLAUDE.md（commit skill 检测缓存）。
