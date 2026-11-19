import { describe, expect, it } from 'vitest';
import { AppError, requireRows, toAppError } from '../src/lib/errors';

describe('toAppError', () => {
  it('passes AppError through', () => {
    const e = new AppError('too-big');
    expect(toAppError(e)).toBe(e);
  });
  it.each([
    [{ message: 'TypeError: Failed to fetch' }, 'network'],
    [{ message: 'NetworkError when attempting to fetch resource.' }, 'network'],
    [{ message: 'Load failed' }, 'network'],
    [{ status: 429, message: 'Request rate limit reached' }, 'rate-limited'],
    [{ code: 'PGRST301', message: 'JWT expired' }, 'auth'],
    [{ code: 'PGRST303', message: 'JWT expired' }, 'auth'],
    [{ status: 401, message: 'Unauthorized' }, 'auth'],
    [{ code: '42501', message: 'permission denied for table tasks' }, 'not-allowed'],
    [{ status: 400, message: 'new row violates row-level security policy' }, 'not-allowed'],
    [{ message: 'something else' }, 'unknown'],
    [null, 'unknown'],
  ])('%j → %s', (input, code) => {
    expect(toAppError(input).code).toBe(code);
  });
});

describe('requireRows', () => {
  it('returns rows when there are some', () => {
    expect(requireRows([{ id: 'a' }])).toEqual([{ id: 'a' }]);
  });
  it('treats zero affected rows as not allowed (RLS silently filters updates and deletes)', () => {
    expect(() => requireRows([])).toThrowError(AppError);
    expect(() => requireRows(null)).toThrowError(AppError);
  });
});
