import * as vscode from 'vscode';

// 阈值配置：GUI 面板上用户可调，每项带「取值范围 / 建议值 / 比较方向 / 说明」。
// above=true 表示「高于阈值告警」，above=false 表示「低于阈值告警」。当前各维度均为高于告警。
export interface Thresholds {
  cpuTotal: number; // 整机 CPU%
  cpuProcess: number; // 单进程 CPU%
  memoryUsed: number; // 内存使用率%
  diskUsed: number; // 磁盘使用率%
}

export interface ThresholdMeta {
  min: number;
  max: number;
  suggest: number;
  above: boolean; // true=高于告警，false=低于告警
  label: string;
  unit: string;
  desc: string;
}

// 面板渲染阈值调节控件、输入校验、说明文字都从这张表读，保证「取值范围 / 建议值 / 说明」一致。
export const THRESHOLD_META: Record<keyof Thresholds, ThresholdMeta> = {
  cpuTotal: {
    min: 30, max: 95, suggest: 75, above: true, label: '整机 CPU', unit: '%',
    desc: '整机 CPU 占用（user+sys）。持续高于此值说明算力吃紧。',
  },
  cpuProcess: {
    min: 10, max: 800, suggest: 80, above: true, label: '单进程 CPU', unit: '%',
    desc: '单个进程的 CPU%（多核可 >100）。某进程吃满近一个核即可能造成卡顿。',
  },
  memoryUsed: {
    min: 50, max: 95, suggest: 80, above: true, label: '内存使用率', unit: '%',
    desc: '内存使用率，高于此值告警。macOS 激进缓存，可用率以 memory_pressure 为准、勿看 PhysMem unused。',
  },
  diskUsed: {
    min: 50, max: 98, suggest: 85, above: true, label: '磁盘使用率', unit: '%',
    desc: '数据盘使用率，高于此值告警。磁盘接近满会影响系统运行。',
  },
};

// 告警冷却（同一资源维度在冷却内不重复弹告警）。默认调久，避免打扰。
export const ALERT_COOLDOWN_META = {
  min: 30,
  max: 3600,
  suggest: 300,
  label: '告警间隔',
  unit: '秒',
  desc: '同一资源项两次告警之间的最小间隔，避免频繁打扰。默认 5 分钟（300 秒）。',
};

export interface AiConfig {
  baseUrl: string;
  model: string;
  protocol: 'anthropic' | 'openai';
}

export interface MonitorConfig {
  interval: number; // 轮询间隔（秒）
  alertCooldownSec: number; // 告警冷却（秒）
  thresholds: Thresholds;
  ai: AiConfig;
}

// 统一读取配置。默认值预填用户的 z.ai 环境（Anthropic 端点 + glm-5.2），他人可改。
export function readConfig(): MonitorConfig {
  const c = vscode.workspace.getConfiguration('resourceMonitor');
  return {
    interval: c.get<number>('interval', 5),
    alertCooldownSec: c.get<number>('alertCooldown', ALERT_COOLDOWN_META.suggest),
    thresholds: {
      cpuTotal: c.get<number>('threshold.cpuTotal', THRESHOLD_META.cpuTotal.suggest),
      cpuProcess: c.get<number>('threshold.cpuProcess', THRESHOLD_META.cpuProcess.suggest),
      memoryUsed: c.get<number>('threshold.memoryUsed', THRESHOLD_META.memoryUsed.suggest),
      diskUsed: c.get<number>('threshold.diskUsed', THRESHOLD_META.diskUsed.suggest),
    },
    ai: {
      baseUrl: c.get<string>('ai.baseUrl', 'https://api.z.ai/api/anthropic'),
      model: c.get<string>('ai.model', 'glm-5.2'),
      protocol: c.get<'anthropic' | 'openai'>('ai.protocol', 'anthropic'),
    },
  };
}
