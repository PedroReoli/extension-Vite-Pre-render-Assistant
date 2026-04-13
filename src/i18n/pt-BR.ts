export const ptBR = {
  // Header
  'header.title': 'Pre-render',

  // Status
  'status.viteDetected': 'Projeto Vite detectado',
  'status.viteNotDetected': 'Nenhum projeto Vite',
  'status.openViteProject': 'Abra um projeto com Vite.',

  // Scan
  'scan.title': 'Descoberta',
  'scan.button': 'Escanear Rotas',
  'scan.scanning': 'Escaneando projeto...',
  'scan.cacheValid': 'Cache válido: nenhuma nova rota. {total} rotas já conhecidas.',
  'scan.cacheNewRoutes': 'Cache válido: {count} nova(s) rota(s) adicionada(s).',
  'scan.added': '{count} nova(s) rota(s). {total} total ({alta} alta confiança).',
  'scan.allExist': 'Todas as {total} rotas já estavam na lista.',
  'scan.noneFound': 'Nenhuma rota encontrada.',

  // Routes
  'routes.title': 'Rotas',
  'routes.selected': '{enabled} de {total} selecionada{s}',
  'routes.empty': 'Nenhuma rota. Escaneie ou adicione.',
  'routes.placeholder': '/nova-rota',
  'routes.yes': 'Sim',
  'routes.no': 'Não',
  'routes.moveUp': 'Mover acima',
  'routes.moveDown': 'Mover abaixo',
  'routes.remove': 'Remover',

  // Build
  'build.button': 'Gerar Pre-render ({count} rota{s})',
  'build.noRoutes': 'Nenhuma rota habilitada.',
  'build.alreadyRunning': 'Um pré-render já está em execução.',
  'build.progress': 'Progresso',
  'build.cancel': 'Cancelar',
  'build.back': 'Voltar',
  'build.viewResults': 'Ver resultados',

  // Build steps
  'step.install': 'Verificando dependências...',
  'step.npmInstall': 'Instalando dependências do projeto...',
  'step.puppeteer': 'Instalando Puppeteer (primeira vez)...',
  'step.build': 'Executando vite build...',
  'step.render': 'Renderizando ({current}/{total})',
  'step.done': 'Concluído',
  'step.error': 'Erro',

  // Results
  'results.title': 'Resultados',
  'results.routes': 'Rotas',
  'results.avgSeo': 'SEO médio',
  'results.totalSize': 'Total',
  'results.sizeComparison': 'SPA original: {original} → Pré-renderizado: {rendered}',
  'results.sizeGain': '(+{diff} de conteúdo)',
  'results.openFolder': 'Abrir pasta',
  'results.preview': 'Preview',
  'results.completedWithErrors': 'Concluído com erros',
  'results.completed': 'Pre-render concluído',
  'results.routesOk': '{count} rota(s) OK',
  'results.errors': '{count} erro(s)',

  // Deploy
  'deploy.zip': 'Gerar ZIP',
  'deploy.copy': 'Copiar deploy',
  'deploy.copyPrompt': 'Caminho de destino para o deploy',
  'deploy.copyPlaceholder': '../deploy/public',
  'deploy.folderNotFound': 'Pasta {dir} não encontrada. Execute o pré-render primeiro.',
  'deploy.zipSuccess': 'ZIP gerado: {path}',
  'deploy.zipError': 'Erro ao gerar ZIP: {error}',
  'deploy.copySuccess': 'Deploy copiado para: {path}',
  'deploy.copyError': 'Erro no deploy: {error}',

  // Outdated
  'outdated.warning': 'Código-fonte alterado desde o último pré-render. Execute novamente.',

  // Last build
  'lastBuild.info': 'Último build: {date} — {original} → {rendered}',
  'lastBuild.viewResults': 'Ver resultados',

  // Errors
  'error.notVite': 'Este projeto não foi detectado como um projeto Vite.',
  'error.noResults': 'Nenhum resultado disponível. Execute o pré-render primeiro.',
  'error.htmlNotFound': 'HTML não encontrado para {path}.',

  // Preview
  'preview.title': 'Preview: {path}',
  'preview.source': 'Código',
  'preview.render': 'Preview',

  // Output channel
  'output.title': 'Vite Pre-render',
  'output.header': 'Vite Pre-render Assistant',
  'output.depsOk': 'Dependências OK.',
  'output.building': 'Executando vite build...',
  'output.buildDone': 'Build concluído.',
  'output.rendering': '[{current}/{total}] {route}',
  'output.ok': 'OK',
  'output.seo': 'SEO: {score}/100',
  'output.error': 'ERRO: {message}',
  'output.done': 'Pré-render concluído com sucesso.',
  'output.exitCode': 'Processo encerrado com código {code}',
  'output.startError': 'Erro ao iniciar: {message}',
  'output.cancelled': 'Cancelado pelo usuário.',
  'output.started': 'Pré-render iniciado para {count} rota(s). Output: {dir}/',

  // SEO warnings
  'seo.noTitle': 'Sem <title>',
  'seo.titleShort': 'Title muito curto ({len} chars)',
  'seo.titleLong': 'Title muito longo ({len} chars)',
  'seo.noDescription': 'Sem meta description',
  'seo.descShort': 'Meta description curta',
  'seo.descLong': 'Meta description longa',
  'seo.noOgTitle': 'Sem og:title',
  'seo.noOgDesc': 'Sem og:description',
  'seo.noOgImage': 'Sem og:image',
  'seo.noCanonical': 'Sem link canonical',
  'seo.noLang': 'Sem atributo lang no <html>',
  'seo.noViewport': 'Sem meta viewport',
};
