import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { Route, PrerenderConfig } from './configManager';

export interface BuildProgress {
  step: 'install' | 'build' | 'render' | 'done' | 'error';
  status: 'start' | 'progress' | 'done' | 'error';
  route?: string;
  message?: string;
  total?: number;
  current?: number;
}

export type ProgressCallback = (progress: BuildProgress) => void;

/**
 * Executa o build do Vite seguido do pré-render real com Puppeteer.
 * Usa child_process para capturar progresso e reportar à sidebar.
 */
export class Runner {
  private outputChannel: vscode.OutputChannel;
  private process: ChildProcess | undefined;
  private onProgress: ProgressCallback | undefined;

  constructor(private projectRoot: string) {
    this.outputChannel = vscode.window.createOutputChannel('Vite Pre-render');
  }

  setProgressCallback(cb: ProgressCallback): void {
    this.onProgress = cb;
  }

  /**
   * Executa o fluxo completo via script único.
   */
  run(enabledRoutes: Route[], config: PrerenderConfig): void {
    if (enabledRoutes.length === 0) {
      vscode.window.showWarningMessage(
        'Nenhuma rota habilitada. Ative pelo menos uma rota antes de executar.'
      );
      return;
    }

    if (this.process && !this.process.killed) {
      vscode.window.showWarningMessage('Um pré-render já está em execução.');
      return;
    }

    this.generateScript(enabledRoutes, config);

    this.outputChannel.clear();
    this.outputChannel.show(true);
    this.outputChannel.appendLine('═══ Vite Pre-render Assistant ═══');
    this.outputChannel.appendLine('');

    this.emit({ step: 'install', status: 'start' });

    // Comando único — sem problemas com && no PowerShell
    const proc = spawn('node', ['prerender.script.mjs'], {
      cwd: this.projectRoot,
      shell: true,
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    this.process = proc;

    let buffer = '';

    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString('utf-8');
      buffer += text;

      // Processar linhas completas
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        this.processLine(line);
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString('utf-8');
      this.outputChannel.appendLine(text);
    });

    proc.on('close', (code) => {
      // Processar buffer restante
      if (buffer.trim()) {
        this.processLine(buffer);
      }

      this.process = undefined;

      if (code === 0) {
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine('Pré-render concluído com sucesso.');
        this.emit({ step: 'done', status: 'done' });
      } else {
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine(`Processo encerrado com código ${code}`);
        this.emit({
          step: 'error',
          status: 'error',
          message: `Processo encerrado com código ${code}`,
        });
      }
    });

    proc.on('error', (err) => {
      this.outputChannel.appendLine(`Erro ao iniciar processo: ${err.message}`);
      this.emit({
        step: 'error',
        status: 'error',
        message: err.message,
      });
      this.process = undefined;
    });
  }

  cancel(): void {
    if (this.process && !this.process.killed) {
      this.process.kill();
      this.process = undefined;
      this.emit({ step: 'error', status: 'error', message: 'Cancelado pelo usuário.' });
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

  dispose(): void {
    this.cancel();
    this.outputChannel.dispose();
  }

  private processLine(raw: string): void {
    const line = raw.trim();
    if (!line) {
      return;
    }

    // Tentar parsear como JSON de progresso
    if (line.startsWith('{"')) {
      try {
        const progress = JSON.parse(line) as BuildProgress;
        this.emit(progress);
        this.logProgress(progress);
        return;
      } catch {
        // Não é JSON válido, tratar como texto
      }
    }

    this.outputChannel.appendLine(line);
  }

  private logProgress(p: BuildProgress): void {
    switch (p.step) {
      case 'install':
        if (p.status === 'start') {
          this.outputChannel.appendLine('Verificando dependências...');
        } else if (p.status === 'done') {
          this.outputChannel.appendLine('Dependências OK.');
        }
        break;

      case 'build':
        if (p.status === 'start') {
          this.outputChannel.appendLine('');
          this.outputChannel.appendLine('Executando vite build...');
        } else if (p.status === 'done') {
          this.outputChannel.appendLine('Build concluído.');
        }
        break;

      case 'render':
        if (p.status === 'start' && p.route) {
          this.outputChannel.appendLine(
            `  [${p.current}/${p.total}] Renderizando ${p.route}...`
          );
        } else if (p.status === 'done' && p.route) {
          this.outputChannel.appendLine(`         OK`);
        } else if (p.status === 'error' && p.route) {
          this.outputChannel.appendLine(`         ERRO: ${p.message}`);
        }
        break;
    }
  }

  private emit(progress: BuildProgress): void {
    this.onProgress?.(progress);
  }

  /**
   * Gera script completo que faz tudo: instala puppeteer, builda, renderiza.
   * Um único arquivo .mjs executado com `node`.
   */
  private generateScript(routes: Route[], config: PrerenderConfig): void {
    const routeList = JSON.stringify(routes.map((r) => r.path));
    const outputDir = config.outputDir || 'prerender-build';
    const waitSelector = config.waitForSelector || '#app, #root, [data-app]';
    const waitTime = config.waitTime || 2000;
    const minify = config.minify || false;
    const cleanBefore = config.cleanBefore !== false;

    const script = `
import { execSync } from 'child_process';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routes = ${routeList};
const OUTPUT_DIR = path.resolve(__dirname, '${outputDir}');
const WAIT_SELECTOR = '${waitSelector}';
const WAIT_TIME = ${waitTime};
const MINIFY = ${minify};
const CLEAN_BEFORE = ${cleanBefore};

function progress(obj) {
  console.log(JSON.stringify(obj));
}

async function main() {
  // ── 1. Verificar/instalar puppeteer ──
  progress({ step: 'install', status: 'start' });

  let puppeteer;
  try {
    puppeteer = await import('puppeteer');
  } catch {
    console.log('Puppeteer não encontrado. Instalando...');
    try {
      execSync('npm install --save-dev puppeteer', {
        cwd: __dirname,
        stdio: 'pipe',
      });
      puppeteer = await import('puppeteer');
    } catch (err) {
      progress({ step: 'error', status: 'error', message: 'Falha ao instalar puppeteer: ' + err.message });
      process.exit(1);
    }
  }

  progress({ step: 'install', status: 'done' });

  // ── 2. Build do Vite ──
  progress({ step: 'build', status: 'start' });

  if (CLEAN_BEFORE && fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }

  try {
    execSync('npx vite build --outDir ' + path.relative(__dirname, OUTPUT_DIR), {
      cwd: __dirname,
      stdio: 'pipe',
    });
  } catch (err) {
    progress({ step: 'error', status: 'error', message: 'Falha no build: ' + err.message });
    process.exit(1);
  }

  progress({ step: 'build', status: 'done' });

  // ── 3. Verificar output ──
  const indexPath = path.join(OUTPUT_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    progress({ step: 'error', status: 'error', message: OUTPUT_DIR + '/index.html nao encontrado.' });
    process.exit(1);
  }

  // ── 4. Subir servidor estático ──
  const port = await findFreePort();
  const server = createStaticServer(OUTPUT_DIR);
  await new Promise((resolve) => server.listen(port, resolve));
  const baseUrl = 'http://localhost:' + port;

  // ── 5. Renderizar com Puppeteer ──
  const browser = await puppeteer.default.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const total = routes.length;
  let success = 0;
  let errors = 0;

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    progress({ step: 'render', status: 'start', route, current: i + 1, total });

    try {
      const page = await browser.newPage();
      const url = baseUrl + route;

      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

      // Esperar pelo seletor do app ou timeout
      try {
        await page.waitForSelector(WAIT_SELECTOR, { timeout: WAIT_TIME });
      } catch {
        // Seletor não encontrado, mas seguimos com o que temos
      }

      // Aguardar tempo extra para renderização dinâmica
      await new Promise((r) => setTimeout(r, Math.min(WAIT_TIME, 3000)));

      let html = await page.content();

      if (MINIFY) {
        html = html.replace(/\\n\\s*/g, '').replace(/\\s{2,}/g, ' ');
      }

      // Salvar HTML
      const outputPath = route === '/'
        ? path.join(OUTPUT_DIR, 'index.html')
        : path.join(OUTPUT_DIR, route.slice(1), 'index.html');

      const outputDirPath = path.dirname(outputPath);
      if (!fs.existsSync(outputDirPath)) {
        fs.mkdirSync(outputDirPath, { recursive: true });
      }

      fs.writeFileSync(outputPath, html, 'utf-8');
      await page.close();
      success++;

      progress({ step: 'render', status: 'done', route, current: i + 1, total });
    } catch (err) {
      errors++;
      progress({
        step: 'render',
        status: 'error',
        route,
        current: i + 1,
        total,
        message: err.message,
      });
    }
  }

  // ── 6. Cleanup ──
  await browser.close();
  server.close();

  progress({
    step: 'done',
    status: 'done',
    total,
    current: success,
    message: errors > 0 ? errors + ' rota(s) com erro' : 'Todas as rotas renderizadas',
  });
}

function createStaticServer(root) {
  return createServer((req, res) => {
    let filePath = path.join(root, decodeURIComponent(req.url || '/'));

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
      // SPA fallback: servir index.html para qualquer rota
      filePath = path.join(root, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

async function findFreePort() {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

main().catch((err) => {
  progress({ step: 'error', status: 'error', message: err.message });
  process.exit(1);
});
`.trimStart();

    const scriptPath = path.join(this.projectRoot, 'prerender.script.mjs');
    fs.writeFileSync(scriptPath, script, 'utf-8');
  }
}
