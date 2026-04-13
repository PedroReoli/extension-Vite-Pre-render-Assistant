import { SeoResult } from '../configManager';

export interface MetaTagSuggestion {
  type: 'title' | 'description' | 'og:title' | 'og:description' | 'og:image' | 'canonical' | 'lang' | 'viewport';
  tag: string;
  value: string;
  source: 'template';
  action: 'add' | 'replace';
}

/**
 * Gera sugestões de meta tags baseado no HTML renderizado.
 * Usa heurísticas: extrai h1, primeiro parágrafo, primeira imagem.
 */
export function generateMetaTags(
  html: string,
  routePath: string,
  seo: SeoResult,
  siteUrl?: string
): MetaTagSuggestion[] {
  const suggestions: MetaTagSuggestion[] = [];
  const h1 = extractH1(html);
  const firstParagraph = extractFirstParagraph(html);
  const firstImage = extractFirstImage(html);
  const baseUrl = siteUrl || '';

  // title
  if (!seo.hasTitle) {
    const val = h1 || capitalize(routePath);
    suggestions.push({
      type: 'title',
      tag: `<title>${truncate(val, 60)}</title>`,
      value: truncate(val, 60),
      source: 'template',
      action: 'add',
    });
  } else if (seo.title.length < 10 || seo.title.length > 70) {
    const val = h1 || seo.title;
    suggestions.push({
      type: 'title',
      tag: `<title>${truncate(val, 60)}</title>`,
      value: truncate(val, 60),
      source: 'template',
      action: 'replace',
    });
  }

  // meta description
  if (!seo.hasMetaDescription) {
    const val = firstParagraph || h1 || '';
    if (val) {
      suggestions.push({
        type: 'description',
        tag: `<meta name="description" content="${truncate(val, 155)}">`,
        value: truncate(val, 155),
        source: 'template',
        action: 'add',
      });
    }
  } else if (seo.metaDescription.length > 160) {
    suggestions.push({
      type: 'description',
      tag: `<meta name="description" content="${truncate(seo.metaDescription, 155)}">`,
      value: truncate(seo.metaDescription, 155),
      source: 'template',
      action: 'replace',
    });
  }

  // og:title
  if (!seo.hasOgTitle) {
    const val = seo.hasTitle ? seo.title : (h1 || capitalize(routePath));
    suggestions.push({
      type: 'og:title',
      tag: `<meta property="og:title" content="${truncate(val, 60)}">`,
      value: truncate(val, 60),
      source: 'template',
      action: 'add',
    });
  }

  // og:description
  if (!seo.hasOgDescription) {
    const val = seo.hasMetaDescription ? seo.metaDescription : (firstParagraph || '');
    if (val) {
      suggestions.push({
        type: 'og:description',
        tag: `<meta property="og:description" content="${truncate(val, 155)}">`,
        value: truncate(val, 155),
        source: 'template',
        action: 'add',
      });
    }
  }

  // og:image
  if (!seo.hasOgImage && firstImage) {
    const imgUrl = firstImage.startsWith('http') ? firstImage : `${baseUrl}${firstImage}`;
    suggestions.push({
      type: 'og:image',
      tag: `<meta property="og:image" content="${imgUrl}">`,
      value: imgUrl,
      source: 'template',
      action: 'add',
    });
  }

  // canonical
  if (!seo.hasCanonical) {
    const url = `${baseUrl}${routePath}`;
    suggestions.push({
      type: 'canonical',
      tag: `<link rel="canonical" href="${url}">`,
      value: url,
      source: 'template',
      action: 'add',
    });
  }

  // lang
  if (!seo.hasLang) {
    suggestions.push({
      type: 'lang',
      tag: '<html lang="en">',
      value: 'en',
      source: 'template',
      action: 'add',
    });
  }

  // viewport
  if (!seo.hasViewport) {
    suggestions.push({
      type: 'viewport',
      tag: '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
      value: 'width=device-width, initial-scale=1.0',
      source: 'template',
      action: 'add',
    });
  }

  return suggestions;
}

// ── Extractors ──────────────────────────────────────────────

function extractH1(html: string): string {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match) { return ''; }
  return stripTags(match[1]).trim();
}

function extractFirstParagraph(html: string): string {
  // Pegar o primeiro <p> com mais de 20 caracteres de conteúdo
  const paragraphs = html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
  for (const m of paragraphs) {
    const text = stripTags(m[1]).trim();
    if (text.length > 20) {
      return text;
    }
  }
  return '';
}

function extractFirstImage(html: string): string {
  // Buscar imagens em <main>, <header>, ou no body geral
  const sections = [
    html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1],
    html.match(/<header[^>]*>([\s\S]*?)<\/header>/i)?.[1],
    html,
  ];

  for (const section of sections) {
    if (!section) { continue; }
    const imgMatch = section.match(/<img[^>]*src=["']([^"']+)["']/i);
    if (imgMatch && !isTinyImage(imgMatch[1])) {
      return imgMatch[1];
    }
  }
  return '';
}

function isTinyImage(src: string): boolean {
  // Ignorar ícones e imagens pequenas (favicon, sprites)
  return /\.(ico|svg)$/i.test(src) || /favicon/i.test(src) || /icon/i.test(src);
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
}

function truncate(text: string, max: number): string {
  if (text.length <= max) { return text; }
  return text.slice(0, max - 3).trim() + '...';
}

function capitalize(routePath: string): string {
  const parts = routePath.replace(/^\//, '').split(/[-_/]/);
  if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) {
    return 'Home';
  }
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}
