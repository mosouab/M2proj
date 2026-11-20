import { getLang, translate, type Lang } from '../i18n';
import type { BulkResult } from '../lib/tasks';

/** The "tout" button of a column: select all its cards, or unselect them if they were all selected. */
export function toggleAll(selected: Set<string>, ids: readonly string[]): void {
  const all = ids.length > 0 && ids.every((id) => selected.has(id));
  for (const id of ids) {
    if (all) selected.delete(id);
    else selected.add(id);
  }
}

/** Forget tasks that disappeared after a reload (deleted by someone else). */
export function pruneSelection(selected: Set<string>, existing: readonly string[]): void {
  const keep = new Set(existing);
  for (const id of [...selected]) if (!keep.has(id)) selected.delete(id);
}

export function bulkSummary(result: BulkResult, lang: Lang = getLang()): { text: string; kind: 'info' | 'error' } {
  const parts = [translate(lang, 'bulk.updated', { n: result.done })];
  if (result.skipped) parts.push(translate(lang, 'bulk.skipped', { n: result.skipped }));
  return { text: parts.join(' '), kind: result.skipped ? 'error' : 'info' };
}
