// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/supabase', () => ({ db: {}, config: { teamEmail: '', adminEmail: '' } }));

import type { Task } from '../src/lib/types';
import { renderBoard } from '../src/ui/board-view';
import { state } from '../src/ui/store';

const task = (id: string, status: Task['status'], taken_by: string | null = null): Task => ({
  id,
  title: `Tâche ${id}`,
  description: '',
  deadline: null,
  status,
  taken_by,
  created_by: 'mo',
  created_at: `2026-11-0${id.length}T00:00:00+00:00`,
  updated_at: '2026-11-01T00:00:00+00:00',
  finished_at: status === 'finished' ? '2026-11-02T00:00:00+00:00' : null,
});

const ctx = { refresh: async () => {} };
let root: HTMLElement;
const click = (el: Element | null | undefined) => (el as HTMLElement).click();
const button = (label: RegExp) => [...root.querySelectorAll('button')].find((b) => label.test(b.textContent ?? ''));

beforeEach(() => {
  Object.assign(state, {
    role: 'admin',
    meId: 'mo',
    members: [
      { id: 'mo', name: 'Mohamed', active: true },
      { id: 'lea', name: 'Léa', active: true },
    ],
    tasks: [task('a', 'waiting'), task('bb', 'waiting'), task('ccc', 'taken', 'lea')],
  });
  root = document.createElement('div');
  document.body.replaceChildren(root);
  renderBoard(root, ctx);
  if (root.querySelector('.bulk-bar')) click(button(/Terminer|Done/)); // leave selection mode from a previous test
});

describe('board selection mode', () => {
  it('turns cards into checkboxes and shows the bulk bar with nothing selected', () => {
    click(button(/Sélectionner|Select/));
    expect(root.querySelectorAll('.card[role=checkbox]')).toHaveLength(3);
    expect(root.querySelector('.card .move')).toBeNull();
    const bar = root.querySelector('.bulk-bar') as HTMLElement;
    expect(bar.textContent).toMatch(/^0 /);
    expect([...bar.querySelectorAll('select')].every((s) => s.disabled)).toBe(true);
  });

  it('selects a card on click and enables the actions', () => {
    click(button(/Sélectionner|Select/));
    click(root.querySelector('.card[data-id=a]'));
    expect(root.querySelector('.card[data-id=a]')?.getAttribute('aria-checked')).toBe('true');
    const bar = root.querySelector('.bulk-bar') as HTMLElement;
    expect(bar.textContent).toMatch(/^1 /);
    expect([...bar.querySelectorAll('select')].some((s) => s.disabled)).toBe(false);
  });

  it('"tout" selects the whole column only', () => {
    click(button(/Sélectionner|Select/));
    click(root.querySelector('.col-waiting .pick-all'));
    expect([...root.querySelectorAll('.card[aria-checked=true]')].map((c) => (c as HTMLElement).dataset.id).sort()).toEqual(['a', 'bb']);
  });

  it('offers active teammates in "assign to" and delete only to the admin', () => {
    click(button(/Sélectionner|Select/));
    const assign = root.querySelectorAll('.bulk-bar select')[1];
    expect([...assign.querySelectorAll('option')].map((o) => o.textContent)).toContain('Léa');
    expect(root.querySelector('.bulk-bar .btn.danger')).not.toBeNull();
    state.role = 'team';
    click(button(/Terminer|Done/));
    click(button(/Sélectionner|Select/));
    expect(root.querySelector('.bulk-bar .btn.danger')).toBeNull();
  });

  it('cancel leaves selection mode', () => {
    click(button(/Sélectionner|Select/));
    click(root.querySelector('.bulk-bar .link-btn'));
    expect(root.querySelector('.bulk-bar')).toBeNull();
    expect(root.querySelector('.card .move')).not.toBeNull();
  });
});
