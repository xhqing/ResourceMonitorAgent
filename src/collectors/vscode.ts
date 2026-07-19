import { runCmd } from '../run';

export interface ExtensionProcess {
  pid: number;
  cpu: number;
  extensionId: string; // 由子进程命令行里的 extensions/<id>-<ver>/ 归属
  command: string;
}

export interface VscodeSnapshot {
  extensionProcesses: ExtensionProcess[]; // 有独立子进程的扩展（语言服务器 / native 二进制）
}

// `ps -axo %cpu,pid,command` 读全系统进程列表，每行格式：CPU%  PID  Command。
// 不用 `code --status` 的原因：`code` CLI 每次会启动 VSCode.app bundle 内的主可执行文件，
// 被 macOS LaunchServices 登记为「VSCode.app 被激活」，从而刷新 Dock「最近使用的应用程序」——
// 多窗口并行轮询时会反复弹出 VSCode 图标。ps 只读进程列表、不启动任何 .app bundle，根治该问题，
// 且输出比 `code --status` 更稳定（后者 Mem 列在本机已知有格式 bug）。
// 纯 JS 扩展共享同一个 extension-host 进程，无法按扩展拆分——只有派生出独立
// 子进程的扩展（命令行带 extensions/<id> 路径）才能在这里被归属。
export async function collectVscode(): Promise<VscodeSnapshot> {
  const { stdout } = await runCmd('ps', ['-axo', '%cpu,pid,command'], 10_000);
  const out: ExtensionProcess[] = [];
  for (const line of stdout.split('\n')) {
    // ps 输出格式：cpu  pid  command（无 Mem 列）
    const m = line.match(/^\s*([\d.]+)\s+(\d+)\s+(.*)$/);
    if (!m) continue;
    const cpu = Number(m[1]);
    const pid = Number(m[2]);
    const command = m[3].trim();
    // 只认 VSCode 扩展子进程：命令行须带 VSCode 应用路径或用户扩展目录。
    // 排除 macOS 系统扩展（.appex/.dext 等，命令行带 /System/Library/.../extensions/）。
    if (!command.includes('Visual Studio Code') && !command.includes('.vscode/extensions')) continue;
    const idMatch = command.match(/extensions[\/\\]([a-z0-9-]+\.[a-z0-9-]+?)[\/\\-]/i);
    if (!idMatch) continue;
    out.push({ pid, cpu, extensionId: idMatch[1], command });
  }
  return { extensionProcesses: out.sort((a, b) => b.cpu - a.cpu) };
}
