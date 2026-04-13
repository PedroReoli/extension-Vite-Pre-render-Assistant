import * as fs from 'fs';
import * as path from 'path';

export interface Route {
  path: string;
  enabled: boolean;
}

export interface PrerenderConfig {
  routes: Route[];
  outputDir: string;
  waitForSelector: string;
  waitTime: number;
  minify: boolean;
  cleanBefore: boolean;
}

const CONFIG_FILENAME = 'prerender.config.json';

const DEFAULT_CONFIG: PrerenderConfig = {
  routes: [{ path: '/', enabled: true }],
  outputDir: 'prerender-build',
  waitForSelector: '#app, #root, [data-app]',
  waitTime: 2000,
  minify: false,
  cleanBefore: true,
};

/**
 * Gerencia leitura e escrita do prerender.config.json.
 * Única camada que acessa esse arquivo diretamente.
 */
export class ConfigManager {
  private configPath: string;

  constructor(private projectRoot: string) {
    this.configPath = path.join(projectRoot, CONFIG_FILENAME);
  }

  getProjectRoot(): string {
    return this.projectRoot;
  }

  getConfigPath(): string {
    return this.configPath;
  }

  exists(): boolean {
    return fs.existsSync(this.configPath);
  }

  read(): PrerenderConfig | null {
    if (!this.exists()) {
      return null;
    }

    try {
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      const parsed = JSON.parse(raw);

      if (!this.hasValidRoutes(parsed)) {
        return null;
      }

      // Merge com defaults para campos ausentes
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        routes: parsed.routes,
      };
    } catch {
      return null;
    }
  }

  write(config: PrerenderConfig): void {
    const content = JSON.stringify(config, null, 2);
    fs.writeFileSync(this.configPath, content, 'utf-8');
  }

  /**
   * Atualiza apenas as rotas, preservando outras configurações.
   */
  updateRoutes(routes: Route[]): void {
    const config = this.read() || { ...DEFAULT_CONFIG };
    config.routes = routes;
    this.write(config);
  }

  ensureExists(): PrerenderConfig {
    const existing = this.read();
    if (existing) {
      return existing;
    }

    if (this.exists()) {
      throw new Error(
        `O arquivo ${CONFIG_FILENAME} existe mas está corrompido. Verifique o conteúdo manualmente.`
      );
    }

    this.write(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }

  private hasValidRoutes(obj: unknown): boolean {
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
