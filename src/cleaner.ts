import * as os from 'os';
import * as path from 'path';
import { runCmd } from './run';
import { CleanerSuggestion } from './ai/types';

// globalStorage 根目录（Code / VSCodium / Trae CN）。rm -rf 只允许删这些目录之下的具体扩展子目录。
const STORAGE_ROOTS = ['Code', 'VSCodium', 'Trae CN'].map((e) =>
  path.join(os.homedir(), 'Library', 'Application Support', e, 'User', 'globalStorage'),
);

export interface CleanResult {
  title: string;
  command: string;
  success: boolean;
  output: string;
}

// 命令白名单校验：只放行三类安全命令，且 rm 路径必须限定在 globalStorage 之下。
// 任何分号、管道、多路径、越界路径一律拒绝——这是「让 AI 清理」的安全闸。
export function validateCommand(cmd: string): { ok: boolean; reason?: string } {
  const c = cmd.trim();

  // 卸载扩展：code --uninstall-extension <publisher.name>
  if (/^code\s+--uninstall-extension\s+[a-z0-9_-]+\.[a-z0-9_-]+$/i.test(c)) return { ok: true };

  // 结束进程：kill [-信号] <pid>
  if (/^kill\s+(-\d+\s+)?\d+$/.test(c)) return { ok: true };

  // 清缓存：rm -rf <globalStorage 下具体扩展目录>（单路径，可带引号）
  const m = c.match(/^rm\s+-rf\s+"?([^"]+)"?$/);
  if (m) {
    const raw = m[1];
    // 路径禁止含命令注入字符（管道 / 分号 / 反引号 / 变量 / 重定向 / 反斜杠 / 换行）
    if (/[|;&\x60$()><\n\r\\]/.test(raw)) {
      return { ok: false, reason: '路径含非法字符（疑似命令注入）' };
    }
    const target = raw.replace(/\/+$/, '').replace(/^~(?=\/|$)/, os.homedir());
    if (STORAGE_ROOTS.includes(target)) {
      return { ok: false, reason: '拒绝删除整个 globalStorage 目录' };
    }
    if (STORAGE_ROOTS.some((root) => target === root + path.sep || target.startsWith(root + '/'))) {
      return { ok: true };
    }
    return { ok: false, reason: '删除路径不在 globalStorage 之下' };
  }

  return { ok: false, reason: '不在白名单内（仅允许卸载扩展 / 清 globalStorage 缓存 / kill 进程）' };
}

// 执行单条清理：先过白名单，再用 sh -c 执行，捕获输出。
export async function executeClean(s: CleanerSuggestion): Promise<CleanResult> {
  const v = validateCommand(s.command);
  if (!v.ok) {
    return { title: s.title, command: s.command, success: false, output: `已拒绝：${v.reason}` };
  }
  const { code, stdout, stderr } = await runCmd('sh', ['-c', s.command], 30_000);
  const output = (stdout + (stderr ? '\n' + stderr : '')).trim().slice(0, 500);
  return {
    title: s.title,
    command: s.command,
    success: code === 0,
    output: output || (code === 0 ? '完成' : '失败（退出码 ' + code + '）'),
  };
}
