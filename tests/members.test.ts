import { describe, expect, it } from 'vitest';
import { chooseMember, pickValidMember } from '../src/lib/members';

const members = [
  { id: 'a', name: 'Léa', active: true },
  { id: 'b', name: 'Sami', active: false },
];

describe('pickValidMember', () => {
  it('keeps a remembered active member', () => {
    expect(pickValidMember('a', members)).toBe('a');
  });
  it('asks again when the member was hidden or removed', () => {
    expect(pickValidMember('b', members)).toBeNull();
    expect(pickValidMember('zzz', members)).toBeNull();
    expect(pickValidMember(null, members)).toBeNull();
  });
});

describe('chooseMember', () => {
  const team = [
    { id: 'mo', name: 'Mohamed', active: true },
    { id: 'lea', name: 'Léa', active: true },
  ];
  it('the admin is always the member saved on the admin account, even if this browser last picked someone else', () => {
    expect(chooseMember('admin', 'mo', 'lea', team)).toBe('mo');
  });
  it('the admin falls back to this browser’s pick when nothing is saved yet', () => {
    expect(chooseMember('admin', null, 'lea', team)).toBe('lea');
    expect(chooseMember('admin', 'gone', null, team)).toBeNull();
  });
  it('the team ignores the admin’s saved member', () => {
    expect(chooseMember('team', 'mo', 'lea', team)).toBe('lea');
    expect(chooseMember('team', 'mo', null, team)).toBeNull();
  });
});
