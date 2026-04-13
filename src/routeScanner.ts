import * as fs from 'fs';
import * as path from 'path';

export interface ScannedRoute {
  path: string;
  source: 'file-based' | 'router-config' | 'code-pattern';
  file: string;
  confidence: 'alta' | 'media' | 'baixa';
}

/**
 * Scanner inteligente de rotas.
 *
 * Três estratégias em ordem de confiança:
 * 1. File-based routing (pages/, views/, routes/ com arquivos de página)
 * 2. Configuração de router (router.ts, routes.ts + imports seguidos)
 * 3. Padrões de código (path="/", to="/", etc.)
 */
export class RouteScanner {
  private readonly rootPath: string;
  private visitedFiles = new Set<string>();

  private static readonly SCAN_EXTENSIONS = [
    '.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte',
  ];

  private static readonly IGNORE_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', 'out',
    '.next', '.nuxt', '.svelte-kit', 'prerender-build',
    '__tests__', '__mocks__', 'coverage', '.cache',
  ]);

  /** Padrões de file-based routing */
  private static readonly PAGE_DIRS = [
    { dir: 'src/pages', transform: 'filename' },
    { dir: 'src/views', transform: 'filename' },
    { dir: 'pages', transform: 'filename' },
    { dir: 'app/routes', transform: 'filename' },
    { dir: 'src/routes', transform: 'svelte' },
  ];

  /** Nomes de arquivos de router */
  private static readonly ROUTER_FILES = [
    'src/router.ts', 'src/router.tsx', 'src/router.js', 'src/router.jsx',
    'src/routes.ts', 'src/routes.tsx', 'src/routes.js', 'src/routes.jsx',
    'src/router/index.ts', 'src/router/index.tsx', 'src/router/index.js',
    'src/routes/index.ts', 'src/routes/index.tsx', 'src/routes/index.js',
    'src/routing/index.ts', 'src/routing/routes.ts',
    'src/App.tsx', 'src/App.jsx', 'src/App.vue',
    'app/router.ts', 'app/routes.ts',
  ];

  /** Regex para definições de rota em configuração de router */
  private static readonly ROUTER_PATTERNS: RegExp[] = [
    // { path: '/about' } em objetos de configuração
    /{\s*path\s*:\s*["'`](\/[^"'`]*?)["'`]/g,
    // createBrowserRouter([{ path: '/about' }])
    /(?:createBrowserRouter|createRouter|createHashRouter)\s*\(\s*\[/g,
  ];

  /** Regex para padrões de código (menor confiança) */
  private static readonly CODE_PATTERNS: RegExp[] = [
    // <Route path="/about" />
    /<Route\s+[^>]*path\s*=\s*["'`](\/[^"'`]*?)["'`]/g,
    // path: "/about" genérico
    /path\s*:\s*["'`](\/[^"'`]*?)["'`]/g,
    // to="/about" em Links
    /\bto\s*=\s*["'`](\/[^"'`]*?)["'`]/g,
    // navigate("/about")
    /navigate\s*\(\s*["'`](\/[^"'`]*?)["'`]\s*\)/g,
    // router.push("/about")
    /(?:router|history)\s*\.\s*push\s*\(\s*["'`](\/[^"'`]*?)["'`]\s*\)/g,
  ];

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  /**
   * Executa o scan completo. Retorna rotas com metadados.
   */
  scan(): ScannedRoute[] {
    this.visitedFiles.clear();
    const results: ScannedRoute[] = [];

    // Estratégia 1: file-based routing
    results.push(...this.scanFileBasedRoutes());

    // Estratégia 2: configuração de router + seguir imports
    results.push(...this.scanRouterConfigs());

    // Estratégia 3: busca ampla por padrões
    results.push(...this.scanCodePatterns());

    // Deduplicar mantendo a maior confiança
    return this.dedup(results);
  }

  /**
   * Retorna apenas os paths únicos (sem metadados).
   */
  scanPaths(): string[] {
    const results = this.scan();
    const paths = results.map((r) => r.path);
    // Garantir "/" presente
    if (!paths.includes('/')) {
      paths.unshift('/');
    }
    return paths;
  }

  // ── Estratégia 1: File-based routing ──────────────────────────

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

  /**
   * Converte um caminho de arquivo em rota.
   * Ex: src/pages/About.tsx → /about
   *     src/pages/blog/Post.tsx → /blog/post
   *     src/routes/about/+page.svelte → /about
   */
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

    // Ignorar arquivos utilitários
    if (/^(_|\.|\[)/.test(baseName)) {
      return null;
    }

    // SvelteKit: +page.svelte, +page.ts
    if (transform === 'svelte') {
      if (!baseName.startsWith('+page')) {
        return null;
      }
      const dirParts = parts.slice(0, -1);
      if (dirParts.length === 0) {
        return '/';
      }
      // Ignorar diretórios com parâmetros
      if (dirParts.some((p) => p.startsWith('[') || p.startsWith('('))) {
        return null;
      }
      return '/' + dirParts.join('/').toLowerCase();
    }

    // Padrão (filename): About.tsx → /about
    const routeParts = parts.slice(0, -1); // diretórios intermediários
    const isIndex = /^index$/i.test(baseName);

    if (!isIndex) {
      routeParts.push(baseName);
    }

    if (routeParts.length === 0) {
      return '/';
    }

    // Ignorar partes dinâmicas
    if (routeParts.some((p) => /[:*\[\]]/.test(p))) {
      return null;
    }

    return '/' + routeParts.map((p) => p.toLowerCase()).join('/');
  }

  // ── Estratégia 2: Configuração de router + imports ────────────

  private scanRouterConfigs(): ScannedRoute[] {
    const results: ScannedRoute[] = [];

    for (const relPath of RouteScanner.ROUTER_FILES) {
      const fullPath = path.join(this.rootPath, relPath);
      if (!fs.existsSync(fullPath)) {
        continue;
      }

      // Extrair rotas do arquivo principal
      results.push(...this.extractFromRouterFile(fullPath));

      // Seguir imports
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

      for (const pattern of RouteScanner.ROUTER_PATTERNS) {
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
    } catch {
      // Arquivo inacessível
    }

    return results;
  }

  /**
   * Encontra imports locais (relativos) em um arquivo.
   * Segue: import X from './routes/auth'
   */
  private findLocalImports(filePath: string): string[] {
    const results: string[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const dir = path.dirname(filePath);

      // import X from './path' ou import('./path')
      const importRegex = /(?:from|import\()\s*["'`](\.\/[^"'`]+)["'`]/g;
      let match: RegExpExecArray | null;

      while ((match = importRegex.exec(content)) !== null) {
        const resolved = this.resolveImport(dir, match[1]);
        if (resolved) {
          results.push(resolved);
        }
      }
    } catch {
      // Arquivo inacessível
    }

    return results;
  }

  /**
   * Resolve um import relativo para um caminho absoluto de arquivo.
   */
  private resolveImport(fromDir: string, importPath: string): string | null {
    const base = path.join(fromDir, importPath);

    // Tentar com extensões
    for (const ext of RouteScanner.SCAN_EXTENSIONS) {
      const withExt = base + ext;
      if (fs.existsSync(withExt)) {
        return withExt;
      }
    }

    // Tentar como diretório com index
    for (const ext of RouteScanner.SCAN_EXTENSIONS) {
      const indexFile = path.join(base, 'index' + ext);
      if (fs.existsSync(indexFile)) {
        return indexFile;
      }
    }

    return null;
  }

  // ── Estratégia 3: Busca ampla por padrões ─────────────────────

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

        for (const pattern of RouteScanner.CODE_PATTERNS) {
          const regex = new RegExp(pattern.source, pattern.flags);
          let match: RegExpExecArray | null;
          while ((match = regex.exec(content)) !== null) {
            if (match[1] && this.isValidRoute(match[1])) {
              results.push({
                path: match[1],
                source: 'code-pattern',
                file,
                confidence: 'baixa',
              });
            }
          }
        }
      } catch {
        // Arquivo inacessível
      }
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

  /**
   * Deduplicar rotas mantendo a de maior confiança.
   */
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
