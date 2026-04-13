import * as fs from 'fs';
import * as path from 'path';

export interface Route {
  path: string;
  enabled: boolean;
}

export interface PrerenderConfig {
  routes: Route[];
}

const CONFIG_FILENAME = 'prerender.config.json';

/**
 * Gerencia leitura e escrita do prerender.config.json.
 * Única camada que acessa esse arquivo diretamente.
 */
export class ConfigManager {
  private configPath: string;

  constructor(projectRoot: string) {
    this.configPath = path.join(projectRoot, CONFIG_FILENAME);
  }

  getConfigPath(): string {
    return this.configPath;
  }

  exists(): boolean {
    return fs.existsSync(this.configPath);
  }

  /**
   * Lê a configuração do arquivo.
   * Retorna null se o arquivo não existir ou estiver corrompido.
   */
  read(): PrerenderConfig | null {
    if (!this.exists()) {
      return null;
    }

    try {
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      const parsed = JSON.parse(raw);

      if (!this.isValidConfig(parsed)) {
        return null;
      }

      return parsed as PrerenderConfig;
    } catch {
      return null;
    }
  }

  /**
   * Salva a configuração no arquivo.
   * Cria o arquivo se não existir.
   */
  write(config: PrerenderConfig): void {
    const content = JSON.stringify(config, null, 2);
    fs.writeFileSync(this.configPath, content, 'utf-8');
  }

  /**
   * Cria o arquivo com configuração padrão se não existir.
   * Nunca sobrescreve um arquivo existente.
   */
  ensureExists(): PrerenderConfig {
    const existing = this.read();
    if (existing) {
      return existing;
    }

    if (this.exists()) {
      // Arquivo existe mas está corrompido — não sobrescrever
      throw new Error(
        `O arquivo ${CONFIG_FILENAME} existe mas está corrompido. Verifique o conteúdo manualmente.`
      );
    }

    const defaultConfig: PrerenderConfig = {
      routes: [{ path: '/', enabled: true }],
    };

    this.write(defaultConfig);
    return defaultConfig;
  }

  private isValidConfig(obj: unknown): boolean {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }

    const record = obj as Record<string, unknown>;
    if (!Array.isArray(record.routes)) {
      return false;
    }

    return record.routes.every(
      (r: unknown) =>
        typeof r === 'object' &&
        r !== null &&
        typeof (r as Record<string, unknown>).path === 'string' &&
        typeof (r as Record<string, unknown>).enabled === 'boolean'
    );
  }
}
