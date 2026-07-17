import * as vscode from 'vscode';
import { Snapshot } from '../snapshot';
import { readConfig } from '../config';
import { complete } from './client';
import { SYSTEM_PROMPT, buildUserMessage } from './prompt';
import { parseSuggestions } from './parse';
import { CleanerSuggestion } from './types';

// AI 分析主入口：取一份快照，调模型，返回结构化清理建议。
export async function analyzeWithAI(
  context: vscode.ExtensionContext,
  snap: Snapshot,
): Promise<CleanerSuggestion[]> {
  const cfg = readConfig();
  const text = await complete(context, cfg.ai, SYSTEM_PROMPT, buildUserMessage(snap));
  return parseSuggestions(text);
}

// 判断「是否建议清理」的 AI 参考意见（独立于规则告警，不阻塞清理流程）。
export async function judgeNeedCleanup(
  context: vscode.ExtensionContext,
  snap: Snapshot,
): Promise<string | undefined> {
  const cfg = readConfig();
  const text = await complete(
    context,
    cfg.ai,
    '你是资源助手。用一句中文回答：当前这台 Mac 是否建议清理维护，并简述主要原因。只回一句，不超过 40 字。',
    buildUserMessage(snap),
  );
  return text.trim() || undefined;
}
