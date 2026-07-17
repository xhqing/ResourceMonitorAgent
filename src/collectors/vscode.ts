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

// `code --status` 给进程树快照，每行格式大致：CPU%  MemMB  PID  <缩进>Command。
// MemMB 列在本机已知有格式 bug（数值异常），只能信 CPU% / PID / Command。
// 纯 JS 扩展共享同一个 extension-host 进程，无法按扩展拆分——只有派生出独立
// 子进程的扩展（命令行带 extensions/<id> 路径）才能在这里被归属。
export async function collectVscode(): Promise<VscodeSnapshot> {
  const { stdout } = await runCmd('code', ['--status'], 15_000);
  const out: ExtensionProcess[] = [];
  for (const line of stdout.split('\n')) {
    // 跳过 Mem 列（中间那个 token）：cpu  <mem>  pid  command
    const m = line.match(/^\s*([\d.]+)\s+\S+\s+(\d+)\s+(.*)$/);
    if (!m) continue;
    const cpu = Number(m[1]);
    const pid = Number(m[2]);
    const command = m[3].trim();
    const idMatch = command.match(/extensions[\/\\]([a-z0-9-]+\.[a-z0-9-]+?)[\/\\-]/i);
    if (!idMatch) continue;
    out.push({ pid, cpu, extensionId: idMatch[1], command });
  }
  return { extensionProcesses: out.sort((a, b) => b.cpu - a.cpu) };
}
