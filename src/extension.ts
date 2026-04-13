import * as vscode from 'vscode';
import { detectViteProject } from './detector';
import { ConfigManager } from './configManager';
import { RouteManager } from './routeManager';
import { RouteScanner } from './routeScanner';
import { Runner } from './runner';
import { SidebarProvider } from './webview/sidebarProvider';

let runner: Runner | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const detection = detectViteProject();
  const isVite = detection.isVite && !!detection.rootPath;
  const rootPath = detection.rootPath;

  let routeManager: RouteManager | undefined;
  let routeScanner: RouteScanner | undefined;

  if (isVite && rootPath) {
    const configManager = new ConfigManager(rootPath);
    routeManager = new RouteManager(configManager);
    routeScanner = new RouteScanner(rootPath);
    runner = new Runner(rootPath);
  }

  // Sidebar sempre registrada
  const sidebarProvider = new SidebarProvider(
    context.extensionUri,
    routeManager,
    runner,
    routeScanner,
    isVite
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.viewType,
      sidebarProvider
    )
  );

  // Comando: focar sidebar
  context.subscriptions.push(
    vscode.commands.registerCommand('vitePrerender.openPanel', () => {
      vscode.commands.executeCommand('vitePrerender.sidebarView.focus');
    })
  );

  // Comando: executar
  context.subscriptions.push(
    vscode.commands.registerCommand('vitePrerender.run', () => {
      if (!runner || !routeManager) {
        vscode.window.showWarningMessage(
          'Este projeto não foi detectado como um projeto Vite.'
        );
        return;
      }
      const enabled = routeManager.listEnabledRoutes();
      runner.run(enabled);
    })
  );

  // Observar mudanças no config
  if (rootPath) {
    const configWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(rootPath, 'prerender.config.json')
    );
    configWatcher.onDidChange(() => sidebarProvider.update());
    context.subscriptions.push(configWatcher);
  }

  context.subscriptions.push({ dispose: () => runner?.dispose() });
}

export function deactivate(): void {
  runner?.dispose();
}
