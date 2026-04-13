import * as vscode from 'vscode';
import { RouteManager } from '../routeManager';
import { RouteScanner } from '../routeScanner';
import { Runner, BuildProgress } from '../runner';
import { ConfigManager, BuildResults } from '../configManager';
import { PreviewPanel } from './previewPanel';
import { generateMetaTags } from '../seo/metaTagGenerator';
import { applyMetaTag } from '../seo/metaTagInjector';
import { getHtml, ViewState, BuildState, SeoFixState, SeoFixItem } from './getHtml';
import { t } from '../i18n';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vitePrerender.sidebarView';

  private view?: vscode.WebviewView;
  private viewState: ViewState = 'idle';
  private seoFixState?: SeoFixState;
  private buildState?: BuildState;
  private lastResults?: BuildResults | null;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly configManager: ConfigManager | undefined,
    private readonly routeManager: RouteManager | undefined,
    private readonly runner: Runner | undefined,
    private readonly routeScanner: RouteScanner | undefined,
    private readonly isVite: boolean
  ) {
    if (this.runner) {
      this.runner.setProgressCallback((p) => this.onBuildProgress(p));
    }
    if (this.configManager) {
      this.lastResults = this.configManager.readBuildResults();
    }
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    this.render();
    webviewView.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
  }

  update(): void { this.render(); }

  private render(): void {
    if (!this.view) { return; }
    const routes = this.routeManager ? this.routeManager.listRoutes() : [];
    const config = this.configManager?.read();
    const outputDir = config?.outputDir || 'prerender-build';
    const isOutdated = this.configManager?.isOutdated() || false;

    this.view.webview.html = getHtml(
      this.view.webview, routes, this.isVite, this.viewState,
      this.buildState, outputDir, isOutdated, this.lastResults,
      this.seoFixState
    );
  }

  private handleMessage(msg: { type: string; path?: string; dir?: string; index?: number }): void {
    switch (msg.type) {
      case 'scan': this.handleScan(); break;
      case 'addRoute': if (msg.path && this.routeManager) { this.routeManager.addRoute(msg.path); this.render(); } break;
      case 'removeRoute': if (msg.path && this.routeManager) { this.routeManager.removeRoute(msg.path); this.render(); } break;
      case 'toggleRoute': if (msg.path && this.routeManager) { this.routeManager.toggleRoute(msg.path); this.render(); } break;
      case 'moveRoute': this.handleMoveRoute(msg.path, msg.dir); break;
      case 'run': this.handleRun(); break;
      case 'cancel': this.runner?.cancel(); this.viewState = 'idle'; this.buildState = undefined; this.render(); break;
      case 'back': this.viewState = 'idle'; this.buildState = undefined; this.render(); break;
      case 'openFolder': this.handleOpenFolder(); break;
      case 'showResults': this.handleShowResults(); break;
      case 'preview': this.handlePreview(msg.path); break;
      case 'deployZip': this.handleDeployZip(); break;
      case 'deployCopy': this.handleDeployCopy(); break;
      case 'fixSeo': this.handleFixSeo(msg.path); break;
      case 'applyFix': this.handleApplyFix(msg.index); break;
      case 'applyAllFixes': this.handleApplyAllFixes(); break;
      case 'rebuild': this.handleRebuild(); break;
      case 'aiSuggest': this.handleAiSuggest(msg.path); break;
      case 'exportReport': this.handleExportReport(); break;
    }
  }

  private handleMoveRoute(routePath?: string, direction?: string): void {
    if (!routePath || !direction || !this.routeManager) { return; }
    const routes = this.routeManager.listRoutes();
    const idx = routes.findIndex((r) => r.path === routePath);
    if (idx === -1) { return; }
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= routes.length) { return; }
    const temp = routes[idx];
    routes[idx] = routes[newIdx];
    routes[newIdx] = temp;
    this.configManager?.updateRoutes(routes);
    this.render();
  }

  private handleScan(): void {
    if (!this.routeScanner || !this.routeManager) { return; }

    const cache = this.routeScanner.checkCache();
    if (cache.valid) {
      const existing = new Set(this.routeManager.listRoutes().map((r) => r.path));
      const newRoutes = cache.routes.filter((p) => !existing.has(p));
      if (newRoutes.length === 0) {
        vscode.window.showInformationMessage(t('scan.cacheValid', { total: cache.routes.length }));
        return;
      }
      for (const p of newRoutes) { this.routeManager.addRoute(p); }
      this.render();
      vscode.window.showInformationMessage(t('scan.cacheNewRoutes', { count: newRoutes.length }));
      return;
    }

    this.viewState = 'scanning';
    this.render();

    setTimeout(() => {
      const found = this.routeScanner!.scan();
      const existing = new Set(this.routeManager!.listRoutes().map((r) => r.path));
      let added = 0;
      for (const scanned of found) {
        if (!existing.has(scanned.path)) { this.routeManager!.addRoute(scanned.path); added++; }
      }
      this.viewState = 'idle';
      this.render();

      const total = found.length;
      const alta = found.filter((r) => r.confidence === 'alta').length;
      if (added > 0) { vscode.window.showInformationMessage(t('scan.added', { count: added, total, alta })); }
      else if (total > 0) { vscode.window.showInformationMessage(t('scan.allExist', { total })); }
      else { vscode.window.showInformationMessage(t('scan.noneFound')); }
    }, 50);
  }

  private handleRun(): void {
    if (!this.runner || !this.routeManager || !this.configManager) { return; }
    const enabled = this.routeManager.listEnabledRoutes();
    if (enabled.length === 0) { vscode.window.showWarningMessage(t('build.noRoutes')); return; }
    const config = this.configManager.read() || this.configManager.ensureExists();
    this.buildState = {
      step: 'install',
      routeStatuses: enabled.map((r) => ({ path: r.path, status: 'pending' as const })),
      total: enabled.length, completed: 0, errors: 0, finished: false,
    };
    this.viewState = 'building';
    this.render();
    this.runner.run(enabled, config);
  }

  private handleOpenFolder(): void {
    const config = this.configManager?.read();
    this.runner?.openOutputFolder(config?.outputDir || 'prerender-build');
  }

  private handleShowResults(): void {
    this.lastResults = this.configManager?.readBuildResults() || null;
    if (this.lastResults) {
      this.viewState = 'results'; this.buildState = undefined; this.render();
    } else {
      vscode.window.showWarningMessage(t('error.noResults'));
    }
  }

  private handlePreview(routePath?: string): void {
    if (!routePath || !this.runner || !this.configManager) { return; }
    const config = this.configManager.read();
    const html = this.runner.getRenderedHtml(routePath, config?.outputDir || 'prerender-build');
    if (html) { PreviewPanel.show(routePath, html, this.configManager?.getProjectRoot()); }
    else { vscode.window.showWarningMessage(t('error.htmlNotFound', { path: routePath })); }
  }

  private handleDeployZip(): void {
    const config = this.configManager?.read();
    this.runner?.generateZip(config?.outputDir || 'prerender-build');
  }

  private handleDeployCopy(): void {
    if (!this.runner || !this.configManager) { return; }
    const config = this.configManager.read();
    const outputDir = config?.outputDir || 'prerender-build';
    const dest = config?.deploy?.copyTo;
    if (!dest) {
      vscode.window.showInputBox({
        prompt: t('deploy.copyPrompt'), placeHolder: t('deploy.copyPlaceholder'),
      }).then((value) => { if (value) { this.runner!.deployTo(outputDir, value); } });
    } else {
      this.runner.deployTo(outputDir, dest);
    }
  }

  private handleFixSeo(routePath?: string): void {
    if (!routePath || !this.configManager || !this.runner) { return; }

    const results = this.configManager.readBuildResults();
    if (!results) {
      vscode.window.showWarningMessage(t('error.noResults'));
      return;
    }

    const routeResult = results.routes.find((r) => r.path === routePath);
    if (!routeResult) { return; }

    const config = this.configManager.read();
    const outputDir = config?.outputDir || 'prerender-build';
    const html = this.runner.getRenderedHtml(routePath, outputDir);
    if (!html) {
      vscode.window.showWarningMessage(t('error.htmlNotFound', { path: routePath }));
      return;
    }

    const suggestions = generateMetaTags(html, routePath, routeResult.seo);
    if (suggestions.length === 0) {
      vscode.window.showInformationMessage(t('seo.allGood'));
      return;
    }

    this.seoFixState = {
      routePath,
      suggestions: suggestions.map((s) => ({ suggestion: s, status: 'pending' })),
      allDone: false,
    };
    this.viewState = 'seoFix';
    this.render();
  }

  private handleApplyFix(index?: number): void {
    if (index === undefined || !this.seoFixState || !this.configManager) { return; }

    const item = this.seoFixState.suggestions[index];
    if (!item || item.status !== 'pending') { return; }

    const projectRoot = this.configManager.getProjectRoot();
    const result = applyMetaTag(projectRoot, item.suggestion);

    if (result.success) {
      item.status = 'applied';
    } else {
      item.status = 'error';
      item.error = result.error;
    }

    this.checkAllDone();
    this.render();
  }

  private handleApplyAllFixes(): void {
    if (!this.seoFixState || !this.configManager) { return; }

    const projectRoot = this.configManager.getProjectRoot();

    for (const item of this.seoFixState.suggestions) {
      if (item.status !== 'pending') { continue; }

      const result = applyMetaTag(projectRoot, item.suggestion);
      if (result.success) {
        item.status = 'applied';
      } else {
        item.status = 'error';
        item.error = result.error;
      }
    }

    this.checkAllDone();
    this.render();
  }

  private handleRebuild(): void {
    this.seoFixState = undefined;
    this.handleRun();
  }

  private checkAllDone(): void {
    if (!this.seoFixState) { return; }
    const pending = this.seoFixState.suggestions.filter((s) => s.status === 'pending');
    this.seoFixState.allDone = pending.length === 0;
  }

  private handleAiSuggest(routePath?: string): void {
    if (!routePath) { return; }
    // Fase 4
    vscode.window.showInformationMessage(`AI Suggestions: ${routePath} — coming soon.`);
  }

  private handleExportReport(): void {
    // Fase 5
    vscode.window.showInformationMessage('Export SEO Report — coming soon.');
  }

  private onBuildProgress(p: BuildProgress): void {
    if (!this.buildState) { return; }
    this.buildState.step = p.step;

    if (p.step === 'render' && p.route) {
      const rs = this.buildState.routeStatuses.find((r) => r.path === p.route);
      if (rs) {
        if (p.status === 'start') { rs.status = 'rendering'; }
        else if (p.status === 'done') { rs.status = 'done'; rs.result = p.result; this.buildState.completed++; }
        else if (p.status === 'error') { rs.status = 'error'; rs.message = p.message; rs.result = p.result; this.buildState.completed++; this.buildState.errors++; }
      }
      if (p.total) { this.buildState.total = p.total; }
    }

    if (p.step === 'done') {
      this.buildState.finished = true;
      this.buildState.completed = this.buildState.total;
      this.lastResults = this.configManager?.readBuildResults() || null;
    }

    if (p.step === 'error' && p.status === 'error') {
      this.buildState.finished = true;
      this.buildState.errorMessage = p.message;
    }

    this.render();
  }
}
