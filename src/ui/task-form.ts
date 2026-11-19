import { t } from '../i18n';
import { db } from '../lib/supabase';
import { createTask, deleteTask, updateTaskFields, type TaskFields } from '../lib/tasks';
import type { Task } from '../lib/types';
import { field, h } from './dom';
import { confirmModal, openModal } from './modal';
import { run } from './run';
import { memberName, state } from './store';
import type { ViewContext } from './view';

export function openTaskForm(task: Task | null, ctx: ViewContext): void {
  const title = h('input', { type: 'text', required: true, maxlength: 200, value: task?.title ?? '' });
  const description = h('textarea', { rows: 5, maxlength: 5000 }, task?.description ?? '');
  const deadline = h('input', { type: 'date', value: task?.deadline ?? '' });
  const error = h('p', { class: 'form-error', role: 'alert' });
  const save = h('button', { class: 'btn', type: 'submit' }, t('common.save'));
  const actions = h('div', { class: 'modal-actions' });

  if (task && state.role === 'admin') {
    actions.append(
      h(
        'button',
        {
          class: 'btn danger',
          type: 'button',
          onclick: async () => {
            if (!(await confirmModal(t('task.confirmDelete', { title: task.title }), t('common.delete')))) return;
            const r = await run(() => deleteTask(db, task.id));
            if (r.ok) {
              modal.close();
              await ctx.refresh();
            }
          },
        },
        t('common.delete'),
      ),
    );
  }
  actions.append(save);

  const info = task
    ? h(
        'p',
        { class: 'muted small' },
        t('task.createdBy', { name: memberName(task.created_by) }),
        task.taken_by ? ` · ${t('task.takenBy', { name: memberName(task.taken_by) })}` : null,
      )
    : null;

  const form = h(
    'form',
    {
      class: 'form',
      onsubmit: async (e: Event) => {
        e.preventDefault();
        const fields: TaskFields = {
          title: title.value.trim(),
          description: description.value.trim(),
          deadline: deadline.value || null,
        };
        if (!fields.title) {
          error.textContent = t('task.titleRequired');
          title.focus();
          return;
        }
        save.disabled = true;
        const r = await run(() =>
          task ? updateTaskFields(db, task.id, fields) : createTask(db, { ...fields, created_by: state.meId as string }),
        );
        save.disabled = false;
        if (r.ok) {
          modal.close();
          await ctx.refresh();
        }
      },
    },
    field(t('task.title'), title),
    field(t('task.description'), description),
    field(t('task.deadline'), deadline),
    info,
    error,
    actions,
  );

  const modal = openModal(task ? t('task.edit') : t('board.new'), form);
  title.focus();
}
