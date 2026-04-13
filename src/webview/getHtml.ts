import * as vscode from 'vscode';
import { Route } from '../configManager';
import { BuildProgress } from '../runner';

export type ViewState = 'idle' | 'scanning' | 'building';

export interface RouteStatus {
  path: string;
  status: 'pending' | 'rendering' | 'done' | 'error';
  message?: string;
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

/**
 * Gera o HTML da interface do painel webview.
 */
export function getHtml(
  webview: vscode.Webview,
  routes: Route[],
  isVite: boolean,
  viewState: ViewState = 'idle',
  buildState?: BuildState,
  outputDir?: string
): string {
  const nonce = getNonce();
  const enabledCount = routes.filter((r) => r.enabled).length;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vite Pre-render</title>
  <style nonce="${nonce}">
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: 12px;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      padding: 10px;
      line-height: 1.4;
    }
    /* Header */
    .header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .header svg { width: 18px; height: 18px; stroke: var(--vscode-foreground); fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .header h2 { font-size: 13px; font-weight: 600; }
    /* Status */
    .status { display: flex; align-items: center; gap: 6px; padding: 5px 8px; margin-bottom: 10px; border-radius: 4px; font-size: 11px; }
    .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .status.ok { background: rgba(40,167,69,0.1); }
    .status.ok .dot { background: #28a745; }
    .status.warn { background: rgba(220,53,69,0.1); }
    .status.warn .dot { background: #dc3545; }
    /* Sections */
    .section { margin-bottom: 10px; }
    .label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--vscode-descriptionForeground); margin-bottom: 5px; }
    .divider { height: 1px; background: var(--vscode-widget-border, rgba(128,128,128,0.15)); margin: 10px 0; }
    /* Buttons */
    .btn { width: 100%; padding: 6px 10px; font-size: 11px; font-weight: 600; border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .btn-primary:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
    .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .btn-secondary:hover:not(:disabled) { background: var(--vscode-button-secondaryHoverBackground); }
    .btn-danger { background: rgba(220,53,69,0.15); color: var(--vscode-errorForeground); }
    .btn-danger:hover { background: rgba(220,53,69,0.25); }
    .btn-sm { width: auto; padding: 3px 10px; font-size: 10px; }
    /* Add row */
    .add-row { display: flex; gap: 4px; margin-top: 6px; }
    .input { flex: 1; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); padding: 5px 8px; font-size: 12px; border-radius: 4px; font-family: var(--vscode-editor-font-family); outline: none; }
    .input:focus { border-color: var(--vscode-focusBorder); }
    /* Route list */
    .route-list { max-height: 320px; overflow-y: auto; }
    .route-item { display: flex; align-items: center; gap: 5px; padding: 3px 4px; border-radius: 3px; }
    .route-item:hover { background: var(--vscode-list-hoverBackground); }
    .route-item label { display: flex; align-items: center; gap: 6px; flex: 1; cursor: pointer; min-width: 0; }
    .route-item input[type="checkbox"] { accent-color: var(--vscode-button-background); cursor: pointer; flex-shrink: 0; }
    .route-path { font-family: var(--vscode-editor-font-family); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .badge { font-size: 9px; font-weight: 600; padding: 1px 5px; border-radius: 3px; flex-shrink: 0; }
    .badge-yes { background: rgba(40,167,69,0.15); color: #28a745; }
    .badge-no { background: rgba(150,150,150,0.12); color: var(--vscode-descriptionForeground); }
    .badge-alta { background: rgba(40,167,69,0.12); color: #28a745; }
    .badge-media { background: rgba(255,193,7,0.12); color: #d49e00; }
    .badge-baixa { background: rgba(150,150,150,0.12); color: var(--vscode-descriptionForeground); }
    .rm-btn { background: none; border: none; color: var(--vscode-descriptionForeground); cursor: pointer; font-size: 11px; padding: 0 3px; border-radius: 3px; opacity: 0; transition: opacity 0.1s; }
    .route-item:hover .rm-btn { opacity: 1; }
    .rm-btn:hover { color: var(--vscode-errorForeground); background: rgba(220,53,69,0.1); }
    /* Counter */
    .counter { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 5px; }
    .counter strong { color: var(--vscode-foreground); }
    /* Empty */
    .empty { text-align: center; padding: 16px 8px; color: var(--vscode-descriptionForeground); font-size: 11px; line-height: 1.6; }
    /* Progress */
    .progress-bar { height: 3px; background: var(--vscode-progressBar-background, rgba(128,128,128,0.2)); border-radius: 2px; overflow: hidden; margin: 8px 0; }
    .progress-fill { height: 100%; background: var(--vscode-button-background); transition: width 0.3s ease; border-radius: 2px; }
    .step-label { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 6px; }
    .step-label strong { color: var(--vscode-foreground); }
    .build-route { display: flex; align-items: center; gap: 6px; padding: 2px 4px; font-size: 11px; }
    .build-route .icon { width: 14px; text-align: center; flex-shrink: 0; }
    .icon-pending { color: var(--vscode-descriptionForeground); }
    .icon-rendering { color: var(--vscode-button-background); }
    .icon-done { color: #28a745; }
    .icon-error { color: var(--vscode-errorForeground); }
    .result-box { padding: 8px; border-radius: 4px; margin-top: 8px; font-size: 11px; }
    .result-ok { background: rgba(40,167,69,0.1); }
    .result-err { background: rgba(220,53,69,0.1); }
    .result-box strong { display: block; margin-bottom: 4px; }
    .link { color: var(--vscode-textLink-foreground); cursor: pointer; text-decoration: underline; font-size: 11px; }
    .link:hover { color: var(--vscode-textLink-activeForeground); }
    /* Spinner */
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid var(--vscode-descriptionForeground); border-top-color: var(--vscode-button-background); border-radius: 50%; animation: spin 0.6s linear infinite; }
  </style>
</head>
<body>
  <div class="header">
    <svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    <h2>Pre-render</h2>
  </div>

  <div class="status ${isVite ? 'ok' : 'warn'}">
    <span class="dot"></span>
    ${isVite ? 'Projeto Vite detectado' : 'Nenhum projeto Vite detectado'}
  </div>

  ${!isVite ? '<div class="empty">Abra um projeto com Vite para usar a extensão.</div>' : ''}
  ${isVite && viewState === 'building' && buildState ? renderBuildProgress(buildState, outputDir || 'prerender-build') : ''}
  ${isVite && viewState !== 'building' ? renderIdleState(routes, enabledCount, viewState === 'scanning') : ''}

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    function $(id) { return document.getElementById(id); }

    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!t) return;
      const id = t.id;
      const data = t.dataset;

      if (id === 'scanBtn') vscode.postMessage({ type: 'scan' });
      if (id === 'runBtn') vscode.postMessage({ type: 'run' });
      if (id === 'cancelBtn') vscode.postMessage({ type: 'cancel' });
      if (id === 'backBtn') vscode.postMessage({ type: 'back' });
      if (id === 'openFolder') vscode.postMessage({ type: 'openFolder' });
      if (id === 'addBtn') {
        const input = $('routeInput');
        if (input && input.value.trim()) {
          vscode.postMessage({ type: 'addRoute', path: input.value.trim() });
          input.value = '';
        }
      }
      if (t.classList && t.classList.contains('rm-btn') && data.path) {
        e.stopPropagation();
        vscode.postMessage({ type: 'removeRoute', path: data.path });
      }
    });

    document.addEventListener('change', (e) => {
      const t = e.target;
      if (t && t.classList && t.classList.contains('route-check')) {
        vscode.postMessage({ type: 'toggleRoute', path: t.dataset.path });
      }
    });

    const ri = $('routeInput');
    if (ri) ri.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('addBtn')?.click(); });
  </script>
</body>
</html>`;
}

function renderIdleState(routes: Route[], enabledCount: number, scanning: boolean): string {
  const routeItems = routes
    .map(
      (r) => `
      <div class="route-item">
        <label>
          <input type="checkbox" class="route-check" data-path="${esc(r.path)}" ${r.enabled ? 'checked' : ''} />
          <span class="route-path">${esc(r.path)}</span>
        </label>
        <span class="badge ${r.enabled ? 'badge-yes' : 'badge-no'}">${r.enabled ? 'Sim' : 'Não'}</span>
        <button class="rm-btn" data-path="${esc(r.path)}" title="Remover">x</button>
      </div>`
    )
    .join('');

  return `
  <div class="section">
    <div class="label">Descoberta</div>
    <button class="btn btn-secondary" id="scanBtn" ${scanning ? 'disabled' : ''}>
      ${scanning ? '<span class="spinner"></span> Escaneando...' : 'Escanear Rotas'}
    </button>
  </div>

  <div class="divider"></div>

  <div class="section">
    <div class="label">Rotas</div>
    ${routes.length > 0
      ? `<div class="counter"><strong>${enabledCount}</strong> de ${routes.length} selecionada${routes.length !== 1 ? 's' : ''}</div>
         <div class="route-list">${routeItems}</div>`
      : '<div class="empty">Nenhuma rota encontrada.<br>Clique em "Escanear Rotas" ou adicione manualmente.</div>'
    }
    <div class="add-row">
      <input class="input" id="routeInput" type="text" placeholder="/nova-rota" />
      <button class="btn btn-primary btn-sm" id="addBtn">+</button>
    </div>
  </div>

  <div class="divider"></div>

  <button class="btn btn-primary" id="runBtn" ${enabledCount === 0 ? 'disabled' : ''}>
    Gerar Pre-render (${enabledCount} rota${enabledCount !== 1 ? 's' : ''})
  </button>`;
}

function renderBuildProgress(state: BuildState, outputDir: string): string {
  const percent = state.total > 0
    ? Math.round((state.completed / state.total) * 100)
    : 0;

  const stepLabels: Record<string, string> = {
    install: 'Verificando dependências...',
    build: 'Executando vite build...',
    render: `Renderizando rotas (${state.completed}/${state.total})`,
    done: 'Concluído',
    error: 'Erro',
  };

  const stepText = stepLabels[state.step] || state.step;

  const routeList = state.routeStatuses
    .map((r) => {
      const icons: Record<string, string> = {
        pending: '<span class="icon icon-pending">○</span>',
        rendering: '<span class="icon icon-rendering"><span class="spinner"></span></span>',
        done: '<span class="icon icon-done">✓</span>',
        error: '<span class="icon icon-error">✗</span>',
      };
      return `
        <div class="build-route">
          ${icons[r.status] || icons.pending}
          <span class="route-path">${esc(r.path)}</span>
          ${r.message ? `<span style="color:var(--vscode-errorForeground);font-size:10px">${esc(r.message)}</span>` : ''}
        </div>`;
    })
    .join('');

  let footer = '';

  if (state.finished) {
    const hasErrors = state.errors > 0;
    footer = `
      <div class="result-box ${hasErrors ? 'result-err' : 'result-ok'}">
        <strong>${hasErrors ? 'Concluído com erros' : 'Pre-render concluído'}</strong>
        ${state.completed - state.errors} rota(s) OK${hasErrors ? `, ${state.errors} erro(s)` : ''}
      </div>
      <div style="margin-top:8px;display:flex;gap:6px">
        <button class="btn btn-secondary" id="openFolder" style="flex:1">Abrir pasta</button>
        <button class="btn btn-primary" id="backBtn" style="flex:1">Voltar</button>
      </div>`;
  } else {
    footer = `
      <button class="btn btn-danger" id="cancelBtn" style="margin-top:8px">Cancelar</button>`;
  }

  return `
  <div class="section">
    <div class="label">Progresso</div>
    <div class="step-label">
      ${!state.finished ? '<span class="spinner"></span>' : ''} <strong>${stepText}</strong>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width:${state.finished && state.errors === 0 ? 100 : percent}%"></div>
    </div>
    <div class="route-list" style="margin-top:6px">${routeList}</div>
    ${footer}
  </div>`;
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
