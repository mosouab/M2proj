import Sortable from 'sortablejs';
import { formatDay, t } from '../i18n';
import { db } from '../lib/supabase';
import { assignTasks, deleteTasks, moveTask, moveTasks, type BulkResult } from '../lib/tasks';
import { groupByStatus, isLate, STATUSES, todayLocal } from '../lib/transitions';
import type { Status, Task } from '../lib/types';
import { h } from './dom';
import { confirmModal } from './modal';
import { run } from './run';
import { bulkSummary, pruneSelection, toggleAll } from './selection';
import { memberName, state } from './store';
import { openTaskForm } from './task-form';
import { toast } from './toast';
import type { ViewContext } from './view';

export const MARKERS: Record<Status, string> = { waiting: '[ ]', taken: '[~]', finished: '[x]' };

/** Browsers may fire a click right after a drop; ignore clicks this soon after a drag. */
let lastDragEnd = 0;
/** Selection mode for bulk actions; survives reloads of the board. */
let selecting = false;
const selected = new Set<string>();

export function renderBoard(root: HTMLElement, ctx: ViewContext): void {
  const today = todayLocal();
  const groups = groupByStatus(state.tasks);
  pruneSelection(selected, state.tasks.map((x) => x.id));
  const rerender = () => renderBoard(root, ctx);

  const head = h(
    'div',
    { class: 'view-head' },
    h('p', { class: 'label' }, t('board.label')),
    h(
      'div',
      { class: 'head-actions' },
      h(
        'button',
        {
          class: selecting ? 'btn' : 'btn ghost',
          type: 'button',
          'aria-pressed': String(selecting),
          onclick: () => {
            selecting = !selecting;
            selected.clear();
            rerender();
          },
        },
        selecting ? t('board.selectDone') : t('board.select'),
      ),
      h('button', { class: 'btn', type: 'button', onclick: () => openTaskForm(null, ctx) }, t('board.new')),
    ),
  );

  const columns = STATUSES.map((status) =>
    h(
      'section',
      { class: `column col-${status}` },
      h(
        'h2',
        { class: 'col-head' },
        h('span', { class: 'marker' }, MARKERS[status]),
        ` ${t(`status.${status}`)} `,
        h('span', { class: 'count' }, `(${groups[status].length})`),
        selecting && groups[status].length
          ? h(
              'button',
              {
                class: 'pick-all',
                type: 'button',
                onclick: () => {
                  toggleAll(selected, groups[status].map((x) => x.id));
                  rerender();
                },
              },
              t('board.selectAll'),
            )
          : null,
      ),
      h(
        'div',
        { class: 'card-list', 'data-status': status },
        groups[status].length
          ? groups[status].map((task) => renderCard(task, today, ctx, rerender))
          : h('p', { class: 'empty' }, t('board.empty')),
      ),
    ),
  );

  const board = h('div', { class: 'board' }, columns);
  if (selecting) root.replaceChildren(head, board, bulkBar(ctx, rerender));
  else root.replaceChildren(head, board);

  for (const list of root.querySelectorAll<HTMLElement>('.card-list')) {
    Sortable.create(list, {
      group: 'board',
      sort: false,
      disabled: selecting,
      draggable: '.card',
      filter: '.no-drag',
      preventOnFilter: false,
      delay: 150,
      delayOnTouchOnly: true,
      animation: 120,
      ghostClass: 'card-ghost',
      onEnd: (evt) => {
        lastDragEnd = Date.now();
        const id = evt.item.dataset.id;
        const to = evt.to.dataset.status as Status | undefined;
        if (!id || !to || evt.from === evt.to) return;
        void moveAndReport(id, to, ctx);
      },
    });
  }
}

function cardDetails(task: Task, late: boolean): (HTMLElement | null)[] {
  const owner = memberName(task.taken_by);
  return [
    task.deadline
      ? h(
          'div',
          { class: 'meta' },
          h('span', {}, t('board.due', { date: formatDay(task.deadline) })),
          late ? h('span', { class: 'late-tag' }, t('board.late')) : null,
        )
      : null,
    owner ? h('div', { class: 'owner' }, task.status === 'finished' ? t('board.doneBy', { name: owner }) : `~ ${owner}`) : null,
  ];
}

function renderCard(task: Task, today: string, ctx: ViewContext, rerender: () => void): HTMLElement {
  const late = isLate(task, today);

  if (selecting) {
    const isSelected = selected.has(task.id);
    const toggle = () => {
      if (isSelected) selected.delete(task.id);
      else selected.add(task.id);
      rerender();
    };
    return h(
      'article',
      {
        class: `card selectable${isSelected ? ' selected' : ''}${late ? ' late' : ''}`,
        'data-id': task.id,
        tabindex: 0,
        role: 'checkbox',
        'aria-checked': String(isSelected),
        onclick: toggle,
        onkeydown: (e: Event) => {
          const key = (e as KeyboardEvent).key;
          if (key === ' ' || key === 'Enter') {
            e.preventDefault();
            toggle();
          }
        },
      },
      h('h3', {}, h('span', { class: 'pick', 'aria-hidden': 'true' }, isSelected ? '[x]' : '[ ]'), ` ${task.title}`),
      cardDetails(task, late),
    );
  }

  const open = () => {
    if (Date.now() - lastDragEnd > 300) openTaskForm(task, ctx);
  };
  const move = h(
    'select',
    {
      class: 'move no-drag',
      'aria-label': t('board.moveTo'),
      onclick: (e: Event) => e.stopPropagation(),
      onkeydown: (e: Event) => e.stopPropagation(),
      onchange: (e: Event) => {
        const to = (e.target as HTMLSelectElement).value as Status;
        if (to !== task.status) void moveAndReport(task.id, to, ctx);
      },
    },
    STATUSES.map((s) => h('option', { value: s, selected: s === task.status }, `${MARKERS[s]} ${t(`status.${s}`)}`)),
  );
  return h(
    'article',
    {
      class: late ? 'card late' : 'card',
      'data-id': task.id,
      tabindex: 0,
      onclick: open,
      onkeydown: (e: Event) => {
        if ((e as KeyboardEvent).key === 'Enter') open();
      },
    },
    h('h3', {}, task.title),
    cardDetails(task, late),
    move,
  );
}

function bulkBar(ctx: ViewContext, rerender: () => void): HTMLElement {
  const picked = state.tasks.filter((x) => selected.has(x.id));
  const none = picked.length === 0;

  const moveSelect = h(
    'select',
    {
      'aria-label': t('board.moveTo'),
      disabled: none,
      onchange: (e: Event) => {
        const to = (e.target as HTMLSelectElement).value as Status;
        if (to) void runBulk(bar, () => moveTasks(db, picked, to, state.meId as string), ctx);
      },
    },
    h('option', { value: '', selected: true, disabled: true }, t('board.moveTo')),
    STATUSES.map((s) => h('option', { value: s }, `${MARKERS[s]} ${t(`status.${s}`)}`)),
  );

  const assignSelect = h(
    'select',
    {
      'aria-label': t('bulk.assignTo'),
      disabled: none,
      onchange: (e: Event) => {
        const memberId = (e.target as HTMLSelectElement).value;
        if (memberId) void runBulk(bar, () => assignTasks(db, picked, memberId), ctx);
      },
    },
    h('option', { value: '', selected: true, disabled: true }, t('bulk.assignTo')),
    state.members.filter((m) => m.active).map((m) => h('option', { value: m.id }, m.name)),
  );

  const remove =
    state.role === 'admin'
      ? h(
          'button',
          {
            class: 'btn danger small',
            type: 'button',
            disabled: none,
            onclick: async () => {
              if (!(await confirmModal(t('bulk.confirmDelete', { n: picked.length }), t('common.delete')))) return;
              setBusy(bar, true);
              const r = await run(() => deleteTasks(db, picked.map((x) => x.id)));
              if (r.ok) {
                toast(t('bulk.deleted', { n: r.value }));
                selected.clear();
              }
              await ctx.refresh();
            },
          },
          t('common.delete'),
        )
      : null;

  const bar: HTMLElement = h(
    'div',
    { class: 'bulk-bar', role: 'region', 'aria-label': t('bulk.count', { n: picked.length }) },
    h('span', { class: 'bulk-count' }, t('bulk.count', { n: picked.length })),
    moveSelect,
    assignSelect,
    remove,
    h(
      'button',
      {
        class: 'link-btn',
        type: 'button',
        onclick: () => {
          selecting = false;
          selected.clear();
          rerender();
        },
      },
      t('common.cancel'),
    ),
  );
  return bar;
}

function setBusy(bar: HTMLElement, busy: boolean): void {
  for (const el of bar.querySelectorAll<HTMLButtonElement | HTMLSelectElement>('button, select')) el.disabled = busy;
}

async function runBulk(bar: HTMLElement, fn: () => Promise<BulkResult>, ctx: ViewContext): Promise<void> {
  setBusy(bar, true);
  const r = await run(fn);
  if (r.ok) {
    const summary = bulkSummary(r.value);
    toast(summary.text, summary.kind);
    selected.clear();
  }
  await ctx.refresh();
}

async function moveAndReport(id: string, to: Status, ctx: ViewContext): Promise<void> {
  const task = state.tasks.find((x) => x.id === id);
  if (!task || !state.meId) return;
  const me = state.meId;
  const r = await run(() => moveTask(db, task, to, me));
  if (r.ok && !r.value.ok) {
    const current = r.value.current;
    if (!current) toast(t('board.gone'), 'error');
    else if (current.status === 'taken') toast(t('board.conflictTaken', { name: memberName(current.taken_by) }), 'error');
    else toast(t('board.conflictMoved', { status: t(`status.${current.status}`) }), 'error');
  }
  // Always reload: on success the card lands in place, on failure it snaps back.
  await ctx.refresh();
}
