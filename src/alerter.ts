import * as vscode from 'vscode';
import { Snapshot } from './snapshot';
import { Thresholds, THRESHOLD_META } from './config';

export type AlertDimension = 'cpuTotal' | 'cpuProcess' | 'memoryUsed' | 'diskUsed';

export interface AlertReason {
  dimension: AlertDimension;
  value: number; // 当前值
  threshold: number; // 触发的阈值
}

// 判断一份快照里哪些维度超阈值，返回触发的维度清单（空数组 = 一切正常）。
// 这是「是否需要清理维护」的规则判断；AI 判断是另一条参考线，两者独立。
export function evaluateAlerts(snap: Snapshot, t: Thresholds): AlertReason[] {
  const reasons: AlertReason[] = [];

  if (snap.cpu.totalPercent >= t.cpuTotal) {
    reasons.push({ dimension: 'cpuTotal', value: snap.cpu.totalPercent, threshold: t.cpuTotal });
  }
  const top = snap.cpu.topProcesses[0];
  if (top && top.cpu >= t.cpuProcess) {
    reasons.push({ dimension: 'cpuProcess', value: top.cpu, threshold: t.cpuProcess });
  }
  const memUsed = 100 - snap.memory.freePercent;
  if (memUsed >= t.memoryUsed) {
    reasons.push({ dimension: 'memoryUsed', value: memUsed, threshold: t.memoryUsed });
  }
  for (const v of snap.disk.volumes) {
    if (v.usedPercent >= t.diskUsed) {
      reasons.push({ dimension: 'diskUsed', value: v.usedPercent, threshold: t.diskUsed });
      break; // 一个数据卷超阈值即触发
    }
  }
  return reasons;
}

// 告警器：带维度冷却地弹出「需要清理维护」提醒，点「查看详情」打开 GUI 面板。
// 冷却按维度记忆——同一维度在冷却内不重复弹，不同维度各自独立，避免轰炸又不错过新问题。
export class Alerter {
  private cooldownSec: number;
  private readonly lastAlertAt = new Map<AlertDimension, number>();
  private readonly onShowPanel: () => void;

  constructor(cooldownSec: number, onShowPanel: () => void) {
    this.cooldownSec = cooldownSec;
    this.onShowPanel = onShowPanel;
  }

  setCooldown(sec: number) {
    this.cooldownSec = sec;
  }

  // 返回是否真的弹了告警（供测试/调试）。
  async maybeAlert(reasons: AlertReason[]): Promise<boolean> {
    const now = Date.now();
    const fresh = reasons.filter((r) => now - (this.lastAlertAt.get(r.dimension) ?? 0) > this.cooldownSec * 1000);
    if (fresh.length === 0) return false;
    fresh.forEach((r) => this.lastAlertAt.set(r.dimension, now));

    const detail = fresh
      .map((r) => {
        const meta = THRESHOLD_META[r.dimension];
        const dir = meta.above ? '高于' : '低于';
        return `• ${meta.label} ${Math.round(r.value)}%（${dir}阈值 ${r.threshold}%）`;
      })
      .join('\n');

    const choice = await vscode.window.showWarningMessage(
      `电脑可能需要清理和维护\n${detail}`,
      '查看详情',
    );
    if (choice === '查看详情') {
      this.onShowPanel();
    }
    return true;
  }
}
