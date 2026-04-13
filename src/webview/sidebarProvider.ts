import * as vscode from 'vscode';
import { RouteManager } from '../routeManager';
import { Runner } from '../runner';
import { getHtml } from './getHtml';

/**
 * Provider que registra a webview na barra lateral do VSCode.
 * Exibe a interface de gerenciamento de rotas e execução.
 */
export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vitePrerender.sidebarView';

  private view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly routeManager: RouteManager,
    private readonly runner: Runner,
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

    const routes = this.routeManager.listRoutes();
    this.view.webview.html = getHtml(
      this.view.webview,
      routes,
      this.isVite
    );
  }

  private handleMessage(message: { type: string; path?: string }): void {
    switch (message.type) {
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
}
