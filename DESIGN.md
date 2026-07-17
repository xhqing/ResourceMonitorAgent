# Resource Monitor 设计文档

## 1. 背景与目标

从「VSCode 渲染进程 CPU 监控 + 抓栈（原生调用栈，看不懂）」重构为「整机资源监控 + AI 清理建议 + 可勾选一键执行」。

- **监控**：整机 CPU / 内存 / 磁盘 / GPU（macOS 无 sudo）
- **AI 诊断**：直调模型分析资源快照，输出可执行清理建议（卸载扩展 / 清缓存 / 关大文件 / 结束进程）
- **执行**：面板勾选 → 二次确认 → 扩展安全执行，结果回显
- **入口**：告警的「查看详情」、左侧栏 Activity Bar 图标，都打开独立大面板

## 2. 能力边界（macOS 无 sudo，Apple M1 / Tahoe 实测）

| 维度 | 能力 | 来源 |
|---|---|---|
| 整机 CPU% / top 进程 | ✅ | `top -l 2`（取第二采样） |
| 内存（总量/可用/swap/top）| ✅ | `sysctl` / `memory_pressure` / `vm_stat` / `ps` |
| 磁盘卷 / 扩展缓存 | ✅ | `df -k`（过滤 APFS 角色卷）/ `du` 扫 globalStorage |
| GPU 整机% / 型号 | ✅ | `ioreg AGXAccelerator` / `system_profiler` |
| 进程级 GPU / GPU 功耗 | ❌ 需 sudo | 面板标「不支持」，不硬编 |
| webview → 扩展归属 | ❌ 只能归到窗口 | 扩展 native 子进程可归属（`code --status`） |

## 3. 模块结构

```
src/
  run.ts            共享 spawn + Node 侧超时（macOS 无 GNU timeout）
  collectors/       cpu / memory / disk / gpu / vscode
  snapshot.ts       聚合整机快照
  config.ts         配置 + 阈值/冷却 meta（面板设置区用）
  monitor.ts        定时巡检 + 状态栏 + 委托告警
  alerter.ts        综合告警 + 维度冷却 +「查看详情」开面板
  panel.ts          Webview Panel 控制器（单例）
  template.ts       面板 HTML/CSS/JS（内联，不走独立构建）
  ai/               client（双协议） / prompt / parse / analyze / types
  cleaner.ts        命令白名单 + 执行
  extension.ts      激活入口
```

零运行时依赖（沿用 `child_process` 调系统命令 + Node 18 自带 `fetch`）。

## 4. AI 集成（直调模型，不依赖 Claude Code）

- 双协议（配置切换）：
  - **Anthropic**：`{base}/v1/messages`，header `x-api-key` + `anthropic-version`（默认，对接 z.ai `/api/anthropic`）
  - **OpenAI**：`{base}/chat/completions`，`Bearer`（对接 z.ai `/api/coding/paas/v4`）
- API Key 用 `SecretStorage` 加密存（系统钥匙串），不落配置文件、不入日志
- 模型强制输出 JSON 数组（`title/reason/impact/command/risk/confidence`），`parse.ts` 容错解析
- 默认 z.ai + `glm-5.2`，可在配置改

## 5. 清理执行安全闸（`cleaner.ts`）

模型只「建议命令」，执行前强校验，**这是「让 AI 清理」的安全底线**：

- 仅放行三类：`code --uninstall-extension <id>` / `rm -rf <globalStorage 下具体目录>` / `kill <pid>`
- `rm` 路径禁止含 `` | ; & ` $ ( ) > < \ `` 换行 等注入字符
- 禁止删整个 globalStorage、禁止路径越界（只允许 `~/Library/Application Support/{Code,VSCodium,Trae CN}/User/globalStorage/` 之下）
- 面板勾选 → 每条二次确认（high risk 模态框）→ 执行 → 结果回显

白名单测试（`tmp/test-cleaner.ts`）：合法放行、`rm -rf /`、管道注入、越界路径等 16 case 全部正确拦截。

## 6. 配置项

- `interval`（轮询 5s）、`alertCooldown`（告警间隔默认 300s，**面板可调**）
- `threshold.cpuTotal / cpuProcess / memoryFree / diskUsed`（**面板可调**，带取值范围/建议值/说明）
- `ai.baseUrl / ai.model / ai.protocol`（默认 z.ai + glm-5.2 + anthropic）

阈值方向：CPU/单进程/磁盘「高于告警」，内存可用率「低于告警」——面板标注清楚。

## 7. 验证

- 采集层 `tmp/test-collectors.ts`：CPU/内存/磁盘/GPU/进程实测数据正确
- 安全闸 `tmp/test-cleaner.ts`：16 case 全过
- `tsc --noEmit`（strict）零错误 + `esbuild` 构建通过
- **F5 联调**：命令「设置 API Key」填 key → 「立即诊断」→ 面板看 AI 建议 → 勾选执行

## 8. 已知待办

- README（中英）仍描述旧版抓栈功能，待更新
- Activity Bar 图标当前用彩色 `icon.png`，VSCode 建议用单色 SVG（后续优化）
- 进程级 GPU 受无 sudo 限制，长期不可达
