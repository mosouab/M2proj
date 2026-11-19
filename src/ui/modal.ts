import { t } from '../i18n';
import { h } from './dom';

export interface ModalHandle {
  dialog: HTMLDialogElement;
  close(): void;
}

export function openModal(title: string, body: Node, onClose?: () => void): ModalHandle {
  const dialog: HTMLDialogElement = h(
    'dialog',
    { class: 'modal' },
    h(
      'div',
      { class: 'modal-head' },
      h('h2', {}, title),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('common.close'), onclick: () => dialog.close() }, '×'),
    ),
    body,
  );
  dialog.addEventListener('close', () => {
    dialog.remove();
    onClose?.();
  });
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, close: () => dialog.close() };
}

export function confirmModal(message: string, confirmLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    let answer = false;
    const body = h(
      'div',
      {},
      h('p', {}, message),
      h(
        'div',
        { class: 'modal-actions' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => modal.close() }, t('common.cancel')),
        h('button', { class: 'btn danger', type: 'button', onclick: () => { answer = true; modal.close(); } }, confirmLabel),
      ),
    );
    const modal = openModal(t('common.confirm'), body, () => resolve(answer));
  });
}
