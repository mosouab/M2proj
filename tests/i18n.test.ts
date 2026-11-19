import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { fr } from '../src/i18n/fr';
import { detectLang, formatDay, formatSize, interpolate, translate, type Key } from '../src/i18n';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries', () => {
  it('fr and en have exactly the same keys', () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });
  it('no translation is empty', () => {
    for (const [key, value] of [...Object.entries(en), ...Object.entries(fr)]) {
      expect(value.trim(), key).not.toBe('');
    }
  });
  it('both languages use the same {placeholders}', () => {
    for (const key of Object.keys(en) as Key[]) {
      expect(placeholders(fr[key]), key).toEqual(placeholders(en[key]));
    }
  });
});

describe('detectLang', () => {
  it('uses a stored choice first', () => {
    expect(detectLang('en', 'fr-FR')).toBe('en');
    expect(detectLang('fr', 'en-US')).toBe('fr');
  });
  it('falls back to the browser language', () => {
    expect(detectLang(null, 'fr-FR')).toBe('fr');
    expect(detectLang(null, 'en-GB')).toBe('en');
    expect(detectLang('garbage', 'fr')).toBe('fr');
    expect(detectLang(null, undefined)).toBe('en');
  });
});

describe('interpolate / translate', () => {
  it('fills placeholders and leaves unknown ones visible', () => {
    expect(interpolate('Hi {name}, {x}', { name: 'Léa' })).toBe('Hi Léa, {x}');
  });
  it('translates with variables', () => {
    expect(translate('fr', 'board.conflictTaken', { name: 'Sami' })).toBe('Déjà pris par Sami.');
    expect(translate('en', 'board.conflictTaken', { name: 'Sami' })).toBe('Already taken by Sami.');
  });
});

describe('formatDay', () => {
  it('shows the picked day', () => {
    expect(formatDay('2026-11-24', 'en')).toMatch(/Nov/);
    expect(formatDay('2026-11-24', 'en')).toMatch(/24/);
    expect(formatDay('2026-11-24', 'fr')).toMatch(/24 nov/);
  });
  it('never shifts a deadline to the previous day, whatever the timezone', () => {
    const original = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      expect(formatDay('2026-11-24', 'en')).toMatch(/24/);
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});

describe('formatSize', () => {
  it('uses the right units and decimal separator', () => {
    expect(formatSize(1536, 'en')).toMatch(/^1\.5\s?kB$/u);
    expect(formatSize(1536, 'fr')).toMatch(/^1,5\s?ko$/u);
    expect(formatSize(50 * 1024 * 1024, 'en')).toMatch(/^50\s?MB$/u);
  });
});
