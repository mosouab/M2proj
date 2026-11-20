import { getLang, t } from '../i18n';
import { currentAdminMember, currentRole, rememberAdminMember, signIn, signOut } from '../lib/auth';
import { listCategories } from '../lib/categories';
import { LS_MEMBER } from '../lib/constants';
import { toAppError } from '../lib/errors';
import { listItems } from '../lib/items';
import { readLocal, writeLocal } from '../lib/local';
import { addMember, chooseMember, listMembers } from '../lib/members';
import { config, db } from '../lib/supabase';
import { listTasks } from '../lib/tasks';
import { renderAdmin } from './admin-view';
import { renderBoard } from './board-view';
import { h } from './dom';
import { renderFiles } from './files-view';
import { renderLogin, type LoginMode } from './login-view';
import { renderPicker } from './picker-view';
import { parseRoute } from './router';
import { run, setAuthLostHandler, setSessionCheck } from './run';
import { memberName, state } from './store';
import { toast } from './toast';
import { renderTopbar } from './topbar';
import type { ViewContext } from './view';

const root = document.getElementById('app') as HTMLElement;
/** Re-renders whatever screen is showing (used when the language changes). */
let screen: () => void = () => {};

async function loadAll(): Promise<void> {
  const [members, categories, tasks, items] = await Promise.all([listMembers(db), listCategories(db), listTasks(db), listItems(db)]);
  Object.assign(state, { members, categories, tasks, items });
}

const ctx: ViewContext = {
  async refresh() {
    const r = await run(loadAll);
    if (r.ok && screen === showApp) showApp();
  },
};

async function enter(): Promise<void> {
  await loadAll();
  const adminMember = state.role === 'admin' ? await currentAdminMember(db) : null;
  state.meId = chooseMember(state.role, adminMember, readLocal(LS_MEMBER), state.members);
  // First admin login since this feature: save the name this browser already knew, so other devices skip the picker.
  if (state.role === 'admin' && state.meId && state.meId !== adminMember) void run(() => rememberAdminMember(db, state.meId as string));
  if (state.meId) showApp();
  else showPicker();
}

function showLogin(mode: LoginMode = 'team', canCancel = false): void {
  screen = () => showLogin(mode, canCancel);
  renderLogin(root, {
    mode,
    onCancel: canCancel ? () => showApp() : undefined,
    async submit(m, password) {
      try {
        state.role = await signIn(db, m === 'admin' ? config.adminEmail : config.teamEmail, password);
        await enter();
        return 'ok';
      } catch (e) {
        const err = toAppError(e);
        if (err.code === 'bad-password') return 'wrong';
        toast(t(`error.${err.code}`), 'error');
        return 'error';
      }
    },
  });
}

function showPicker(): void {
  screen = showPicker;
  renderPicker(root, {
    members: state.members.filter((m) => m.active),
    canAdd: state.role === 'admin',
    onPick(id) {
      state.meId = id;
      writeLocal(LS_MEMBER, id);
      // The admin is always the same person: remember it on the account so no device asks again.
      if (state.role === 'admin') void run(() => rememberAdminMember(db, id));
      showApp();
    },
    async onAdd(name) {
      const r = await run(async () => {
        await addMember(db, name);
        state.members = await listMembers(db);
      });
      if (r.ok) showPicker();
    },
  });
}

function showApp(): void {
  screen = showApp;
  if (!state.role || !state.meId) return;
  const route = parseRoute(location.hash, state.role);
  const view = h('main', { class: 'wrap view' });
  root.replaceChildren(
    renderTopbar({
      route,
      role: state.role,
      meName: memberName(state.meId),
      onChangeName: showPicker,
      onAdminLogin: () => showLogin('admin', true),
      onLogout: () => void logout(),
    }),
    view,
  );
  if (route === 'board') renderBoard(view, ctx);
  else if (route === 'files') renderFiles(view, ctx);
  else renderAdmin(view, ctx);
}

function showRetry(): void {
  screen = showRetry;
  root.replaceChildren(
    h('div', { class: 'center' }, h('div', { class: 'login-card' }, h('p', {}, t('error.network')), h('button', { class: 'btn', type: 'button', onclick: () => void boot() }, t('common.retry')))),
  );
}

async function logout(): Promise<void> {
  // Clear the role first so the SIGNED_OUT event below is not mistaken for a lost session.
  state.role = null;
  await signOut(db).catch(() => undefined);
  history.replaceState(null, '', location.pathname);
  showLogin();
}

function authLost(): void {
  if (!state.role) return;
  state.role = null;
  toast(t('error.auth'), 'error');
  void signOut(db).catch(() => undefined);
  showLogin();
}

setAuthLostHandler(authLost);
setSessionCheck(async () => (await currentRole(db)) !== null);
// Supabase drops the session itself when the refresh token is revoked (password change, "sign out all sessions").
db.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') setTimeout(authLost, 0);
});

window.addEventListener('hashchange', () => {
  if (screen === showApp) showApp();
});
window.addEventListener('m2proj:lang', () => screen());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && screen === showApp) void ctx.refresh();
});

async function boot(): Promise<void> {
  document.documentElement.lang = getLang();
  state.role = await currentRole(db);
  if (!state.role) return showLogin();
  const r = await run(enter);
  if (!r.ok && state.role) showRetry();
}

void boot();
