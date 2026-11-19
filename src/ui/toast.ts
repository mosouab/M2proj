import { h } from './dom';

export function toast(message: string, kind: 'info' | 'error' = 'info'): void {
  const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
  const host: HTMLElement = dialogs.length ? dialogs[dialogs.length - 1] : document.body;
  let region = Array.from(host.children).find((c): c is HTMLElement => c.classList.contains('toasts'));
  if (!region) {
    region = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    host.append(region);
  }
  const el = h('div', { class: `toast ${kind}` }, message);
  region.append(el);
  setTimeout(() => el.remove(), kind === 'error' ? 6000 : 3500);
}
