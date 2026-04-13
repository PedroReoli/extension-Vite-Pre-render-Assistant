import * as vscode from 'vscode';
import { ptBR } from './pt-BR';
import { en } from './en';
import { es } from './es';

export type TranslationKey = keyof typeof ptBR;

const TRANSLATIONS: Record<string, Record<string, string>> = {
  'pt-br': ptBR,
  'pt': ptBR,
  'en': en,
  'en-us': en,
  'en-gb': en,
  'es': es,
  'es-es': es,
  'es-mx': es,
};

let currentLang = 'en';
let currentStrings: Record<string, string> = en;

/**
 * Detecta o idioma do VSCode e carrega as traduções correspondentes.
 * Deve ser chamado uma vez na ativação da extensão.
 */
export function initI18n(): void {
  const vscodeLang = vscode.env.language.toLowerCase();

  // Tentar match exato, depois prefixo
  if (TRANSLATIONS[vscodeLang]) {
    currentLang = vscodeLang;
    currentStrings = TRANSLATIONS[vscodeLang];
  } else {
    const prefix = vscodeLang.split('-')[0];
    if (TRANSLATIONS[prefix]) {
      currentLang = prefix;
      currentStrings = TRANSLATIONS[prefix];
    }
  }
}

/**
 * Retorna a string traduzida para a chave.
 * Aceita placeholders: t('key', { count: 5 }) substitui {count} por 5.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  let text = currentStrings[key] || en[key as keyof typeof en] || key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }

  return text;
}

export function getCurrentLang(): string {
  return currentLang;
}

/**
 * Traduz um warning de SEO vindo do script.
 * Formato: "seo.key" ou "seo.key:param" (ex: "seo.titleShort:5")
 */
export function translateWarning(warning: string): string {
  const [key, param] = warning.split(':');
  if (param !== undefined) {
    return t(key, { len: param });
  }
  return t(key);
}
