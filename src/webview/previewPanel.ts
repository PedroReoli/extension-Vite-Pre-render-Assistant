import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { t } from '../i18n';

/**
 * Painel de preview com 3 abas:
 * - Rendered: página real com CSS/JS/imagens via webview URIs
 * - Source: código HTML formatado
 * - Raw: texto puro extraído
 *
 * A aba Rendered funciona reescrevendo os paths dos assets
 * para URIs do webview, que o VSCode serve diretamente do disco.
 */
export class PreviewPanel {
  private static panels = new Map<string, PreviewPanel>();

  private readonly panel: vscode.WebviewPanel;
  private readonly routePath: string;

  private constructor(
    panel: vscode.WebviewPanel,
    routePath: string,
    html: string,
    buildDir: string
  ) {
    this.panel = panel;
    this.routePath = routePath;

    this.update(html, buildDir);

    this.panel.onDidDispose(() => {
      PreviewPanel.panels.delete(routePath);
    });

    this.panel.webview.onDidReceiveMessage((msg) => {
      if (msg.type === 'switchTab') {
        this.panel.webview.postMessage({ type: 'showTab', tab: msg.tab });
      }
    });
  }

  static show(routePath: string, html: string, projectRoot?: string): void {
    const buildDir = PreviewPanel.resolveBuildDir(projectRoot || '');

    const existing = PreviewPanel.panels.get(routePath);
    if (existing) {
      existing.panel.reveal();
      existing.update(html, buildDir);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'vitePrerenderPreview',
      t('preview.title', { path: routePath }),
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: buildDir
          ? [vscode.Uri.file(buildDir)]
          : undefined,
      }
    );

    const instance = new PreviewPanel(panel, routePath, html, buildDir);
    PreviewPanel.panels.set(routePath, instance);
  }

  private update(html: string, buildDir: string): void {
    const webview = this.panel.webview;
    const nonce = getNonce();
    const sizeKb = (Buffer.byteLength(html, 'utf-8') / 1024).toFixed(1);

    // Reescrever paths de assets para webview URIs
    const renderedHtml = this.rewriteAssetPaths(html, buildDir, webview);

    // Código-fonte original (escaped para exibição)
    const sourceEscaped = escHtml(html);

    // Texto puro extraído
    const rawText = escHtml(this.extractText(html));

    webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src ${webview.cspSource} 'unsafe-inline';
                 script-src 'nonce-${nonce}';
                 img-src ${webview.cspSource} data: https:;
                 font-src ${webview.cspSource} data:;">
  <title>${t('preview.title', { path: this.routePath })}</title>
  <style nonce="${nonce}">
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:var(--vscode-editor-background);color:var(--vscode-foreground);font-family:var(--vscode-font-family)}
    .pv-toolbar{display:flex;align-items:center;gap:10px;padding:6px 12px;background:var(--vscode-sideBar-background,var(--vscode-editor-background));border-bottom:1px solid var(--vscode-widget-border);position:fixed;top:0;left:0;right:0;z-index:99999;font-size:12px}
    .pv-toolbar strong{font-size:13px}
    .pv-toolbar .pv-info{color:var(--vscode-descriptionForeground);font-size:11px}
    .pv-tabs{display:flex;gap:3px;margin-left:auto}
    .pv-tab{padding:4px 12px;border:none;border-radius:3px;cursor:pointer;font-size:11px;font-weight:600;background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
    .pv-tab:hover{background:var(--vscode-button-secondaryHoverBackground)}
    .pv-tab.active{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
    .pv-view{display:none;padding-top:38px;min-height:100vh}
    .pv-view.active{display:block}
    #pv-rendered{background:#fff;color:#000}
    #pv-source{padding:12px;padding-top:50px}
    #pv-source pre{font-family:var(--vscode-editor-font-family);font-size:var(--vscode-editor-font-size,13px);white-space:pre-wrap;word-break:break-all;line-height:1.5;tab-size:2}
    #pv-raw{padding:16px;padding-top:50px;font-size:13px;line-height:1.6;white-space:pre-wrap}
  </style>
</head>
<body>
  <div class="pv-toolbar">
    <strong>${escAttr(this.routePath)}</strong>
    <span class="pv-info">${sizeKb} KB</span>
    <div class="pv-tabs">
      <button class="pv-tab active" data-tab="pv-rendered">${t('preview.rendered')}</button>
      <button class="pv-tab" data-tab="pv-source">${t('preview.source')}</button>
      <button class="pv-tab" data-tab="pv-raw">${t('preview.raw')}</button>
    </div>
  </div>

  <div class="pv-view active" id="pv-rendered">
    ${renderedHtml}
  </div>

  <div class="pv-view" id="pv-source">
    <pre>${sourceEscaped}</pre>
  </div>

  <div class="pv-view" id="pv-raw">
    ${rawText}
  </div>

  <script nonce="${nonce}">
    document.querySelectorAll('.pv-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.pv-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.pv-view').forEach(v => v.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
      });
    });
  </script>
</body>
</html>`;
  }

  /**
   * Reescreve todos os paths de assets no HTML para webview URIs.
   * Isso permite que o webview carregue CSS, JS, imagens e fontes diretamente do disco.
   */
  private rewriteAssetPaths(
    html: string,
    buildDir: string,
    webview: vscode.Webview
  ): string {
    if (!buildDir) { return html; }

    // Padrão genérico: qualquer href="..." ou src="..." que comece com /
    // Reescreve para URI do webview
    html = html.replace(
      /((?:href|src|content)\s*=\s*["'])(\/[^"']+)(["'])/gi,
      (_match, prefix: string, assetPath: string, suffix: string) => {
        const resolved = this.resolveToWebviewUri(assetPath, buildDir, webview);
        if (resolved) {
          return prefix + resolved + suffix;
        }
        return _match;
      }
    );

    // CSS url() dentro de <style> tags ou atributos style
    html = html.replace(
      /url\(\s*["']?(\/[^"')]+)["']?\s*\)/gi,
      (_match, assetPath: string) => {
        const resolved = this.resolveToWebviewUri(assetPath, buildDir, webview);
        if (resolved) {
          return `url("${resolved}")`;
        }
        return _match;
      }
    );

    return html;
  }

  private resolveToWebviewUri(
    assetPath: string,
    buildDir: string,
    webview: vscode.Webview
  ): string | null {
    let clean = assetPath.split('?')[0].split('#')[0];
    if (clean.startsWith('/')) {
      clean = clean.slice(1);
    }

    const filePath = path.join(buildDir, clean);
    if (fs.existsSync(filePath)) {
      const uri = vscode.Uri.file(filePath);
      return webview.asWebviewUri(uri).toString();
    }

    return null;
  }

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

  private static resolveBuildDir(projectRoot: string): string {
    if (!projectRoot) { return ''; }
    try {
      const raw = fs.readFileSync(
        path.join(projectRoot, 'prerender.config.json'),
        'utf-8'
      );
      const config = JSON.parse(raw);
      return path.join(projectRoot, config.outputDir || 'prerender-build');
    } catch {
      return path.join(projectRoot, 'prerender-build');
    }
  }
}

function getNonce(): string {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let r = '';
  for (let i = 0; i < 32; i++) { r += c.charAt(Math.floor(Math.random() * c.length)); }
  return r;
}

function escHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
