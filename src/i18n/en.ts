export const en = {
  // Header
  'header.title': 'Pre-render',

  // Status
  'status.viteDetected': 'Vite project detected',
  'status.viteNotDetected': 'No Vite project',
  'status.openViteProject': 'Open a Vite project to get started.',

  // Scan
  'scan.title': 'Discovery',
  'scan.button': 'Scan Routes',
  'scan.scanning': 'Scanning project...',
  'scan.cacheValid': 'Cache valid: no new routes. {total} routes already known.',
  'scan.cacheNewRoutes': 'Cache valid: {count} new route(s) added.',
  'scan.added': '{count} new route(s). {total} total ({alta} high confidence).',
  'scan.allExist': 'All {total} routes were already in the list.',
  'scan.noneFound': 'No routes found.',

  // Routes
  'routes.title': 'Routes',
  'routes.selected': '{enabled} of {total} selected',
  'routes.empty': 'No routes. Scan or add manually.',
  'routes.placeholder': '/new-route',
  'routes.yes': 'Yes',
  'routes.no': 'No',
  'routes.moveUp': 'Move up',
  'routes.moveDown': 'Move down',
  'routes.remove': 'Remove',

  // Build
  'build.button': 'Generate Pre-render ({count} route{s})',
  'build.noRoutes': 'No routes enabled.',
  'build.alreadyRunning': 'A pre-render is already running.',
  'build.progress': 'Progress',
  'build.cancel': 'Cancel',
  'build.back': 'Back',
  'build.viewResults': 'View results',

  // Build steps
  'step.install': 'Checking dependencies...',
  'step.npmInstall': 'Installing project dependencies...',
  'step.puppeteer': 'Installing Puppeteer (first time)...',
  'step.build': 'Running vite build...',
  'step.render': 'Rendering ({current}/{total})',
  'step.done': 'Done',
  'step.error': 'Error',

  // Results
  'results.title': 'Results',
  'results.routes': 'Routes',
  'results.avgSeo': 'Avg SEO',
  'results.totalSize': 'Total',
  'results.sizeComparison': 'SPA original: {original} → Pre-rendered: {rendered}',
  'results.sizeGain': '(+{diff} of content)',
  'results.checks': 'checks passed',
  'results.openFolder': 'Open folder',
  'results.preview': 'Preview',
  'results.completedWithErrors': 'Completed with errors',
  'results.completed': 'Pre-render completed',
  'results.routesOk': '{count} route(s) OK',
  'results.errors': '{count} error(s)',

  // Deploy
  'deploy.zip': 'Generate ZIP',
  'deploy.copy': 'Copy deploy',
  'deploy.copyPrompt': 'Destination path for deploy',
  'deploy.copyPlaceholder': '../deploy/public',
  'deploy.folderNotFound': '{dir} folder not found. Run pre-render first.',
  'deploy.zipSuccess': 'ZIP generated: {path}',
  'deploy.zipError': 'Error generating ZIP: {error}',
  'deploy.copySuccess': 'Deploy copied to: {path}',
  'deploy.copyError': 'Deploy error: {error}',

  // Outdated
  'outdated.warning': 'Source code changed since last pre-render. Run again.',

  // Last build
  'lastBuild.info': 'Last build: {date} — {original} → {rendered}',
  'lastBuild.viewResults': 'View results',

  // Errors
  'error.notVite': 'This project was not detected as a Vite project.',
  'error.noResults': 'No results available. Run pre-render first.',
  'error.htmlNotFound': 'HTML not found for {path}.',

  // Preview
  'preview.title': 'Preview: {path}',
  'preview.rendered': 'Rendered',
  'preview.source': 'Source',
  'preview.raw': 'Text',
  'preview.render': 'Preview',

  // Output channel
  'output.title': 'Vite Pre-render',
  'output.header': 'Vite Pre-render Assistant',
  'output.depsOk': 'Dependencies OK.',
  'output.building': 'Running vite build...',
  'output.buildDone': 'Build done.',
  'output.rendering': '[{current}/{total}] {route}',
  'output.ok': 'OK',
  'output.seo': 'SEO: {score}/100',
  'output.error': 'ERROR: {message}',
  'output.done': 'Pre-render completed successfully.',
  'output.exitCode': 'Process exited with code {code}',
  'output.startError': 'Error starting: {message}',
  'output.cancelled': 'Cancelled by user.',
  'output.started': 'Pre-render started for {count} route(s). Output: {dir}/',

  // SEO warnings (keys match script output)
  'seo.noTitle': 'Missing <title>',
  'seo.titleShort': 'Title too short ({len} chars)',
  'seo.titleLong': 'Title too long ({len} chars)',
  'seo.noDescription': 'Missing meta description',
  'seo.descShort': 'Meta description too short',
  'seo.descLong': 'Meta description too long',
  'seo.noOgTitle': 'Missing og:title',
  'seo.noOgDesc': 'Missing og:description',
  'seo.noOgImage': 'Missing og:image',
  'seo.noCanonical': 'Missing link canonical',
  'seo.noLang': 'Missing lang attribute on <html>',
  'seo.noViewport': 'Missing meta viewport',
  'seo.allGood': 'All SEO checks passed for this route!',
  'seo.selectTags': 'Select meta tags to copy ({route})',
  'seo.copiedToClipboard': '{count} meta tag(s) copied to clipboard.',

  // Premium / Licensing
  'premium.badge': 'PRO',
  'premium.upgrade': 'Upgrade',
  'premium.upgradeTitle': 'Unlock Premium',
  'premium.upgradeDesc': 'SEO suggestions, meta tag generation, AI analysis and more',
  'premium.activateTitle': 'Activate License',
  'premium.activatePlaceholder': 'VPAR-XXXX-XXXX-XXXX',
  'premium.activateBtn': 'Activate',
  'premium.activated': 'Premium activated successfully!',
  'premium.invalid': 'Invalid license key.',
  'premium.networkError': 'Could not validate. Check your connection.',
  'premium.invalidFormat': 'Invalid key format. Expected: VPAR-XXXX-XXXX-XXXX',
  'premium.deactivate': 'Deactivate',
  'premium.deactivated': 'License deactivated.',
  'premium.required': 'This feature requires Premium.',
  'premium.active': 'Premium active',
  'premium.fixSeo': 'Fix SEO',
  'premium.aiSuggest': 'AI Suggestions',
  'premium.exportReport': 'Export SEO Report',
  'preview.useButton': 'Use the "Preview" button in pre-render results.',
};
