import { getLang, setLang, t, type Key, type Lang } from '../i18n';
import type { Role } from '../lib/auth';
import { h } from './dom';
import type { Route } from './router';

export interface TopbarProps {
  route: Route;
  role: Role;
  meName: string;
  onChangeName(): void;
  onAdminLogin(): void;
  onLogout(): void;
}

const fn = (label: string) => [h('span', { class: 'fn' }, `.${label}`), h('span', { class: 'paren' }, '()')];

export function langSwitch(): HTMLElement {
  const current = getLang();
  const button = (lang: Lang) =>
    h(
      'button',
      { type: 'button', class: lang === current ? 'lang active' : 'lang', 'aria-pressed': String(lang === current), onclick: () => setLang(lang) },
      lang.toUpperCase(),
    );
  return h('span', { class: 'langs' }, button('fr'), h('span', { class: 'muted' }, '|'), button('en'));
}

export function renderTopbar(p: TopbarProps): HTMLElement {
  const tab = (route: Route, key: Key) =>
    h('a', { href: `#${route}`, class: p.route === route ? 'tab active' : 'tab', 'aria-current': p.route === route ? 'page' : null }, fn(t(key)));
  return h(
    'nav',
    { class: 'topbar' },
    h(
      'div',
      { class: 'wrap bar' },
      h('span', { class: 'brand' }, 'M2proj'),
      h('div', { class: 'tabs' }, tab('board', 'nav.board'), tab('files', 'nav.files'), p.role === 'admin' ? tab('admin', 'nav.admin') : null),
      h(
        'div',
        { class: 'tools' },
        h('span', { class: 'me' }, `~ ${p.meName} `, h('button', { class: 'link-btn', type: 'button', onclick: p.onChangeName }, `(${t('nav.change')})`)),
        langSwitch(),
        p.role === 'admin'
          ? h('span', { class: 'badge' }, t('nav.adminBadge'))
          : h('button', { class: 'link-btn', type: 'button', onclick: p.onAdminLogin }, fn(t('nav.admin'))),
        h('button', { class: 'link-btn', type: 'button', onclick: p.onLogout }, fn(t('nav.logout'))),
      ),
    ),
  );
}
