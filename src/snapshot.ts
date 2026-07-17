import { collectCpu, CpuSnapshot } from './collectors/cpu';
import { collectMemory, MemorySnapshot } from './collectors/memory';
import { collectDisk, DiskSnapshot } from './collectors/disk';
import { collectGpu, GpuSnapshot } from './collectors/gpu';
import { collectVscode, VscodeSnapshot } from './collectors/vscode';

export interface Snapshot {
  timestamp: number;
  cpu: CpuSnapshot;
  memory: MemorySnapshot;
  disk: DiskSnapshot;
  gpu: GpuSnapshot;
  vscode: VscodeSnapshot;
}

// 聚合一次整机快照：CPU / 内存 / 磁盘 / GPU / VSCode 进程归属。
// 五类采集并行跑（每类内部也已并行），尽量缩短单轮采集耗时。
export async function takeSnapshot(): Promise<Snapshot> {
  const [cpu, memory, disk, gpu, vscode] = await Promise.all([
    collectCpu(),
    collectMemory(),
    collectDisk(),
    collectGpu(),
    collectVscode(),
  ]);
  return { timestamp: Date.now(), cpu, memory, disk, gpu, vscode };
}
