import { runCmd } from '../run';

export interface MemoryProcess {
  pid: number;
  rssBytes: number;
  command: string;
}

export interface MemorySnapshot {
  totalBytes: number; // 物理内存总量
  freePercent: number; // 可用内存%（memory_pressure 给的，不是 PhysMem 的 unused）
  swapTotalBytes: number;
  swapUsedBytes: number;
  topProcesses: MemoryProcess[];
}

// macOS「可用内存」绝不能看 `top` 的 PhysMem unused——系统激进地把空闲 RAM
// 拿去做缓存，unused 永远接近 0，会误报「内存快满」。`memory_pressure` 末行
// 直接给「System-wide memory free percentage: NN%」，这才是真实可用率。
async function readFreePercent(): Promise<number> {
  const { stdout } = await runCmd('memory_pressure', []);
  const m = stdout.match(/System-wide memory free percentage:\s*(\d+)/);
  return m ? Number(m[1]) : 0;
}

async function readTotal(): Promise<number> {
  const { stdout } = await runCmd('sysctl', ['-n', 'hw.memsize']);
  const m = stdout.match(/\d+/);
  return m ? Number(m[0]) : 0;
}

// swap 用量是内存压力的真实信号（比 PhysMem 直观）：`sysctl vm.swapusage`
// 输出 "total = 3072.00M  used = 2095.50M  free = 976.50M  (encrypted)"
async function readSwap(): Promise<{ total: number; used: number }> {
  const { stdout } = await runCmd('sysctl', ['vm.swapusage']);
  const total = stdout.match(/total\s*=\s*([\d.]+)\s*([KMGT])/);
  const used = stdout.match(/used\s*=\s*([\d.]+)\s*([KMGT])/);
  return {
    total: total ? toBytes(Number(total[1]), total[2]) : 0,
    used: used ? toBytes(Number(used[1]), used[2]) : 0,
  };
}

function toBytes(n: number, unit: string): number {
  const k: Record<string, number> = { K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 };
  return n * (k[unit] || 1);
}

// `ps` 的 rss 单位是 KB。
async function readTopMemoryProcesses(): Promise<MemoryProcess[]> {
  const { stdout } = await runCmd('ps', ['-ww', '-A', '-o', 'pid=,rss=,command=']);
  return stdout
    .split('\n')
    .map((l) => l.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({ pid: Number(m[1]), rssBytes: Number(m[2]) * 1024, command: m[3].trim() }))
    .sort((a, b) => b.rssBytes - a.rssBytes)
    .slice(0, 10);
}

export async function collectMemory(): Promise<MemorySnapshot> {
  const [total, freePercent, swap, topProcesses] = await Promise.all([
    readTotal(),
    readFreePercent(),
    readSwap(),
    readTopMemoryProcesses(),
  ]);
  return { totalBytes: total, freePercent, swapTotalBytes: swap.total, swapUsedBytes: swap.used, topProcesses };
}
