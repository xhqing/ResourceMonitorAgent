import * as vscode from 'vscode';
import { Alerter, evaluateAlerts } from './alerter';
import { readConfig } from './config';
import { takeSnapshot, Snapshot } from './snapshot';

// 监控器：定时巡检整机资源，更新状态栏，超阈值时委托 Alerter 弹「需要清理维护」。
export class Monitor {
  private timer: NodeJS.Timeout | undefined;
  private readonly statusItem: vscode.StatusBarItem;
  private readonly alerter: Alerter;
  lastSnapshot: Snapshot | undefined;

  constructor(onShowPanel: () => void) {
    this.statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusItem.command = 'resourceMonitor.openPanel';
    this.statusItem.tooltip = 'Resource Monitor：点击打开资源面板';
    this.statusItem.text = '$(pulse) RM 启动中…';
    this.statusItem.show();

    const cfg = readConfig();
    this.alerter = new Alerter(cfg.alertCooldownSec, onShowPanel);
  }

  start() {
    if (this.timer) return;
    const interval = readConfig().interval * 1000;
    this.timer = setInterval(() => { void this.poll(); }, interval);
    void this.poll();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.statusItem.text = '$(circle-slash) RM 已停止';
  }

  dispose() {
    this.stop();
    this.statusItem.dispose();
  }

  private async poll() {
    try {
      const cfg = readConfig();
      this.alerter.setCooldown(cfg.alertCooldownSec);
      const snap = await takeSnapshot();
      this.lastSnapshot = snap;
      const reasons = evaluateAlerts(snap, cfg.thresholds);
      this.updateStatus(snap, reasons);
      if (reasons.length > 0) {
        await this.alerter.maybeAlert(reasons);
      }
    } catch {
      // 单轮采集失败静默，避免异常刷屏；下一轮自动重试。
    }
  }

  private updateStatus(snap: Snapshot, reasons: ReturnType<typeof evaluateAlerts>) {
    const cpu = Math.round(snap.cpu.totalPercent);
    const memUsed = 100 - snap.memory.freePercent;
    const diskTop = snap.disk.volumes.reduce(
      (a, b) => (a.usedPercent > b.usedPercent ? a : b),
      snap.disk.volumes[0],
    );
    const icon = reasons.length > 0 ? '$(flame)' : '$(pulse)';
    this.statusItem.text = `${icon} CPU ${cpu}% · 内存 ${Math.round(memUsed)}% · 磁盘 ${diskTop?.usedPercent ?? 0}%`;
    this.statusItem.tooltip = 'Resource Monitor：点击打开资源面板查看详情与清理建议';
  }

  // 手动采集一次快照（供面板刷新 / 诊断命令复用）。
  async sampleOnce(): Promise<Snapshot> {
    const snap = await takeSnapshot();
    this.lastSnapshot = snap;
    return snap;
  }
}
