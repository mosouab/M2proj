import { describe, expect, it } from 'vitest';
import { pickValidMember } from '../src/lib/members';

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
