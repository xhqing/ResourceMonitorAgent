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
  panel = new PanelController(context, () => void diagnose());

  const m = new Monitor(() => panel?.show(monitor?.lastSnapshot));
  monitor = m;
  context.subscriptions.push(m);

  context.subscriptions.push(
    vscode.commands.registerCommand('resourceMonitor.openPanel', async () => {
      const snap = await m.sampleOnce();
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

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Resource Monitor 诊断', cancellable: false },
    async (progress) => {
      progress.report({ message: '采集资源数据…' });
      let snap;
      try {
        snap = await mon.sampleOnce();
      } catch (e) {
        void vscode.window.showErrorMessage('采集失败：' + (e as Error).message);
        return;
      }
      pan.show(snap);

      progress.report({ message: 'AI 分析中…' });
      try {
        const items = await analyzeWithAI(ctx, snap);
        pan.setSuggestions(items);
        const verdict =
          items.length > 0
            ? `AI 判断：建议清理（${items.length} 项），详见面板。`
            : 'AI 判断：当前资源状态良好，暂无需清理。';
        void vscode.window.showInformationMessage(verdict);
      } catch (e) {
        void vscode.window.showErrorMessage('AI 诊断失败：' + (e as Error).message);
      }
    },
  );
}

export function deactivate() {
  monitor?.dispose();
}
