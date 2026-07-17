import { runCmd } from '../run';

export interface CpuProcess {
  pid: number;
  cpu: number; // 进程 CPU%，单个进程可大于 100（吃满多个核）
  command: string;
}

export interface CpuSnapshot {
  totalPercent: number; // 整机瞬时 CPU%（user + sys）
  topProcesses: CpuProcess[];
}

// `top -l 2` 连续采两次样，第二采样才是瞬时值——单次 `top -l 1` 的 CPU 行和
// 进程% 是「开机以来累计 / 首采样」混合，不可信。用 `-n 10 -o cpu` 在同一次
// 调用里同时拿到整机 CPU 行和 top10 进程，省一次 fork。代价是多花约 1 秒采样。
const TOP_ARGS = ['-l', '2', '-s', '1', '-n', '10', '-o', 'cpu', '-stats', 'pid,cpu,command'];

export async function collectCpu(): Promise<CpuSnapshot> {
  const { stdout } = await runCmd('top', TOP_ARGS, 15_000);

  // 整机%：取最后一个 "CPU usage:" 行（即第二采样）
  let totalPercent = 0;
  const usageMatches = stdout.match(/CPU usage:[^\n]*?([\d.]+)% user,[^\n]*?([\d.]+)% sys/g);
  if (usageMatches && usageMatches.length > 0) {
    const m = usageMatches[usageMatches.length - 1].match(/([\d.]+)% user,[^\n]*?([\d.]+)% sys/);
    if (m) totalPercent = Number(m[1]) + Number(m[2]);
  }

  // 进程表：top -l 2 第一采样的进程% 是首采样坑（恒为 0，不可信）。
  // 用最后一次 "CPU usage:" 行作分界，取其后的进程行（即第二采样），拿到真实瞬时 CPU。
  const topProcesses: CpuProcess[] = [];
  const lastUsage = stdout.lastIndexOf('CPU usage:');
  if (lastUsage >= 0) {
    for (const line of stdout.slice(lastUsage).split('\n')) {
      const m = line.match(/^\s*(\d+)\s+([\d.]+)\s+(.*)$/);
      if (!m) continue;
      topProcesses.push({ pid: Number(m[1]), cpu: Number(m[2]), command: m[3].trim() });
      if (topProcesses.length >= 10) break;
    }
  }

  return { totalPercent, topProcesses };
}
