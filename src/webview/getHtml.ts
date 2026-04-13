import * as vscode from 'vscode';
import { Route } from '../configManager';

/**
 * Gera o HTML da interface do painel webview.
 * Layout compacto, amigável, com scan de rotas e toggles Sim/Não.
 */
export function getHtml(
  webview: vscode.Webview,
  routes: Route[],
  isVite: boolean,
  scanning: boolean = false
): string {
  const nonce = getNonce();

  const enabledCount = routes.filter((r) => r.enabled).length;

  const routeItems = routes
    .map(
      (r) => `
      <div class="route-item">
        <label class="route-label">
          <input type="checkbox" class="route-check" data-path="${escapeHtml(r.path)}"
                 ${r.enabled ? 'checked' : ''} />
          <span class="route-path">${escapeHtml(r.path)}</span>
        </label>
        <span class="route-badge ${r.enabled ? 'badge-yes' : 'badge-no'}">
          ${r.enabled ? 'Sim' : 'Não'}
        </span>
        <button class="route-remove" data-path="${escapeHtml(r.path)}" title="Remover rota">x</button>
      </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vite Pre-render Assistant</title>
  <style nonce="${nonce}">
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: 12px;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      padding: 10px;
    }

    /* Header */
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }
    .header-icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }
    .header-icon svg {
      width: 100%;
      height: 100%;
      stroke: var(--vscode-foreground);
      fill: none;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .header h2 {
      font-size: 13px;
      font-weight: 600;
    }

    /* Status badge */
    .status {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      margin-bottom: 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .status.ok { background: rgba(40, 167, 69, 0.12); }
    .status.ok .status-dot { background: #28a745; }
    .status.warn { background: rgba(220, 53, 69, 0.12); }
    .status.warn .status-dot { background: #dc3545; }

    /* Section */
    .section {
      margin-bottom: 10px;
    }
    .section-title {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 6px;
    }

    /* Scan button */
    .scan-btn {
      width: 100%;
      padding: 7px 10px;
      font-size: 11px;
      font-weight: 600;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .scan-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .scan-btn.scanning {
      opacity: 0.7;
      cursor: wait;
    }

    /* Add route */
    .add-row {
      display: flex;
      gap: 4px;
      margin-top: 8px;
    }
    .add-input {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      padding: 5px 8px;
      font-size: 12px;
      border-radius: 4px;
      font-family: var(--vscode-editor-font-family);
      outline: none;
    }
    .add-input:focus {
      border-color: var(--vscode-focusBorder);
    }
    .add-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 5px 12px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    .add-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    /* Route list */
    .route-list {
      max-height: 300px;
      overflow-y: auto;
      margin-bottom: 4px;
    }
    .route-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 6px;
      border-radius: 3px;
    }
    .route-item:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .route-label {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      cursor: pointer;
      min-width: 0;
    }
    .route-check {
      accent-color: var(--vscode-button-background);
      cursor: pointer;
      flex-shrink: 0;
    }
    .route-path {
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .route-badge {
      font-size: 10px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 3px;
      flex-shrink: 0;
    }
    .badge-yes {
      background: rgba(40, 167, 69, 0.15);
      color: #28a745;
    }
    .badge-no {
      background: rgba(150, 150, 150, 0.15);
      color: var(--vscode-descriptionForeground);
    }
    .route-remove {
      background: none;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      font-size: 12px;
      padding: 0 4px;
      border-radius: 3px;
      line-height: 1;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .route-item:hover .route-remove {
      opacity: 1;
    }
    .route-remove:hover {
      color: var(--vscode-errorForeground);
      background: rgba(220, 53, 69, 0.1);
    }

    /* Counter */
    .counter {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }
    .counter strong {
      color: var(--vscode-foreground);
    }

    /* Empty state */
    .empty {
      text-align: center;
      padding: 20px 10px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      line-height: 1.5;
    }

    /* Generate button */
    .run-btn {
      width: 100%;
      padding: 8px 10px;
      font-size: 12px;
      font-weight: 600;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 6px;
    }
    .run-btn:hover:not(:disabled) {
      background: var(--vscode-button-hoverBackground);
    }
    .run-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Divider */
    .divider {
      height: 1px;
      background: var(--vscode-widget-border, rgba(128,128,128,0.2));
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-icon">
      <svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    </div>
    <h2>Pre-render</h2>
  </div>

  <div class="status ${isVite ? 'ok' : 'warn'}">
    <span class="status-dot"></span>
    ${isVite ? 'Projeto Vite detectado' : 'Nenhum projeto Vite detectado'}
  </div>

  ${isVite ? `
  <!-- Scan -->
  <div class="section">
    <div class="section-title">Descoberta</div>
    <button class="scan-btn ${scanning ? 'scanning' : ''}" id="scanBtn" ${scanning ? 'disabled' : ''}>
      ${scanning ? 'Escaneando...' : 'Escanear Rotas'}
    </button>
  </div>

  <div class="divider"></div>

  <!-- Routes -->
  <div class="section">
    <div class="section-title">Rotas</div>
    ${routes.length > 0
      ? `<div class="counter"><strong>${enabledCount}</strong> de ${routes.length} selecionada${routes.length !== 1 ? 's' : ''}</div>
         <div class="route-list">${routeItems}</div>`
      : '<div class="empty">Nenhuma rota encontrada.<br>Clique em "Escanear Rotas" ou adicione manualmente.</div>'
    }
    <div class="add-row">
      <input class="add-input" id="routeInput" type="text" placeholder="/nova-rota" />
      <button class="add-btn" id="addBtn">+</button>
    </div>
  </div>

  <div class="divider"></div>

  <!-- Generate -->
  <button class="run-btn" id="runBtn" ${enabledCount === 0 ? 'disabled' : ''}>
    Gerar Pre-render (${enabledCount} rota${enabledCount !== 1 ? 's' : ''})
  </button>
  ` : `
  <div class="empty">
    Abra um projeto com Vite para usar a extensão.
  </div>
  `}

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    function $(id) { return document.getElementById(id); }

    if ($('scanBtn')) {
      $('scanBtn').addEventListener('click', () => {
        vscode.postMessage({ type: 'scan' });
      });
    }

    if ($('addBtn')) {
      $('addBtn').addEventListener('click', () => {
        const input = $('routeInput');
        const value = input.value.trim();
        if (value) {
          vscode.postMessage({ type: 'addRoute', path: value });
          input.value = '';
        }
      });

      $('routeInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') $('addBtn').click();
      });
    }

    if ($('runBtn')) {
      $('runBtn').addEventListener('click', () => {
        vscode.postMessage({ type: 'run' });
      });
    }

    document.querySelectorAll('.route-check').forEach((cb) => {
      cb.addEventListener('change', () => {
        vscode.postMessage({ type: 'toggleRoute', path: cb.dataset.path });
      });
    });

    document.querySelectorAll('.route-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        vscode.postMessage({ type: 'removeRoute', path: btn.dataset.path });
      });
    });
  </script>
</body>
</html>`;
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
