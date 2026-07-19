import { Thresholds, THRESHOLD_META, ALERT_COOLDOWN_META } from './config';

export interface HtmlData {
  thresholds: Thresholds;
  cooldown: number;
  nonce: string;
}

interface SliderMeta {
  min: number;
  max: number;
  suggest: number;
  label: string;
  unit: string;
  desc: string;
}

// 面板 HTML（内联 CSS/JS，不走独立构建）。用 VSCode 主题变量自动适配深浅色。
export function buildHtml(data: HtmlData): string {
  const { thresholds, cooldown, nonce } = data;
  const t = THRESHOLD_META;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); margin: 0; padding: 16px 22px; }
  header { display:flex; align-items:baseline; justify-content:space-between; margin-bottom: 14px; }
  header h1 { font-size: 16px; margin: 0; font-weight: 600; }
  #ts { font-size: 12px; opacity: 0.65; }
  section { margin-bottom: 22px; }
  h2 { font-size: 13px; font-weight: 600; margin: 0 0 10px; opacity: 0.9; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
  .card { background: var(--vscode-editor-inset-background); border-radius: 10px; padding: 14px; }
  .card .label { font-size: 12px; opacity: 0.75; }
  .card .value { font-size: 26px; font-weight: 600; margin: 4px 0; }
  .card .sub { font-size: 11px; opacity: 0.6; word-break: break-all; }
  .bar { height: 6px; background: var(--vscode-scrollbarSlider-background); border-radius: 3px; margin-top: 8px; overflow: hidden; }
  .bar > i { display: block; height: 100%; background: var(--vscode-focusBorder); border-radius: 3px; transition: width .3s; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td, th { text-align: left; padding: 4px 8px; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .setting { margin-bottom: 14px; }
  .setting .row { display: flex; align-items: center; justify-content: space-between; }
  .setting input[type=range] { width: 100%; margin: 4px 0; }
  .setting .desc { font-size: 11px; opacity: 0.6; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 6px; padding: 6px 14px; cursor: pointer; font-size: 13px; margin-right: 8px; }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button:disabled { opacity: 0.5; cursor: default; }
  .placeholder { opacity: 0.6; font-size: 12px; }
  .item { display:flex; align-items:flex-start; gap:8px; padding:10px; border-radius:8px; background: var(--vscode-editor-inset-background); margin-bottom:8px; }
  .item code { display:block; font-size:11px; opacity:0.75; margin-top:4px; word-break: break-all; }
  .risk-high { color: var(--vscode-errorForeground); }
  .risk-medium { color: var(--vscode-charts-yellow); }
  .res { padding:8px 10px; border-radius:8px; background: var(--vscode-editor-inset-background); margin-bottom:6px; font-size:12px; }
  .res.fail { border-left: 3px solid var(--vscode-errorForeground); }
  .res.ok { border-left: 3px solid var(--vscode-testing-iconPassed); }
</style>
</head>
<body>
<header><h1>🖥️ 资源监控</h1><span id="ts">等待采集…</span></header>

<section>
  <div class="grid">
    <div class="card"><div class="label">整机 CPU</div><div class="value" id="cpu">--</div><div class="sub" id="cpu-sub"></div><div class="bar"><i id="cpu-bar" style="width:0"></i></div></div>
    <div class="card"><div class="label">内存占用</div><div class="value" id="mem">--</div><div class="sub" id="mem-sub"></div><div class="bar"><i id="mem-bar" style="width:0"></i></div></div>
    <div class="card"><div class="label">磁盘使用</div><div class="value" id="disk">--</div><div class="sub" id="disk-sub"></div><div class="bar"><i id="disk-bar" style="width:0"></i></div></div>
  </div>
</section>

<section>
  <h2>阈值与告警设置</h2>
  ${slider(t.cpuTotal, thresholds.cpuTotal, 'cpuTotal', 'threshold')}
  ${slider(t.cpuProcess, thresholds.cpuProcess, 'cpuProcess', 'threshold')}
  ${slider(t.memoryUsed, thresholds.memoryUsed, 'memoryUsed', 'threshold')}
  ${slider(t.diskUsed, thresholds.diskUsed, 'diskUsed', 'threshold')}
  ${slider(ALERT_COOLDOWN_META, cooldown, 'alertCooldown', 'cooldown')}
</section>

<section>
  <h2>AI 清理建议</h2>
  <div style="margin-bottom:10px">
    <button id="diagnose">立即诊断</button>
  </div>
  <div id="suggestions"><span class="placeholder">点击「立即诊断」，AI 会依据上面的资源数据给出可勾选的清理建议。勾选后点下方「清理勾选」。</span></div>
  <button id="clean" hidden style="margin-top:10px">清理勾选</button>
  <div id="cleanResults" style="margin-top:10px"></div>
</section>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  const fmtBytes = (b) => { if (!b) return '0'; const u = ['B','KB','MB','GB','TB']; const i = Math.floor(Math.log(b)/Math.log(1024)); return (b/Math.pow(1024,i)).toFixed(i<2?0:1) + ' ' + u[i]; };
  const shortName = (cmd) => (cmd || '').split('/').pop().split(' ')[0].slice(0, 36);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  document.querySelectorAll('input[type=range]').forEach((el) => {
    const out = el.parentElement.querySelector('.val');
    const refresh = () => { if (out) out.textContent = el.value + (el.dataset.unit || ''); };
    el.addEventListener('input', refresh); refresh();
    el.addEventListener('change', () => {
      vscode.postMessage({ type: el.dataset.kind === 'cooldown' ? 'updateCooldown' : 'updateThreshold', key: el.dataset.key, value: Number(el.value) });
    });
  });
  $('diagnose').addEventListener('click', () => vscode.postMessage({ type: 'diagnose' }));
  $('clean').addEventListener('click', () => {
    const cmds = Array.from(document.querySelectorAll('#suggestions input[type=checkbox]:checked')).map((el) => el.dataset.cmd).filter(Boolean);
    if (!cmds.length) return;
    vscode.postMessage({ type: 'executeClean', commands: cmds });
  });

  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.type === 'snapshot') render(msg.snap);
    else if (msg.type === 'suggestions') renderSug(msg.items);
    else if (msg.type === 'cleanResults') renderResults(msg.results);
    else if (msg.type === 'diagnoseStatus') setDiagState(msg.state);
  });

  function setDiagState(state) {
    const btn = $('diagnose');
    if (state === 'sampling') { btn.textContent = '采集数据中…'; btn.disabled = true; }
    else if (state === 'analyzing') { btn.textContent = 'AI 分析中…'; btn.disabled = true; }
    else { btn.textContent = '立即诊断'; btn.disabled = false; }
  }

  function render(s) {
    $('ts').textContent = '更新于 ' + new Date(s.timestamp).toLocaleTimeString();
    $('cpu').textContent = Math.round(s.cpu.totalPercent) + '%';
    const top = s.cpu.topProcesses[0];
    $('cpu-sub').textContent = top ? (shortName(top.command) + ' ' + Math.round(top.cpu) + '%') : '';
    $('cpu-bar').style.width = Math.min(100, s.cpu.totalPercent) + '%';

    const memUsed = 100 - s.memory.freePercent;
    $('mem').textContent = Math.round(memUsed) + '%';
    $('mem-sub').textContent = fmtBytes(s.memory.totalBytes * memUsed / 100) + ' / ' + fmtBytes(s.memory.totalBytes) + (s.memory.swapUsedBytes ? ' · swap ' + fmtBytes(s.memory.swapUsedBytes) : '');
    $('mem-bar').style.width = memUsed + '%';

    let dv;
    (s.disk.volumes || []).forEach((v) => { if (!dv || v.usedPercent > dv.usedPercent) dv = v; });
    if (dv) { $('disk').textContent = dv.usedPercent + '%'; $('disk-sub').textContent = dv.mount + ' · ' + fmtBytes(dv.usedBytes) + '/' + fmtBytes(dv.totalBytes); $('disk-bar').style.width = dv.usedPercent + '%'; }
  }

  function renderSug(items) {
    const box = $('suggestions'); box.innerHTML = '';
    const cleanBtn = $('clean');
    if (!items || !items.length) { box.innerHTML = '<span class="placeholder">暂无建议，资源状态良好。</span>'; if (cleanBtn) cleanBtn.hidden = true; return; }
    if (cleanBtn) cleanBtn.hidden = false;
    items.forEach((it) => {
      const div = document.createElement('div'); div.className = 'item';
      const riskCls = it.risk === 'high' ? 'risk-high' : (it.risk === 'medium' ? 'risk-medium' : '');
      div.innerHTML = '<input type="checkbox" data-cmd="' + esc(it.command) + '"><div style="flex:1">'
        + '<div><b>' + esc(it.title) + '</b> <span class="' + riskCls + '">(' + esc(it.risk) + (it.confidence ? ' / 把握 ' + esc(it.confidence) : '') + ')</span></div>'
        + '<div class="placeholder">' + esc(it.reason) + '</div>'
        + (it.impact ? '<div class="placeholder">影响：' + esc(it.impact) + '</div>' : '')
        + '<code>' + esc(it.command) + '</code></div>';
      box.appendChild(div);
    });
  }

  function renderResults(results) {
    const box = $('cleanResults'); box.innerHTML = '<h2>执行结果</h2>';
    if (!results || !results.length) return;
    results.forEach((r) => {
      const div = document.createElement('div'); div.className = 'res ' + (r.success ? 'ok' : 'fail');
      div.innerHTML = '<b>' + (r.success ? '✅' : '❌') + ' ' + esc(r.title) + '</b><br>'
        + '<span class="placeholder">' + esc(r.output) + '</span><code>' + esc(r.command) + '</code>';
      box.appendChild(div);
    });
  }
</script>
</body>
</html>`;
}

function slider(m: SliderMeta, value: number, key: string, kind: string): string {
  return `<div class="setting">
    <div class="row"><b>${m.label}</b><span class="val"></span></div>
    <input type="range" data-key="${key}" data-kind="${kind}" data-unit="${m.unit}" min="${m.min}" max="${m.max}" value="${value}">
    <div class="desc">${m.desc}（建议 ${m.suggest}${m.unit}，范围 ${m.min}–${m.max}${m.unit}）</div>
  </div>`;
}
