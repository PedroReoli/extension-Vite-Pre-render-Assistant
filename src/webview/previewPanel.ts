import * as vscode from 'vscode';

/**
 * Painel de preview para visualizar o HTML renderizado de uma rota.
 * Abre em aba separada com o código-fonte e preview lado a lado.
 */
export class PreviewPanel {
  private static panels = new Map<string, PreviewPanel>();

  private readonly panel: vscode.WebviewPanel;
  private readonly routePath: string;

  private constructor(panel: vscode.WebviewPanel, routePath: string, html: string) {
    this.panel = panel;
    this.routePath = routePath;

    this.panel.webview.html = this.getPreviewHtml(html);

    this.panel.onDidDispose(() => {
      PreviewPanel.panels.delete(routePath);
    });
  }

  static show(routePath: string, html: string): void {
    const existing = PreviewPanel.panels.get(routePath);
    if (existing) {
      existing.panel.reveal();
      existing.panel.webview.html = existing.getPreviewHtml(html);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'vitePrerenderPreview',
      `Preview: ${routePath}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
      }
    );

    const instance = new PreviewPanel(panel, routePath, html);
    PreviewPanel.panels.set(routePath, instance);
  }

  private getPreviewHtml(renderedHtml: string): string {
    const nonce = getNonce();
    const escaped = renderedHtml
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const sizeKb = (Buffer.byteLength(renderedHtml, 'utf-8') / 1024).toFixed(1);

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <title>Preview: ${this.routePath}</title>
  <style nonce="${nonce}">
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: 12px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      border-bottom: 1px solid var(--vscode-widget-border);
      font-size: 12px;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .toolbar strong { font-size: 13px; }
    .toolbar .info { color: var(--vscode-descriptionForeground); }
    .tabs {
      display: flex;
      gap: 4px;
      margin-left: auto;
    }
    .tab {
      padding: 4px 12px;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .tab.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .view { display: none; height: calc(100vh - 40px); overflow: auto; }
    .view.active { display: block; }
    .source {
      padding: 12px;
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size, 13px);
      white-space: pre-wrap;
      word-break: break-all;
      line-height: 1.5;
      tab-size: 2;
    }
    .preview-frame {
      width: 100%;
      height: 100%;
      border: none;
      background: #fff;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <strong>${this.routePath}</strong>
    <span class="info">${sizeKb} KB</span>
    <div class="tabs">
      <button class="tab active" data-view="source">Código</button>
      <button class="tab" data-view="preview">Preview</button>
    </div>
  </div>

  <div class="view active" id="source">
    <pre class="source">${escaped}</pre>
  </div>

  <div class="view" id="preview">
    <iframe class="preview-frame" sandbox="allow-same-origin" srcdoc="${escaped}"></iframe>
  </div>

  <script nonce="${nonce}">
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.view).classList.add('active');
      });
    });
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
