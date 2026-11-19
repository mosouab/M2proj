import { t } from '../i18n';
import { field, h } from './dom';
import { langSwitch } from './topbar';

export type LoginMode = 'team' | 'admin';

export interface LoginProps {
  mode: LoginMode;
  /** Present when a team session already exists (admin login from the top bar). */
  onCancel?: () => void;
  submit(mode: LoginMode, password: string): Promise<'ok' | 'wrong' | 'error'>;
}

export function renderLogin(root: HTMLElement, props: LoginProps): void {
  const { mode } = props;
  const error = h('p', { class: 'form-error', role: 'alert' });
  const input = h('input', { type: 'password', autocomplete: 'current-password', required: true });
  const submitBtn = h('button', { class: 'btn', type: 'submit' }, t('login.submit'));
  const switchBtn = props.onCancel
    ? h('button', { class: 'link-btn', type: 'button', onclick: props.onCancel }, t('login.back'))
    : h(
        'button',
        { class: 'link-btn', type: 'button', onclick: () => renderLogin(root, { ...props, mode: mode === 'team' ? 'admin' : 'team' }) },
        mode === 'team' ? t('login.toAdmin') : t('login.toTeam'),
      );
  const form = h(
    'form',
    {
      class: 'login-card',
      onsubmit: async (e: Event) => {
        e.preventDefault();
        error.textContent = '';
        submitBtn.disabled = true;
        const result = await props.submit(mode, input.value);
        if (result === 'ok') return;
        submitBtn.disabled = false;
        if (result === 'wrong') {
          error.textContent = t('error.bad-password');
          input.select();
        }
      },
    },
    h('h1', { class: 'brand big' }, 'M2proj'),
    h('p', { class: 'label' }, mode === 'admin' ? t('login.admin') : t('login.team')),
    field(t('login.password'), input),
    error,
    h('div', { class: 'login-actions' }, submitBtn, switchBtn),
  );
  root.replaceChildren(h('div', { class: 'center' }, h('div', { class: 'corner' }, langSwitch()), form));
  input.focus();
}
