import * as vscode from 'vscode';
import { detectViteProject } from './detector';
import { ConfigManager } from './configManager';
import { RouteManager } from './routeManager';
import { Runner } from './runner';
import { PrerenderPanel } from './webview/panel';

let runner: Runner | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const detection = detectViteProject();

  if (!detection.isVite || !detection.rootPath) {
    // Extensão não ativa se o projeto não for Vite.
    // Registra comandos mesmo assim para exibir aviso.
    context.subscriptions.push(
      vscode.commands.registerCommand('vitePrerender.openPanel', () => {
        vscode.window.showWarningMessage(
          'Este projeto não foi detectado como um projeto Vite.'
        );
      }),
      vscode.commands.registerCommand('vitePrerender.run', () => {
        vscode.window.showWarningMessage(
          'Este projeto não foi detectado como um projeto Vite.'
        );
      })
    );
    return;
  }

  const rootPath = detection.rootPath;
  const configManager = new ConfigManager(rootPath);
  const routeManager = new RouteManager(configManager);
  runner = new Runner(rootPath);

  // Comando: abrir painel
  context.subscriptions.push(
    vscode.commands.registerCommand('vitePrerender.openPanel', () => {
      PrerenderPanel.createOrShow(
        context.extensionUri,
        routeManager,
        runner!,
        true
      );
    })
  );

  // Comando: executar diretamente
  context.subscriptions.push(
    vscode.commands.registerCommand('vitePrerender.run', () => {
      const enabled = routeManager.listEnabledRoutes();
      runner!.run(enabled);
    })
  );

  // Observar mudanças no prerender.config.json para atualizar a UI
  const configWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(rootPath, 'prerender.config.json')
  );

  configWatcher.onDidChange(() => {
    if (PrerenderPanel.currentPanel) {
      PrerenderPanel.createOrShow(
        context.extensionUri,
        routeManager,
        runner!,
        true
      );
    }
  });

  context.subscriptions.push(configWatcher);
  context.subscriptions.push({ dispose: () => runner?.dispose() });
}

export function deactivate(): void {
  runner?.dispose();
}
