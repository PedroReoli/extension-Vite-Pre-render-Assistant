import * as vscode from 'vscode';
import { RouteManager } from '../routeManager';
import { RouteScanner, ScannedRoute } from '../routeScanner';
import { Runner, BuildProgress } from '../runner';
import { ConfigManager } from '../configManager';
import { getHtml, ViewState, BuildState, RouteStatus } from './getHtml';

/**
 * Provider que registra a webview na barra lateral do VSCode.
 * Gerencia estados: idle, scanning, building.
 */
export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vitePrerender.sidebarView';

  private view?: vscode.WebviewView;
  private viewState: ViewState = 'idle';
  private buildState?: BuildState;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly configManager: ConfigManager | undefined,
    private readonly routeManager: RouteManager | undefined,
    private readonly runner: Runner | undefined,
    private readonly routeScanner: RouteScanner | undefined,
    private readonly isVite: boolean
  ) {
    // Registrar callback de progresso
    if (this.runner) {
      this.runner.setProgressCallback((p) => this.onBuildProgress(p));
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

  update(): void {
    this.render();
  }

  private render(): void {
    if (!this.view) {
      return;
    }

    const routes = this.routeManager ? this.routeManager.listRoutes() : [];
    const config = this.configManager?.read();
    const outputDir = config?.outputDir || 'prerender-build';

    this.view.webview.html = getHtml(
      this.view.webview,
      routes,
      this.isVite,
      this.viewState,
      this.buildState,
      outputDir
    );
  }

  private handleMessage(message: { type: string; path?: string }): void {
    switch (message.type) {
      case 'scan':
        this.handleScan();
        break;

      case 'addRoute':
        if (message.path && this.routeManager) {
          this.routeManager.addRoute(message.path);
          this.render();
        }
        break;

      case 'removeRoute':
        if (message.path && this.routeManager) {
          this.routeManager.removeRoute(message.path);
          this.render();
        }
        break;

      case 'toggleRoute':
        if (message.path && this.routeManager) {
          this.routeManager.toggleRoute(message.path);
          this.render();
        }
        break;

      case 'run':
        this.handleRun();
        break;

      case 'cancel':
        this.runner?.cancel();
        this.viewState = 'idle';
        this.buildState = undefined;
        this.render();
        break;

      case 'back':
        this.viewState = 'idle';
        this.buildState = undefined;
        this.render();
        break;

      case 'openFolder': {
        const config = this.configManager?.read();
        const dir = config?.outputDir || 'prerender-build';
        this.runner?.openOutputFolder(dir);
        break;
      }
    }
  }

  private handleScan(): void {
    if (!this.routeScanner || !this.routeManager) {
      return;
    }

    this.viewState = 'scanning';
    this.render();

    setTimeout(() => {
      const found = this.routeScanner!.scan();
      const existing = new Set(this.routeManager!.listRoutes().map((r) => r.path));

      let added = 0;
      for (const scanned of found) {
        if (!existing.has(scanned.path)) {
          this.routeManager!.addRoute(scanned.path);
          added++;
        }
      }

      this.viewState = 'idle';
      this.render();

      const total = found.length;
      const alta = found.filter((r) => r.confidence === 'alta').length;

      if (added > 0) {
        vscode.window.showInformationMessage(
          `Scan: ${added} nova(s) rota(s) adicionada(s). ${total} total encontrada(s) (${alta} alta confiança).`
        );
      } else if (total > 0) {
        vscode.window.showInformationMessage(
          `Scan: todas as ${total} rotas já estavam na lista.`
        );
      } else {
        vscode.window.showInformationMessage(
          'Scan: nenhuma rota encontrada no projeto.'
        );
      }
    }, 50);
  }

  private handleRun(): void {
    if (!this.runner || !this.routeManager || !this.configManager) {
      return;
    }

    const enabled = this.routeManager.listEnabledRoutes();
    if (enabled.length === 0) {
      vscode.window.showWarningMessage('Nenhuma rota habilitada.');
      return;
    }

    const config = this.configManager.read() || this.configManager.ensureExists();

    // Iniciar estado de build
    this.buildState = {
      step: 'install',
      routeStatuses: enabled.map((r) => ({
        path: r.path,
        status: 'pending' as const,
      })),
      total: enabled.length,
      completed: 0,
      errors: 0,
      finished: false,
    };
    this.viewState = 'building';
    this.render();

    this.runner.run(enabled, config);
  }

  private onBuildProgress(p: BuildProgress): void {
    if (!this.buildState) {
      return;
    }

    this.buildState.step = p.step;

    if (p.step === 'render' && p.route) {
      const routeStatus = this.buildState.routeStatuses.find(
        (r) => r.path === p.route
      );

      if (routeStatus) {
        if (p.status === 'start') {
          routeStatus.status = 'rendering';
        } else if (p.status === 'done') {
          routeStatus.status = 'done';
          this.buildState.completed++;
        } else if (p.status === 'error') {
          routeStatus.status = 'error';
          routeStatus.message = p.message;
          this.buildState.completed++;
          this.buildState.errors++;
        }
      }

      if (p.total) {
        this.buildState.total = p.total;
      }
    }

    if (p.step === 'done') {
      this.buildState.finished = true;
      this.buildState.completed = this.buildState.total;
    }

    if (p.step === 'error' && p.status === 'error') {
      this.buildState.finished = true;
      this.buildState.errorMessage = p.message;
    }

    this.render();
  }
}
