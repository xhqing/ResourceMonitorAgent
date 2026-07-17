import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { Snapshot } from './snapshot';
import { readConfig } from './config';
import { buildHtml } from './template';
import { CleanerSuggestion } from './ai/types';
import { executeClean, CleanResult } from './cleaner';

// 独立大面板（编辑器区 Webview Panel），单例：整机仪表盘 + 阈值/告警间隔可调 + AI 清理建议 + 勾选执行。
export class PanelController {
  private panel: vscode.WebviewPanel | undefined;
  private suggestions: CleanerSuggestion[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly onDiagnose: () => void,
  ) {}

  show(initial?: Snapshot) {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active);
    } else {
      const cfg = readConfig();
      this.panel = vscode.window.createWebviewPanel(
        'resourceMonitorPanel',
        '资源监控',
        vscode.ViewColumn.Active,
        { enableScripts: true, retainContextWhenHidden: true },
      );
      this.panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'assets', 'icon.png');
      this.panel.webview.html = buildHtml({
        thresholds: cfg.thresholds,
        cooldown: cfg.alertCooldownSec,
        nonce: getNonce(),
      });
      this.panel.webview.onDidReceiveMessage((msg: PanelMessage) => this.handleMessage(msg));
      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
    }
    if (initial) {
      this.update(initial);
    }
  }

  update(snap: Snapshot) {
    this.panel?.webview.postMessage({ type: 'snapshot', snap });
  }

  setSuggestions(items: CleanerSuggestion[]) {
    this.suggestions = items;
    this.panel?.webview.postMessage({ type: 'suggestions', items });
  }

  private handleMessage(msg: PanelMessage) {
    const cfg = vscode.workspace.getConfiguration('resourceMonitor');
    switch (msg.type) {
      case 'updateThreshold':
        void cfg.update(`threshold.${msg.key}`, msg.value, vscode.ConfigurationTarget.Global);
        break;
      case 'updateCooldown':
        void cfg.update('alertCooldown', msg.value, vscode.ConfigurationTarget.Global);
        break;
      case 'diagnose':
        this.onDiagnose();
        break;
      case 'executeClean':
        void this.runClean(msg.commands);
        break;
    }
  }

  // 执行勾选的清理项：每条都二次确认（high risk 用模态框），再过白名单执行。
  private async runClean(commands: string[]) {
    const picked = commands
      .map((cmd) => this.suggestions.find((s) => s.command === cmd))
      .filter((s): s is CleanerSuggestion => Boolean(s));
    if (picked.length === 0) {
      void vscode.window.showWarningMessage('没有勾选任何清理项。');
      return;
    }

    const results: CleanResult[] = [];
    for (const s of picked) {
      const confirm = await vscode.window.showWarningMessage(
        `${s.risk === 'high' ? '⚠️ 高风险' : '确认执行'}：${s.title}\n命令：${s.command}${s.impact ? '\n影响：' + s.impact : ''}`,
        { modal: s.risk === 'high' },
        '执行',
      );
      if (confirm !== '执行') {
        results.push({ title: s.title, command: s.command, success: false, output: '已跳过（用户取消）' });
        continue;
      }
      results.push(await executeClean(s));
    }

    this.panel?.webview.postMessage({ type: 'cleanResults', results });
    const ok = results.filter((r) => r.success).length;
    void vscode.window.showInformationMessage(`清理完成：成功 ${ok}/${results.length} 项，详见面板。`);
  }
}

type PanelMessage =
  | { type: 'updateThreshold'; key: string; value: number }
  | { type: 'updateCooldown'; value: number }
  | { type: 'diagnose' }
  | { type: 'executeClean'; commands: string[] };

function getNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}
