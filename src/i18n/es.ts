export const es = {
  // Header
  'header.title': 'Pre-render',

  // Status
  'status.viteDetected': 'Proyecto Vite detectado',
  'status.viteNotDetected': 'Ningún proyecto Vite',
  'status.openViteProject': 'Abre un proyecto con Vite.',

  // Scan
  'scan.title': 'Descubrimiento',
  'scan.button': 'Escanear Rutas',
  'scan.scanning': 'Escaneando proyecto...',
  'scan.cacheValid': 'Caché válido: ninguna ruta nueva. {total} rutas ya conocidas.',
  'scan.cacheNewRoutes': 'Caché válido: {count} ruta(s) nueva(s) agregada(s).',
  'scan.added': '{count} ruta(s) nueva(s). {total} total ({alta} alta confianza).',
  'scan.allExist': 'Todas las {total} rutas ya estaban en la lista.',
  'scan.noneFound': 'Ninguna ruta encontrada.',

  // Routes
  'routes.title': 'Rutas',
  'routes.selected': '{enabled} de {total} seleccionada{s}',
  'routes.empty': 'Ninguna ruta. Escanea o agrega manualmente.',
  'routes.placeholder': '/nueva-ruta',
  'routes.yes': 'Sí',
  'routes.no': 'No',
  'routes.moveUp': 'Mover arriba',
  'routes.moveDown': 'Mover abajo',
  'routes.remove': 'Eliminar',

  // Build
  'build.button': 'Generar Pre-render ({count} ruta{s})',
  'build.noRoutes': 'Ninguna ruta habilitada.',
  'build.alreadyRunning': 'Un pre-render ya está en ejecución.',
  'build.progress': 'Progreso',
  'build.cancel': 'Cancelar',
  'build.back': 'Volver',
  'build.viewResults': 'Ver resultados',

  // Build steps
  'step.install': 'Verificando dependencias...',
  'step.npmInstall': 'Instalando dependencias del proyecto...',
  'step.puppeteer': 'Instalando Puppeteer (primera vez)...',
  'step.build': 'Ejecutando vite build...',
  'step.render': 'Renderizando ({current}/{total})',
  'step.done': 'Completado',
  'step.error': 'Error',

  // Results
  'results.title': 'Resultados',
  'results.routes': 'Rutas',
  'results.avgSeo': 'SEO promedio',
  'results.totalSize': 'Total',
  'results.sizeComparison': 'SPA original: {original} → Pre-renderizado: {rendered}',
  'results.sizeGain': '(+{diff} de contenido)',
  'results.openFolder': 'Abrir carpeta',
  'results.preview': 'Preview',
  'results.completedWithErrors': 'Completado con errores',
  'results.completed': 'Pre-render completado',
  'results.routesOk': '{count} ruta(s) OK',
  'results.errors': '{count} error(es)',

  // Deploy
  'deploy.zip': 'Generar ZIP',
  'deploy.copy': 'Copiar deploy',
  'deploy.copyPrompt': 'Ruta de destino para el deploy',
  'deploy.copyPlaceholder': '../deploy/public',
  'deploy.folderNotFound': 'Carpeta {dir} no encontrada. Ejecuta el pre-render primero.',
  'deploy.zipSuccess': 'ZIP generado: {path}',
  'deploy.zipError': 'Error al generar ZIP: {error}',
  'deploy.copySuccess': 'Deploy copiado a: {path}',
  'deploy.copyError': 'Error en el deploy: {error}',

  // Outdated
  'outdated.warning': 'Código fuente modificado desde el último pre-render. Ejecuta nuevamente.',

  // Last build
  'lastBuild.info': 'Último build: {date} — {original} → {rendered}',
  'lastBuild.viewResults': 'Ver resultados',

  // Errors
  'error.notVite': 'Este proyecto no fue detectado como un proyecto Vite.',
  'error.noResults': 'No hay resultados disponibles. Ejecuta el pre-render primero.',
  'error.htmlNotFound': 'HTML no encontrado para {path}.',

  // Preview
  'preview.title': 'Preview: {path}',
  'preview.source': 'Código',
  'preview.render': 'Preview',

  // Output channel
  'output.title': 'Vite Pre-render',
  'output.header': 'Vite Pre-render Assistant',
  'output.depsOk': 'Dependencias OK.',
  'output.building': 'Ejecutando vite build...',
  'output.buildDone': 'Build completado.',
  'output.rendering': '[{current}/{total}] {route}',
  'output.ok': 'OK',
  'output.seo': 'SEO: {score}/100',
  'output.error': 'ERROR: {message}',
  'output.done': 'Pre-render completado exitosamente.',
  'output.exitCode': 'Proceso terminó con código {code}',
  'output.startError': 'Error al iniciar: {message}',
  'output.cancelled': 'Cancelado por el usuario.',
  'output.started': 'Pre-render iniciado para {count} ruta(s). Output: {dir}/',

  // SEO warnings
  'seo.noTitle': 'Sin <title>',
  'seo.titleShort': 'Título muy corto ({len} chars)',
  'seo.titleLong': 'Título muy largo ({len} chars)',
  'seo.noDescription': 'Sin meta description',
  'seo.descShort': 'Meta description muy corta',
  'seo.descLong': 'Meta description muy larga',
  'seo.noOgTitle': 'Sin og:title',
  'seo.noOgDesc': 'Sin og:description',
  'seo.noOgImage': 'Sin og:image',
  'seo.noCanonical': 'Sin link canonical',
  'seo.noLang': 'Sin atributo lang en <html>',
  'seo.noViewport': 'Sin meta viewport',

  // Premium / Licensing
  'premium.badge': 'PRO',
  'premium.upgrade': 'Upgrade',
  'premium.upgradeTitle': 'Desbloquear Premium',
  'premium.upgradeDesc': 'Sugerencias SEO, generación de meta tags, análisis con IA y más',
  'premium.activateTitle': 'Activar Licencia',
  'premium.activatePlaceholder': 'VPAR-XXXX-XXXX-XXXX',
  'premium.activateBtn': 'Activar',
  'premium.activated': 'Premium activado exitosamente!',
  'premium.invalid': 'Clave de licencia inválida.',
  'premium.networkError': 'No se pudo validar. Verifica tu conexión.',
  'premium.invalidFormat': 'Formato inválido. Esperado: VPAR-XXXX-XXXX-XXXX',
  'premium.deactivate': 'Desactivar',
  'premium.deactivated': 'Licencia desactivada.',
  'premium.required': 'Esta función requiere Premium.',
  'premium.active': 'Premium activo',
  'premium.fixSeo': 'Corregir SEO',
  'premium.aiSuggest': 'Sugerencias IA',
  'premium.exportReport': 'Exportar Reporte SEO',
  'preview.useButton': 'Usa el botón "Preview" en los resultados del pre-render.',
};
