import * as vscode from 'vscode';
import { Route, RouteResult, BuildResults } from '../configManager';
import { BuildProgress } from '../runner';

export type ViewState = 'idle' | 'scanning' | 'building' | 'results';

export interface RouteStatus {
  path: string;
  status: 'pending' | 'rendering' | 'done' | 'error';
  message?: string;
  result?: RouteResult;
}

export interface BuildState {
  step: string;
  routeStatuses: RouteStatus[];
  total: number;
  completed: number;
  errors: number;
  errorMessage?: string;
  finished: boolean;
}

export function getHtml(
  webview: vscode.Webview,
  routes: Route[],
  isVite: boolean,
  viewState: ViewState = 'idle',
  buildState?: BuildState,
  outputDir?: string,
  isOutdated?: boolean,
  lastResults?: BuildResults | null
): string {
  const n = getNonce();
  const enabled = routes.filter((r) => r.enabled).length;
  const od = outputDir || 'prerender-build';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'nonce-${n}'; script-src 'nonce-${n}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pre-render</title>
  <style nonce="${n}">${CSS}</style>
</head>
<body>
  <div class="header">
    <svg viewBox="0 0 24 24" class="hicon"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    <h2>Pre-render</h2>
  </div>
  <div class="status ${isVite ? 'ok' : 'warn'}">
    <span class="dot"></span>
    ${isVite ? 'Projeto Vite detectado' : 'Nenhum projeto Vite'}
  </div>
  ${!isVite ? '<div class="empty">Abra um projeto com Vite.</div>' : ''}
  ${isVite && viewState === 'idle' ? idleView(routes, enabled, isOutdated || false, lastResults) : ''}
  ${isVite && viewState === 'scanning' ? scanningView(routes, enabled) : ''}
  ${isVite && viewState === 'building' && buildState ? buildView(buildState) : ''}
  ${isVite && viewState === 'results' && lastResults ? resultsView(lastResults, od) : ''}
  <script nonce="${n}">${JS}</script>
</body>
</html>`;
}

// ── Views ─────────────────────────────────────────────────────

function idleView(routes: Route[], enabled: number, outdated: boolean, lastResults?: BuildResults | null): string {
  const items = routes.map((r, i) => `
    <div class="ri">
      <label class="rl">
        <input type="checkbox" class="rc" data-path="${e(r.path)}" ${r.enabled ? 'checked' : ''}/>
        <span class="rp">${e(r.path)}</span>
      </label>
      <span class="badge ${r.enabled ? 'b-yes' : 'b-no'}">${r.enabled ? 'Sim' : 'Não'}</span>
      <button class="mv" data-path="${e(r.path)}" data-dir="up" title="Mover acima">&#9650;</button>
      <button class="mv" data-path="${e(r.path)}" data-dir="down" title="Mover abaixo">&#9660;</button>
      <button class="rm" data-path="${e(r.path)}" title="Remover">x</button>
    </div>`).join('');

  const outdatedBanner = outdated ? `
    <div class="alert alert-warn">
      Código-fonte alterado desde o último pré-render. Execute novamente.
    </div>` : '';

  const lastBuildInfo = lastResults ? `
    <div class="last-build">
      Último build: ${new Date(lastResults.timestamp).toLocaleString('pt-BR')}
      — ${fmtSize(lastResults.totalOriginalSize)} &rarr; ${fmtSize(lastResults.totalRenderedSize)}
      <a class="link" id="showResults">Ver resultados</a>
    </div>` : '';

  return `
  ${outdatedBanner}
  ${lastBuildInfo}

  <div class="section">
    <div class="lbl">Descoberta</div>
    <button class="btn btn-sec" id="scanBtn">Escanear Rotas</button>
  </div>
  <div class="div"></div>
  <div class="section">
    <div class="lbl">Rotas</div>
    ${routes.length > 0
      ? `<div class="ctr"><strong>${enabled}</strong> de ${routes.length} selecionada${routes.length !== 1 ? 's' : ''}</div>
         <div class="rlist">${items}</div>`
      : '<div class="empty">Nenhuma rota. Escaneie ou adicione.</div>'}
    <div class="addrow">
      <input class="inp" id="routeInput" type="text" placeholder="/nova-rota"/>
      <button class="btn btn-pri btn-sm" id="addBtn">+</button>
    </div>
  </div>
  <div class="div"></div>
  <button class="btn btn-pri" id="runBtn" ${enabled === 0 ? 'disabled' : ''}>
    Gerar Pre-render (${enabled} rota${enabled !== 1 ? 's' : ''})
  </button>
  <div class="deploy-row">
    <button class="btn btn-sec btn-sm" id="deployZip">Gerar ZIP</button>
    <button class="btn btn-sec btn-sm" id="deployCopy">Copiar deploy</button>
  </div>`;
}

function scanningView(routes: Route[], enabled: number): string {
  return `
  <div class="section" style="text-align:center;padding:30px 0">
    <div class="spinner lg"></div>
    <div style="margin-top:10px;color:var(--vscode-descriptionForeground)">Escaneando projeto...</div>
  </div>`;
}

function buildView(state: BuildState): string {
  const pct = state.total > 0 ? Math.round((state.completed / state.total) * 100) : 0;
  const steps: Record<string, string> = {
    install: 'Verificando dependências...',
    build: 'Executando vite build...',
    render: `Renderizando (${state.completed}/${state.total})`,
    done: 'Concluído',
    error: 'Erro',
  };

  const routeList = state.routeStatuses.map((r) => {
    const icons: Record<string, string> = {
      pending: '<span class="ic ic-p">○</span>',
      rendering: '<span class="ic ic-r"><span class="spinner"></span></span>',
      done: '<span class="ic ic-d">✓</span>',
      error: '<span class="ic ic-e">✗</span>',
    };
    const seoTag = r.result?.seo ? `<span class="seo-score seo-${seoGrade(r.result.seo.score)}">${r.result.seo.score}</span>` : '';
    const sizeTag = r.result && r.status === 'done'
      ? `<span class="size-tag">${fmtSize(r.result.originalSize)} → ${fmtSize(r.result.renderedSize)}</span>` : '';
    const errTag = r.message ? `<span class="err-msg">${e(r.message)}</span>` : '';

    return `<div class="br">${icons[r.status] || icons.pending}<span class="rp">${e(r.path)}</span>${seoTag}${sizeTag}${errTag}</div>`;
  }).join('');

  let footer = '';
  if (state.finished) {
    footer = `<div style="margin-top:8px;display:flex;gap:6px">
      <button class="btn btn-sec" id="backBtn" style="flex:1">Voltar</button>
      <button class="btn btn-pri" id="showResults" style="flex:1">Ver resultados</button>
    </div>`;
  } else {
    footer = `<button class="btn btn-dan" id="cancelBtn" style="margin-top:8px">Cancelar</button>`;
  }

  return `
  <div class="section">
    <div class="lbl">Progresso</div>
    <div class="step">${!state.finished ? '<span class="spinner"></span>' : ''} <strong>${steps[state.step] || state.step}</strong></div>
    ${state.errorMessage && !state.routeStatuses.length ? `<div class="alert alert-err">${e(state.errorMessage)}</div>` : ''}
    <div class="pbar"><div class="pfill" style="width:${state.finished && !state.errors ? 100 : pct}%"></div></div>
    <div class="rlist" style="margin-top:4px">${routeList}</div>
    ${footer}
  </div>`;
}

function resultsView(results: BuildResults, outputDir: string): string {
  const avgScore = results.routes.length > 0
    ? Math.round(results.routes.reduce((s, r) => s + r.seo.score, 0) / results.routes.length) : 0;

  const routeCards = results.routes.map((r) => {
    const seo = r.seo;
    const warnings = seo.warnings.map((w) => `<div class="warn-item">⚠ ${e(w)}</div>`).join('');

    return `
    <div class="result-card">
      <div class="rc-header">
        <span class="rp">${e(r.path)}</span>
        <span class="seo-score seo-${seoGrade(seo.score)}">${seo.score}/100</span>
        <span class="size-tag">${fmtSize(r.originalSize)} → ${fmtSize(r.renderedSize)}</span>
        <button class="btn btn-sec btn-sm preview-btn" data-path="${e(r.path)}">Preview</button>
      </div>
      <div class="rc-tags">
        ${tag('title', seo.hasTitle)}${tag('description', seo.hasMetaDescription)}
        ${tag('og:title', seo.hasOgTitle)}${tag('og:desc', seo.hasOgDescription)}
        ${tag('og:image', seo.hasOgImage)}${tag('canonical', seo.hasCanonical)}
        ${tag('lang', seo.hasLang)}${tag('viewport', seo.hasViewport)}
      </div>
      ${warnings ? `<div class="rc-warnings">${warnings}</div>` : ''}
    </div>`;
  }).join('');

  return `
  <div class="section">
    <div class="lbl">Resultados</div>
    <div class="result-summary">
      <div class="rs-item">
        <div class="rs-val">${results.routes.length}</div><div class="rs-label">Rotas</div>
      </div>
      <div class="rs-item">
        <div class="rs-val seo-${seoGrade(avgScore)}">${avgScore}</div><div class="rs-label">SEO médio</div>
      </div>
      <div class="rs-item">
        <div class="rs-val">${fmtSize(results.totalRenderedSize)}</div><div class="rs-label">Total</div>
      </div>
    </div>
    <div class="size-comparison">
      SPA original: ${fmtSize(results.totalOriginalSize)} → Pré-renderizado: ${fmtSize(results.totalRenderedSize)}
      <strong>(+${fmtSize(results.totalRenderedSize - results.totalOriginalSize)} de conteúdo)</strong>
    </div>
    ${routeCards}
    <div style="margin-top:8px;display:flex;gap:6px">
      <button class="btn btn-sec" id="openFolder" style="flex:1">Abrir pasta</button>
      <button class="btn btn-pri" id="backBtn" style="flex:1">Voltar</button>
    </div>
  </div>`;
}

// ── Helpers ──────────────────────────────────────────────────

function tag(label: string, ok: boolean): string {
  return `<span class="stag ${ok ? 'stag-ok' : 'stag-no'}">${ok ? '✓' : '✗'} ${label}</span>`;
}

function seoGrade(score: number): string {
  if (score >= 80) { return 'good'; }
  if (score >= 50) { return 'mid'; }
  return 'bad';
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) { return bytes + 'B'; }
  if (bytes < 1024 * 1024) { return (bytes / 1024).toFixed(1) + 'KB'; }
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

function getNonce(): string {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let r = '';
  for (let i = 0; i < 32; i++) { r += c.charAt(Math.floor(Math.random() * c.length)); }
  return r;
}

function e(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── CSS ─────────────────────────────────────────────────────

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--vscode-font-family);font-size:12px;color:var(--vscode-foreground);background:var(--vscode-sideBar-background,var(--vscode-editor-background));padding:10px;line-height:1.4}
.header{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.hicon{width:18px;height:18px;stroke:var(--vscode-foreground);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.header h2{font-size:13px;font-weight:600}
.status{display:flex;align-items:center;gap:6px;padding:5px 8px;margin-bottom:8px;border-radius:4px;font-size:11px}
.dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.status.ok{background:rgba(40,167,69,.1)}.status.ok .dot{background:#28a745}
.status.warn{background:rgba(220,53,69,.1)}.status.warn .dot{background:#dc3545}
.section{margin-bottom:8px}.lbl{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--vscode-descriptionForeground);margin-bottom:5px}
.div{height:1px;background:var(--vscode-widget-border,rgba(128,128,128,.15));margin:8px 0}
.btn{width:100%;padding:6px 10px;font-size:11px;font-weight:600;border:none;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn-pri{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
.btn-pri:hover:not(:disabled){background:var(--vscode-button-hoverBackground)}
.btn-sec{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
.btn-sec:hover:not(:disabled){background:var(--vscode-button-secondaryHoverBackground)}
.btn-dan{background:rgba(220,53,69,.15);color:var(--vscode-errorForeground)}.btn-dan:hover{background:rgba(220,53,69,.25)}
.btn-sm{width:auto;padding:3px 10px;font-size:10px}
.addrow{display:flex;gap:4px;margin-top:6px}
.inp{flex:1;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);padding:5px 8px;font-size:12px;border-radius:4px;font-family:var(--vscode-editor-font-family);outline:none}
.inp:focus{border-color:var(--vscode-focusBorder)}
.rlist{max-height:300px;overflow-y:auto}
.ri{display:flex;align-items:center;gap:4px;padding:3px 4px;border-radius:3px}
.ri:hover{background:var(--vscode-list-hoverBackground)}
.rl{display:flex;align-items:center;gap:6px;flex:1;cursor:pointer;min-width:0}
.ri input[type="checkbox"]{accent-color:var(--vscode-button-background);cursor:pointer;flex-shrink:0}
.rp{font-family:var(--vscode-editor-font-family);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.badge{font-size:9px;font-weight:600;padding:1px 5px;border-radius:3px;flex-shrink:0}
.b-yes{background:rgba(40,167,69,.15);color:#28a745}.b-no{background:rgba(150,150,150,.12);color:var(--vscode-descriptionForeground)}
.mv{background:none;border:none;color:var(--vscode-descriptionForeground);cursor:pointer;font-size:8px;padding:0 2px;opacity:0;transition:opacity .1s}
.ri:hover .mv{opacity:.7}.mv:hover{opacity:1!important;color:var(--vscode-foreground)}
.rm{background:none;border:none;color:var(--vscode-descriptionForeground);cursor:pointer;font-size:11px;padding:0 3px;border-radius:3px;opacity:0;transition:opacity .1s}
.ri:hover .rm{opacity:1}.rm:hover{color:var(--vscode-errorForeground);background:rgba(220,53,69,.1)}
.ctr{font-size:11px;color:var(--vscode-descriptionForeground);margin-bottom:4px}.ctr strong{color:var(--vscode-foreground)}
.empty{text-align:center;padding:14px 8px;color:var(--vscode-descriptionForeground);font-size:11px;line-height:1.6}
.pbar{height:3px;background:rgba(128,128,128,.2);border-radius:2px;overflow:hidden;margin:6px 0}
.pfill{height:100%;background:var(--vscode-button-background);transition:width .3s;border-radius:2px}
.step{font-size:11px;color:var(--vscode-descriptionForeground);margin-bottom:4px}.step strong{color:var(--vscode-foreground)}
.br{display:flex;align-items:center;gap:6px;padding:2px 4px;font-size:11px}
.ic{width:14px;text-align:center;flex-shrink:0}
.ic-p{color:var(--vscode-descriptionForeground)}.ic-r{color:var(--vscode-button-background)}.ic-d{color:#28a745}.ic-e{color:var(--vscode-errorForeground)}
.err-msg{color:var(--vscode-errorForeground);font-size:10px;margin-left:auto}
@keyframes spin{to{transform:rotate(360deg)}}
.spinner{display:inline-block;width:12px;height:12px;border:2px solid var(--vscode-descriptionForeground);border-top-color:var(--vscode-button-background);border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle}
.spinner.lg{width:24px;height:24px;border-width:3px}
.link{color:var(--vscode-textLink-foreground);cursor:pointer;text-decoration:underline;font-size:11px}
.link:hover{color:var(--vscode-textLink-activeForeground)}
.alert{padding:6px 8px;border-radius:4px;font-size:11px;margin-bottom:8px}
.alert-warn{background:rgba(255,193,7,.1);color:#d49e00;border-left:3px solid #d49e00}
.alert-err{background:rgba(220,53,69,.1);color:var(--vscode-errorForeground)}
.last-build{font-size:10px;color:var(--vscode-descriptionForeground);margin-bottom:8px;padding:4px 6px;background:rgba(128,128,128,.06);border-radius:3px}
.deploy-row{display:flex;gap:6px;margin-top:6px}
.deploy-row .btn{flex:1}
.seo-score{font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;flex-shrink:0}
.seo-good{background:rgba(40,167,69,.12);color:#28a745}
.seo-mid{background:rgba(255,193,7,.12);color:#d49e00}
.seo-bad{background:rgba(220,53,69,.12);color:var(--vscode-errorForeground)}
.size-tag{font-size:9px;color:var(--vscode-descriptionForeground);flex-shrink:0}
.result-summary{display:flex;gap:6px;margin-bottom:8px}
.rs-item{flex:1;text-align:center;padding:8px 4px;background:rgba(128,128,128,.06);border-radius:4px}
.rs-val{font-size:16px;font-weight:700}.rs-label{font-size:9px;color:var(--vscode-descriptionForeground);margin-top:2px}
.size-comparison{font-size:11px;color:var(--vscode-descriptionForeground);margin-bottom:8px;padding:6px 8px;background:rgba(40,167,69,.06);border-radius:4px}
.size-comparison strong{color:var(--vscode-foreground)}
.result-card{border:1px solid var(--vscode-widget-border,rgba(128,128,128,.15));border-radius:4px;padding:6px 8px;margin-bottom:6px}
.rc-header{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.rc-tags{display:flex;flex-wrap:wrap;gap:3px;margin-top:4px}
.stag{font-size:9px;padding:1px 4px;border-radius:2px}
.stag-ok{background:rgba(40,167,69,.1);color:#28a745}.stag-no{background:rgba(220,53,69,.08);color:var(--vscode-errorForeground)}
.rc-warnings{margin-top:4px;font-size:10px;color:#d49e00}
.warn-item{padding:1px 0}
`;

// ── JS ──────────────────────────────────────────────────────

const JS = `
const vscode = acquireVsCodeApi();
function $(id){return document.getElementById(id)}

document.addEventListener('click', e => {
  const t = e.target;
  if(!t) return;
  const id = t.id, d = t.dataset;

  if(id==='scanBtn') vscode.postMessage({type:'scan'});
  if(id==='runBtn') vscode.postMessage({type:'run'});
  if(id==='cancelBtn') vscode.postMessage({type:'cancel'});
  if(id==='backBtn') vscode.postMessage({type:'back'});
  if(id==='openFolder') vscode.postMessage({type:'openFolder'});
  if(id==='showResults') vscode.postMessage({type:'showResults'});
  if(id==='deployZip') vscode.postMessage({type:'deployZip'});
  if(id==='deployCopy') vscode.postMessage({type:'deployCopy'});
  if(id==='addBtn'){
    const i=$('routeInput');
    if(i&&i.value.trim()){vscode.postMessage({type:'addRoute',path:i.value.trim()});i.value='';}
  }
  if(t.classList.contains('rm')&&d.path){e.stopPropagation();vscode.postMessage({type:'removeRoute',path:d.path});}
  if(t.classList.contains('mv')&&d.path&&d.dir){e.stopPropagation();vscode.postMessage({type:'moveRoute',path:d.path,dir:d.dir});}
  if(t.classList.contains('preview-btn')&&d.path){vscode.postMessage({type:'preview',path:d.path});}
});

document.addEventListener('change', e => {
  const t = e.target;
  if(t&&t.classList.contains('rc')) vscode.postMessage({type:'toggleRoute',path:t.dataset.path});
});

const ri=$('routeInput');
if(ri) ri.addEventListener('keydown', e=>{if(e.key==='Enter') $('addBtn')?.click();});
`;
