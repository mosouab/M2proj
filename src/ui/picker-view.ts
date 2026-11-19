import { t } from '../i18n';
import type { Member } from '../lib/types';
import { h } from './dom';
import { langSwitch } from './topbar';

export interface PickerProps {
  members: Member[];
  /** Admin only: lets the first admin add names on an empty project. */
  canAdd: boolean;
  onPick(id: string): void;
  onAdd(name: string): Promise<void>;
}

export function renderPicker(root: HTMLElement, p: PickerProps): void {
  const list = p.members.length
    ? h('div', { class: 'picker' }, p.members.map((m) => h('button', { class: 'btn ghost', type: 'button', onclick: () => p.onPick(m.id) }, m.name)))
    : h('p', { class: 'muted picker-empty' }, t('picker.empty'));
  const input = h('input', { type: 'text', maxlength: 60, placeholder: t('picker.namePlaceholder'), 'aria-label': t('admin.memberName') });
  const addForm = p.canAdd
    ? h(
        'form',
        {
          class: 'inline-form',
          onsubmit: async (e: Event) => {
            e.preventDefault();
            const name = input.value.trim();
            if (name) await p.onAdd(name);
          },
        },
        input,
        h('button', { class: 'btn', type: 'submit' }, t('common.add')),
      )
    : null;
  root.replaceChildren(
    h(
      'div',
      { class: 'center' },
      h('div', { class: 'corner' }, langSwitch()),
      h('div', { class: 'login-card' }, h('h1', { class: 'brand big' }, 'M2proj'), h('p', { class: 'label' }, t('picker.title')), list, addForm),
    ),
  );
}
