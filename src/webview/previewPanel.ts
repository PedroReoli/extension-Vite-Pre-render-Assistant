import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { t } from '../i18n';

/**
 * Painel de preview com 3 abas:
 * - Rendered: página renderizada com CSS (iframe)
 * - Source: código HTML formatado
 * - Raw: texto puro extraído da página
 */
export class PreviewPanel {
  private static panels = new Map<string, PreviewPanel>();

  private readonly panel: vscode.WebviewPanel;
  private readonly routePath: string;

  private constructor(
    panel: vscode.WebviewPanel,
    routePath: string,
    html: string,
    projectRoot?: string
  ) {
    this.panel = panel;
    this.routePath = routePath;

    this.panel.webview.html = this.buildHtml(html, projectRoot);

    this.panel.onDidDispose(() => {
      PreviewPanel.panels.delete(routePath);
    });
  }

  static show(routePath: string, html: string, projectRoot?: string): void {
    const existing = PreviewPanel.panels.get(routePath);
    if (existing) {
      existing.panel.reveal();
      existing.panel.webview.html = existing.buildHtml(html, projectRoot);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'vitePrerenderPreview',
      `${t('preview.title', { path: routePath })}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
      }
    );

    const instance = new PreviewPanel(panel, routePath, html, projectRoot);
    PreviewPanel.panels.set(routePath, instance);
  }

  /**
   * Injeta CSS inline no HTML para que o iframe renderize corretamente.
   * Lê os arquivos CSS referenciados e os insere como <style> tags.
   */
  private inlineAssets(html: string, projectRoot?: string): string {
    if (!projectRoot) {
      return html;
    }

    // Encontrar links de CSS e substituir por <style> inline
    return html.replace(
      /<link\s+[^>]*href=["']([^"']*\.css)["'][^>]*>/gi,
      (_match, href: string) => {
        const cssPath = this.resolveAssetPath(href, projectRoot);
        if (cssPath && fs.existsSync(cssPath)) {
          try {
            const css = fs.readFileSync(cssPath, 'utf-8');
            return `<style>${css}</style>`;
          } catch {
            return _match;
          }
        }
        return _match;
      }
    );
  }

  private resolveAssetPath(href: string, projectRoot: string): string | null {
    // Remover query strings e hashes
    const clean = href.split('?')[0].split('#')[0];

    // Assets relativos ao output dir
    const config = this.tryReadConfig(projectRoot);
    const outputDir = config?.outputDir || 'prerender-build';
    const fromOutput = path.join(projectRoot, outputDir, clean);
    if (fs.existsSync(fromOutput)) {
      return fromOutput;
    }

    // Assets relativos à raiz
    const fromRoot = path.join(projectRoot, clean);
    if (fs.existsSync(fromRoot)) {
      return fromRoot;
    }

    return null;
  }

  private tryReadConfig(projectRoot: string): { outputDir?: string } | null {
    try {
      const raw = fs.readFileSync(
        path.join(projectRoot, 'prerender.config.json'),
        'utf-8'
      );
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Extrai texto visível do HTML (sem tags).
   */
  private extractText(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  private buildHtml(renderedHtml: string, projectRoot?: string): string {
    const nonce = getNonce();
    const sizeKb = (Buffer.byteLength(renderedHtml, 'utf-8') / 1024).toFixed(1);

    // HTML com CSS inline para o iframe renderizado
    const inlined = this.inlineAssets(renderedHtml, projectRoot);
    const inlinedEscaped = esc(inlined);

    // Código-fonte original
    const sourceEscaped = esc(renderedHtml);

    // Texto puro extraído
    const rawText = esc(this.extractText(renderedHtml));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; frame-src blob: data:;">
  <title>${t('preview.title', { path: this.routePath })}</title>
  <style nonce="${nonce}">
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:var(--vscode-font-family);font-size:12px;color:var(--vscode-foreground);background:var(--vscode-editor-background)}
    .toolbar{display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--vscode-sideBar-background,var(--vscode-editor-background));border-bottom:1px solid var(--vscode-widget-border);position:sticky;top:0;z-index:10}
    .toolbar strong{font-size:13px}
    .toolbar .info{color:var(--vscode-descriptionForeground);font-size:11px}
    .tabs{display:flex;gap:3px;margin-left:auto}
    .tab{padding:4px 12px;border:none;border-radius:3px;cursor:pointer;font-size:11px;font-weight:600;background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);transition:background .15s}
    .tab:hover{background:var(--vscode-button-secondaryHoverBackground)}
    .tab.active{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
    .view{display:none;height:calc(100vh - 42px);overflow:auto}
    .view.active{display:block}
    .source-code{padding:12px;font-family:var(--vscode-editor-font-family);font-size:var(--vscode-editor-font-size,13px);white-space:pre-wrap;word-break:break-all;line-height:1.5;tab-size:2}
    .raw-text{padding:16px;font-family:var(--vscode-font-family);font-size:13px;line-height:1.6;color:var(--vscode-foreground);white-space:pre-wrap}
    .render-frame{width:100%;height:100%;border:none;background:#fff}
  </style>
</head>
<body>
  <div class="toolbar">
    <strong>${escAttr(this.routePath)}</strong>
    <span class="info">${sizeKb} KB</span>
    <div class="tabs">
      <button class="tab active" data-view="rendered">${t('preview.rendered')}</button>
      <button class="tab" data-view="source">${t('preview.source')}</button>
      <button class="tab" data-view="raw">${t('preview.raw')}</button>
    </div>
  </div>

  <div class="view active" id="rendered">
    <iframe class="render-frame" sandbox="allow-same-origin allow-scripts" srcdoc="${inlinedEscaped}"></iframe>
  </div>

  <div class="view" id="source">
    <pre class="source-code">${sourceEscaped}</pre>
  </div>

  <div class="view" id="raw">
    <div class="raw-text">${rawText}</div>
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
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let r = '';
  for (let i = 0; i < 32; i++) { r += c.charAt(Math.floor(Math.random() * c.length)); }
  return r;
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
