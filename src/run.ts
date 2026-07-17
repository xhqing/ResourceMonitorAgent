import { spawn } from 'child_process';

// 共享的命令执行工具：spawn 子进程跑系统命令，统一捕获 stdout。
// 关键点——macOS 没有 GNU `timeout`，所以超时控制必须在 Node 侧做：
// 到点直接 SIGKILL 子进程，避免某条采集命令卡死整轮巡检。

export interface RunResult {
  stdout: string;
  stderr: string;
  code: number;
}

export function runCmd(bin: string, args: string[], timeoutMs = 10_000): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { env: process.env });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);

    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    child.on('error', (err: Error) => {
      clearTimeout(timer);
      // 命令不存在（ENOENT）等：归并到 stderr，code 标 -1，调用方按空输出兜底
      resolve({ stdout, stderr: stderr + err.message, code: -1 });
    });
    child.on('close', (code: number | null) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? -1 });
    });
  });
}
