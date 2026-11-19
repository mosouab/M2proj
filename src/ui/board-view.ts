import Sortable from 'sortablejs';
import { formatDay, t } from '../i18n';
import { db } from '../lib/supabase';
import { moveTask } from '../lib/tasks';
import { groupByStatus, isLate, STATUSES, todayLocal } from '../lib/transitions';
import type { Status, Task } from '../lib/types';
import { h } from './dom';
import { run } from './run';
import { memberName, state } from './store';
import { openTaskForm } from './task-form';
import { toast } from './toast';
import type { ViewContext } from './view';

export const MARKERS: Record<Status, string> = { waiting: '[ ]', taken: '[~]', finished: '[x]' };

/** Browsers may fire a click right after a drop; ignore clicks this soon after a drag. */
let lastDragEnd = 0;

export function renderBoard(root: HTMLElement, ctx: ViewContext): void {
  const today = todayLocal();
  const groups = groupByStatus(state.tasks);

  const head = h(
    'div',
    { class: 'view-head' },
    h('p', { class: 'label' }, t('board.label')),
    h('button', { class: 'btn', type: 'button', onclick: () => openTaskForm(null, ctx) }, t('board.new')),
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
      ),
      h(
        'div',
        { class: 'card-list', 'data-status': status },
        groups[status].length ? groups[status].map((task) => renderCard(task, today, ctx)) : h('p', { class: 'empty' }, t('board.empty')),
      ),
    ),
  );

  root.replaceChildren(head, h('div', { class: 'board' }, columns));

  for (const list of root.querySelectorAll<HTMLElement>('.card-list')) {
    Sortable.create(list, {
      group: 'board',
      sort: false,
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

function renderCard(task: Task, today: string, ctx: ViewContext): HTMLElement {
  const late = isLate(task, today);
  const owner = memberName(task.taken_by);
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
    task.deadline
      ? h(
          'div',
          { class: 'meta' },
          h('span', {}, t('board.due', { date: formatDay(task.deadline) })),
          late ? h('span', { class: 'late-tag' }, t('board.late')) : null,
        )
      : null,
    owner ? h('div', { class: 'owner' }, task.status === 'finished' ? t('board.doneBy', { name: owner }) : `~ ${owner}`) : null,
    move,
  );
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
