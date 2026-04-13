import * as vscode from 'vscode';
import { detectViteProject } from './detector';
import { ConfigManager } from './configManager';
import { RouteManager } from './routeManager';
import { RouteScanner } from './routeScanner';
import { Runner } from './runner';
import { LicenseManager } from './licensing/licenseManager';
import { initPremiumGate } from './licensing/premiumGate';
import { SidebarProvider } from './webview/sidebarProvider';
import { initI18n, t } from './i18n';

let runner: Runner | undefined;

export function activate(context: vscode.ExtensionContext): void {
  initI18n();

  const detection = detectViteProject();
  const isVite = detection.isVite && !!detection.rootPath;
  const rootPath = detection.rootPath;

  let configManager: ConfigManager | undefined;
  let routeManager: RouteManager | undefined;
  let routeScanner: RouteScanner | undefined;
  let licenseManager: LicenseManager | undefined;

  if (isVite && rootPath) {
    configManager = new ConfigManager(rootPath);
    routeManager = new RouteManager(configManager);
    routeScanner = new RouteScanner(rootPath, configManager);
    runner = new Runner(rootPath, configManager);

    const gatewayUrl = vscode.workspace
      .getConfiguration('vitePrerenderAssistant')
      .get<string>('gateway.url', 'https://vpar-gateway.vercel.app');

    licenseManager = new LicenseManager(configManager, gatewayUrl);
    initPremiumGate(licenseManager);

    // Revalidar licença em background (não bloqueia)
    licenseManager.revalidate();
  }

  const sidebarProvider = new SidebarProvider(
    context.extensionUri,
    configManager,
    routeManager,
    runner,
    routeScanner,
    licenseManager,
    isVite
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.viewType,
      sidebarProvider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vitePrerender.openPanel', () => {
      vscode.commands.executeCommand('vitePrerender.sidebarView.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vitePrerender.run', () => {
      if (!runner || !routeManager || !configManager) {
        vscode.window.showWarningMessage(t('error.notVite'));
        return;
      }
      const config = configManager.read() || configManager.ensureExists();
      const enabled = routeManager.listEnabledRoutes();
      runner.run(enabled, config);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vitePrerender.preview', () => {
      vscode.window.showInformationMessage(t('preview.useButton'));
    })
  );

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
