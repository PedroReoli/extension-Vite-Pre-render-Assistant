import * as https from 'https';
import { ConfigManager, LicenseState } from '../configManager';

const GATEWAY_URL = 'https://vpar-gateway.vercel.app';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Gerencia a licença premium.
 * - Validação remota via gateway
 * - Cache local de 7 dias (funciona offline)
 * - Leitura síncrona via isPremium() para evitar async em toda a UI
 */
export class LicenseManager {
  private cachedState: LicenseState | null = null;

  constructor(
    private configManager: ConfigManager,
    private gatewayUrl: string = GATEWAY_URL
  ) {
    this.cachedState = this.configManager.readLicense();
  }

  /**
   * Verifica se o usuário é premium. Leitura síncrona do cache local.
   */
  isPremium(): boolean {
    if (!this.cachedState) {
      return false;
    }

    if (!this.cachedState.valid) {
      return false;
    }

    // Verificar se o cache expirou (7 dias sem revalidação)
    const lastValidated = new Date(this.cachedState.lastValidated).getTime();
    if (Date.now() - lastValidated > CACHE_TTL_MS) {
      return false;
    }

    return true;
  }

  getState(): LicenseState | null {
    return this.cachedState;
  }

  getKey(): string | null {
    return this.cachedState?.key || null;
  }

  /**
   * Ativa uma license key. Faz validação remota.
   */
  async validateKey(key: string): Promise<ValidationResult> {
    const normalized = key.trim().toUpperCase();

    if (!this.isValidFormat(normalized)) {
      return { valid: false, error: 'invalid_format' };
    }

    try {
      const result = await this.callValidateApi(normalized);

      if (result.valid) {
        const state: LicenseState = {
          key: normalized,
          activatedAt: new Date().toISOString(),
          lastValidated: new Date().toISOString(),
          valid: true,
        };
        this.configManager.writeLicense(state);
        this.cachedState = state;
      }

      return result;
    } catch {
      return { valid: false, error: 'network_error' };
    }
  }

  /**
   * Revalida a licença em background. Não bloqueia.
   */
  async revalidate(): Promise<void> {
    if (!this.cachedState?.key) {
      return;
    }

    try {
      const result = await this.callValidateApi(this.cachedState.key);

      this.cachedState.valid = result.valid;
      this.cachedState.lastValidated = new Date().toISOString();
      this.configManager.writeLicense(this.cachedState);
    } catch {
      // Rede indisponível — manter estado atual
    }
  }

  /**
   * Remove a licença.
   */
  deactivate(): void {
    this.configManager.deleteLicense();
    this.cachedState = null;
  }

  private isValidFormat(key: string): boolean {
    return /^VPAR-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(key);
  }

  private callValidateApi(key: string): Promise<ValidationResult> {
    return new Promise((resolve, reject) => {
      const url = `${this.gatewayUrl}/api/validate?key=${encodeURIComponent(key)}`;

      const req = https.get(url, { timeout: 10000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ valid: !!parsed.valid });
          } catch {
            resolve({ valid: false, error: 'invalid_response' });
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('timeout'));
      });
    });
  }
}
