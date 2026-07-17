import * as vscode from 'vscode';
import { AiConfig } from '../config';

// API key 用 VSCode SecretStorage 加密存储，绝不写进 settings.json / 日志 / 聊天。
const SECRET_KEY = 'resourceMonitor.aiApiKey';

export async function getApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
  return context.secrets.get(SECRET_KEY);
}

export async function setApiKey(context: vscode.ExtensionContext, key: string): Promise<void> {
  await context.secrets.store(SECRET_KEY, key);
}

export async function hasApiKey(context: vscode.ExtensionContext): Promise<boolean> {
  return Boolean(await context.secrets.get(SECRET_KEY));
}

// 调模型，返回文本响应。按协议走 Anthropic Messages 或 OpenAI Chat Completions，
// 对应 z.ai 的两个端点（/api/anthropic、/api/coding/paas/v4）。
export async function complete(
  context: vscode.ExtensionContext,
  cfg: AiConfig,
  system: string,
  user: string,
): Promise<string> {
  const key = await getApiKey(context);
  if (!key) throw new Error('未设置 API Key，请先执行「设置 API Key」命令。');
  return cfg.protocol === 'anthropic'
    ? anthropicComplete(cfg, key, system, user)
    : openaiComplete(cfg, key, system, user);
}

// Anthropic Messages：POST {base}/v1/messages，header 用 x-api-key + anthropic-version。
async function anthropicComplete(cfg: AiConfig, key: string, system: string, user: string): Promise<string> {
  const url = cfg.baseUrl.replace(/\/+$/, '') + '/v1/messages';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic 接口 ${res.status}：${await safeText(res)}`);
  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  return Array.isArray(data.content) ? data.content.map((b) => b.text ?? '').join('') : '';
}

// OpenAI Chat Completions：POST {base}/chat/completions，header 用 Bearer。
async function openaiComplete(cfg: AiConfig, key: string, system: string, user: string): Promise<string> {
  const url = cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + key,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI 接口 ${res.status}：${await safeText(res)}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return '';
  }
}
