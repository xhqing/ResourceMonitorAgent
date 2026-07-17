import { CleanerSuggestion } from './types';

// 解析模型返回的清理建议。容错：去 markdown 围栏、提取第一个 JSON 数组、校验字段。
// 模型偶尔会多说几句或加代码围栏，这里都兜住，解析失败返回空数组而不是抛错。
export function parseSuggestions(text: string): CleanerSuggestion[] {
  if (!text) return [];
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start < 0 || end <= start) return [];

  let arr: unknown;
  try {
    arr = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];

  return arr
    .filter((it): it is Record<string, unknown> => typeof it === 'object' && it !== null)
    .map(normalize)
    .filter((s): s is CleanerSuggestion => Boolean(s.title) && Boolean(s.command));
}

function normalize(it: Record<string, unknown>): CleanerSuggestion {
  return {
    title: String(it.title ?? ''),
    reason: String(it.reason ?? ''),
    impact: typeof it.impact === 'string' && it.impact ? it.impact : undefined,
    command: String(it.command ?? ''),
    risk: it.risk === 'low' || it.risk === 'medium' || it.risk === 'high' ? it.risk : 'medium',
    confidence:
      it.confidence === 'high' || it.confidence === 'medium' || it.confidence === 'low' ? it.confidence : undefined,
  };
}
