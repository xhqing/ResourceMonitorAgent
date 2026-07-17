import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runCmd } from '../run';

export interface DiskVolume {
  mount: string;
  totalBytes: number;
  usedBytes: number;
  usedPercent: number;
}

export interface ExtensionStorageEntry {
  editor: string; // vscode / vscodium / trae
  extensionId: string; // globalStorage 子目录名即扩展 id
  bytes: number;
}

export interface DiskSnapshot {
  volumes: DiskVolume[];
  extensionStorage: ExtensionStorageEntry[];
}

// APFS 把同一物理 SSD 容器切成多个角色卷，df 会逐个列出且 Size 相同——
// 直接累加会重复计数 N 倍。只保留真正的用户数据卷。
function shouldIncludeVolume(mount: string): boolean {
  if (mount === '/') return true;
  if (mount === '/System/Volumes/Data') return true; // 用户文件实际所在的数据卷
  if (mount.startsWith('/Volumes/')) return true; // 外接卷
  return false;
}

async function readVolumes(): Promise<DiskVolume[]> {
  const { stdout } = await runCmd('df', ['-k']); // -k 给 KB 整数，比 -h 好解析
  const volumes: DiskVolume[] = [];
  for (const line of stdout.split('\n').slice(1)) {
    // 列：Filesystem 1024-blocks Used Available Capacity Mounted-on
    // macOS df -k 是 9 列：Filesystem 1024-blocks Used Available Capacity iused ifree %iused Mounted-on
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9) continue;
    const totalBytes = Number(parts[1]) * 1024;
    const usedBytes = Number(parts[2]) * 1024;
    const usedPercent = Number(parts[4].replace('%', ''));
    const mount = parts.slice(8).join(' '); // 挂载点在最后一列（名字可能含空格）
    if (!shouldIncludeVolume(mount) || !totalBytes) continue;
    volumes.push({ mount, totalBytes, usedBytes, usedPercent });
  }
  // APFS：根 / 与 /System/Volumes/Data 共享同一物理容器（容量相同）。若有数据卷 Data，
  // 则 / 是冗余的只读系统卷，移除它，避免面板把一块盘显示成两块。
  if (volumes.some((v) => v.mount === '/System/Volumes/Data')) {
    return volumes.filter((v) => v.mount !== '/');
  }
  return volumes;
}

// globalStorage 下每个子目录名就是扩展 id，du 扫一遍即完成归属。
// du 只读目录元数据、不读文件内容，几 GB 都亚秒级。`*/` 要 shell 展开、
// 2>/dev/null 要 shell，所以走 sh -c（路径硬编码，无注入风险）。
const STORAGE_DIRS: { editor: string; rel: string }[] = [
  { editor: 'vscode', rel: 'Library/Application Support/Code/User/globalStorage' },
  { editor: 'vscodium', rel: 'Library/Application Support/VSCodium/User/globalStorage' },
  { editor: 'trae', rel: 'Library/Application Support/Trae CN/User/globalStorage' },
];

async function readExtensionStorage(): Promise<ExtensionStorageEntry[]> {
  const home = os.homedir();
  const entries: ExtensionStorageEntry[] = [];
  for (const d of STORAGE_DIRS) {
    const dir = path.join(home, d.rel);
    if (!fs.existsSync(dir)) continue;
    const { stdout } = await runCmd('sh', ['-c', `du -sk "${dir}"/*/ 2>/dev/null`], 15_000);
    for (const line of stdout.split('\n')) {
      const m = line.match(/^(\d+)\s+(.+)$/);
      if (!m) continue;
      const bytes = Number(m[1]) * 1024;
      const extensionId = path.basename(m[2].trim().replace(/\/$/, ''));
      if (!extensionId) continue;
      entries.push({ editor: d.editor, extensionId, bytes });
    }
  }
  return entries.sort((a, b) => b.bytes - a.bytes);
}

export async function collectDisk(): Promise<DiskSnapshot> {
  const [volumes, extensionStorage] = await Promise.all([readVolumes(), readExtensionStorage()]);
  return { volumes, extensionStorage };
}
