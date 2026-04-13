import * as vscode from 'vscode';
import { Route } from '../configManager';

/**
 * Gera o HTML da interface do painel webview.
 * Layout compacto, alta densidade de informação.
 */
export function getHtml(
  webview: vscode.Webview,
  routes: Route[],
  isVite: boolean
): string {
  const nonce = getNonce();

  const routeRows = routes
    .map(
      (r) => `
      <tr>
        <td class="route-path">${escapeHtml(r.path)}</td>
        <td class="route-toggle">
          <button class="toggle-btn ${r.enabled ? 'enabled' : 'disabled'}"
                  data-path="${escapeHtml(r.path)}">
            ${r.enabled ? 'Ativa' : 'Inativa'}
          </button>
        </td>
        <td class="route-actions">
          <button class="remove-btn" data-path="${escapeHtml(r.path)}">Remover</button>
        </td>
      </tr>`
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
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 12px;
      margin: 0;
    }
    h2 {
      font-size: 14px;
      margin: 0 0 8px 0;
      font-weight: 600;
    }
    .status {
      padding: 6px 10px;
      margin-bottom: 12px;
      border-radius: 3px;
      font-size: 12px;
    }
    .status.ok {
      background: var(--vscode-testing-iconPassed);
      color: #fff;
    }
    .status.warn {
      background: var(--vscode-inputValidation-warningBackground);
      color: var(--vscode-inputValidation-warningForeground);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    th, td {
      text-align: left;
      padding: 4px 8px;
      font-size: 12px;
    }
    th {
      border-bottom: 1px solid var(--vscode-widget-border);
      font-weight: 600;
    }
    tr:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .route-path {
      font-family: var(--vscode-editor-font-family);
    }
    button {
      font-family: var(--vscode-font-family);
      font-size: 11px;
      border: none;
      padding: 3px 10px;
      border-radius: 3px;
      cursor: pointer;
    }
    .toggle-btn.enabled {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .toggle-btn.disabled {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .remove-btn {
      background: transparent;
      color: var(--vscode-errorForeground);
    }
    .remove-btn:hover {
      background: var(--vscode-inputValidation-errorBackground);
    }
    .actions {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .add-input {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      padding: 4px 8px;
      font-size: 12px;
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
    }
    .add-btn, .run-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      font-size: 12px;
      padding: 6px 16px;
      font-weight: 600;
    }
    .add-btn:hover, .run-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .run-btn {
      width: 100%;
      padding: 8px;
      font-size: 13px;
    }
    .empty {
      text-align: center;
      padding: 16px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
  </style>
</head>
<body>
  <h2>Vite Pre-render Assistant</h2>

  <div class="status ${isVite ? 'ok' : 'warn'}">
    ${isVite ? 'Projeto Vite detectado' : 'Projeto Vite nao detectado'}
  </div>

  <div class="actions">
    <input class="add-input" id="routeInput" type="text" placeholder="/nova-rota" />
    <button class="add-btn" id="addBtn">Adicionar</button>
  </div>

  ${
    routes.length > 0
      ? `<table>
    <thead>
      <tr>
        <th>Rota</th>
        <th>Estado</th>
        <th></th>
      </tr>
    </thead>
    <tbody>${routeRows}</tbody>
  </table>`
      : '<div class="empty">Nenhuma rota configurada</div>'
  }

  <button class="run-btn" id="runBtn" ${!isVite ? 'disabled' : ''}>
    Gerar + Executar
  </button>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    document.getElementById('addBtn').addEventListener('click', () => {
      const input = document.getElementById('routeInput');
      const value = input.value.trim();
      if (value) {
        vscode.postMessage({ type: 'addRoute', path: value });
        input.value = '';
      }
    });

    document.getElementById('routeInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('addBtn').click();
      }
    });

    document.getElementById('runBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'run' });
    });

    document.querySelectorAll('.toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'toggleRoute', path: btn.dataset.path });
      });
    });

    document.querySelectorAll('.remove-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
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
