<div align="center">

<img src="assets/logo.png" width="640" alt="Resource Monitor logo" />

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Built with Claude Code](https://img.shields.io/badge/Built%20with-Claude%20Code-19C37D)
![Type](https://img.shields.io/badge/Type-VSCode%20Extension-0078D4)

</div>

# Resource Monitor

> VSCode extension that monitors your whole Mac (CPU / memory / disk / GPU), uses AI to turn the numbers into checkable cleanup actions (uninstall an extension, clear a cache, kill a process), and executes the ones you pick — safely.

[简体中文](README_cn.md)

## Why

Small Macs (8 GB RAM) stutter under VSCode / Trae, and the culprit roams across the whole machine — CPU one moment, memory pressure or a bloated extension cache the next. Raw numbers don't tell you what to *do*. This extension watches the whole machine, and an AI assistant translates the snapshot into concrete, executable cleanup steps you can tick and run in one click.

## Features

- **Whole-machine dashboard**: live CPU / memory / disk / GPU, plus top processes — in an editor-side panel
- **AI cleanup suggestions**: send the snapshot to your model (z.ai / GLM via the Anthropic-compatible endpoint, or any OpenAI-compatible endpoint), get back a checkable list of actions with reasons, risk levels, and ready-to-run commands
- **Tick and run, safely**: pick the suggestions you trust, confirm, and the extension executes them. Every command passes a strict allowlist (uninstall extension / clear a specific `globalStorage` cache / kill a pid); `rm -rf /`, pipe injection, and out-of-scope paths are refused
- **Adjustable thresholds & alert cooldown**: tune CPU / memory / disk thresholds and the alert interval right in the panel, with suggested values and ranges
- **Two entry points**: the status-bar alert's "View details" and the Activity Bar icon both open the panel

## Platform requirements

- **macOS** (uses built-in `top` / `ps` / `df` / `ioreg` / `system_profiler` — no `sudo`, no Xcode Command Line Tools)
- Process-level GPU usage and GPU power are not readable without `sudo` — the panel marks them "unsupported" honestly rather than guessing

## Quick start (development)

```bash
npm install
npm run build      # or npm run watch for continuous build
# In VSCode, press F5 to open the Extension Development Host
```

Package as `.vsix` and install:

```bash
npm install -g @vscode/vsce
npm run package
# In VSCode: "Extensions → Install from VSIX", pick dist/*.vsix
```

## Commands

| Command | Description |
|---|---|
| Resource Monitor: Open Panel | Open the resource dashboard |
| Resource Monitor: Start / Stop Monitoring | Start / stop polling |
| Resource Monitor: Diagnose (AI cleanup) | Collect a snapshot and ask the AI for cleanup suggestions |
| Resource Monitor: Set API Key | Store your AI API key (encrypted via SecretStorage) |

## Configuration

| Option | Default | Description |
|---|---|---|
| `resourceMonitor.interval` | `5` | Polling interval (seconds) |
| `resourceMonitor.alertCooldown` | `300` | Min seconds between alerts on the same metric (panel-adjustable) |
| `resourceMonitor.threshold.cpuTotal` | `75` | Whole-machine CPU % that triggers an alert (above) |
| `resourceMonitor.threshold.cpuProcess` | `80` | Single-process CPU % that triggers an alert (above) |
| `resourceMonitor.threshold.memoryFree` | `20` | Free memory % that triggers an alert (below) |
| `resourceMonitor.threshold.diskUsed` | `85` | Disk usage % that triggers an alert (above) |
| `resourceMonitor.ai.baseUrl` | `https://api.z.ai/api/anthropic` | AI endpoint base URL |
| `resourceMonitor.ai.model` | `glm-5.2` | AI model id |
| `resourceMonitor.ai.protocol` | `anthropic` | `anthropic` or `openai` |

## How it works

- Collectors (`src/collectors/`) read CPU / memory / disk / GPU / VSCode processes via shell commands — zero runtime dependencies
- `src/ai/` calls your model directly (Node 18 `fetch`); the API key lives in `SecretStorage`, never in settings or logs
- `src/cleaner.ts` is the safety gate: a command allowlist that refuses anything dangerous before execution
- See [DESIGN.md](DESIGN.md) for the full design, capability boundaries, and safety model

## License & Attribution

Copyright (c) 2026 All Contributors. Licensed under the [MIT License](LICENSE.md).

**Attribution**: If this project helps you, a ⭐ on GitHub and retaining the copyright notice are appreciated. In derived works, please credit "Resource Monitor (https://github.com/xhqing/ResourceMonitor)".

**Citing this project**:

```
Resource Monitor — VSCode extension for whole-machine resource monitoring and AI-assisted cleanup.
https://github.com/xhqing/ResourceMonitor
```
