import * as vscode from 'vscode';
import { RouteManager } from '../routeManager';
import { Runner } from '../runner';
import { getHtml } from './getHtml';

/**
 * Gerencia o painel webview da extensão.
 * Comunica com os módulos via postMessage.
 */
export class PrerenderPanel {
  public static currentPanel: PrerenderPanel | undefined;
  private static readonly viewType = 'vitePrerenderPanel';

  private readonly panel: vscode.WebviewPanel;
  private readonly routeManager: RouteManager;
  private readonly runner: Runner;
  private readonly isVite: boolean;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    routeManager: RouteManager,
    runner: Runner,
    isVite: boolean
  ) {
    this.panel = panel;
    this.routeManager = routeManager;
    this.runner = runner;
    this.isVite = isVite;

    this.update();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      null,
      this.disposables
    );
  }

  /**
   * Cria ou exibe o painel.
   */
  static createOrShow(
    extensionUri: vscode.Uri,
    routeManager: RouteManager,
    runner: Runner,
    isVite: boolean
  ): PrerenderPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (PrerenderPanel.currentPanel) {
      PrerenderPanel.currentPanel.panel.reveal(column);
      PrerenderPanel.currentPanel.update();
      return PrerenderPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      PrerenderPanel.viewType,
      'Vite Pre-render',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    PrerenderPanel.currentPanel = new PrerenderPanel(
      panel,
      routeManager,
      runner,
      isVite
    );

    return PrerenderPanel.currentPanel;
  }

  private update(): void {
    const routes = this.routeManager.listRoutes();
    this.panel.webview.html = getHtml(
      this.panel.webview,
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

  private dispose(): void {
    PrerenderPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      d?.dispose();
    }
  }
}
