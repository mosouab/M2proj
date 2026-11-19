import { LS_LANG } from '../lib/constants';
import { readLocal, writeLocal } from '../lib/local';
import { en } from './en';
import { fr } from './fr';

export type Lang = 'fr' | 'en';
export type Key = keyof typeof en;
type Vars = Record<string, string | number>;

const dicts: Record<Lang, Record<Key, string>> = { fr, en };

export function detectLang(stored: string | null, browser: string | undefined): Lang {
  if (stored === 'fr' || stored === 'en') return stored;
  return browser?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

let current: Lang | null = null;

export function getLang(): Lang {
  if (!current) {
    current = detectLang(readLocal(LS_LANG), typeof navigator === 'undefined' ? undefined : navigator.language);
  }
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  writeLocal(LS_LANG, lang);
  document.documentElement.lang = lang;
  window.dispatchEvent(new Event('m2proj:lang'));
}

export function interpolate(template: string, vars: Vars = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export function translate(lang: Lang, key: Key, vars?: Vars): string {
  return interpolate(dicts[lang][key] ?? en[key] ?? key, vars);
}

export function t(key: Key, vars?: Vars): string {
  return translate(getLang(), key, vars);
}

/** 'YYYY-MM-DD' → "24 nov." / "Nov 24". Built from local parts so the day never shifts. */
export function formatDay(ymd: string, lang: Lang = getLang()): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const showYear = y !== new Date().getFullYear();
  return new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'short',
    year: showYear ? 'numeric' : undefined,
  }).format(new Date(y, m - 1, d));
}

export function formatTimestamp(iso: string, lang: Lang = getLang()): string {
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export function formatSize(bytes: number, lang: Lang = getLang()): string {
  const units = ['byte', 'kilobyte', 'megabyte'] as const;
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return new Intl.NumberFormat(lang, {
    style: 'unit',
    unit: units[i],
    unitDisplay: 'short',
    maximumFractionDigits: i === 0 ? 0 : 1,
  }).format(value);
}
