// Integration check against the real Supabase project.
// Run: npm run check:permissions   (needs .env with the PUBLIC_* values + M2_TEAM_PASSWORD + M2_ADMIN_PASSWORD)
// Creates and removes its own "zz-check" data. Never run in CI.
import { createClient } from '@supabase/supabase-js';
import { adminMemberOf, rememberAdminMember, signIn, signOut } from '../src/lib/auth';
import { addCategory, deleteCategory, listCategories } from '../src/lib/categories';
import { BUCKET } from '../src/lib/constants';
import { toAppError, type ErrorCode } from '../src/lib/errors';
import { addFile, addLink, deleteItem, fileUrl, listItems } from '../src/lib/items';
import { addMember, listMembers, renameMember, setMemberActive } from '../src/lib/members';
import { assignTasks, createTask, deleteTask, deleteTasks, listTasks, moveTask, moveTasks } from '../src/lib/tasks';

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} in .env`);
    process.exit(2);
  }
  return value;
}

const URL_ = env('PUBLIC_SUPABASE_URL');
const KEY = env('PUBLIC_SUPABASE_ANON_KEY');
const TEAM_EMAIL = env('PUBLIC_TEAM_EMAIL');
const ADMIN_EMAIL = env('PUBLIC_ADMIN_EMAIL');
const client = () => createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

let failures = 0;
function check(name: string, ok: boolean): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failures++;
}
async function fails(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}
async function failsWith(fn: () => Promise<unknown>, code: ErrorCode): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (e) {
    return toAppError(e).code === code;
  }
}

async function main(): Promise<void> {
  const anon = client();
  const team = client();
  const team2 = client();
  const admin = client();

  // Sign in
  check('team signs in with role team', (await signIn(team, TEAM_EMAIL, env('M2_TEAM_PASSWORD'))) === 'team');
  await signIn(team2, TEAM_EMAIL, env('M2_TEAM_PASSWORD'));
  check('admin signs in with role admin', (await signIn(admin, ADMIN_EMAIL, env('M2_ADMIN_PASSWORD'))) === 'admin');
  check('wrong password is reported as bad-password', await failsWith(() => signIn(client(), TEAM_EMAIL, 'definitely-wrong'), 'bad-password'));

  // Admin fixtures
  const checker = (await listMembers(admin)).find((m) => m.name === 'zz-check') ?? (await addMember(admin, 'zz-check'));
  await setMemberActive(admin, checker.id, true);
  const category = await addCategory(admin, 'zz-check', await listCategories(admin));

  // Team vs members / categories
  check('team can list members', (await listMembers(team)).some((m) => m.id === checker.id));
  check('team cannot add members', await fails(() => addMember(team, 'zz-intruder')));
  check('team cannot rename members', await fails(() => renameMember(team, checker.id, 'hacked')));
  check('team cannot add categories', await fails(() => addCategory(team, 'zz-intruder', [])));

  // Tasks
  const task = await createTask(team, { title: 'zz-check task', description: '', deadline: null, created_by: checker.id });
  check('team can create a task', task.status === 'waiting');
  check('blank titles are rejected by the database', await fails(() => createTask(team, { title: '   ', description: '', deadline: null, created_by: checker.id })));
  check('team can take a task', (await moveTask(team, task, 'taken', checker.id)).ok);
  const race = await moveTask(team2, task /* stale copy, still "waiting" */, 'taken', checker.id);
  check('a second take of the same task is refused and reports the owner', !race.ok && race.current?.status === 'taken');

  // Items
  const link = await addLink(team, { category_id: category.id, title: 'zz link', url: 'example.org/page', added_by: checker.id });
  check('a link pasted without https:// is stored with it', link.url === 'https://example.org/page');
  const { error: jsError } = await team
    .from('items')
    .insert({ category_id: category.id, kind: 'link', title: 'x', url: 'javascript:alert(1)', added_by: checker.id });
  check('the database rejects javascript: links', jsError !== null);
  const content = `bonjour M2proj ${Date.now()}`;
  const file = await addFile(team, {
    category_id: category.id,
    title: 'Compte rendu réunion.txt',
    file: new Blob([content], { type: 'text/plain' }),
    fileName: 'Compte rendu réunion.txt',
    added_by: checker.id,
  });
  check('a French file name uploads', file.storage_path?.endsWith('-Compte-rendu-reunion.txt') ?? false);
  const download = await fetch(await fileUrl(team, file));
  check('the signed link downloads the same content', (await download.text()) === content);

  // A category deleted while someone has the page open: clear error, no invisible orphan file
  const ghost = crypto.randomUUID();
  check('a link into a deleted category gets a clear error', await failsWith(() => addLink(team, { category_id: ghost, title: 'x', url: 'example.org', added_by: checker.id }), 'category-gone'));
  const countObjects = async () => ((await admin.storage.from(BUCKET).list('', { limit: 1000 })).data ?? []).length;
  const objectsBefore = await countObjects();
  check('a file into a deleted category gets a clear error', await failsWith(() => addFile(team, { category_id: ghost, title: 'x.txt', file: new Blob(['x']), fileName: 'x.txt', added_by: checker.id }), 'category-gone'));
  check('…and leaves no invisible file behind', (await countObjects()) === objectsBefore);

  // Anonymous visitors see nothing (data exists now, so empty means blocked)
  for (const table of ['members', 'categories', 'tasks', 'items']) {
    const { data, error } = await anon.from(table).select('id').limit(1);
    check(`anon cannot read ${table}`, error !== null || (data ?? []).length === 0);
  }
  const { data: anonList } = await anon.storage.from(BUCKET).list();
  check('anon cannot list files', (anonList ?? []).length === 0);
  const { data: anonSigned } = await anon.storage.from(BUCKET).createSignedUrl(file.storage_path as string, 60);
  check('anon cannot create download links', !anonSigned?.signedUrl);
  check('anon can call ping() for the keep-alive', (await anon.rpc('ping')).error === null);

  // Team cannot delete
  check('team cannot delete a task', await failsWith(() => deleteTask(team, task.id), 'not-allowed'));
  check('…and the task is still there', (await listTasks(admin)).some((t) => t.id === task.id));
  check('team cannot delete an item', await failsWith(() => deleteItem(team, link), 'not-allowed'));
  await team.storage.from(BUCKET).remove([file.storage_path as string]);
  const { data: afterTeamRemove } = await admin.storage.from(BUCKET).list('', { search: file.storage_path as string });
  check('team cannot delete a stored file', (afterTeamRemove ?? []).length === 1);

  // Logging out one browser must not log out the others (shared account).
  // Access tokens stay valid for up to an hour either way; a *global* sign-out would revoke the refresh token.
  await signOut(team2);
  const { error: refreshError } = await team.auth.refreshSession();
  check('other devices stay logged in after one logs out', refreshError === null);

  // The admin account remembers which member it is (so the admin never sees "Who are you?")
  const savedBefore = adminMemberOf((await admin.auth.getUser()).data.user);
  await rememberAdminMember(admin, checker.id);
  const admin2 = client();
  await signIn(admin2, ADMIN_EMAIL, env('M2_ADMIN_PASSWORD'));
  check('the admin account remembers its member across logins', adminMemberOf((await admin2.auth.getUser()).data.user) === checker.id);
  if (savedBefore) await rememberAdminMember(admin, savedBefore);
  else await admin.auth.updateUser({ data: { m2proj_member: null } });

  // Bulk: several tasks at once, skipping the ones someone else changed in the meantime
  const newTask = (title: string) => createTask(team, { title, description: '', deadline: null, created_by: checker.id });
  const [b1, b2, b3] = [await newTask('zz-bulk 1'), await newTask('zz-bulk 2'), await newTask('zz-bulk 3')];
  const bulkIds = [b1.id, b2.id, b3.id];
  await moveTask(admin, b3, 'taken', checker.id); // someone takes b3 while this client still sees it waiting
  const moved = await moveTasks(team, [b1, b2, b3], 'finished', checker.id);
  check('bulk move changes the up-to-date tasks and skips the one someone changed', moved.done === 2 && moved.skipped === 1);
  const fresh = (await listTasks(team)).filter((t) => bulkIds.includes(t.id));
  const assigned = await assignTasks(team, fresh, checker.id);
  check('bulk assign hands every task to the teammate (already theirs = untouched)', assigned.done === 2 && assigned.skipped === 0);
  const afterAssign = (await listTasks(team)).filter((t) => bulkIds.includes(t.id));
  check('…and they are all "taken" by that teammate', afterAssign.every((t) => t.status === 'taken' && t.taken_by === checker.id && t.finished_at === null));
  check('bulk assign skips a task changed since it was loaded', (await assignTasks(team, [b1 /* stale: waiting */], checker.id)).skipped === 1);
  check('team cannot bulk delete', await failsWith(() => deleteTasks(team, bulkIds), 'not-allowed'));
  check('admin bulk delete removes them all', (await deleteTasks(admin, bulkIds)) === 3 && !(await listTasks(admin)).some((t) => bulkIds.includes(t.id)));

  // Admin can do everything
  check('a category with items cannot be deleted', await failsWith(() => deleteCategory(admin, category.id), 'category-not-empty'));
  await deleteItem(admin, file);
  await deleteItem(admin, link);
  await deleteTask(admin, task.id);
  const { data: afterAdminRemove } = await admin.storage.from(BUCKET).list('', { search: file.storage_path as string });
  check('admin delete also removes the stored file', (afterAdminRemove ?? []).length === 0);
  const items = await listItems(admin);
  check('admin deleted the items', !items.some((i) => i.id === file.id || i.id === link.id));
  check('admin deleted the task', !(await listTasks(admin)).some((t) => t.id === task.id));
  await deleteCategory(admin, category.id);
  check('admin can delete an empty category', !(await listCategories(admin)).some((c) => c.id === category.id));
  await setMemberActive(admin, checker.id, false);
  check('admin can hide a member', (await listMembers(admin)).find((m) => m.id === checker.id)?.active === false);

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error('Crashed:', e);
  console.error('Leftover "zz-check" rows can be deleted from the app in admin mode.');
  process.exit(1);
});
