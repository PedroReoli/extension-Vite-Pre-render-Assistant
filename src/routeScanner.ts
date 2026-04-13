import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ConfigManager, ScanCache } from './configManager';

export interface ScannedRoute {
  path: string;
  source: 'file-based' | 'router-config' | 'code-pattern';
  file: string;
  confidence: 'alta' | 'media' | 'baixa';
}

/**
 * Scanner inteligente de rotas com cache.
 *
 * Lógica:
 * 1. Verifica se o projeto usa um router explícito (react-router, vue-router, etc.)
 * 2. Se usa router: extrai rotas da configuração + padrões de código. Ignora file-based.
 * 3. Se NÃO usa router: tenta file-based routing (Next.js, Nuxt, SvelteKit).
 *
 * File-based só funciona quando o framework realmente mapeia arquivos → rotas.
 * Se existe react-router-dom, os arquivos em pages/ são componentes, não rotas.
 */
export class RouteScanner {
  private readonly rootPath: string;
  private readonly configManager: ConfigManager;
  private visitedFiles = new Set<string>();

  private static readonly SCAN_EXTENSIONS = [
    '.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte',
  ];

  private static readonly IGNORE_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', 'out',
    '.next', '.nuxt', '.svelte-kit', 'prerender-build',
    '__tests__', '__mocks__', 'coverage', '.cache',
    '.viteprerender',
  ]);

  /** Bibliotecas de roteamento explícito — se presente, file-based é desativado */
  private static readonly EXPLICIT_ROUTERS = [
    'react-router-dom', 'react-router',
    'vue-router',
    '@tanstack/react-router',
    'wouter',
  ];

  /** Frameworks com file-based routing real */
  private static readonly FILE_BASED_FRAMEWORKS = [
    'next', '@sveltejs/kit', 'nuxt', '@remix-run/react',
  ];

  private static readonly PAGE_DIRS = [
    { dir: 'src/pages', transform: 'filename' },
    { dir: 'src/views', transform: 'filename' },
    { dir: 'pages', transform: 'filename' },
    { dir: 'app/routes', transform: 'filename' },
    { dir: 'src/routes', transform: 'svelte' },
  ];

  private static readonly ROUTER_FILES = [
    'src/router.ts', 'src/router.tsx', 'src/router.js', 'src/router.jsx',
    'src/routes.ts', 'src/routes.tsx', 'src/routes.js', 'src/routes.jsx',
    'src/router/index.ts', 'src/router/index.tsx', 'src/router/index.js',
    'src/routes/index.ts', 'src/routes/index.tsx', 'src/routes/index.js',
    'src/routing/index.ts', 'src/routing/routes.ts',
    'src/App.tsx', 'src/App.jsx', 'src/App.vue',
    'app/router.ts', 'app/routes.ts',
  ];

  /** Padrões para definição explícita de path em router */
  private static readonly ROUTER_PATH_PATTERNS: RegExp[] = [
    // <Route path="/about" /> ou <Route path="/about" element={...} />
    /<Route\s+[^>]*path\s*=\s*["'`](\/[^"'`]*?)["'`]/g,
    // { path: '/about' } em configuração de router
    /{\s*path\s*:\s*["'`](\/[^"'`]*?)["'`]/g,
  ];

  constructor(rootPath: string, configManager: ConfigManager) {
    this.rootPath = rootPath;
    this.configManager = configManager;
  }

  checkCache(): { valid: boolean; routes: string[] } {
    const cache = this.configManager.readCache();
    if (!cache) {
      return { valid: false, routes: [] };
    }
    const currentHash = this.computeSrcHash();
    if (cache.srcHash === currentHash) {
      return { valid: true, routes: cache.routes };
    }
    return { valid: false, routes: [] };
  }

  scan(): ScannedRoute[] {
    this.visitedFiles.clear();
    const results: ScannedRoute[] = [];

    const hasExplicitRouter = this.detectExplicitRouter();
    const hasFileBasedFramework = this.detectFileBasedFramework();

    if (hasExplicitRouter) {
      // Projeto usa router explícito — buscar nas definições de rota
      results.push(...this.scanRouterConfigs());

      // Se encontrou poucas rotas nos configs, complementar com padrões
      if (results.length < 2) {
        results.push(...this.scanCodePatterns());
      }
      // NÃO usar file-based — os arquivos são componentes, não rotas
    } else if (hasFileBasedFramework) {
      // Framework com file-based routing real
      results.push(...this.scanFileBasedRoutes());
    } else {
      // Sem router detectado — tentar tudo, priorizando código
      results.push(...this.scanRouterConfigs());
      results.push(...this.scanCodePatterns());
      // File-based como último recurso se nada foi achado
      if (results.length === 0) {
        results.push(...this.scanFileBasedRoutes());
      }
    }

    const deduped = this.dedup(results);

    const paths = deduped.map((r) => r.path);
    if (!paths.includes('/')) {
      paths.unshift('/');
    }

    this.configManager.writeCache({
      timestamp: Date.now(),
      srcHash: this.computeSrcHash(),
      routes: paths,
    });

    return deduped;
  }

  scanPaths(): string[] {
    const results = this.scan();
    const paths = results.map((r) => r.path);
    if (!paths.includes('/')) {
      paths.unshift('/');
    }
    return paths;
  }

  // ── Detecção de tipo de roteamento ────────────────────────────

  private detectExplicitRouter(): boolean {
    const pkgPath = path.join(this.rootPath, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return false;
    }

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const allDeps: Record<string, string> = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      return RouteScanner.EXPLICIT_ROUTERS.some((r) => r in allDeps);
    } catch {
      return false;
    }
  }

  private detectFileBasedFramework(): boolean {
    const pkgPath = path.join(this.rootPath, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return false;
    }

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const allDeps: Record<string, string> = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      return RouteScanner.FILE_BASED_FRAMEWORKS.some((f) => f in allDeps);
    } catch {
      return false;
    }
  }

  // ── Cache hash ────────────────────────────────────────────────

  private computeSrcHash(): string {
    const srcDir = path.join(this.rootPath, 'src');
    if (!fs.existsSync(srcDir)) {
      return 'no-src';
    }

    const hash = crypto.createHash('md5');
    this.hashDir(srcDir, hash);
    return hash.digest('hex').slice(0, 16);
  }

  private hashDir(dir: string, hash: crypto.Hash): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true }).sort(
        (a, b) => a.name.localeCompare(b.name)
      );
      for (const entry of entries) {
        if (entry.isDirectory() && !RouteScanner.IGNORE_DIRS.has(entry.name)) {
          this.hashDir(path.join(dir, entry.name), hash);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (RouteScanner.SCAN_EXTENSIONS.includes(ext)) {
            const stat = fs.statSync(path.join(dir, entry.name));
            hash.update(entry.name + ':' + stat.mtimeMs);
          }
        }
      }
    } catch { /* diretório inacessível */ }
  }

  // ── Estratégia: File-based routing ────────────────────────────

  private scanFileBasedRoutes(): ScannedRoute[] {
    const results: ScannedRoute[] = [];

    for (const { dir, transform } of RouteScanner.PAGE_DIRS) {
      const fullDir = path.join(this.rootPath, dir);
      if (!fs.existsSync(fullDir) || !fs.statSync(fullDir).isDirectory()) {
        continue;
      }

      const files = this.collectFiles(fullDir);
      for (const file of files) {
        const routePath = this.fileToRoute(file, fullDir, transform);
        if (routePath && this.isValidRoute(routePath)) {
          results.push({
            path: routePath,
            source: 'file-based',
            file,
            confidence: 'alta',
          });
        }
      }
    }

    return results;
  }

  private fileToRoute(
    filePath: string,
    baseDir: string,
    transform: string
  ): string | null {
    const relative = path.relative(baseDir, filePath);
    const parts = relative.replace(/\\/g, '/').split('/');
    const fileName = parts[parts.length - 1];
    const ext = path.extname(fileName);
    const baseName = fileName.replace(ext, '');

    if (/^(_|\.|\[|\()/.test(baseName)) {
      return null;
    }

    if (transform === 'svelte') {
      if (!baseName.startsWith('+page')) {
        return null;
      }
      const dirParts = parts.slice(0, -1);
      if (dirParts.length === 0) {
        return '/';
      }
      if (dirParts.some((p) => p.startsWith('[') || p.startsWith('('))) {
        return null;
      }
      return '/' + dirParts.join('/').toLowerCase();
    }

    const routeParts = parts.slice(0, -1);
    const isIndex = /^index$/i.test(baseName);

    if (!isIndex) {
      routeParts.push(baseName);
    }

    if (routeParts.length === 0) {
      return '/';
    }

    if (routeParts.some((p) => /[:*\[\]]/.test(p))) {
      return null;
    }

    return '/' + routeParts.map((p) => p.toLowerCase()).join('/');
  }

  // ── Estratégia: Configuração de router + imports ──────────────

  private scanRouterConfigs(): ScannedRoute[] {
    const results: ScannedRoute[] = [];

    for (const relPath of RouteScanner.ROUTER_FILES) {
      const fullPath = path.join(this.rootPath, relPath);
      if (!fs.existsSync(fullPath)) {
        continue;
      }

      results.push(...this.extractFromRouterFile(fullPath));

      const imports = this.findLocalImports(fullPath);
      for (const importPath of imports) {
        if (!this.visitedFiles.has(importPath)) {
          results.push(...this.extractFromRouterFile(importPath));
        }
      }
    }

    return results;
  }

  private extractFromRouterFile(filePath: string): ScannedRoute[] {
    this.visitedFiles.add(filePath);
    const results: ScannedRoute[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      for (const pattern of RouteScanner.ROUTER_PATH_PATTERNS) {
        const regex = new RegExp(pattern.source, pattern.flags);
        let match: RegExpExecArray | null;
        while ((match = regex.exec(content)) !== null) {
          if (match[1] && this.isValidRoute(match[1])) {
            results.push({
              path: match[1],
              source: 'router-config',
              file: filePath,
              confidence: 'alta',
            });
          }
        }
      }
    } catch { /* arquivo inacessível */ }

    return results;
  }

  private findLocalImports(filePath: string): string[] {
    const results: string[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const dir = path.dirname(filePath);
      const importRegex = /(?:from|import\()\s*["'`](\.\/[^"'`]+)["'`]/g;
      let match: RegExpExecArray | null;

      while ((match = importRegex.exec(content)) !== null) {
        const resolved = this.resolveImport(dir, match[1]);
        if (resolved) {
          results.push(resolved);
        }
      }
    } catch { /* arquivo inacessível */ }

    return results;
  }

  private resolveImport(fromDir: string, importPath: string): string | null {
    const base = path.join(fromDir, importPath);

    for (const ext of RouteScanner.SCAN_EXTENSIONS) {
      const withExt = base + ext;
      if (fs.existsSync(withExt)) {
        return withExt;
      }
    }

    for (const ext of RouteScanner.SCAN_EXTENSIONS) {
      const indexFile = path.join(base, 'index' + ext);
      if (fs.existsSync(indexFile)) {
        return indexFile;
      }
    }

    return null;
  }

  // ── Estratégia: Padrões de código ─────────────────────────────

  private scanCodePatterns(): ScannedRoute[] {
    const results: ScannedRoute[] = [];
    const srcDir = path.join(this.rootPath, 'src');

    if (!fs.existsSync(srcDir)) {
      return results;
    }

    const files = this.collectFiles(srcDir);
    for (const file of files) {
      if (this.visitedFiles.has(file)) {
        continue;
      }

      try {
        const content = fs.readFileSync(file, 'utf-8');

        // Usar apenas padrões de alta confiança para evitar falsos positivos
        for (const pattern of RouteScanner.ROUTER_PATH_PATTERNS) {
          const regex = new RegExp(pattern.source, pattern.flags);
          let match: RegExpExecArray | null;
          while ((match = regex.exec(content)) !== null) {
            if (match[1] && this.isValidRoute(match[1])) {
              results.push({
                path: match[1],
                source: 'code-pattern',
                file,
                confidence: 'media',
              });
            }
          }
        }
      } catch { /* arquivo inacessível */ }
    }

    return results;
  }

  // ── Utilitários ───────────────────────────────────────────────

  private isValidRoute(routePath: string): boolean {
    if (!routePath || !routePath.startsWith('/')) {
      return false;
    }
    if (/[:*\[\]{}]/.test(routePath)) {
      return false;
    }
    if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/i.test(routePath)) {
      return false;
    }
    if (/^\/(api|_|\.|\$)/.test(routePath)) {
      return false;
    }
    return true;
  }

  private dedup(routes: ScannedRoute[]): ScannedRoute[] {
    const map = new Map<string, ScannedRoute>();
    const priority: Record<string, number> = { alta: 3, media: 2, baixa: 1 };

    for (const route of routes) {
      const existing = map.get(route.path);
      if (!existing || priority[route.confidence] > priority[existing.confidence]) {
        map.set(route.path, route);
      }
    }

    return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path));
  }

  private collectFiles(dir: string): string[] {
    const files: string[] = [];
    this.walkDir(dir, files);
    return files;
  }

  private walkDir(dir: string, result: string[]): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!RouteScanner.IGNORE_DIRS.has(entry.name)) {
          this.walkDir(fullPath, result);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (RouteScanner.SCAN_EXTENSIONS.includes(ext)) {
          result.push(fullPath);
        }
      }
    }
  }
}
