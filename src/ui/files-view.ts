import { formatSize, formatTimestamp, t } from '../i18n';
import { deleteItem, fileUrl } from '../lib/items';
import { db } from '../lib/supabase';
import type { Item } from '../lib/types';
import { h } from './dom';
import { openItemForm } from './item-form';
import { confirmModal } from './modal';
import { run } from './run';
import { memberName, state } from './store';
import type { ViewContext } from './view';

export function renderFiles(root: HTMLElement, ctx: ViewContext): void {
  const head = h(
    'div',
    { class: 'view-head' },
    h('p', { class: 'label' }, t('files.label')),
    h('button', { class: 'btn', type: 'button', disabled: state.categories.length === 0, onclick: () => openItemForm(ctx) }, t('files.add')),
  );
  if (state.categories.length === 0) {
    root.replaceChildren(head, h('p', { class: 'empty' }, t('files.noCategories')));
    return;
  }
  const groups = state.categories.map((category) => {
    const items = state.items.filter((i) => i.category_id === category.id);
    return h(
      'section',
      { class: 'file-group' },
      h('h2', { class: 'group-head' }, category.name, h('span', { class: 'count' }, ` (${items.length})`)),
      items.length
        ? h('ul', { class: 'file-list' }, items.map((item) => renderItem(item, ctx)))
        : h('p', { class: 'empty' }, t('files.emptyCategory')),
    );
  });
  root.replaceChildren(head, ...groups);
}

function renderItem(item: Item, ctx: ViewContext): HTMLElement {
  const meta = [
    memberName(item.added_by),
    formatTimestamp(item.created_at),
    item.kind === 'file' && item.size_bytes !== null ? formatSize(item.size_bytes) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const open =
    item.kind === 'link'
      ? h('a', { class: 'btn ghost small', href: item.url ?? '#', target: '_blank', rel: 'noopener noreferrer' }, t('files.open'))
      : h(
          'button',
          {
            class: 'btn ghost small',
            type: 'button',
            onclick: async () => {
              // Navigate instead of window.open: popup blockers stop window.open after an await.
              const r = await run(() => fileUrl(db, item));
              if (r.ok) window.location.assign(r.value);
            },
          },
          t('files.download'),
        );

  const remove =
    state.role === 'admin'
      ? h(
          'button',
          {
            class: 'btn danger small',
            type: 'button',
            onclick: async () => {
              if (!(await confirmModal(t('files.confirmDelete', { title: item.title }), t('common.delete')))) return;
              const r = await run(() => deleteItem(db, item));
              if (r.ok) await ctx.refresh();
            },
          },
          t('common.delete'),
        )
      : null;

  return h(
    'li',
    { class: 'file-row' },
    h('span', { class: 'kind' }, item.kind === 'file' ? '[f]' : '[↗]'),
    h('div', { class: 'file-main' }, h('span', { class: 'file-title' }, item.title), h('span', { class: 'muted small' }, meta)),
    h('div', { class: 'file-actions' }, open, remove),
  );
}
