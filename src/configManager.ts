import * as fs from 'fs';
import * as path from 'path';

export interface Route {
  path: string;
  enabled: boolean;
  /** Seletor CSS específico para esta rota (sobrescreve o global) */
  waitForSelector?: string;
  /** Tempo de espera específico em ms (sobrescreve o global) */
  waitTime?: number;
}

export interface DeployConfig {
  /** Caminho de destino para cópia */
  copyTo: string;
  /** Gerar .zip ao finalizar */
  zip: boolean;
}

export interface PrerenderConfig {
  routes: Route[];
  outputDir: string;
  waitForSelector: string;
  waitTime: number;
  minify: boolean;
  cleanBefore: boolean;
  deploy: DeployConfig;
}

export interface RouteResult {
  path: string;
  status: 'done' | 'error';
  originalSize: number;
  renderedSize: number;
  seo: SeoResult;
  error?: string;
}

export interface SeoResult {
  hasTitle: boolean;
  title: string;
  hasMetaDescription: boolean;
  metaDescription: string;
  hasOgTitle: boolean;
  hasOgDescription: boolean;
  hasOgImage: boolean;
  hasCanonical: boolean;
  hasLang: boolean;
  hasViewport: boolean;
  warnings: string[];
  score: number;
}

const CONFIG_FILENAME = 'prerender.config.json';
const INTERNAL_DIR = '.viteprerender';
const CACHE_FILENAME = 'cache.json';
const RESULTS_FILENAME = 'results.json';
const SCRIPT_FILENAME = 'prerender.script.mjs';

const DEFAULT_CONFIG: PrerenderConfig = {
  routes: [{ path: '/', enabled: true }],
  outputDir: 'prerender-build',
  waitForSelector: '#app, #root, [data-app]',
  waitTime: 2000,
  minify: false,
  cleanBefore: true,
  deploy: {
    copyTo: '',
    zip: false,
  },
};

export class ConfigManager {
  private configPath: string;
  private internalDir: string;

  constructor(private projectRoot: string) {
    this.configPath = path.join(projectRoot, CONFIG_FILENAME);
    this.internalDir = path.join(projectRoot, INTERNAL_DIR);
  }

  /** Garante que a pasta .viteprerender/ existe */
  private ensureInternalDir(): void {
    if (!fs.existsSync(this.internalDir)) {
      fs.mkdirSync(this.internalDir, { recursive: true });
    }
  }

  getInternalDir(): string {
    return this.internalDir;
  }

  getScriptPath(): string {
    return path.join(this.internalDir, SCRIPT_FILENAME);
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

      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        routes: parsed.routes,
        deploy: { ...DEFAULT_CONFIG.deploy, ...parsed.deploy },
      };
    } catch {
      return null;
    }
  }

  write(config: PrerenderConfig): void {
    const content = JSON.stringify(config, null, 2);
    fs.writeFileSync(this.configPath, content, 'utf-8');
  }

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

  // ── Cache ─────────────────────────────────────────────────────

  readCache(): ScanCache | null {
    try {
      const cachePath = path.join(this.internalDir, CACHE_FILENAME);
      if (!fs.existsSync(cachePath)) {
        return null;
      }
      const raw = fs.readFileSync(cachePath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  writeCache(cache: ScanCache): void {
    this.ensureInternalDir();
    const cachePath = path.join(this.internalDir, CACHE_FILENAME);
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
  }

  // ── Build Results ─────────────────────────────────────────────

  readBuildResults(): BuildResults | null {
    try {
      const resultsPath = path.join(this.internalDir, RESULTS_FILENAME);
      if (!fs.existsSync(resultsPath)) {
        return null;
      }
      const raw = fs.readFileSync(resultsPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  writeBuildResults(results: BuildResults): void {
    this.ensureInternalDir();
    const resultsPath = path.join(this.internalDir, RESULTS_FILENAME);
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2), 'utf-8');
  }

  // ── Outdated Detection ────────────────────────────────────────

  isOutdated(): boolean {
    const results = this.readBuildResults();
    if (!results) {
      return false;
    }

    const buildTime = results.timestamp;
    const srcDir = path.join(this.projectRoot, 'src');

    if (!fs.existsSync(srcDir)) {
      return false;
    }

    const latestMod = this.getLatestModTime(srcDir);
    return latestMod > buildTime;
  }

  private getLatestModTime(dir: string): number {
    let latest = 0;
    const IGNORE = new Set([
      'node_modules', '.git', 'dist', 'build', 'out',
      'prerender-build', '.cache', 'coverage',
    ]);

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!IGNORE.has(entry.name)) {
            const sub = this.getLatestModTime(fullPath);
            if (sub > latest) {
              latest = sub;
            }
          }
        } else if (entry.isFile()) {
          const stat = fs.statSync(fullPath);
          if (stat.mtimeMs > latest) {
            latest = stat.mtimeMs;
          }
        }
      }
    } catch {
      // Diretório inacessível
    }

    return latest;
  }

  // ── Validation ────────────────────────────────────────────────

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

export interface ScanCache {
  timestamp: number;
  srcHash: string;
  routes: string[];
}

export interface BuildResults {
  timestamp: number;
  outputDir: string;
  routes: RouteResult[];
  totalOriginalSize: number;
  totalRenderedSize: number;
}
