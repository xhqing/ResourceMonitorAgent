import { runCmd } from '../run';

export interface GpuSnapshot {
  model?: string;
  cores?: number;
  devicePercent?: number; // 整机 GPU 利用率%
  rendererPercent?: number;
  tilerPercent?: number;
  supported: boolean; // false = 无 sudo 拿不到（Intel 集显 / 读不到 AGXAccelerator）
}

// system_profiler 慢（几秒），型号/核心信息基本不变，进程级缓存即可。
let modelCache: { model?: string; cores?: number } | undefined;

async function readModel(): Promise<{ model?: string; cores?: number }> {
  if (modelCache) return modelCache;
  const { stdout } = await runCmd('system_profiler', ['SPDisplaysDataType'], 15_000);
  // 型号行形如 "    Apple M1:" / "    Intel Iris Plus Graphics 655:"
  const modelMatch = stdout.match(/^[ \t]*([A-Za-z0-9 .-]+):[ \t]*$/m);
  const coresMatch = stdout.match(/Total Number of Cores:\s*(\d+)/);
  modelCache = {
    model: modelMatch ? modelMatch[1].trim() : undefined,
    cores: coresMatch ? Number(coresMatch[1]) : undefined,
  };
  return modelCache;
}

// AGXAccelerator 是 Apple Silicon 的 GPU 节点；Intel 机器读不到，supported=false。
// Tahoe 上 "Device Utilization %" 偶发报 0，面板侧取 Device/Renderer/Tiler 三项
// 最大值兜底——这里三项都返回，由展示层决定怎么聚合。
async function readUtilization(): Promise<{
  device?: number;
  renderer?: number;
  tiler?: number;
  supported: boolean;
}> {
  const { stdout } = await runCmd('ioreg', ['-r', '-c', 'AGXAccelerator', '-d', '1']);
  if (!stdout.includes('AGXAccelerator')) {
    return { supported: false };
  }
  const pick = (key: string): number | undefined => {
    const m = stdout.match(new RegExp(`"${key}"\\s*=\\s*(\\d+)`));
    return m ? Number(m[1]) : undefined;
  };
  return {
    device: pick('Device Utilization %'),
    renderer: pick('Renderer Utilization %'),
    tiler: pick('Tiler Utilization %'),
    supported: true,
  };
}

export async function collectGpu(): Promise<GpuSnapshot> {
  const [model, util] = await Promise.all([readModel(), readUtilization()]);
  return {
    model: model.model,
    cores: model.cores,
    devicePercent: util.device,
    rendererPercent: util.renderer,
    tilerPercent: util.tiler,
    supported: util.supported,
  };
}
