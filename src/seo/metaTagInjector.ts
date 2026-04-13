import * as fs from 'fs';
import * as path from 'path';
import { MetaTagSuggestion } from './metaTagGenerator';

export interface InjectionResult {
  success: boolean;
  file: string;
  error?: string;
}

/**
 * Localiza o index.html do projeto (raiz ou public/).
 */
export function findIndexHtml(projectRoot: string): string | null {
  const candidates = [
    path.join(projectRoot, 'index.html'),
    path.join(projectRoot, 'public', 'index.html'),
    path.join(projectRoot, 'src', 'index.html'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

/**
 * Aplica uma sugestão de meta tag no index.html do projeto.
 * Cria backup antes de modificar.
 */
export function applyMetaTag(
  projectRoot: string,
  suggestion: MetaTagSuggestion
): InjectionResult {
  const indexPath = findIndexHtml(projectRoot);
  if (!indexPath) {
    return { success: false, file: '', error: 'index.html not found' };
  }

  try {
    let html = fs.readFileSync(indexPath, 'utf-8');

    // Backup
    createBackup(projectRoot, indexPath);

    if (suggestion.type === 'lang') {
      html = injectLang(html, suggestion.value);
    } else if (suggestion.type === 'title') {
      html = injectTitle(html, suggestion);
    } else if (suggestion.type === 'viewport') {
      html = injectInHead(html, suggestion.tag);
    } else if (suggestion.type === 'canonical') {
      html = injectOrReplace(html, 'link[rel="canonical"]', suggestion.tag,
        /<link[^>]*rel=["']canonical["'][^>]*>/i);
    } else if (suggestion.type === 'description') {
      html = injectOrReplace(html, 'meta[name="description"]', suggestion.tag,
        /<meta[^>]*name=["']description["'][^>]*>/i);
    } else if (suggestion.type === 'og:title') {
      html = injectOrReplace(html, 'meta[property="og:title"]', suggestion.tag,
        /<meta[^>]*property=["']og:title["'][^>]*>/i);
    } else if (suggestion.type === 'og:description') {
      html = injectOrReplace(html, 'meta[property="og:description"]', suggestion.tag,
        /<meta[^>]*property=["']og:description["'][^>]*>/i);
    } else if (suggestion.type === 'og:image') {
      html = injectOrReplace(html, 'meta[property="og:image"]', suggestion.tag,
        /<meta[^>]*property=["']og:image["'][^>]*>/i);
    }

    fs.writeFileSync(indexPath, html, 'utf-8');
    return { success: true, file: indexPath };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, file: indexPath, error: msg };
  }
}

// ── Helpers ──────────────────────────────────────────────────

function createBackup(projectRoot: string, filePath: string): void {
  const backupDir = path.join(projectRoot, '.viteprerender', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const name = path.basename(filePath);
  const ts = Date.now();
  const backupPath = path.join(backupDir, `${name}.${ts}.bak`);

  // Só criar backup se não existir um recente (últimos 10s)
  const existing = fs.readdirSync(backupDir)
    .filter((f) => f.startsWith(name))
    .sort()
    .pop();

  if (existing) {
    const existingTs = parseInt(existing.split('.').slice(-2, -1)[0] || '0', 10);
    if (Date.now() - existingTs < 10000) {
      return; // Backup recente existe
    }
  }

  fs.copyFileSync(filePath, backupPath);
}

function injectLang(html: string, lang: string): string {
  if (/<html[^>]*lang=/i.test(html)) {
    return html.replace(/(<html[^>]*lang=["'])[^"']*["']/i, `$1${lang}"`);
  }
  return html.replace(/<html/i, `<html lang="${lang}"`);
}

function injectTitle(html: string, suggestion: MetaTagSuggestion): string {
  if (suggestion.action === 'replace') {
    return html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, suggestion.tag);
  }
  return injectInHead(html, suggestion.tag);
}

function injectOrReplace(
  html: string,
  _selector: string,
  newTag: string,
  existingRegex: RegExp
): string {
  if (existingRegex.test(html)) {
    return html.replace(existingRegex, newTag);
  }
  return injectInHead(html, newTag);
}

function injectInHead(html: string, tag: string): string {
  // Inserir antes de </head>
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `  ${tag}\n</head>`);
  }
  // Fallback: inserir no início
  return tag + '\n' + html;
}
