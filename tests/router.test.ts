import { describe, expect, it } from 'vitest';
import { parseRoute } from '../src/ui/router';

describe('parseRoute', () => {
  it('defaults to the board', () => {
    expect(parseRoute('', 'team')).toBe('board');
    expect(parseRoute('#nonsense', 'team')).toBe('board');
  });
  it('opens files for everyone', () => {
    expect(parseRoute('#files', 'team')).toBe('files');
  });
  it('opens admin only for the admin', () => {
    expect(parseRoute('#admin', 'admin')).toBe('admin');
    expect(parseRoute('#admin', 'team')).toBe('board');
  });
});
