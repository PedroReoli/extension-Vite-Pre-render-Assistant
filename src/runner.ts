import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Route } from './configManager';

const OUTPUT_DIR = 'prerender-build';

/**
 * Executa o build do Vite seguido do pré-render.
 * Output gerado na pasta prerender-build/.
 * Usa terminal integrado do VSCode.
 */
export class Runner {
  private terminal: vscode.Terminal | undefined;

  constructor(private projectRoot: string) {}

  /**
   * Executa o fluxo completo: instalar dependências, build e pré-render.
   */
  run(enabledRoutes: Route[]): void {
    if (enabledRoutes.length === 0) {
      vscode.window.showWarningMessage(
        'Nenhuma rota habilitada. Ative pelo menos uma rota antes de executar.'
      );
      return;
    }

    this.ensurePrerenderScript(enabledRoutes);

    const commands: string[] = [];

    if (this.needsInstallDependencies()) {
      commands.push('npm install');
    }

    // Build do Vite com output na pasta prerender-build
    commands.push(`npx vite build --outDir ${OUTPUT_DIR}`);
    commands.push('node ./prerender.script.mjs');

    const fullCommand = commands.join(' && ');

    this.getTerminal().sendText(fullCommand);
    vscode.window.showInformationMessage(
      `Pré-render iniciado para ${enabledRoutes.length} rota(s). Output: ${OUTPUT_DIR}/`
    );
  }

  /**
   * Gera o script de pré-render temporário na raiz do projeto.
   */
  private ensurePrerenderScript(routes: Route[]): void {
    const routeList = routes.map((r) => `'${r.path}'`).join(', ');

    const script = `
import { createServer } from 'vite';
import fs from 'fs';
import path from 'path';

const routes = [${routeList}];
const outDir = path.resolve('${OUTPUT_DIR}');

async function prerender() {
  const templatePath = path.join(outDir, 'index.html');
  if (!fs.existsSync(templatePath)) {
    console.error('Erro: ${OUTPUT_DIR}/index.html nao encontrado. Verifique o build.');
    process.exit(1);
  }

  const template = fs.readFileSync(templatePath, 'utf-8');

  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });

  console.log('Gerando pre-render para ' + routes.length + ' rota(s)...');
  console.log('Output: ${OUTPUT_DIR}/');
  console.log('');

  for (const route of routes) {
    try {
      let html = template;

      html = html.replace(
        '</head>',
        \`<link rel="canonical" href="\${route}" />\\n</head>\`
      );

      const outputPath = route === '/'
        ? path.join(outDir, 'index.html')
        : path.join(outDir, route.slice(1), 'index.html');

      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(outputPath, html, 'utf-8');
      console.log('  OK  ' + route + '  ->  ' + path.relative(process.cwd(), outputPath));
    } catch (err) {
      console.error('  ERRO  ' + route + ':', err);
    }
  }

  await vite.close();
  console.log('');
  console.log('Pre-render concluido com sucesso.');
}

prerender();
`.trimStart();

    const scriptPath = path.join(this.projectRoot, 'prerender.script.mjs');
    fs.writeFileSync(scriptPath, script, 'utf-8');
  }

  private needsInstallDependencies(): boolean {
    const nodeModules = path.join(this.projectRoot, 'node_modules');
    return !fs.existsSync(nodeModules);
  }

  private getTerminal(): vscode.Terminal {
    if (this.terminal && !this.terminal.exitStatus) {
      return this.terminal;
    }

    this.terminal = vscode.window.createTerminal({
      name: 'Vite Pre-render',
      cwd: this.projectRoot,
    });

    this.terminal.show();
    return this.terminal;
  }

  dispose(): void {
    this.terminal?.dispose();
  }
}
