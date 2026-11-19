import { describe, expect, it } from 'vitest';
import {
  fileNameFromPath,
  isFileSizeOk,
  MAX_FILE_BYTES,
  normalizeLink,
  sanitizeFileName,
  storagePathFor,
} from '../src/lib/validate';

const UUID = '0b6f3c1e-9a7d-4e2b-8c1f-2d3e4f5a6b7c';

describe('isFileSizeOk', () => {
  it('accepts exactly 50 MB and refuses one byte more', () => {
    expect(MAX_FILE_BYTES).toBe(52428800);
    expect(isFileSizeOk(MAX_FILE_BYTES)).toBe(true);
    expect(isFileSizeOk(MAX_FILE_BYTES + 1)).toBe(false);
  });
});

describe('normalizeLink', () => {
  it('keeps http and https links, trimmed', () => {
    expect(normalizeLink('  https://docs.google.com/x  ')).toBe('https://docs.google.com/x');
    expect(normalizeLink('http://example.org')).toBe('http://example.org/');
  });
  it('adds https:// to pasted links without a scheme', () => {
    expect(normalizeLink('docs.google.com/document/d/abc')).toBe('https://docs.google.com/document/d/abc');
  });
  it('refuses other schemes', () => {
    expect(normalizeLink('javascript:alert(1)')).toBeNull();
    expect(normalizeLink('ftp://example.org/file')).toBeNull();
    expect(normalizeLink('mailto:a@b.c')).toBeNull();
  });
  it('refuses things that are not links', () => {
    expect(normalizeLink('')).toBeNull();
    expect(normalizeLink('hello')).toBeNull();
    expect(normalizeLink('two words.com')).toBeNull();
  });
});

describe('sanitizeFileName', () => {
  it('turns French names into safe ASCII keys', () => {
    expect(sanitizeFileName('Compte rendu réunion.pdf')).toBe('Compte-rendu-reunion.pdf');
    expect(sanitizeFileName('été 2026 (v2).docx')).toBe('ete-2026-v2.docx');
  });
  it('keeps only the last dot as the extension', () => {
    expect(sanitizeFileName('rapport.v2.final.pdf')).toBe('rapport-v2-final.pdf');
  });
  it('falls back to "file" when nothing usable is left', () => {
    expect(sanitizeFileName('日本語.txt')).toBe('file.txt');
    expect(sanitizeFileName('???')).toBe('file');
  });
  it('caps very long names but keeps the extension', () => {
    const out = sanitizeFileName(`${'a'.repeat(300)}.pdf`);
    expect(out.endsWith('.pdf')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(101);
  });
});

describe('storage paths', () => {
  it('prefixes the uuid and round-trips the readable name', () => {
    const path = storagePathFor('Compte rendu réunion.pdf', UUID);
    expect(path).toBe(`${UUID}-Compte-rendu-reunion.pdf`);
    expect(fileNameFromPath(path)).toBe('Compte-rendu-reunion.pdf');
  });
  it('leaves paths without a uuid prefix untouched', () => {
    expect(fileNameFromPath('plain.txt')).toBe('plain.txt');
  });
});
