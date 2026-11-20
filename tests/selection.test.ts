import { describe, expect, it } from 'vitest';
import { bulkSummary, pruneSelection, toggleAll } from '../src/ui/selection';

describe('toggleAll (the "tout" button of a column)', () => {
  it('selects every card of the column when some are not selected yet', () => {
    const s = new Set(['a']);
    toggleAll(s, ['a', 'b', 'c']);
    expect([...s].sort()).toEqual(['a', 'b', 'c']);
  });
  it('unselects them when they were all selected, keeping other columns', () => {
    const s = new Set(['a', 'b', 'x']);
    toggleAll(s, ['a', 'b']);
    expect([...s]).toEqual(['x']);
  });
  it('does nothing for an empty column', () => {
    const s = new Set(['x']);
    toggleAll(s, []);
    expect([...s]).toEqual(['x']);
  });
});

describe('pruneSelection', () => {
  it('forgets tasks that no longer exist (deleted by someone else)', () => {
    const s = new Set(['a', 'gone']);
    pruneSelection(s, ['a', 'b']);
    expect([...s]).toEqual(['a']);
  });
});

describe('bulkSummary', () => {
  it('says how many changed', () => {
    expect(bulkSummary({ done: 3, skipped: 0 }, 'fr')).toEqual({ text: '3 modifiée(s).', kind: 'info' });
  });
  it('flags the skipped ones as an error toast', () => {
    expect(bulkSummary({ done: 2, skipped: 1 }, 'en')).toEqual({
      text: '2 updated. 1 skipped: someone changed them in the meantime.',
      kind: 'error',
    });
  });
});
