import * as fs from 'fs';
import * as path from 'path';

/**
 * Scanner que detecta rotas automaticamente no projeto.
 *
 * Estratégia em duas passadas:
 * 1. Busca arquivos com nomes comuns de roteamento
 * 2. Analisa conteúdo buscando padrões de definição de rotas
 */
export class RouteScanner {
  private readonly rootPath: string;

  /** Nomes comuns de arquivos de rotas */
  private static readonly ROUTE_FILE_PATTERNS = [
    'router.ts', 'router.tsx', 'router.js', 'router.jsx',
    'routes.ts', 'routes.tsx', 'routes.js', 'routes.jsx',
    'Router.ts', 'Router.tsx', 'Router.js', 'Router.jsx',
    'Routes.ts', 'Routes.tsx', 'Routes.js', 'Routes.jsx',
    'app-routes.ts', 'app-routes.tsx', 'app-routes.js',
    'AppRoutes.ts', 'AppRoutes.tsx', 'AppRoutes.js',
  ];

  /** Diretórios comuns onde rotas ficam */
  private static readonly ROUTE_DIRS = [
    'src/router',
    'src/routes',
    'src/routing',
    'src/pages',
    'app/routes',
    'app/router',
    'pages',
  ];

  /** Regex para extrair paths de rotas em código */
  private static readonly ROUTE_PATTERNS: RegExp[] = [
    // React Router: path="/about" ou path: "/about"
    /path\s*[:=]\s*["'`](\/[^"'`]*?)["'`]/g,
    // Vue Router: { path: '/about' }
    /{\s*path\s*:\s*["'`](\/[^"'`]*?)["'`]/g,
    // Next.js/file-based: não aplicável aqui
    // Generic: createRoute("/about"), route("/about")
    /(?:create)?[Rr]oute\s*\(\s*["'`](\/[^"'`]*?)["'`]/g,
    // <Route path="/about"
    /<Route\s+[^>]*path\s*=\s*["'`](\/[^"'`]*?)["'`]/g,
    // Navigate/Link to="/about"
    /to\s*=\s*["'`](\/[^"'`]*?)["'`]/g,
  ];

  /** Extensões de arquivo para busca por conteúdo */
  private static readonly SCAN_EXTENSIONS = [
    '.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte',
  ];

  /** Diretórios ignorados */
  private static readonly IGNORE_DIRS = [
    'node_modules', '.git', 'dist', 'build', 'out',
    '.next', '.nuxt', '.svelte-kit', 'prerender-build',
  ];

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  /**
   * Executa o scan completo e retorna rotas únicas encontradas.
   */
  scan(): string[] {
    const routeFiles = this.findRouteFiles();
    const allRoutes = new Set<string>();

    // Passada 1: arquivos de rota conhecidos
    for (const file of routeFiles) {
      const routes = this.extractRoutesFromFile(file);
      routes.forEach((r) => allRoutes.add(r));
    }

    // Passada 2: busca ampla em src/
    const srcDir = path.join(this.rootPath, 'src');
    if (fs.existsSync(srcDir)) {
      const sourceFiles = this.collectSourceFiles(srcDir);
      for (const file of sourceFiles) {
        // Pular arquivos já analisados
        if (routeFiles.includes(file)) {
          continue;
        }
        const routes = this.extractRoutesFromFile(file);
        routes.forEach((r) => allRoutes.add(r));
      }
    }

    // Garantir que "/" sempre esteja presente
    allRoutes.add('/');

    return Array.from(allRoutes).sort();
  }

  /**
   * Passada 1: busca arquivos com nomes comuns de roteamento.
   */
  private findRouteFiles(): string[] {
    const found: string[] = [];

    // Buscar na raiz de src/
    for (const name of RouteScanner.ROUTE_FILE_PATTERNS) {
      const filePath = path.join(this.rootPath, 'src', name);
      if (fs.existsSync(filePath)) {
        found.push(filePath);
      }
    }

    // Buscar em diretórios comuns
    for (const dir of RouteScanner.ROUTE_DIRS) {
      const dirPath = path.join(this.rootPath, dir);
      if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
        continue;
      }

      const files = this.listFilesFlat(dirPath);
      for (const file of files) {
        if (this.isScannable(file)) {
          found.push(file);
        }
      }
    }

    return [...new Set(found)];
  }

  /**
   * Passada 2: extrai paths de rota do conteúdo de um arquivo.
   */
  private extractRoutesFromFile(filePath: string): string[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const routes: string[] = [];

      for (const pattern of RouteScanner.ROUTE_PATTERNS) {
        // Reset regex state
        const regex = new RegExp(pattern.source, pattern.flags);
        let match: RegExpExecArray | null;

        while ((match = regex.exec(content)) !== null) {
          const routePath = match[1];
          if (this.isValidRoute(routePath)) {
            routes.push(routePath);
          }
        }
      }

      return routes;
    } catch {
      return [];
    }
  }

  /**
   * Valida se um path extraído é uma rota válida (estática).
   */
  private isValidRoute(routePath: string): boolean {
    if (!routePath || !routePath.startsWith('/')) {
      return false;
    }
    // Ignorar rotas dinâmicas (:id, [slug], *)
    if (/[:*\[\]]/.test(routePath)) {
      return false;
    }
    // Ignorar paths de assets
    if (/\.(js|css|png|jpg|svg|ico|woff|ttf)$/i.test(routePath)) {
      return false;
    }
    // Ignorar paths de API
    if (routePath.startsWith('/api/')) {
      return false;
    }
    return true;
  }

  /**
   * Coleta arquivos fonte recursivamente em um diretório.
   */
  private collectSourceFiles(dir: string): string[] {
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
        if (!RouteScanner.IGNORE_DIRS.includes(entry.name)) {
          this.walkDir(fullPath, result);
        }
      } else if (entry.isFile() && this.isScannable(fullPath)) {
        result.push(fullPath);
      }
    }
  }

  private listFilesFlat(dir: string): string[] {
    try {
      return fs.readdirSync(dir)
        .map((name) => path.join(dir, name))
        .filter((p) => fs.statSync(p).isFile());
    } catch {
      return [];
    }
  }

  private isScannable(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return RouteScanner.SCAN_EXTENSIONS.includes(ext);
  }
}
