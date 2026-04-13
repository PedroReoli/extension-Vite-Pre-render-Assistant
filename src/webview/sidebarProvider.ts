import * as vscode from 'vscode';
import { RouteManager } from '../routeManager';
import { RouteScanner } from '../routeScanner';
import { Runner } from '../runner';
import { getHtml } from './getHtml';

/**
 * Provider que registra a webview na barra lateral do VSCode.
 * Exibe a interface de gerenciamento de rotas e execução.
 */
export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vitePrerender.sidebarView';

  private view?: vscode.WebviewView;
  private scanning = false;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly routeManager: RouteManager | undefined,
    private readonly runner: Runner | undefined,
    private readonly routeScanner: RouteScanner | undefined,
    private readonly isVite: boolean
  ) {}

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

    this.update();

    webviewView.webview.onDidReceiveMessage((message) =>
      this.handleMessage(message)
    );
  }

  update(): void {
    if (!this.view) {
      return;
    }

    const routes = this.routeManager ? this.routeManager.listRoutes() : [];
    this.view.webview.html = getHtml(
      this.view.webview,
      routes,
      this.isVite,
      this.scanning
    );
  }

  private handleMessage(message: { type: string; path?: string }): void {
    if (!this.routeManager || !this.runner) {
      return;
    }

    switch (message.type) {
      case 'scan':
        this.handleScan();
        break;

      case 'addRoute':
        if (message.path) {
          this.routeManager.addRoute(message.path);
          this.update();
        }
        break;

      case 'removeRoute':
        if (message.path) {
          this.routeManager.removeRoute(message.path);
          this.update();
        }
        break;

      case 'toggleRoute':
        if (message.path) {
          this.routeManager.toggleRoute(message.path);
          this.update();
        }
        break;

      case 'run': {
        const enabled = this.routeManager.listEnabledRoutes();
        this.runner.run(enabled);
        break;
      }
    }
  }

  private handleScan(): void {
    if (!this.routeScanner || !this.routeManager) {
      return;
    }

    this.scanning = true;
    this.update();

    // Executa o scan de forma assíncrona para não travar a UI
    setTimeout(() => {
      const foundRoutes = this.routeScanner!.scan();
      const existingRoutes = this.routeManager!.listRoutes().map((r) => r.path);

      let added = 0;
      for (const routePath of foundRoutes) {
        if (!existingRoutes.includes(routePath)) {
          this.routeManager!.addRoute(routePath);
          added++;
        }
      }

      this.scanning = false;
      this.update();

      if (added > 0) {
        vscode.window.showInformationMessage(
          `Scan concluído: ${added} nova(s) rota(s) encontrada(s).`
        );
      } else if (foundRoutes.length > 0) {
        vscode.window.showInformationMessage(
          `Scan concluído: todas as ${foundRoutes.length} rotas já estavam na lista.`
        );
      } else {
        vscode.window.showInformationMessage(
          'Scan concluído: nenhuma rota encontrada no projeto.'
        );
      }
    }, 50);
  }
}
