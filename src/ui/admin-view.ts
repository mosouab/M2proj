import { t } from '../i18n';
import { addCategory, deleteCategory, renameCategory, swapCategoryPositions } from '../lib/categories';
import { addMember, renameMember, setMemberActive } from '../lib/members';
import { db } from '../lib/supabase';
import type { Category } from '../lib/types';
import { h } from './dom';
import { confirmModal } from './modal';
import { run } from './run';
import { state } from './store';
import type { ViewContext } from './view';

export function renderAdmin(root: HTMLElement, ctx: ViewContext): void {
  root.replaceChildren(h('p', { class: 'label' }, t('admin.label')), h('div', { class: 'admin-grid' }, membersPanel(ctx), categoriesPanel(ctx)));
}

async function act(ctx: ViewContext, fn: () => Promise<unknown>): Promise<void> {
  const r = await run(fn);
  if (r.ok) await ctx.refresh();
}

function addForm(placeholder: string, onAdd: (name: string) => Promise<void>): HTMLFormElement {
  const input = h('input', { type: 'text', maxlength: 60, placeholder, 'aria-label': placeholder });
  return h(
    'form',
    {
      class: 'inline-form',
      onsubmit: async (e: Event) => {
        e.preventDefault();
        const name = input.value.trim();
        if (name) await onAdd(name);
      },
    },
    input,
    h('button', { class: 'btn', type: 'submit' }, t('common.add')),
  );
}

function membersPanel(ctx: ViewContext): HTMLElement {
  const rows = state.members.map((m) => {
    const name = h('input', { type: 'text', value: m.name, maxlength: 60, 'aria-label': t('admin.memberName') });
    return h(
      'li',
      { class: m.active ? 'admin-row' : 'admin-row inactive' },
      name,
      h(
        'button',
        {
          class: 'btn ghost small',
          type: 'button',
          onclick: () => {
            const next = name.value.trim();
            if (next && next !== m.name) void act(ctx, () => renameMember(db, m.id, next));
          },
        },
        t('common.save'),
      ),
      h(
        'button',
        { class: 'btn ghost small', type: 'button', onclick: () => void act(ctx, () => setMemberActive(db, m.id, !m.active)) },
        m.active ? t('admin.deactivate') : t('admin.reactivate'),
      ),
    );
  });
  return h(
    'section',
    { class: 'panel' },
    h('h2', {}, t('admin.members')),
    h('ul', { class: 'admin-list' }, rows),
    addForm(t('admin.memberName'), (name) => act(ctx, () => addMember(db, name))),
  );
}

function categoriesPanel(ctx: ViewContext): HTMLElement {
  const cats: Category[] = state.categories;
  const rows = cats.map((c, i) => {
    const name = h('input', { type: 'text', value: c.name, maxlength: 60, 'aria-label': t('admin.categoryName') });
    return h(
      'li',
      { class: 'admin-row' },
      name,
      h(
        'button',
        {
          class: 'btn ghost small',
          type: 'button',
          onclick: () => {
            const next = name.value.trim();
            if (next && next !== c.name) void act(ctx, () => renameCategory(db, c.id, next));
          },
        },
        t('common.save'),
      ),
      h(
        'button',
        { class: 'btn ghost small', type: 'button', disabled: i === 0, 'aria-label': t('admin.moveUp'), onclick: () => void act(ctx, () => swapCategoryPositions(db, cats[i - 1], c)) },
        '↑',
      ),
      h(
        'button',
        { class: 'btn ghost small', type: 'button', disabled: i === cats.length - 1, 'aria-label': t('admin.moveDown'), onclick: () => void act(ctx, () => swapCategoryPositions(db, c, cats[i + 1])) },
        '↓',
      ),
      h(
        'button',
        {
          class: 'btn danger small',
          type: 'button',
          onclick: async () => {
            if (await confirmModal(t('admin.confirmDeleteCategory', { name: c.name }), t('common.delete'))) {
              await act(ctx, () => deleteCategory(db, c.id));
            }
          },
        },
        t('common.delete'),
      ),
    );
  });
  return h(
    'section',
    { class: 'panel' },
    h('h2', {}, t('admin.categories')),
    h('ul', { class: 'admin-list' }, rows),
    addForm(t('admin.categoryName'), (name) => act(ctx, () => addCategory(db, name, cats))),
  );
}
