import * as vscode from 'vscode';
import { Monitor } from './monitor';
import { PanelController } from './panel';
import { analyzeWithAI } from './ai/analyze';
import { setApiKey, hasApiKey } from './ai/client';

let monitor: Monitor | undefined;
let panel: PanelController | undefined;
let extContext: vscode.ExtensionContext | undefined;

// 扩展激活入口：创建面板与监控器，注册命令，自动开始监控。
export function activate(context: vscode.ExtensionContext) {
  extContext = context;
  panel = new PanelController(() => void diagnose());

  // 注册侧边栏视图：点活动栏图标即展开资源监控面板，无需再点「打开」按钮。
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('resourceMonitor.entry', panel),
  );

  const m = new Monitor(
    (snap) => panel?.show(snap),
    () => void panel?.reveal(),
  );
  monitor = m;
  context.subscriptions.push(m);

  context.subscriptions.push(
    vscode.commands.registerCommand('resourceMonitor.openPanel', async () => {
      const snap = await m.sampleOnce();
      await panel?.reveal();
      panel?.show(snap);
    }),
    vscode.commands.registerCommand('resourceMonitor.start', () => {
      m.start();
      void vscode.window.showInformationMessage('Resource Monitor 已开始监控。');
    }),
    vscode.commands.registerCommand('resourceMonitor.stop', () => {
      m.stop();
      void vscode.window.showInformationMessage('Resource Monitor 已停止。');
    }),
    vscode.commands.registerCommand('resourceMonitor.diagnose', () => void diagnose()),
    vscode.commands.registerCommand('resourceMonitor.setApiKey', async () => {
      const key = await vscode.window.showInputBox({
        prompt: '输入 AI 接口的 API Key（加密存储于系统钥匙串，不会写入配置文件）',
        password: true,
        ignoreFocusOut: true,
      });
      if (key) {
        await setApiKey(context, key.trim());
        void vscode.window.showInformationMessage('API Key 已保存。');
      }
    }),
  );

  m.start();
}

// AI 诊断：采集快照 → 调模型分析 → 推送可勾选清理建议到面板。
// AI 判断是参考（基于建议数量），不阻塞任何手动清理流程。
async function diagnose() {
  const ctx = extContext;
  const mon = monitor;
  const pan = panel;
  if (!ctx || !mon || !pan) return;

  if (!(await hasApiKey(ctx))) {
    const choice = await vscode.window.showWarningMessage('尚未设置 API Key，是否现在设置？', '设置', '取消');
    if (choice === '设置') {
      await vscode.commands.executeCommand('resourceMonitor.setApiKey');
    }
    return;
  }

  pan.setDiagnosing('sampling');
  let snap;
  try {
    snap = await mon.sampleOnce();
  } catch (e) {
    pan.setDiagnosing('idle');
    void vscode.window.showErrorMessage('采集失败：' + (e as Error).message);
    return;
  }
  pan.show(snap);

  pan.setDiagnosing('analyzing');
  try {
    const items = await analyzeWithAI(ctx, snap);
    pan.setSuggestions(items);
  } catch (e) {
    void vscode.window.showErrorMessage('AI 诊断失败：' + (e as Error).message);
  } finally {
    pan.setDiagnosing('idle');
  }
}

export function deactivate() {
  monitor?.dispose();
}
