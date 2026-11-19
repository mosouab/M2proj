import { h } from './dom';
import type { ViewContext } from './view';

export function renderAdmin(root: HTMLElement, _ctx: ViewContext): void {
  root.replaceChildren(h('p', { class: 'label' }, 'admin'));
}
