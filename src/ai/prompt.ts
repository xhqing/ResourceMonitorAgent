import { Snapshot } from '../snapshot';

// 系统提示：要求模型只输出 JSON 数组、用规范命令、守安全底线、诚实标注归因把握。
export const SYSTEM_PROMPT = `你是 macOS 资源清理助手。用户会给你一份整机资源快照（CPU、内存、磁盘、GPU、占用最高的进程、各 VSCode 扩展的缓存大小、有独立子进程的扩展及其 CPU）。

任务：根据快照给出「具体、可执行」的清理建议，帮用户降低资源占用。

输出格式（必须严格遵守）：
- 只输出一个 JSON 数组，不要任何解释文字，不要 markdown 代码围栏。
- 数组每项：{"title": string, "reason": string, "impact": string, "command": string, "risk": "low|medium|high", "confidence": "high|medium|low"}

字段说明：
- title：一句话操作，如「清理扩展 ms-python.python 的缓存」。
- reason：基于哪条数据，如「该扩展缓存达 1200MB」。
- impact：执行后的影响，如「该扩展的本地状态会被重置」。
- command：可直接在终端执行的命令：
  - 卸载扩展：code --uninstall-extension <扩展id>
  - 清扩展缓存：rm -rf "<完整路径>"，路径限定在 ~/Library/Application Support/Code/User/globalStorage/<扩展id>/ 之内。路径含空格，必须用双引号包裹整个路径。
  - 结束进程：kill <pid>
- risk：low=清缓存等无副作用；medium=卸载扩展或结束进程；high=影响正在使用的东西。
- confidence：你对归因的把握。进程级 CPU 归因不一定准（webview 归不到扩展），没把握就标 low。

安全底线：绝不建议 rm -rf /、删除系统目录、删除用户文档、格式化磁盘等危险操作。如果资源状态健康、没有值得清理的项，返回空数组 []。`;

// 把快照精简成模型易读的文本（截掉过长的命令路径细节，只保留关键数字）。
export function buildUserMessage(snap: Snapshot): string {
  const topCpu = snap.cpu.topProcesses
    .slice(0, 8)
    .map((p) => `  pid ${p.pid}: ${Math.round(p.cpu)}% — ${p.command.slice(0, 80)}`)
    .join('\n');

  const topMem = snap.memory.topProcesses
    .slice(0, 8)
    .map((p) => `  pid ${p.pid}: ${Math.round(p.rssBytes / 1024 / 1024)}MB — ${p.command.slice(0, 80)}`)
    .join('\n');

  const volumes = snap.disk.volumes
    .map((v) => `  ${v.mount}: ${v.usedPercent}% (${(v.usedBytes / 1e9).toFixed(0)}/${(v.totalBytes / 1e9).toFixed(0)}GB)`)
    .join('\n');

  const editorRoot: Record<string, string> = { vscode: 'Code', vscodium: 'VSCodium', trae: 'Trae CN' };
  const extStorage = snap.disk.extensionStorage
    .filter((e) => e.bytes > 1024 * 1024) // 只报 >1MB 的，省 token
    .slice(0, 20)
    .map((e) => {
      const root = editorRoot[e.editor] ?? e.editor;
      return `  ${e.extensionId} = ${(e.bytes / 1024 / 1024).toFixed(0)}MB (清理命令示例：rm -rf "~/Library/Application Support/${root}/User/globalStorage/${e.extensionId}")`;
    })
    .join('\n');

  const extProcs = snap.vscode.extensionProcesses
    .slice(0, 10)
    .map((p) => `  ${p.extensionId}: pid ${p.pid} ${p.cpu}%`)
    .join('\n');

  return `资源快照：
- 整机 CPU：${snap.cpu.totalPercent.toFixed(0)}%
Top CPU 进程：
${topCpu || '  (无)'}

- 内存：总量 ${(snap.memory.totalBytes / 1e9).toFixed(1)}GB，可用率 ${snap.memory.freePercent}%，swap 用 ${Math.round(snap.memory.swapUsedBytes / 1e6)}MB
Top 内存进程：
${topMem || '  (无)'}

- 磁盘卷：
${volumes || '  (无)'}
扩展缓存（globalStorage，仅列 >1MB）：
${extStorage || '  (无)'}

- GPU：${snap.gpu.supported ? `${snap.gpu.model ?? ''} ${snap.gpu.cores ?? 0}核，利用率 ${snap.gpu.devicePercent ?? 0}%` : '当前机型不支持读取'}

- 有独立子进程的 VSCode 扩展（CPU）：
${extProcs || '  (无)'}

请给出可执行的清理建议 JSON 数组。`;
}
