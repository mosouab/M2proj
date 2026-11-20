import { describe, expect, it } from 'vitest';
import { adminMemberOf, roleOf } from '../src/lib/auth';

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

describe('adminMemberOf', () => {
  it('reads the member saved on the admin account', () => {
    expect(adminMemberOf({ user_metadata: { m2proj_member: 'mo-id' } })).toBe('mo-id');
  });
  it('is null when nothing (or junk) was saved', () => {
    expect(adminMemberOf({ user_metadata: {} })).toBeNull();
    expect(adminMemberOf({ user_metadata: { m2proj_member: 42 } })).toBeNull();
    expect(adminMemberOf(null)).toBeNull();
  });
});
