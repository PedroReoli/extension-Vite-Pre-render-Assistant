import * as vscode from 'vscode';
import { LicenseManager } from './licenseManager';
import { t } from '../i18n';

let manager: LicenseManager | undefined;

/**
 * Inicializa o gate premium. Chamado uma vez na ativação.
 */
export function initPremiumGate(lm: LicenseManager): void {
  manager = lm;
}

/**
 * Verifica se o usuário é premium. Leitura síncrona.
 */
export function isPremium(): boolean {
  return manager?.isPremium() ?? false;
}

/**
 * Exige premium para continuar. Retorna true se premium, false se não.
 * Exibe notificação de upgrade quando não premium.
 */
export function requirePremium(): boolean {
  if (isPremium()) {
    return true;
  }

  vscode.window.showInformationMessage(
    t('premium.required'),
    t('premium.upgrade')
  ).then((choice) => {
    if (choice === t('premium.upgrade')) {
      const gatewayUrl = vscode.workspace
        .getConfiguration('vitePrerenderAssistant')
        .get<string>('gateway.url', 'https://vpar-gateway.vercel.app');
      vscode.env.openExternal(vscode.Uri.parse(gatewayUrl));
    }
  });

  return false;
}
