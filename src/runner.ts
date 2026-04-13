import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess, execSync } from 'child_process';
import { Route, PrerenderConfig, RouteResult, BuildResults, ConfigManager } from './configManager';
import { t, translateWarning } from './i18n';

export interface BuildProgress {
  step: 'install' | 'build' | 'render' | 'done' | 'error';
  status: 'start' | 'progress' | 'done' | 'error';
  route?: string;
  message?: string;
  total?: number;
  current?: number;
  /** Dados de resultado por rota (SEO + tamanhos) */
  result?: RouteResult;
}

export type ProgressCallback = (progress: BuildProgress) => void;

/**
 * Executa o build do Vite seguido do pré-render real com Puppeteer.
 * Captura progresso via child_process e reporta à sidebar.
 * Inclui validação SEO e comparação de tamanho.
 */
export class Runner {
  private outputChannel: vscode.OutputChannel;
  private process: ChildProcess | undefined;
  private onProgress: ProgressCallback | undefined;
  private routeResults: RouteResult[] = [];

  constructor(
    private projectRoot: string,
    private configManager: ConfigManager
  ) {
    this.outputChannel = vscode.window.createOutputChannel('Vite Pre-render');
  }

  setProgressCallback(cb: ProgressCallback): void {
    this.onProgress = cb;
  }

  run(enabledRoutes: Route[], config: PrerenderConfig): void {
    if (enabledRoutes.length === 0) {
      vscode.window.showWarningMessage(t('build.noRoutes'));
      return;
    }

    if (this.process && !this.process.killed) {
      vscode.window.showWarningMessage(t('build.alreadyRunning'));
      return;
    }

    this.routeResults = [];
    this.generateScript(enabledRoutes, config);

    this.outputChannel.clear();
    this.outputChannel.show(true);
    this.outputChannel.appendLine('══════════════════════════════════════');
    this.outputChannel.appendLine('  Vite Pre-render Assistant');
    this.outputChannel.appendLine('══════════════════════════════════════');
    this.outputChannel.appendLine('');

    this.emit({ step: 'install', status: 'start' });

    const scriptPath = this.configManager.getScriptPath();
    const proc = spawn('node', [scriptPath], {
      cwd: this.projectRoot,
      shell: true,
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    this.process = proc;
    let buffer = '';

    proc.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString('utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        this.processLine(line);
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      this.outputChannel.appendLine(data.toString('utf-8'));
    });

    proc.on('close', (code) => {
      if (buffer.trim()) {
        this.processLine(buffer);
      }
      this.process = undefined;

      if (code === 0) {
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine(t('output.done'));
        this.saveBuildResults(config.outputDir);
        this.emit({ step: 'done', status: 'done' });
      } else {
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine(t('output.exitCode', { code: code || 0 }));
        this.emit({
          step: 'error',
          status: 'error',
          message: t('output.exitCode', { code: code || 0 }),
        });
      }
    });

    proc.on('error', (err) => {
      this.outputChannel.appendLine(t('output.startError', { message: err.message }));
      this.emit({ step: 'error', status: 'error', message: err.message });
      this.process = undefined;
    });
  }

  cancel(): void {
    if (this.process && !this.process.killed) {
      this.process.kill();
      this.process = undefined;
      this.emit({ step: 'error', status: 'error', message: t('output.cancelled') });
    }
  }

  isRunning(): boolean {
    return !!this.process && !this.process.killed;
  }

  openOutputFolder(outputDir: string): void {
    const fullPath = path.join(this.projectRoot, outputDir);
    if (fs.existsSync(fullPath)) {
      vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(fullPath));
    }
  }

  /**
   * Retorna o HTML renderizado de uma rota para preview.
   */
  getRenderedHtml(routePath: string, outputDir: string): string | null {
    const htmlPath = routePath === '/'
      ? path.join(this.projectRoot, outputDir, 'index.html')
      : path.join(this.projectRoot, outputDir, routePath.slice(1), 'index.html');

    if (fs.existsSync(htmlPath)) {
      return fs.readFileSync(htmlPath, 'utf-8');
    }
    return null;
  }

  /**
   * Copia a pasta de output para o destino configurado.
   */
  deployTo(outputDir: string, destination: string): boolean {
    const src = path.join(this.projectRoot, outputDir);
    const dest = path.resolve(this.projectRoot, destination);

    if (!fs.existsSync(src)) {
      vscode.window.showErrorMessage(t('deploy.folderNotFound', { dir: outputDir }));
      return false;
    }

    try {
      this.copyDirSync(src, dest);
      vscode.window.showInformationMessage(t('deploy.copySuccess', { path: dest }));
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(t('deploy.copyError', { error: msg }));
      return false;
    }
  }

  generateZip(outputDir: string): boolean {
    const src = path.join(this.projectRoot, outputDir);
    const zipPath = path.join(this.projectRoot, `${outputDir}.zip`);

    if (!fs.existsSync(src)) {
      vscode.window.showErrorMessage(t('deploy.folderNotFound', { dir: outputDir }));
      return false;
    }

    try {
      if (process.platform === 'win32') {
        execSync(
          `powershell -Command "Compress-Archive -Path '${src}\\*' -DestinationPath '${zipPath}' -Force"`,
          { cwd: this.projectRoot }
        );
      } else {
        execSync(`cd "${src}" && zip -r "${zipPath}" .`, { cwd: this.projectRoot });
      }

      vscode.window.showInformationMessage(t('deploy.zipSuccess', { path: zipPath }));
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(t('deploy.zipError', { error: msg }));
      return false;
    }
  }

  dispose(): void {
    this.cancel();
    this.outputChannel.dispose();
  }

  // ── Internos ──────────────────────────────────────────────────

  private processLine(raw: string): void {
    const line = raw.trim();
    if (!line) {
      return;
    }

    if (line.startsWith('{"')) {
      try {
        const progress = JSON.parse(line) as BuildProgress;

        // Coletar resultados por rota
        if (progress.result) {
          this.routeResults.push(progress.result);
        }

        this.emit(progress);
        this.logProgress(progress);
        return;
      } catch {
        // Não é JSON
      }
    }

    this.outputChannel.appendLine(line);
  }

  private logProgress(p: BuildProgress): void {
    switch (p.step) {
      case 'install':
        if (p.status === 'start') {
          this.outputChannel.appendLine(t('step.install'));
        } else if (p.status === 'done') {
          this.outputChannel.appendLine(t('output.depsOk'));
        }
        break;
      case 'build':
        if (p.status === 'start') {
          this.outputChannel.appendLine('');
          this.outputChannel.appendLine(t('output.building'));
        } else if (p.status === 'done') {
          this.outputChannel.appendLine(t('output.buildDone'));
        }
        break;
      case 'render':
        if (p.status === 'start' && p.route) {
          this.outputChannel.appendLine(`  ${t('output.rendering', { current: p.current || 0, total: p.total || 0, route: p.route })}`);
        } else if (p.status === 'done' && p.result) {
          const r = p.result;
          const sizeInfo = `${formatSize(r.originalSize)} → ${formatSize(r.renderedSize)}`;
          const seoInfo = t('output.seo', { score: r.seo.score });
          this.outputChannel.appendLine(`         ${t('output.ok')}  ${sizeInfo}  ${seoInfo}`);
          if (r.seo.warnings.length > 0) {
            for (const w of r.seo.warnings) {
              this.outputChannel.appendLine(`         ⚠ ${translateWarning(w)}`);
            }
          }
        } else if (p.status === 'error') {
          this.outputChannel.appendLine(`         ${t('output.error', { message: p.message || '' })}`);
        }
        break;
    }
  }

  private emit(progress: BuildProgress): void {
    this.onProgress?.(progress);
  }

  private saveBuildResults(outputDir: string): void {
    if (this.routeResults.length === 0) {
      return;
    }

    const results: BuildResults = {
      timestamp: Date.now(),
      outputDir,
      routes: this.routeResults,
      totalOriginalSize: this.routeResults.reduce((s, r) => s + r.originalSize, 0),
      totalRenderedSize: this.routeResults.reduce((s, r) => s + r.renderedSize, 0),
    };

    this.configManager.writeBuildResults(results);
  }

  private copyDirSync(src: string, dest: string): void {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirSync(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Gera o script completo .mjs com pré-render real + validação SEO.
   */
  private generateScript(routes: Route[], config: PrerenderConfig): void {
    const routeConfigs = JSON.stringify(
      routes.map((r) => ({
        path: r.path,
        waitForSelector: r.waitForSelector || config.waitForSelector,
        waitTime: r.waitTime || config.waitTime,
      }))
    );
    const outputDir = config.outputDir || 'prerender-build';
    const minify = config.minify || false;
    const cleanBefore = config.cleanBefore !== false;

    const script = `
import { execSync } from 'child_process';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ROUTES = ${routeConfigs};
const OUTPUT_DIR = path.resolve(PROJECT_ROOT, '${outputDir}');
const MINIFY = ${minify};
const CLEAN = ${cleanBefore};

function progress(obj) {
  console.log(JSON.stringify(obj));
}

function analyzeSeo(html, route) {
  const warnings = [];
  let score = 100;

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\\/title>/i);
  const hasTitle = !!titleMatch && titleMatch[1].trim().length > 0;
  const title = titleMatch ? titleMatch[1].trim() : '';
  if (!hasTitle) { warnings.push('seo.noTitle'); score -= 20; }
  else if (title.length < 10) { warnings.push('seo.titleShort:' + title.length); score -= 5; }
  else if (title.length > 70) { warnings.push('seo.titleLong:' + title.length); score -= 5; }

  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const hasMetaDescription = !!descMatch && descMatch[1].trim().length > 0;
  const metaDescription = descMatch ? descMatch[1].trim() : '';
  if (!hasMetaDescription) { warnings.push('seo.noDescription'); score -= 15; }
  else if (metaDescription.length < 50) { warnings.push('seo.descShort'); score -= 5; }
  else if (metaDescription.length > 160) { warnings.push('seo.descLong'); score -= 5; }

  const hasOgTitle = /<meta[^>]*property=["']og:title["']/i.test(html);
  if (!hasOgTitle) { warnings.push('seo.noOgTitle'); score -= 10; }

  const hasOgDescription = /<meta[^>]*property=["']og:description["']/i.test(html);
  if (!hasOgDescription) { warnings.push('seo.noOgDesc'); score -= 10; }

  const hasOgImage = /<meta[^>]*property=["']og:image["']/i.test(html);
  if (!hasOgImage) { warnings.push('seo.noOgImage'); score -= 10; }

  const hasCanonical = /<link[^>]*rel=["']canonical["']/i.test(html);
  if (!hasCanonical) { warnings.push('seo.noCanonical'); score -= 5; }

  const hasLang = /<html[^>]*lang=["'][^"']+["']/i.test(html);
  if (!hasLang) { warnings.push('seo.noLang'); score -= 5; }

  const hasViewport = /<meta[^>]*name=["']viewport["']/i.test(html);
  if (!hasViewport) { warnings.push('seo.noViewport'); score -= 5; }

  return {
    hasTitle, title,
    hasMetaDescription, metaDescription,
    hasOgTitle, hasOgDescription, hasOgImage,
    hasCanonical, hasLang, hasViewport,
    warnings, score: Math.max(0, score),
  };
}

async function main() {
  // 1. Dependências do projeto
  progress({ step: 'install', status: 'start' });

  const nodeModulesExists = fs.existsSync(path.join(PROJECT_ROOT, 'node_modules'));
  if (!nodeModulesExists) {
    console.log('node_modules nao encontrado. Executando npm install...');
    try {
      execSync('npm install', { cwd: PROJECT_ROOT, stdio: 'inherit' });
    } catch (err) {
      progress({ step: 'error', status: 'error', message: 'npm install falhou: ' + err.message });
      process.exit(1);
    }
  }

  // 2. Puppeteer
  let puppeteer;
  try {
    puppeteer = await import('puppeteer');
  } catch {
    console.log('Puppeteer nao encontrado. Instalando (pode demorar na primeira vez)...');
    try {
      // stdio: 'inherit' para mostrar progresso do download do Chromium
      execSync('npm install --save-dev puppeteer', { cwd: PROJECT_ROOT, stdio: 'inherit' });
      puppeteer = await import('puppeteer');
    } catch (err) {
      progress({ step: 'error', status: 'error', message: 'Falha ao instalar puppeteer: ' + err.message });
      process.exit(1);
    }
  }

  progress({ step: 'install', status: 'done' });

  // 3. Build
  progress({ step: 'build', status: 'start' });

  if (CLEAN && fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }

  try {
    execSync('npx vite build --outDir ' + path.relative(PROJECT_ROOT, OUTPUT_DIR), {
      cwd: PROJECT_ROOT, stdio: 'inherit',
    });
  } catch (err) {
    progress({ step: 'error', status: 'error', message: 'Build falhou. Verifique o output acima.' });
    process.exit(1);
  }

  progress({ step: 'build', status: 'done' });

  // 3. Verificar
  const indexPath = path.join(OUTPUT_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    progress({ step: 'error', status: 'error', message: OUTPUT_DIR + '/index.html nao encontrado.' });
    process.exit(1);
  }

  const originalHtml = fs.readFileSync(indexPath, 'utf-8');
  const originalSize = Buffer.byteLength(originalHtml, 'utf-8');

  // 4. Servidor
  const port = await findFreePort();
  const server = createStaticServer(OUTPUT_DIR);
  await new Promise((resolve) => server.listen(port, resolve));

  // 5. Render
  const browser = await puppeteer.default.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const total = ROUTES.length;

  for (let i = 0; i < ROUTES.length; i++) {
    const route = ROUTES[i];
    progress({ step: 'render', status: 'start', route: route.path, current: i + 1, total });

    try {
      const page = await browser.newPage();
      await page.goto('http://localhost:' + port + route.path, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      try {
        await page.waitForSelector(route.waitForSelector, { timeout: route.waitTime });
      } catch { /* seletor não encontrado, usar o que tem */ }

      await new Promise((r) => setTimeout(r, Math.min(route.waitTime, 3000)));

      let html = await page.content();

      if (MINIFY) {
        html = html.replace(/\\n\\s*/g, '').replace(/\\s{2,}/g, ' ');
      }

      const renderedSize = Buffer.byteLength(html, 'utf-8');
      const seo = analyzeSeo(html, route.path);

      const outputPath = route.path === '/'
        ? path.join(OUTPUT_DIR, 'index.html')
        : path.join(OUTPUT_DIR, route.path.slice(1), 'index.html');

      const outputDirPath = path.dirname(outputPath);
      if (!fs.existsSync(outputDirPath)) {
        fs.mkdirSync(outputDirPath, { recursive: true });
      }

      fs.writeFileSync(outputPath, html, 'utf-8');
      await page.close();

      const result = {
        path: route.path,
        status: 'done',
        originalSize,
        renderedSize,
        seo,
      };

      progress({ step: 'render', status: 'done', route: route.path, current: i + 1, total, result });
    } catch (err) {
      const result = {
        path: route.path,
        status: 'error',
        originalSize,
        renderedSize: 0,
        seo: { hasTitle: false, title: '', hasMetaDescription: false, metaDescription: '', hasOgTitle: false, hasOgDescription: false, hasOgImage: false, hasCanonical: false, hasLang: false, hasViewport: false, warnings: [], score: 0 },
        error: err.message,
      };

      progress({ step: 'render', status: 'error', route: route.path, current: i + 1, total, message: err.message, result });
    }
  }

  await browser.close();
  server.close();

  progress({ step: 'done', status: 'done' });
}

function createStaticServer(root) {
  return createServer((req, res) => {
    let filePath = path.join(root, decodeURIComponent(req.url || '/'));

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
      filePath = path.join(root, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
      '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2',
      '.ico': 'image/x-icon', '.webp': 'image/webp', '.gif': 'image/gif',
    };

    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(fs.readFileSync(filePath));
  });
}

async function findFreePort() {
  return new Promise((resolve) => {
    const s = createServer();
    s.listen(0, () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

main().catch((err) => {
  progress({ step: 'error', status: 'error', message: err.message });
  process.exit(1);
});
`.trimStart();

    const scriptPath = this.configManager.getScriptPath();
    const scriptDir = path.dirname(scriptPath);
    if (!fs.existsSync(scriptDir)) {
      fs.mkdirSync(scriptDir, { recursive: true });
    }
    fs.writeFileSync(scriptPath, script, 'utf-8');
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) { return bytes + 'B'; }
  if (bytes < 1024 * 1024) { return (bytes / 1024).toFixed(1) + 'KB'; }
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}
