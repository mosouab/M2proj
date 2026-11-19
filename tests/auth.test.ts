import { describe, expect, it } from 'vitest';
import { roleOf } from '../src/lib/auth';

describe('roleOf', () => {
  it('reads the m2proj_role claim', () => {
    expect(roleOf({ app_metadata: { m2proj_role: 'team' } })).toBe('team');
    expect(roleOf({ app_metadata: { m2proj_role: 'admin' } })).toBe('admin');
  });
  it('gives no role to anything else', () => {
    expect(roleOf({ app_metadata: { m2proj_role: 'root' } })).toBeNull();
    expect(roleOf({ app_metadata: {} })).toBeNull();
    expect(roleOf(null)).toBeNull();
    expect(roleOf(undefined)).toBeNull();
  });
});
