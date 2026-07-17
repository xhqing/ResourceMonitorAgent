// 一条可执行的清理建议。AI 输出、面板渲染、清理执行都围绕这个结构。
export type Risk = 'low' | 'medium' | 'high';
export type Confidence = 'high' | 'medium' | 'low';

export interface CleanerSuggestion {
  title: string; // 一句话标题，如「卸载扩展 GitLens」
  reason: string; // 为什么建议清理（基于哪条资源数据）
  impact?: string; // 影响范围，如「删除后该扩展的本地缓存丢失」
  command: string; // 可执行命令，如 code --uninstall-extension xxx / rm -rf <path> / kill <pid>
  risk: Risk; // low/medium/high，面板据此标色与二次确认
  confidence?: Confidence; // AI 对这条建议的把握（归因不一定准，诚实标注）
}
