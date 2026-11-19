# M2proj Team Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private team hub at `https://mosouab.github.io/M2proj/` with a drag-and-drop task board (Waiting / Taken / Finished) and a categorised file & link area, protected by a shared team password plus an admin password.

**Architecture:** A static Astro 5 single-page app (one page, hash routes) deployed to GitHub Pages from a new repo `mosouab/M2proj`. The browser talks directly to a Supabase free-tier project (Postgres + Auth + Storage) with the public key; every permission is enforced by Row Level Security and Storage policies keyed on an `m2proj_role` claim (`team` / `admin`) stored in each account's `app_metadata`. Pure logic (task moves, validation, i18n) lives in small env-free modules with Vitest tests; the data layer takes the Supabase client as a parameter so a Node script can integration-test it against the real project.

**Tech Stack:** Astro 5, TypeScript (strict), `@supabase/supabase-js` 2, SortableJS 1.15, Fontsource (Geist Mono, Doto), Vitest 3 + happy-dom, tsx, GitHub Actions + GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-19-m2proj-team-hub-design.md` (in the personal-site repo; Task 1 copies it into the new repo).

## Global Constraints

- New repo lives at `/home/mo/Documents/M2proj`; GitHub repo `mosouab/M2proj`; live URL `https://mosouab.github.io/M2proj/` (exact capitalisation); Astro `site: 'https://mosouab.github.io'`, `base: '/M2proj'`.
- Astro 5 + TypeScript strict, **no UI framework**. Runtime deps only: `astro`, `@supabase/supabase-js`, `sortablejs`, `@fontsource/geist-mono`, `@fontsource-variable/doto`.
- Statuses are exactly `waiting`, `taken`, `finished`; column markers `[ ]`, `[~]`, `[x]`.
- Max file size 50 MB = `52428800` bytes, checked in the browser **and** by the bucket. Signed download URLs live `300` seconds.
- Links must be `http://` or `https://` (checked in the browser **and** by a database CHECK).
- Never insert user content with `innerHTML`; build DOM with `h()` from `src/ui/dom.ts`.
- Every UI string goes through `t()`; `src/i18n/fr.ts` and `src/i18n/en.ts` have identical keys and placeholders. Default language: `fr` if `navigator.language` starts with `fr`, else `en`.
- Sign out with `{ scope: 'local' }` **only** — everyone shares one account, a global sign-out would log the whole team out.
- `src/lib/*` modules never read `import.meta.env` and never touch the DOM, except `src/lib/supabase.ts` (env) and `src/lib/local.ts` (localStorage). This keeps them runnable from `scripts/` with tsx.
- `localStorage` keys: `m2proj.member`, `m2proj.lang`; Supabase auth `storageKey: 'm2proj.auth'`. Every storage access is wrapped in try/catch.
- Design tokens copied verbatim from the personal site (`--bg #fbfbfa`, `--surface #ffffff`, `--ink #161616`, `--fg #262626`, `--soft #5a5a5a`, `--muted #8a8a8a`, `--border #e4e4e4`, `--border-dark #d4d4d2`, `--accent #00875f`, `--radius 2px`, Geist Mono body, Doto display, dotted background) plus one new token `--danger: #c0362c`. Phone gutter 16px, no horizontal scroll.
- Passwords never enter the repo. `.env` is gitignored; only `PUBLIC_*` variables reach the browser bundle.
- Prerequisites Mo must do himself (the executor asks for them at the right step): install npm (`! sudo pacman -S npm`, npm is currently missing on this machine), create the Supabase project (Task 5), log in to GitHub CLI (`! gh auth login`, Task 10).

## Review Focus

1. **One teammate logging out logs everyone out.** All teammates share one Supabase account; supabase-js `signOut()` defaults to a *global* sign-out. Expected: logging out only affects that browser. → Task 4 uses `scope: 'local'`; Task 5's permissions script signs out a second client and checks the first still works.
2. **French file names** (`Compte rendu réunion.pdf`, spaces, accents, `(v2)`): Supabase Storage rejects non-ASCII keys. Expected: upload works and the download keeps a readable name. → Task 2 `sanitizeFileName` tests; Task 5 script uploads an accented name.
3. **Deadline shown one day early** for anyone whose browser is west of UTC, because `new Date('2026-11-24')` is UTC midnight. Expected: the card shows the date that was picked. → Task 3 `formatDay` test under `TZ=America/Los_Angeles`.
4. **First admin login on an empty project is a dead end**: "Who are you?" has no names and only the admin can add members. Expected: the admin can add a name right there. → Task 6 picker test (admin sees an add form when the list is empty).
5. **Errors invisible while a modal is open**: a `<dialog>` opened with `showModal()` sits in the top layer, so a toast appended to `<body>` is hidden behind it (e.g. upload fails inside the "Add" modal). Expected: the error is visible. → Task 6 toast test (toast goes inside the open dialog).

---

### Task 1: Repo scaffold, shared types and task rules

**Files:**
- Create: `/home/mo/Documents/M2proj/package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.env.example`, `src/env.d.ts`, `src/styles/global.css`, `src/pages/index.astro`, `public/favicon.svg` (copied), `docs/superpowers/specs/…` and `docs/superpowers/plans/…` (copied)
- Create: `src/lib/types.ts`, `src/lib/transitions.ts`
- Test: `tests/transitions.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `src/lib/types.ts`: `type Status = 'waiting' | 'taken' | 'finished'`, `type ItemKind = 'file' | 'link'`, `interface Member { id; name; active }`, `interface Category { id; name; position }`, `interface Task { id; title; description; deadline: string | null; status: Status; taken_by: string | null; created_by: string; created_at; updated_at; finished_at: string | null }`, `interface Item { id; category_id; kind: ItemKind; title; url: string | null; storage_path: string | null; size_bytes: number | null; added_by; created_at }`
  - `src/lib/transitions.ts`: `STATUSES: readonly Status[]`, `type MovePatch`, `interface MovePlan { from: Status; to: Status; patch: MovePatch }`, `planMove(task: Pick<Task,'status'|'taken_by'>, to: Status, me: string, nowIso: string): MovePlan | null`, `todayLocal(d?: Date): string`, `isLate(task: Pick<Task,'deadline'|'status'>, today: string): boolean`, `sortColumn(tasks: readonly Task[], status: Status): Task[]`, `groupByStatus(tasks: readonly Task[]): Record<Status, Task[]>`

- [ ] **Step 1: Make sure npm exists**

Run: `npm -v`
If it prints `command not found`, stop and ask Mo to run `! sudo pacman -S npm` in the Claude Code prompt, then re-run `npm -v` (expect a version number).

- [ ] **Step 2: Create the repo and copy shared assets**

```bash
mkdir -p /home/mo/Documents/M2proj && cd /home/mo/Documents/M2proj
git init -b main
mkdir -p src/lib src/ui src/i18n src/styles src/pages public tests scripts supabase .github/workflows docs/superpowers/specs docs/superpowers/plans
cp ../mosouab.github.io/public/favicon.svg public/
cp ../mosouab.github.io/docs/superpowers/specs/2026-11-19-m2proj-team-hub-design.md docs/superpowers/specs/
cp ../mosouab.github.io/docs/superpowers/plans/2026-11-19-m2proj-team-hub.md docs/superpowers/plans/
```

- [ ] **Step 3: Write config files**

`package.json`:
```json
{
  "name": "m2proj",
  "type": "module",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test": "vitest run",
    "check:permissions": "node --env-file=.env --import tsx scripts/check-permissions.ts"
  }
}
```

`astro.config.mjs`:
```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://mosouab.github.io',
  base: '/M2proj',
});
```

`tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
```

`.gitignore`:
```
node_modules/
dist/
.astro/
npm-debug.log*
.env
.env.*
!.env.example
```

`.env.example`:
```
# Copy to .env and fill in. .env is gitignored.
PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
PUBLIC_TEAM_EMAIL=team@m2proj.invalid
PUBLIC_ADMIN_EMAIL=admin@m2proj.invalid
# Only read by scripts/check-permissions.ts. Never prefix these with PUBLIC_.
M2_TEAM_PASSWORD=
M2_ADMIN_PASSWORD=
```

`src/env.d.ts`:
```ts
interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly PUBLIC_TEAM_EMAIL: string;
  readonly PUBLIC_ADMIN_EMAIL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 4: Install dependencies**

```bash
cd /home/mo/Documents/M2proj
npm install astro@^5 @supabase/supabase-js@^2 sortablejs@^1.15 @fontsource/geist-mono@^5 @fontsource-variable/doto@^5
npm install -D vitest@^3 happy-dom tsx @astrojs/check typescript @types/sortablejs @types/node
```
Expected: both commands finish without `ERR!`.

- [ ] **Step 5: Write the base stylesheet and placeholder page**

`src/styles/global.css` (tokens and base rules copied from the personal site; site-only rules like `section`, `.chips`, `.prose`, marquee are deliberately left out):
```css
:root {
  --bg: #fbfbfa;
  --surface: #ffffff;
  --ink: #161616;
  --fg: #262626;
  --soft: #5a5a5a;
  --muted: #8a8a8a;
  --border: #e4e4e4;
  --border-dark: #d4d4d2;
  --accent: #00875f;
  --danger: #c0362c;
  --radius: 2px;
  --font-mono: 'Geist Mono', 'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace;
  --font-display: 'Doto Variable', var(--font-mono);
  --w: 1120px;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background-color: var(--bg);
  background-image: radial-gradient(circle at 1px 1px, #1616160d 1px, transparent 0);
  background-size: 22px 22px;
  color: var(--fg);
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}

::selection {
  background: var(--ink);
  color: var(--bg);
}

a {
  color: var(--fg);
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
}

a:hover {
  color: var(--ink);
  background: #16161608;
}

h1, h2, h3 {
  color: var(--ink);
  line-height: 1.25;
}

.wrap {
  max-width: var(--w);
  margin: 0 auto;
  padding: 0 24px;
}

@media (max-width: 560px) {
  .wrap {
    padding: 0 16px;
  }
}

.label {
  font-size: 11px;
  letter-spacing: 0.15em;
  color: var(--muted);
  text-transform: uppercase;
}

.label::before {
  content: '// ';
}

.btn {
  display: inline-block;
  background: var(--ink);
  color: var(--bg);
  border: 1px solid var(--ink);
  border-radius: var(--radius);
  padding: 9px 18px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  text-decoration: none;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.btn:hover {
  color: var(--bg);
  background: var(--ink);
  transform: translate(-2px, -2px);
  box-shadow: 3px 3px 0 0 var(--border-dark);
}

.btn.ghost {
  background: transparent;
  color: var(--fg);
  border-color: var(--border-dark);
}

.btn.ghost:hover {
  background: var(--surface);
}

@media (prefers-reduced-motion: reduce) {
  .btn, .card {
    transition: none !important;
  }
}
```

`src/pages/index.astro` (placeholder; Task 6 replaces it):
```astro
---
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import '@fontsource/geist-mono/700.css';
import '@fontsource-variable/doto';
import '../styles/global.css';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
---

<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <link rel="icon" type="image/svg+xml" href={`${base}/favicon.svg`} />
    <title>M2proj</title>
  </head>
  <body>
    <div id="app"><p class="wrap label">M2proj</p></div>
  </body>
</html>
```

- [ ] **Step 6: Write the shared types**

`src/lib/types.ts`:
```ts
export type Status = 'waiting' | 'taken' | 'finished';
export type ItemKind = 'file' | 'link';

export interface Member {
  id: string;
  name: string;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  position: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  /** 'YYYY-MM-DD' (Postgres date) or null */
  deadline: string | null;
  status: Status;
  taken_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

export interface Item {
  id: string;
  category_id: string;
  kind: ItemKind;
  title: string;
  url: string | null;
  storage_path: string | null;
  size_bytes: number | null;
  added_by: string;
  created_at: string;
}
```

- [ ] **Step 7: Write the failing tests for task rules**

`tests/transitions.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { groupByStatus, isLate, planMove, sortColumn, STATUSES, todayLocal } from '../src/lib/transitions';
import type { Status, Task } from '../src/lib/types';

const NOW = '2026-11-19T10:00:00.000Z';
const ME = 'me-id';
const SAMI = 'sami-id';

function task(over: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'T',
    description: '',
    deadline: null,
    status: 'waiting',
    taken_by: null,
    created_by: SAMI,
    created_at: '2026-11-01T00:00:00+00:00',
    updated_at: '2026-11-01T00:00:00+00:00',
    finished_at: null,
    ...over,
  };
}

const VALID: Record<Status, Task> = {
  waiting: task(),
  taken: task({ status: 'taken', taken_by: SAMI }),
  finished: task({ status: 'finished', taken_by: SAMI, finished_at: '2026-11-10T00:00:00+00:00' }),
};

describe('planMove', () => {
  it('returns null when the status does not change', () => {
    expect(planMove(VALID.waiting, 'waiting', ME, NOW)).toBeNull();
  });

  it('waiting → taken assigns me', () => {
    expect(planMove(VALID.waiting, 'taken', ME, NOW)).toEqual({
      from: 'waiting',
      to: 'taken',
      patch: { status: 'taken', taken_by: ME },
    });
  });

  it('waiting → finished assigns me and stamps finished_at', () => {
    expect(planMove(VALID.waiting, 'finished', ME, NOW)?.patch).toEqual({
      status: 'finished',
      taken_by: ME,
      finished_at: NOW,
    });
  });

  it('taken → finished keeps the owner', () => {
    expect(planMove(VALID.taken, 'finished', ME, NOW)?.patch).toEqual({ status: 'finished', finished_at: NOW });
  });

  it('taken → waiting gives the task back', () => {
    expect(planMove(VALID.taken, 'waiting', ME, NOW)?.patch).toEqual({ status: 'waiting', taken_by: null });
  });

  it('finished → waiting clears owner and finished_at', () => {
    expect(planMove(VALID.finished, 'waiting', ME, NOW)?.patch).toEqual({
      status: 'waiting',
      taken_by: null,
      finished_at: null,
    });
  });

  it('finished → taken keeps the previous owner', () => {
    expect(planMove(VALID.finished, 'taken', ME, NOW)?.patch).toEqual({
      status: 'taken',
      taken_by: SAMI,
      finished_at: null,
    });
  });

  it('finished → taken assigns me when the owner is missing', () => {
    expect(planMove({ status: 'finished', taken_by: null }, 'taken', ME, NOW)?.patch.taken_by).toBe(ME);
  });

  it('the guard is always the status the client saw', () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        if (from !== to) expect(planMove(VALID[from], to, ME, NOW)?.from).toBe(from);
      }
    }
  });

  it('every move keeps the database invariants (waiting ⇔ no owner, finished ⇔ finished_at)', () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        const plan = planMove(VALID[from], to, ME, NOW);
        if (!plan) continue;
        const after = { ...VALID[from], ...plan.patch };
        expect(after.status === 'waiting', `${from}→${to}`).toBe(after.taken_by === null);
        expect(after.status === 'finished', `${from}→${to}`).toBe(after.finished_at !== null);
      }
    }
  });
});

describe('isLate', () => {
  const today = '2026-11-19';
  it('is late when the deadline was yesterday and the task is open', () => {
    expect(isLate({ deadline: '2026-11-18', status: 'waiting' }, today)).toBe(true);
    expect(isLate({ deadline: '2026-11-18', status: 'taken' }, today)).toBe(true);
  });
  it('is not late on the deadline day itself', () => {
    expect(isLate({ deadline: '2026-11-19', status: 'waiting' }, today)).toBe(false);
  });
  it('is never late without a deadline', () => {
    expect(isLate({ deadline: null, status: 'waiting' }, today)).toBe(false);
  });
  it('is never late once finished', () => {
    expect(isLate({ deadline: '2026-01-01', status: 'finished' }, today)).toBe(false);
  });
});

describe('todayLocal', () => {
  it('formats the local calendar date, not the UTC one', () => {
    expect(todayLocal(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

describe('sortColumn / groupByStatus', () => {
  it('sorts open tasks by deadline, no deadline last, then by creation', () => {
    const tasks = [
      task({ id: 'none', deadline: null }),
      task({ id: 'late', deadline: '2026-12-01' }),
      task({ id: 'soon-b', deadline: '2026-11-20', created_at: '2026-11-02T00:00:00+00:00' }),
      task({ id: 'soon-a', deadline: '2026-11-20', created_at: '2026-11-01T00:00:00+00:00' }),
      task({ id: 'other', status: 'taken', taken_by: SAMI }),
    ];
    expect(sortColumn(tasks, 'waiting').map((t) => t.id)).toEqual(['soon-a', 'soon-b', 'late', 'none']);
  });

  it('sorts finished tasks newest first', () => {
    const tasks = [
      task({ id: 'old', status: 'finished', taken_by: SAMI, finished_at: '2026-11-01T00:00:00+00:00' }),
      task({ id: 'new', status: 'finished', taken_by: SAMI, finished_at: '2026-11-15T00:00:00+00:00' }),
    ];
    expect(sortColumn(tasks, 'finished').map((t) => t.id)).toEqual(['new', 'old']);
  });

  it('puts every task in exactly one column', () => {
    const groups = groupByStatus([VALID.waiting, VALID.taken, VALID.finished]);
    expect(groups.waiting).toHaveLength(1);
    expect(groups.taken).toHaveLength(1);
    expect(groups.finished).toHaveLength(1);
  });
});
```

- [ ] **Step 8: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "../src/lib/transitions"`.

- [ ] **Step 9: Implement the task rules**

`src/lib/transitions.ts`:
```ts
import type { Status, Task } from './types';

export const STATUSES: readonly Status[] = ['waiting', 'taken', 'finished'];

export type MovePatch = Partial<Pick<Task, 'status' | 'taken_by' | 'finished_at'>>;

export interface MovePlan {
  /** Status the client saw; the update only applies if the row still has it. */
  from: Status;
  to: Status;
  patch: MovePatch;
}

export function planMove(
  task: Pick<Task, 'status' | 'taken_by'>,
  to: Status,
  me: string,
  nowIso: string,
): MovePlan | null {
  const from = task.status;
  if (from === to) return null;
  const plan = (patch: MovePatch): MovePlan => ({ from, to, patch });
  switch (`${from}>${to}`) {
    case 'waiting>taken':
      return plan({ status: 'taken', taken_by: me });
    case 'waiting>finished':
      return plan({ status: 'finished', taken_by: me, finished_at: nowIso });
    case 'taken>finished':
      return plan({ status: 'finished', finished_at: nowIso });
    case 'taken>waiting':
      return plan({ status: 'waiting', taken_by: null });
    case 'finished>waiting':
      return plan({ status: 'waiting', taken_by: null, finished_at: null });
    case 'finished>taken':
      return plan({ status: 'taken', taken_by: task.taken_by ?? me, finished_at: null });
    default:
      return null;
  }
}

export function todayLocal(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function isLate(task: Pick<Task, 'deadline' | 'status'>, today: string): boolean {
  return task.deadline !== null && task.status !== 'finished' && task.deadline < today;
}

export function sortColumn(tasks: readonly Task[], status: Status): Task[] {
  const column = tasks.filter((t) => t.status === status);
  if (status === 'finished') {
    return column.sort((a, b) => (b.finished_at ?? '').localeCompare(a.finished_at ?? ''));
  }
  return column.sort((a, b) => {
    if (a.deadline !== b.deadline) {
      if (a.deadline === null) return 1;
      if (b.deadline === null) return -1;
      return a.deadline.localeCompare(b.deadline);
    }
    return a.created_at.localeCompare(b.created_at);
  });
}

export function groupByStatus(tasks: readonly Task[]): Record<Status, Task[]> {
  return {
    waiting: sortColumn(tasks, 'waiting'),
    taken: sortColumn(tasks, 'taken'),
    finished: sortColumn(tasks, 'finished'),
  };
}
```

- [ ] **Step 10: Run tests, type-check and build**

Run: `npm test && npm run check && npm run build`
Expected: all transitions tests PASS; `astro check` reports `0 errors`; build writes `dist/index.html`.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold M2proj (Astro, types, task move rules)"
```

---

### Task 2: File and link helpers

**Files:**
- Create: `src/lib/validate.ts`
- Test: `tests/validate.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `MAX_FILE_BYTES = 52428800`, `isFileSizeOk(bytes: number): boolean`, `normalizeLink(input: string): string | null`, `sanitizeFileName(name: string): string`, `storagePathFor(fileName: string, uuid: string): string`, `fileNameFromPath(path: string): string`

- [ ] **Step 1: Write the failing tests**

`tests/validate.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  fileNameFromPath,
  isFileSizeOk,
  MAX_FILE_BYTES,
  normalizeLink,
  sanitizeFileName,
  storagePathFor,
} from '../src/lib/validate';

const UUID = '0b6f3c1e-9a7d-4e2b-8c1f-2d3e4f5a6b7c';

describe('isFileSizeOk', () => {
  it('accepts exactly 50 MB and refuses one byte more', () => {
    expect(MAX_FILE_BYTES).toBe(52428800);
    expect(isFileSizeOk(MAX_FILE_BYTES)).toBe(true);
    expect(isFileSizeOk(MAX_FILE_BYTES + 1)).toBe(false);
  });
});

describe('normalizeLink', () => {
  it('keeps http and https links, trimmed', () => {
    expect(normalizeLink('  https://docs.google.com/x  ')).toBe('https://docs.google.com/x');
    expect(normalizeLink('http://example.org')).toBe('http://example.org/');
  });
  it('adds https:// to pasted links without a scheme', () => {
    expect(normalizeLink('docs.google.com/document/d/abc')).toBe('https://docs.google.com/document/d/abc');
  });
  it('refuses other schemes', () => {
    expect(normalizeLink('javascript:alert(1)')).toBeNull();
    expect(normalizeLink('ftp://example.org/file')).toBeNull();
    expect(normalizeLink('mailto:a@b.c')).toBeNull();
  });
  it('refuses things that are not links', () => {
    expect(normalizeLink('')).toBeNull();
    expect(normalizeLink('hello')).toBeNull();
    expect(normalizeLink('two words.com')).toBeNull();
  });
});

describe('sanitizeFileName', () => {
  it('turns French names into safe ASCII keys', () => {
    expect(sanitizeFileName('Compte rendu réunion.pdf')).toBe('Compte-rendu-reunion.pdf');
    expect(sanitizeFileName('été 2026 (v2).docx')).toBe('ete-2026-v2.docx');
  });
  it('keeps only the last dot as the extension', () => {
    expect(sanitizeFileName('rapport.v2.final.pdf')).toBe('rapport-v2-final.pdf');
  });
  it('falls back to "file" when nothing usable is left', () => {
    expect(sanitizeFileName('日本語.txt')).toBe('file.txt');
    expect(sanitizeFileName('???')).toBe('file');
  });
  it('caps very long names but keeps the extension', () => {
    const out = sanitizeFileName(`${'a'.repeat(300)}.pdf`);
    expect(out.endsWith('.pdf')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(101);
  });
});

describe('storage paths', () => {
  it('prefixes the uuid and round-trips the readable name', () => {
    const path = storagePathFor('Compte rendu réunion.pdf', UUID);
    expect(path).toBe(`${UUID}-Compte-rendu-reunion.pdf`);
    expect(fileNameFromPath(path)).toBe('Compte-rendu-reunion.pdf');
  });
  it('leaves paths without a uuid prefix untouched', () => {
    expect(fileNameFromPath('plain.txt')).toBe('plain.txt');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/validate.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/validate"`.

- [ ] **Step 3: Implement**

`src/lib/validate.ts`:
```ts
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export function isFileSizeOk(bytes: number): boolean {
  return bytes <= MAX_FILE_BYTES;
}

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Returns a clean http(s) URL, adding https:// when the scheme is missing, or null if invalid. */
export function normalizeLink(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const candidate = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.href;
  } catch {
    return null;
  }
}

function cleanPart(s: string): string {
  return s
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** ASCII-only, Storage-safe file name that keeps the extension. */
export function sanitizeFileName(name: string): string {
  const ascii = name.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const dot = ascii.lastIndexOf('.');
  const rawStem = dot > 0 ? ascii.slice(0, dot) : ascii;
  const rawExt = dot > 0 ? ascii.slice(dot + 1) : '';
  const stem = cleanPart(rawStem).slice(0, 90) || 'file';
  const ext = cleanPart(rawExt).slice(0, 10);
  return ext ? `${stem}.${ext}` : stem;
}

export function storagePathFor(fileName: string, uuid: string): string {
  return `${uuid}-${sanitizeFileName(fileName)}`;
}

const UUID_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;

export function fileNameFromPath(path: string): string {
  return path.replace(UUID_PREFIX, '');
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/validate.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/lib/validate.ts tests/validate.test.ts
git commit -m "feat: file size, link and file-name helpers"
```

---

### Task 3: Translations (FR/EN), formatting and local storage

**Files:**
- Create: `src/lib/constants.ts`, `src/lib/local.ts`, `src/i18n/en.ts`, `src/i18n/fr.ts`, `src/i18n/index.ts`
- Test: `tests/i18n.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `src/lib/constants.ts`: `BUCKET = 'files'`, `SIGNED_URL_SECONDS = 300`, `LS_MEMBER = 'm2proj.member'`, `LS_LANG = 'm2proj.lang'`, `AUTH_STORAGE_KEY = 'm2proj.auth'`
  - `src/lib/local.ts`: `readLocal(key: string): string | null`, `writeLocal(key: string, value: string | null): void`
  - `src/i18n/index.ts`: `type Lang = 'fr' | 'en'`, `type Key = keyof typeof en`, `detectLang(stored, browser): Lang`, `getLang(): Lang`, `setLang(lang: Lang): void` (dispatches `window` event `'m2proj:lang'`), `interpolate(template, vars?)`, `translate(lang, key, vars?)`, `t(key, vars?)`, `formatDay(ymd: string, lang?: Lang)`, `formatTimestamp(iso: string, lang?: Lang)`, `formatSize(bytes: number, lang?: Lang)`
  - `src/i18n/en.ts`: `en` (keys listed below); `src/i18n/fr.ts`: `fr: Record<Key, string>`

- [ ] **Step 1: Write the failing tests**

`tests/i18n.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { fr } from '../src/i18n/fr';
import { detectLang, formatDay, formatSize, interpolate, translate, type Key } from '../src/i18n';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries', () => {
  it('fr and en have exactly the same keys', () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });
  it('no translation is empty', () => {
    for (const [key, value] of [...Object.entries(en), ...Object.entries(fr)]) {
      expect(value.trim(), key).not.toBe('');
    }
  });
  it('both languages use the same {placeholders}', () => {
    for (const key of Object.keys(en) as Key[]) {
      expect(placeholders(fr[key]), key).toEqual(placeholders(en[key]));
    }
  });
});

describe('detectLang', () => {
  it('uses a stored choice first', () => {
    expect(detectLang('en', 'fr-FR')).toBe('en');
    expect(detectLang('fr', 'en-US')).toBe('fr');
  });
  it('falls back to the browser language', () => {
    expect(detectLang(null, 'fr-FR')).toBe('fr');
    expect(detectLang(null, 'en-GB')).toBe('en');
    expect(detectLang('garbage', 'fr')).toBe('fr');
    expect(detectLang(null, undefined)).toBe('en');
  });
});

describe('interpolate / translate', () => {
  it('fills placeholders and leaves unknown ones visible', () => {
    expect(interpolate('Hi {name}, {x}', { name: 'Léa' })).toBe('Hi Léa, {x}');
  });
  it('translates with variables', () => {
    expect(translate('fr', 'board.conflictTaken', { name: 'Sami' })).toBe('Déjà pris par Sami.');
    expect(translate('en', 'board.conflictTaken', { name: 'Sami' })).toBe('Already taken by Sami.');
  });
});

describe('formatDay', () => {
  it('shows the picked day', () => {
    expect(formatDay('2026-11-24', 'en')).toMatch(/Nov/);
    expect(formatDay('2026-11-24', 'en')).toMatch(/24/);
    expect(formatDay('2026-11-24', 'fr')).toMatch(/24 nov/);
  });
  it('never shifts a deadline to the previous day, whatever the timezone', () => {
    const original = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      expect(formatDay('2026-11-24', 'en')).toMatch(/24/);
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});

describe('formatSize', () => {
  it('uses the right units and decimal separator', () => {
    expect(formatSize(1536, 'en')).toMatch(/^1\.5\s?kB$/u);
    expect(formatSize(1536, 'fr')).toMatch(/^1,5\s?ko$/u);
    expect(formatSize(50 * 1024 * 1024, 'en')).toMatch(/^50\s?MB$/u);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/i18n.test.ts`
Expected: FAIL — `Failed to resolve import "../src/i18n/en"`.

- [ ] **Step 3: Write constants and the local storage helper**

`src/lib/constants.ts`:
```ts
export const BUCKET = 'files';
export const SIGNED_URL_SECONDS = 300;
export const LS_MEMBER = 'm2proj.member';
export const LS_LANG = 'm2proj.lang';
export const AUTH_STORAGE_KEY = 'm2proj.auth';
```

`src/lib/local.ts`:
```ts
// localStorage can be missing or throw (private mode, blocked storage, Node). Never let that break the app.
export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ignore: the choice just won't be remembered
  }
}
```

- [ ] **Step 4: Write the English dictionary**

`src/i18n/en.ts`:
```ts
export const en = {
  'common.close': 'Close',
  'common.cancel': 'Cancel',
  'common.confirm': 'Are you sure?',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.add': 'Add',
  'common.retry': 'Retry',

  'login.team': 'Team access',
  'login.admin': 'Admin access',
  'login.password': 'Password',
  'login.submit': 'Enter',
  'login.toAdmin': 'Admin?',
  'login.toTeam': '← Team login',
  'login.back': '← Back to the board',

  'picker.title': 'Who are you?',
  'picker.empty': 'No members yet. Ask the admin to add the team.',
  'picker.namePlaceholder': 'First name',

  'nav.board': 'board',
  'nav.files': 'files',
  'nav.admin': 'admin',
  'nav.change': 'change',
  'nav.logout': 'logout',
  'nav.adminBadge': 'ADMIN',

  'status.waiting': 'Waiting',
  'status.taken': 'Taken',
  'status.finished': 'Finished',

  'board.label': 'board',
  'board.new': '+ New task',
  'board.empty': 'Nothing here',
  'board.due': 'due {date}',
  'board.late': 'LATE',
  'board.doneBy': 'done by {name}',
  'board.moveTo': 'Move to…',
  'board.conflictTaken': 'Already taken by {name}.',
  'board.conflictMoved': 'Someone already moved it to "{status}".',
  'board.gone': 'This task no longer exists.',

  'task.title': 'Title',
  'task.description': 'Description',
  'task.deadline': 'Deadline (optional)',
  'task.edit': 'Edit task',
  'task.createdBy': 'Created by {name}',
  'task.takenBy': 'taken by {name}',
  'task.confirmDelete': 'Delete the task "{title}"? This cannot be undone.',
  'task.titleRequired': 'A title is required.',

  'files.label': 'files',
  'files.add': '+ Add',
  'files.noCategories': 'No categories yet. The admin needs to create them first.',
  'files.emptyCategory': 'Empty',
  'files.open': 'Open',
  'files.download': 'Download',
  'files.confirmDelete': 'Delete "{title}"? This cannot be undone.',
  'files.kindFile': 'File',
  'files.kindLink': 'Link',
  'files.file': 'File (max 50 MB)',
  'files.url': 'Link',
  'files.title': 'Title',
  'files.category': 'Category',
  'files.pickFile': 'Choose a file first.',
  'files.uploading': 'Uploading…',

  'admin.label': 'admin',
  'admin.members': 'Members',
  'admin.categories': 'Categories',
  'admin.memberName': 'Name',
  'admin.categoryName': 'Category name',
  'admin.deactivate': 'Hide',
  'admin.reactivate': 'Show',
  'admin.moveUp': 'Move up',
  'admin.moveDown': 'Move down',
  'admin.confirmDeleteCategory': 'Delete the category "{name}"?',

  'error.bad-password': 'Wrong password.',
  'error.auth': 'Your session expired. Please log in again.',
  'error.network': 'Connection problem. Check your internet and try again.',
  'error.not-allowed': 'Only the admin can do that.',
  'error.too-big': 'File too big (50 MB max).',
  'error.bad-url': 'That link does not look valid.',
  'error.category-not-empty': 'This category is not empty. Delete its files and links first.',
  'error.rate-limited': 'Too many attempts. Wait a minute and try again.',
  'error.unknown': 'Something went wrong. Try again.',
} as const;
```

- [ ] **Step 5: Write the French dictionary**

`src/i18n/fr.ts`:
```ts
import type { Key } from './index';

export const fr: Record<Key, string> = {
  'common.close': 'Fermer',
  'common.cancel': 'Annuler',
  'common.confirm': 'Tu es sûr ?',
  'common.save': 'Enregistrer',
  'common.delete': 'Supprimer',
  'common.add': 'Ajouter',
  'common.retry': 'Réessayer',

  'login.team': 'Accès équipe',
  'login.admin': 'Accès admin',
  'login.password': 'Mot de passe',
  'login.submit': 'Entrer',
  'login.toAdmin': 'Admin ?',
  'login.toTeam': '← Connexion équipe',
  'login.back': '← Retour au tableau',

  'picker.title': 'Qui es-tu ?',
  'picker.empty': "Pas encore de membres. Demande à l'admin d'ajouter l'équipe.",
  'picker.namePlaceholder': 'Prénom',

  'nav.board': 'tableau',
  'nav.files': 'fichiers',
  'nav.admin': 'admin',
  'nav.change': 'changer',
  'nav.logout': 'quitter',
  'nav.adminBadge': 'ADMIN',

  'status.waiting': 'En attente',
  'status.taken': 'Pris',
  'status.finished': 'Terminé',

  'board.label': 'tableau',
  'board.new': '+ Nouvelle tâche',
  'board.empty': 'Rien ici',
  'board.due': 'pour le {date}',
  'board.late': 'EN RETARD',
  'board.doneBy': 'fait par {name}',
  'board.moveTo': 'Déplacer vers…',
  'board.conflictTaken': 'Déjà pris par {name}.',
  'board.conflictMoved': "Quelqu'un l'a déjà déplacée vers « {status} ».",
  'board.gone': "Cette tâche n'existe plus.",

  'task.title': 'Titre',
  'task.description': 'Description',
  'task.deadline': 'Échéance (facultative)',
  'task.edit': 'Modifier la tâche',
  'task.createdBy': 'Créée par {name}',
  'task.takenBy': 'prise par {name}',
  'task.confirmDelete': "Supprimer la tâche « {title} » ? C'est définitif.",
  'task.titleRequired': 'Le titre est obligatoire.',

  'files.label': 'fichiers',
  'files.add': '+ Ajouter',
  'files.noCategories': "Pas encore de catégories. L'admin doit d'abord les créer.",
  'files.emptyCategory': 'Vide',
  'files.open': 'Ouvrir',
  'files.download': 'Télécharger',
  'files.confirmDelete': "Supprimer « {title} » ? C'est définitif.",
  'files.kindFile': 'Fichier',
  'files.kindLink': 'Lien',
  'files.file': 'Fichier (50 Mo max)',
  'files.url': 'Lien',
  'files.title': 'Titre',
  'files.category': 'Catégorie',
  'files.pickFile': "Choisis d'abord un fichier.",
  'files.uploading': 'Envoi…',

  'admin.label': 'admin',
  'admin.members': 'Membres',
  'admin.categories': 'Catégories',
  'admin.memberName': 'Nom',
  'admin.categoryName': 'Nom de la catégorie',
  'admin.deactivate': 'Masquer',
  'admin.reactivate': 'Réafficher',
  'admin.moveUp': 'Monter',
  'admin.moveDown': 'Descendre',
  'admin.confirmDeleteCategory': 'Supprimer la catégorie « {name} » ?',

  'error.bad-password': 'Mot de passe incorrect.',
  'error.auth': 'Ta session a expiré. Reconnecte-toi.',
  'error.network': 'Problème de connexion. Vérifie ton internet et réessaie.',
  'error.not-allowed': "Seul l'admin peut faire ça.",
  'error.too-big': 'Fichier trop lourd (50 Mo max).',
  'error.bad-url': 'Ce lien ne semble pas valide.',
  'error.category-not-empty': "Cette catégorie n'est pas vide. Supprime d'abord ses fichiers et liens.",
  'error.rate-limited': 'Trop de tentatives. Attends une minute et réessaie.',
  'error.unknown': 'Une erreur est survenue. Réessaie.',
};
```

- [ ] **Step 6: Write the i18n module**

`src/i18n/index.ts`:
```ts
import { LS_LANG } from '../lib/constants';
import { readLocal, writeLocal } from '../lib/local';
import { en } from './en';
import { fr } from './fr';

export type Lang = 'fr' | 'en';
export type Key = keyof typeof en;
type Vars = Record<string, string | number>;

const dicts: Record<Lang, Record<Key, string>> = { fr, en };

export function detectLang(stored: string | null, browser: string | undefined): Lang {
  if (stored === 'fr' || stored === 'en') return stored;
  return browser?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

let current: Lang | null = null;

export function getLang(): Lang {
  if (!current) {
    current = detectLang(readLocal(LS_LANG), typeof navigator === 'undefined' ? undefined : navigator.language);
  }
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  writeLocal(LS_LANG, lang);
  document.documentElement.lang = lang;
  window.dispatchEvent(new Event('m2proj:lang'));
}

export function interpolate(template: string, vars: Vars = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export function translate(lang: Lang, key: Key, vars?: Vars): string {
  return interpolate(dicts[lang][key] ?? en[key] ?? key, vars);
}

export function t(key: Key, vars?: Vars): string {
  return translate(getLang(), key, vars);
}

/** 'YYYY-MM-DD' → "24 nov." / "Nov 24". Built from local parts so the day never shifts. */
export function formatDay(ymd: string, lang: Lang = getLang()): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const showYear = y !== new Date().getFullYear();
  return new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'short',
    year: showYear ? 'numeric' : undefined,
  }).format(new Date(y, m - 1, d));
}

export function formatTimestamp(iso: string, lang: Lang = getLang()): string {
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export function formatSize(bytes: number, lang: Lang = getLang()): string {
  const units = ['byte', 'kilobyte', 'megabyte'] as const;
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return new Intl.NumberFormat(lang, {
    style: 'unit',
    unit: units[i],
    unitDisplay: 'short',
    maximumFractionDigits: i === 0 ? 0 : 1,
  }).format(value);
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/i18n.test.ts && npm run check`
Expected: PASS; `0 errors`. If a `formatSize`/`formatDay` assertion fails only because of the ICU spacing character, print the actual string and widen the regex — do not change the format options.

- [ ] **Step 8: Commit**

```bash
git add src/lib/constants.ts src/lib/local.ts src/i18n tests/i18n.test.ts
git commit -m "feat: FR/EN translations, date and size formatting"
```

---

### Task 4: Data layer (auth, members, categories, tasks, items)

**Files:**
- Create: `src/lib/errors.ts`, `src/lib/auth.ts`, `src/lib/members.ts`, `src/lib/categories.ts`, `src/lib/tasks.ts`, `src/lib/items.ts`, `src/lib/supabase.ts`
- Test: `tests/errors.test.ts`, `tests/auth.test.ts`, `tests/members.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `transitions.planMove`, `validate.*`, `constants.*` (Tasks 1–3).
- Produces (every data function takes the Supabase client `db: SupabaseClient` first and throws on failure):
  - `errors.ts`: `type ErrorCode = 'bad-password' | 'auth' | 'network' | 'not-allowed' | 'too-big' | 'bad-url' | 'category-not-empty' | 'rate-limited' | 'unknown'`, `class AppError extends Error { code: ErrorCode }`, `toAppError(e: unknown): AppError`, `requireRows<T>(data: T[] | null): T[]`
  - `auth.ts`: `type Role = 'team' | 'admin' | null`, `roleOf(user): Role`, `currentRole(db): Promise<Role>`, `signIn(db, email, password): Promise<'team' | 'admin'>`, `signOut(db): Promise<void>`
  - `members.ts`: `listMembers(db): Promise<Member[]>`, `addMember(db, name): Promise<Member>`, `renameMember(db, id, name): Promise<void>`, `setMemberActive(db, id, active): Promise<void>`, `pickValidMember(storedId: string | null, members: Member[]): string | null`
  - `categories.ts`: `listCategories(db): Promise<Category[]>`, `addCategory(db, name, existing: Category[]): Promise<Category>`, `renameCategory(db, id, name): Promise<void>`, `swapCategoryPositions(db, a: Category, b: Category): Promise<void>`, `deleteCategory(db, id): Promise<void>`
  - `tasks.ts`: `interface TaskFields { title; description; deadline: string | null }`, `interface NewTask extends TaskFields { created_by }`, `type MoveResult = { ok: true } | { ok: false; current: Task | null }`, `listTasks(db)`, `createTask(db, input: NewTask): Promise<Task>`, `updateTaskFields(db, id, fields: TaskFields): Promise<Task>`, `moveTask(db, task: Task, to: Status, me: string, now?: Date): Promise<MoveResult>`, `deleteTask(db, id): Promise<void>`
  - `items.ts`: `listItems(db): Promise<Item[]>` (newest first), `addLink(db, { category_id, title, url, added_by }): Promise<Item>`, `addFile(db, { category_id, title, file: Blob, fileName, added_by }, id?: string): Promise<Item>`, `fileUrl(db, item): Promise<string>`, `deleteItem(db, item): Promise<void>`
  - `supabase.ts`: `db: SupabaseClient` (browser singleton), `config: { teamEmail: string; adminEmail: string }`

- [ ] **Step 1: Write the failing unit tests**

`tests/errors.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { AppError, requireRows, toAppError } from '../src/lib/errors';

describe('toAppError', () => {
  it('passes AppError through', () => {
    const e = new AppError('too-big');
    expect(toAppError(e)).toBe(e);
  });
  it.each([
    [{ message: 'TypeError: Failed to fetch' }, 'network'],
    [{ message: 'NetworkError when attempting to fetch resource.' }, 'network'],
    [{ message: 'Load failed' }, 'network'],
    [{ status: 429, message: 'Request rate limit reached' }, 'rate-limited'],
    [{ code: 'PGRST301', message: 'JWT expired' }, 'auth'],
    [{ code: 'PGRST303', message: 'JWT expired' }, 'auth'],
    [{ status: 401, message: 'Unauthorized' }, 'auth'],
    [{ code: '42501', message: 'permission denied for table tasks' }, 'not-allowed'],
    [{ status: 400, message: 'new row violates row-level security policy' }, 'not-allowed'],
    [{ message: 'something else' }, 'unknown'],
    [null, 'unknown'],
  ])('%j → %s', (input, code) => {
    expect(toAppError(input).code).toBe(code);
  });
});

describe('requireRows', () => {
  it('returns rows when there are some', () => {
    expect(requireRows([{ id: 'a' }])).toEqual([{ id: 'a' }]);
  });
  it('treats zero affected rows as not allowed (RLS silently filters updates and deletes)', () => {
    expect(() => requireRows([])).toThrowError(AppError);
    expect(() => requireRows(null)).toThrowError(AppError);
  });
});
```

`tests/auth.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { roleOf } from '../src/lib/auth';

describe('roleOf', () => {
  it('reads the m2proj_role claim', () => {
    expect(roleOf({ app_metadata: { m2proj_role: 'team' } })).toBe('team');
    expect(roleOf({ app_metadata: { m2proj_role: 'admin' } })).toBe('admin');
  });
  it('gives no role to anything else', () => {
    expect(roleOf({ app_metadata: { m2proj_role: 'root' } })).toBeNull();
    expect(roleOf({ app_metadata: {} })).toBeNull();
    expect(roleOf(null)).toBeNull();
    expect(roleOf(undefined)).toBeNull();
  });
});
```

`tests/members.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { pickValidMember } from '../src/lib/members';

const members = [
  { id: 'a', name: 'Léa', active: true },
  { id: 'b', name: 'Sami', active: false },
];

describe('pickValidMember', () => {
  it('keeps a remembered active member', () => {
    expect(pickValidMember('a', members)).toBe('a');
  });
  it('asks again when the member was hidden or removed', () => {
    expect(pickValidMember('b', members)).toBeNull();
    expect(pickValidMember('zzz', members)).toBeNull();
    expect(pickValidMember(null, members)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/errors.test.ts tests/auth.test.ts tests/members.test.ts`
Expected: FAIL — unresolved imports.

- [ ] **Step 3: Implement errors**

`src/lib/errors.ts`:
```ts
export type ErrorCode =
  | 'bad-password'
  | 'auth'
  | 'network'
  | 'not-allowed'
  | 'too-big'
  | 'bad-url'
  | 'category-not-empty'
  | 'rate-limited'
  | 'unknown';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'AppError';
  }
}

interface ErrorLike {
  code?: unknown;
  status?: unknown;
  message?: unknown;
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const err = (e ?? {}) as ErrorLike;
  const message = String(err.message ?? '');
  const code = String(err.code ?? '');
  const status = Number(err.status ?? 0);

  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return new AppError('network', message);
  }
  if (status === 429) return new AppError('rate-limited', message);
  if (code === 'PGRST301' || code === 'PGRST303' || status === 401 || /jwt expired|invalid jwt|refresh token/i.test(message)) {
    return new AppError('auth', message);
  }
  if (code === '42501' || status === 403 || /row-level security/i.test(message)) {
    return new AppError('not-allowed', message);
  }
  return new AppError('unknown', message);
}

/** RLS makes forbidden UPDATE/DELETE affect 0 rows without an error; call with `.select()` results. */
export function requireRows<T>(data: T[] | null): T[] {
  if (!data || data.length === 0) throw new AppError('not-allowed');
  return data;
}
```

- [ ] **Step 4: Implement auth**

`src/lib/auth.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from './errors';

export type Role = 'team' | 'admin' | null;

export function roleOf(user: { app_metadata?: Record<string, unknown> } | null | undefined): Role {
  const role = user?.app_metadata?.m2proj_role;
  return role === 'team' || role === 'admin' ? role : null;
}

export async function currentRole(db: SupabaseClient): Promise<Role> {
  const { data } = await db.auth.getSession();
  return roleOf(data.session?.user);
}

export async function signIn(db: SupabaseClient, email: string, password: string): Promise<'team' | 'admin'> {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    if (/invalid login credentials/i.test(error.message)) throw new AppError('bad-password');
    throw error;
  }
  const role = roleOf(data.user);
  if (!role) {
    await signOut(db);
    throw new AppError('not-allowed');
  }
  return role;
}

/** Local only: the team shares one account, a global sign-out would log everybody out. */
export async function signOut(db: SupabaseClient): Promise<void> {
  await db.auth.signOut({ scope: 'local' });
}
```

- [ ] **Step 5: Implement members and categories**

`src/lib/members.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireRows } from './errors';
import type { Member } from './types';

const COLS = 'id,name,active';

export async function listMembers(db: SupabaseClient): Promise<Member[]> {
  const { data, error } = await db.from('members').select(COLS).order('name');
  if (error) throw error;
  return data as Member[];
}

export async function addMember(db: SupabaseClient, name: string): Promise<Member> {
  const { data, error } = await db.from('members').insert({ name: name.trim() }).select(COLS).single();
  if (error) throw error;
  return data as Member;
}

export async function renameMember(db: SupabaseClient, id: string, name: string): Promise<void> {
  const { data, error } = await db.from('members').update({ name: name.trim() }).eq('id', id).select('id');
  if (error) throw error;
  requireRows(data);
}

export async function setMemberActive(db: SupabaseClient, id: string, active: boolean): Promise<void> {
  const { data, error } = await db.from('members').update({ active }).eq('id', id).select('id');
  if (error) throw error;
  requireRows(data);
}

export function pickValidMember(storedId: string | null, members: Member[]): string | null {
  return members.some((m) => m.id === storedId && m.active) ? storedId : null;
}
```

`src/lib/categories.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError, requireRows } from './errors';
import type { Category } from './types';

const COLS = 'id,name,position';

export async function listCategories(db: SupabaseClient): Promise<Category[]> {
  const { data, error } = await db.from('categories').select(COLS).order('position').order('name');
  if (error) throw error;
  return data as Category[];
}

export async function addCategory(db: SupabaseClient, name: string, existing: Category[]): Promise<Category> {
  const position = existing.reduce((max, c) => Math.max(max, c.position), -1) + 1;
  const { data, error } = await db.from('categories').insert({ name: name.trim(), position }).select(COLS).single();
  if (error) throw error;
  return data as Category;
}

export async function renameCategory(db: SupabaseClient, id: string, name: string): Promise<void> {
  const { data, error } = await db.from('categories').update({ name: name.trim() }).eq('id', id).select('id');
  if (error) throw error;
  requireRows(data);
}

export async function swapCategoryPositions(db: SupabaseClient, a: Category, b: Category): Promise<void> {
  for (const [id, position] of [
    [a.id, b.position],
    [b.id, a.position],
  ] as const) {
    const { data, error } = await db.from('categories').update({ position }).eq('id', id).select('id');
    if (error) throw error;
    requireRows(data);
  }
}

export async function deleteCategory(db: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await db.from('categories').delete().eq('id', id).select('id');
  if (error) {
    if (error.code === '23503') throw new AppError('category-not-empty', error.message);
    throw error;
  }
  requireRows(data);
}
```

- [ ] **Step 6: Implement tasks**

`src/lib/tasks.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireRows } from './errors';
import { planMove } from './transitions';
import type { Status, Task } from './types';

const COLS = 'id,title,description,deadline,status,taken_by,created_by,created_at,updated_at,finished_at';

export interface TaskFields {
  title: string;
  description: string;
  deadline: string | null;
}

export interface NewTask extends TaskFields {
  created_by: string;
}

export type MoveResult = { ok: true } | { ok: false; current: Task | null };

export async function listTasks(db: SupabaseClient): Promise<Task[]> {
  const { data, error } = await db.from('tasks').select(COLS);
  if (error) throw error;
  return data as Task[];
}

export async function createTask(db: SupabaseClient, input: NewTask): Promise<Task> {
  const { data, error } = await db.from('tasks').insert(input).select(COLS).single();
  if (error) throw error;
  return data as Task;
}

export async function updateTaskFields(db: SupabaseClient, id: string, fields: TaskFields): Promise<Task> {
  const { data, error } = await db.from('tasks').update(fields).eq('id', id).select(COLS);
  if (error) throw error;
  return requireRows(data)[0] as Task;
}

/** Conditional on the status the client saw: if someone moved it first, nothing changes and we return the current row. */
export async function moveTask(
  db: SupabaseClient,
  task: Task,
  to: Status,
  me: string,
  now: Date = new Date(),
): Promise<MoveResult> {
  const plan = planMove(task, to, me, now.toISOString());
  if (!plan) return { ok: true };
  const { data, error } = await db
    .from('tasks')
    .update(plan.patch)
    .eq('id', task.id)
    .eq('status', plan.from)
    .select('id');
  if (error) throw error;
  if (data && data.length > 0) return { ok: true };
  const { data: current, error: readError } = await db.from('tasks').select(COLS).eq('id', task.id).maybeSingle();
  if (readError) throw readError;
  return { ok: false, current: (current as Task | null) ?? null };
}

export async function deleteTask(db: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await db.from('tasks').delete().eq('id', id).select('id');
  if (error) throw error;
  requireRows(data);
}
```

- [ ] **Step 7: Implement items**

`src/lib/items.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { BUCKET, SIGNED_URL_SECONDS } from './constants';
import { AppError, requireRows } from './errors';
import type { Item } from './types';
import { fileNameFromPath, isFileSizeOk, normalizeLink, storagePathFor } from './validate';

const COLS = 'id,category_id,kind,title,url,storage_path,size_bytes,added_by,created_at';

export async function listItems(db: SupabaseClient): Promise<Item[]> {
  const { data, error } = await db.from('items').select(COLS).order('created_at', { ascending: false });
  if (error) throw error;
  return data as Item[];
}

export async function addLink(
  db: SupabaseClient,
  input: { category_id: string; title: string; url: string; added_by: string },
): Promise<Item> {
  const url = normalizeLink(input.url);
  if (!url) throw new AppError('bad-url');
  const { data, error } = await db
    .from('items')
    .insert({ ...input, url, title: input.title.trim() || url, kind: 'link' })
    .select(COLS)
    .single();
  if (error) throw error;
  return data as Item;
}

/** Upload first, then insert the row; if the insert fails, try to remove the upload (may be refused for the team: harmless orphan). */
export async function addFile(
  db: SupabaseClient,
  input: { category_id: string; title: string; file: Blob; fileName: string; added_by: string },
  id: string = crypto.randomUUID(),
): Promise<Item> {
  if (!isFileSizeOk(input.file.size)) throw new AppError('too-big');
  const path = storagePathFor(input.fileName, id);
  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(path, input.file, { contentType: input.file.type || 'application/octet-stream', upsert: false });
  if (uploadError) throw uploadError;
  const { data, error } = await db
    .from('items')
    .insert({
      category_id: input.category_id,
      kind: 'file',
      title: input.title.trim() || input.fileName,
      storage_path: path,
      size_bytes: input.file.size,
      added_by: input.added_by,
    })
    .select(COLS)
    .single();
  if (error) {
    await db.storage.from(BUCKET).remove([path]);
    throw error;
  }
  return data as Item;
}

export async function fileUrl(db: SupabaseClient, item: Item): Promise<string> {
  if (!item.storage_path) throw new AppError('unknown', 'item has no file');
  const { data, error } = await db.storage
    .from(BUCKET)
    .createSignedUrl(item.storage_path, SIGNED_URL_SECONDS, { download: fileNameFromPath(item.storage_path) });
  if (error) throw error;
  return data.signedUrl;
}

/** Row first, then the stored object; a failed object removal only leaves an invisible orphan. */
export async function deleteItem(db: SupabaseClient, item: Item): Promise<void> {
  const { data, error } = await db.from('items').delete().eq('id', item.id).select('id');
  if (error) throw error;
  requireRows(data);
  if (item.storage_path) await db.storage.from(BUCKET).remove([item.storage_path]);
}
```

- [ ] **Step 8: Implement the browser client**

`src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js';
import { AUTH_STORAGE_KEY } from './constants';

const env = import.meta.env;

if (!env.PUBLIC_SUPABASE_URL || !env.PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('M2proj: PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY are missing (see README → Setup).');
}

export const config = {
  teamEmail: env.PUBLIC_TEAM_EMAIL,
  adminEmail: env.PUBLIC_ADMIN_EMAIL,
};

export const db = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: AUTH_STORAGE_KEY },
});
```

- [ ] **Step 9: Run tests and type-check**

Run: `npm test && npm run check`
Expected: every test file PASS; `0 errors`.

- [ ] **Step 10: Commit**

```bash
git add src/lib tests
git commit -m "feat: Supabase data layer (auth, members, categories, tasks, items)"
```

---

### Task 5: Database schema, Supabase setup and permissions check

**Files:**
- Create: `supabase/schema.sql`, `supabase/roles.sql`, `scripts/check-permissions.ts`, `README.md`

**Interfaces:**
- Consumes: every data-layer function from Task 4, `BUCKET` from Task 3.
- Produces: a configured Supabase project; tables `members`, `categories`, `tasks`, `items`; functions `m2_role()`, `is_member()`, `is_admin()`, `ping()`; private bucket `files`; `.env` filled locally (never committed).

- [ ] **Step 1: Write the permissions check (the test for this task)**

`scripts/check-permissions.ts`:
```ts
// Integration check against the real Supabase project.
// Run: npm run check:permissions   (needs .env with the PUBLIC_* values + M2_TEAM_PASSWORD + M2_ADMIN_PASSWORD)
// Creates and removes its own "zz-check" data. Never run in CI.
import { createClient } from '@supabase/supabase-js';
import { signIn, signOut } from '../src/lib/auth';
import { addCategory, deleteCategory, listCategories } from '../src/lib/categories';
import { BUCKET } from '../src/lib/constants';
import { toAppError, type ErrorCode } from '../src/lib/errors';
import { addFile, addLink, deleteItem, fileUrl, listItems } from '../src/lib/items';
import { addMember, listMembers, renameMember, setMemberActive } from '../src/lib/members';
import { createTask, deleteTask, listTasks, moveTask } from '../src/lib/tasks';

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

  // Logging out one browser must not log out the others (shared account)
  // Access tokens stay valid for up to an hour either way; a *global* sign-out would revoke the refresh token.
  await signOut(team2);
  const { error: refreshError } = await team.auth.refreshSession();
  check('other devices stay logged in after one logs out', refreshError === null);

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
```

- [ ] **Step 2: Write the schema**

`supabase/schema.sql`:
```sql
-- M2proj schema. Run ONCE in the SQL editor of a fresh Supabase project.

-- Roles come from app_metadata.m2proj_role on the two accounts (see supabase/roles.sql).
create or replace function public.m2_role() returns text
language sql stable
as $$ select coalesce(auth.jwt() -> 'app_metadata' ->> 'm2proj_role', '') $$;

create or replace function public.is_member() returns boolean
language sql stable
as $$ select public.m2_role() in ('team', 'admin') $$;

create or replace function public.is_admin() returns boolean
language sql stable
as $$ select public.m2_role() = 'admin' $$;

-- Keep-alive endpoint for the scheduled GitHub Action. Returns no data.
create or replace function public.ping() returns integer
language sql stable
as $$ select 1 $$;

create table public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  position integer not null default 0
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  deadline date,
  status text not null default 'waiting' check (status in ('waiting', 'taken', 'finished')),
  taken_by uuid references public.members (id),
  created_by uuid not null references public.members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint tasks_owner_matches_status check ((status = 'waiting') = (taken_by is null)),
  constraint tasks_finished_at_matches_status check ((status = 'finished') = (finished_at is not null))
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  kind text not null check (kind in ('file', 'link')),
  title text not null check (length(trim(title)) > 0),
  url text check (url ~* '^https?://'),
  storage_path text,
  size_bytes bigint check (size_bytes >= 0),
  added_by uuid not null references public.members (id),
  created_at timestamptz not null default now(),
  constraint items_kind_fields check (
    (kind = 'link' and url is not null and storage_path is null and size_bytes is null)
    or (kind = 'file' and storage_path is not null and url is null and size_bytes is not null)
  )
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql
as $$ begin new.updated_at = now(); return new; end $$;

create trigger tasks_touch_updated_at
before update on public.tasks
for each row execute function public.touch_updated_at();

-- Privileges: nothing for anonymous visitors; RLS decides for logged-in users.
revoke all on public.members, public.categories, public.tasks, public.items from anon;
grant select, insert, update, delete on public.members, public.categories, public.tasks, public.items to authenticated;
grant execute on function public.ping() to anon, authenticated;

alter table public.members enable row level security;
alter table public.categories enable row level security;
alter table public.tasks enable row level security;
alter table public.items enable row level security;

-- members: everyone reads, admin writes, nobody deletes (hide instead)
create policy members_select on public.members for select to authenticated using (public.is_member());
create policy members_insert on public.members for insert to authenticated with check (public.is_admin());
create policy members_update on public.members for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- categories: everyone reads, admin writes and deletes
create policy categories_select on public.categories for select to authenticated using (public.is_member());
create policy categories_insert on public.categories for insert to authenticated with check (public.is_admin());
create policy categories_update on public.categories for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy categories_delete on public.categories for delete to authenticated using (public.is_admin());

-- tasks: everyone reads/adds/edits, admin deletes
create policy tasks_select on public.tasks for select to authenticated using (public.is_member());
create policy tasks_insert on public.tasks for insert to authenticated with check (public.is_member());
create policy tasks_update on public.tasks for update to authenticated using (public.is_member()) with check (public.is_member());
create policy tasks_delete on public.tasks for delete to authenticated using (public.is_admin());

-- items: same as tasks
create policy items_select on public.items for select to authenticated using (public.is_member());
create policy items_insert on public.items for insert to authenticated with check (public.is_member());
create policy items_update on public.items for update to authenticated using (public.is_member()) with check (public.is_member());
create policy items_delete on public.items for delete to authenticated using (public.is_admin());

-- Storage: private bucket, 50 MB per file
insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy "m2proj files select" on storage.objects for select to authenticated
  using (bucket_id = 'files' and public.is_member());
create policy "m2proj files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and public.is_member());
create policy "m2proj files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'files' and public.is_admin());
```

`supabase/roles.sql`:
```sql
-- Run AFTER creating the two accounts in Authentication → Users.
-- If you used other addresses than the defaults, change them here AND in .env / repo variables.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('m2proj_role', case email
       when 'team@m2proj.invalid' then 'team'
       when 'admin@m2proj.invalid' then 'admin'
     end)
where email in ('team@m2proj.invalid', 'admin@m2proj.invalid');

select email, raw_app_meta_data ->> 'm2proj_role' as role from auth.users order by email;
```

- [ ] **Step 3: Write the README (setup section)**

`README.md`:
````markdown
# M2proj

Team hub for the M2 group project: a task board (Waiting / Taken / Finished) and shared files & links.
Live at **https://mosouab.github.io/M2proj/** (exact capitalisation).

## How the team uses it

1. Open the link, type the team password, pick your name. Your browser remembers both.
2. **Board:** drag a card to another column (or use its "Move to…" menu on a phone). Taking a card puts your name on it.
3. **Files:** "+ Add" a file (max 50 MB) or a link into a category.
4. Only the admin can delete things and manage members and categories ("admin" in the top bar).

## Setup (once)

1. Create a free project at https://supabase.com (region: Paris / eu-west-3).
2. SQL editor → paste `supabase/schema.sql` → Run. Expect "Success. No rows returned".
3. Authentication → Users → Add user → Create new user, with **Auto Confirm User** ticked:
   - `team@m2proj.invalid` + the team password
   - `admin@m2proj.invalid` + your admin password
   If the dashboard refuses these addresses, use two addresses you own (e.g. `you+m2team@gmail.com`,
   `you+m2admin@gmail.com`) and use them everywhere below instead.
4. SQL editor → paste `supabase/roles.sql` → Run. The result must show `team` and `admin` in the role column.
5. Authentication → Sign In / Providers → turn **off** "Allow new users to sign up".
6. Project Settings → API: copy the project URL and the anon (or publishable) key.
7. `cp .env.example .env` and fill it in (the two passwords are only used by `npm run check:permissions`).
8. `npm install && npm run check:permissions` → must end with "All checks passed".
9. `npm run dev`, open http://localhost:4321/M2proj/, click "Admin?", log in, add yourself and the team,
   then create the file categories in the admin tab.

## Locking someone out

Change the team password (Authentication → Users → team account), then use "Sign out all sessions"
on that user. Give the new password to the rest of the team.

## Development

- `npm run dev` · `npm test` · `npm run check` · `npm run build`
- Spec and plan: `docs/superpowers/`
````

- [ ] **Step 4: HUMAN CHECKPOINT — Supabase setup**

Stop and ask Mo to do README → Setup steps 1–7 (create the project, run both SQL files, create the two accounts, disable sign-ups, fill `.env`). Do not continue until he confirms `.env` exists. Never print the passwords.

- [ ] **Step 5: Run the permissions check**

Run: `npm run check:permissions`
Expected: every line `PASS`, last line `All checks passed`, exit code 0.
If `anon can call ping()` fails with a permission error, re-run the `grant execute … ping()` line. If `team signs in with role team` fails, `roles.sql` was not run or used other addresses.

- [ ] **Step 6: Commit**

```bash
git add supabase scripts README.md
git commit -m "feat: Supabase schema with RLS, setup guide and permissions check"
```

---

### Task 6: App shell — login, name picker, top bar, language switch

**Files:**
- Create: `src/ui/dom.ts`, `src/ui/toast.ts`, `src/ui/modal.ts`, `src/ui/run.ts`, `src/ui/router.ts`, `src/ui/store.ts`, `src/ui/view.ts`, `src/ui/topbar.ts`, `src/ui/login-view.ts`, `src/ui/picker-view.ts`, `src/ui/main.ts`, `src/styles/app.css`
- Create (stubs replaced in Tasks 7–9): `src/ui/board-view.ts`, `src/ui/files-view.ts`, `src/ui/admin-view.ts`
- Modify: `src/pages/index.astro` (replace whole file)
- Test: `tests/dom.test.ts`, `tests/toast.test.ts`, `tests/router.test.ts`, `tests/picker.test.ts`

**Interfaces:**
- Consumes: data layer (Task 4), i18n (Task 3), `db`/`config` from `supabase.ts`.
- Produces:
  - `dom.ts`: `h(tag, attrs?, ...children)` (strings always become text nodes; `on*` function attrs become listeners; `false/null/undefined` attrs skipped; `true` → empty attribute), `field(label: string, control: HTMLElement): HTMLLabelElement`
  - `toast.ts`: `toast(message: string, kind?: 'info' | 'error'): void` (inside the top-most open `<dialog>` if any)
  - `modal.ts`: `openModal(title: string, body: Node, onClose?: () => void): { dialog: HTMLDialogElement; close(): void }`, `confirmModal(message: string, confirmLabel: string): Promise<boolean>`
  - `run.ts`: `type RunResult<T> = { ok: true; value: T } | { ok: false; error: AppError }`, `run<T>(fn: () => Promise<T>): Promise<RunResult<T>>` (toasts errors; calls the auth-lost handler on `auth`), `setAuthLostHandler(fn: () => void): void`
  - `router.ts`: `type Route = 'board' | 'files' | 'admin'`, `parseRoute(hash: string, role: Role): Route`
  - `store.ts`: `interface AppState { role; meId; members; categories; tasks; items }`, `state: AppState`, `memberName(id: string | null): string`
  - `view.ts`: `interface ViewContext { refresh(): Promise<void> }`
  - `topbar.ts`: `renderTopbar(props: TopbarProps): HTMLElement`, `langSwitch(): HTMLElement`
  - `login-view.ts`: `type LoginMode = 'team' | 'admin'`, `renderLogin(root, props: LoginProps)`
  - `picker-view.ts`: `renderPicker(root, props: PickerProps)`
  - view entry points used by `main.ts`: `renderBoard(root: HTMLElement, ctx: ViewContext)`, `renderFiles(root, ctx)`, `renderAdmin(root, ctx)`

- [ ] **Step 1: Write the failing tests**

`tests/dom.test.ts`:
```ts
// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { h } from '../src/ui/dom';

describe('h', () => {
  it('renders strings as text, never as HTML', () => {
    const el = h('p', {}, '<img src=x onerror=alert(1)>');
    expect(el.children).toHaveLength(0);
    expect(el.textContent).toBe('<img src=x onerror=alert(1)>');
  });
  it('skips false/null/undefined attributes and sets true as empty', () => {
    const el = h('button', { disabled: true, hidden: false, title: null, 'data-x': undefined });
    expect(el.hasAttribute('disabled')).toBe(true);
    expect(el.hasAttribute('hidden')).toBe(false);
    expect(el.hasAttribute('title')).toBe(false);
  });
  it('attaches event handlers', () => {
    const onClick = vi.fn();
    const el = h('button', { onclick: onClick });
    el.click();
    expect(onClick).toHaveBeenCalledOnce();
  });
  it('flattens arrays and skips empty children', () => {
    const el = h('ul', {}, [h('li', {}, 'a'), null, false], undefined, h('li', {}, 'b'), 3);
    expect(el.textContent).toBe('ab3');
  });
});
```

`tests/toast.test.ts`:
```ts
// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { toast } from '../src/ui/toast';

afterEach(() => {
  document.body.replaceChildren();
});

describe('toast', () => {
  it('shows the message on the page when no modal is open', () => {
    toast('saved');
    expect(document.querySelector('body > .toasts .toast')?.textContent).toBe('saved');
  });
  it('shows errors inside an open modal so they are not hidden behind it', () => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.append(dialog);
    toast('upload failed', 'error');
    expect(dialog.querySelector('.toast.error')?.textContent).toBe('upload failed');
  });
});
```

`tests/router.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseRoute } from '../src/ui/router';

describe('parseRoute', () => {
  it('defaults to the board', () => {
    expect(parseRoute('', 'team')).toBe('board');
    expect(parseRoute('#nonsense', 'team')).toBe('board');
  });
  it('opens files for everyone', () => {
    expect(parseRoute('#files', 'team')).toBe('files');
  });
  it('opens admin only for the admin', () => {
    expect(parseRoute('#admin', 'admin')).toBe('admin');
    expect(parseRoute('#admin', 'team')).toBe('board');
  });
});
```

`tests/picker.test.ts`:
```ts
// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { renderPicker } from '../src/ui/picker-view';

const noop = () => {};

describe('renderPicker', () => {
  it('lets the admin add a name when there are no members yet (first login)', () => {
    const root = document.createElement('div');
    renderPicker(root, { members: [], canAdd: true, onPick: noop, onAdd: async () => {} });
    expect(root.querySelector('form input')).not.toBeNull();
  });
  it('shows the team a message and no form when there are no members', () => {
    const root = document.createElement('div');
    renderPicker(root, { members: [], canAdd: false, onPick: noop, onAdd: async () => {} });
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('.picker-empty')).not.toBeNull();
  });
  it('sends the trimmed name to onAdd', async () => {
    const root = document.createElement('div');
    const onAdd = vi.fn(async () => {});
    renderPicker(root, { members: [], canAdd: true, onPick: noop, onAdd });
    const input = root.querySelector('form input') as HTMLInputElement;
    input.value = '  Mo  ';
    root.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await Promise.resolve();
    expect(onAdd).toHaveBeenCalledWith('Mo');
  });
  it('picks a member by clicking their name', () => {
    const root = document.createElement('div');
    const onPick = vi.fn();
    renderPicker(root, { members: [{ id: 'a', name: 'Léa', active: true }], canAdd: false, onPick, onAdd: async () => {} });
    (root.querySelector('.picker button') as HTMLButtonElement).click();
    expect(onPick).toHaveBeenCalledWith('a');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/dom.test.ts tests/toast.test.ts tests/router.test.ts tests/picker.test.ts`
Expected: FAIL — unresolved imports.

- [ ] **Step 3: Implement the DOM helpers, toast, modal, run, router, store, view**

`src/ui/dom.ts`:
```ts
type Child = Node | string | number | null | undefined | false;
type AttrValue = string | number | boolean | ((e: Event) => unknown) | null | undefined;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, AttrValue> = {},
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (typeof value === 'function') {
      el.addEventListener(key.replace(/^on/, ''), value as EventListener);
    } else {
      el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'number' ? String(child) : child);
  }
  return el;
}

export function field(label: string, control: HTMLElement): HTMLLabelElement {
  return h('label', { class: 'field' }, h('span', {}, label), control);
}
```

`src/ui/toast.ts`:
```ts
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
```

`src/ui/modal.ts`:
```ts
import { t } from '../i18n';
import { h } from './dom';

export interface ModalHandle {
  dialog: HTMLDialogElement;
  close(): void;
}

export function openModal(title: string, body: Node, onClose?: () => void): ModalHandle {
  const dialog = h(
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
```

`src/ui/run.ts`:
```ts
import { t } from '../i18n';
import { toAppError, type AppError } from '../lib/errors';
import { toast } from './toast';

export type RunResult<T> = { ok: true; value: T } | { ok: false; error: AppError };

let onAuthLost: () => void = () => {};

export function setAuthLostHandler(fn: () => void): void {
  onAuthLost = fn;
}

/** Runs a data call; shows a translated toast on failure, sends the user to login if the session is gone. */
export async function run<T>(fn: () => Promise<T>): Promise<RunResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    console.error(e);
    const error = toAppError(e);
    if (error.code === 'auth') onAuthLost();
    else toast(t(`error.${error.code}`), 'error');
    return { ok: false, error };
  }
}
```

`src/ui/router.ts`:
```ts
import type { Role } from '../lib/auth';

export type Route = 'board' | 'files' | 'admin';

export function parseRoute(hash: string, role: Role): Route {
  const route = hash.replace(/^#/, '');
  if (route === 'files') return 'files';
  if (route === 'admin' && role === 'admin') return 'admin';
  return 'board';
}
```

`src/ui/store.ts`:
```ts
import type { Role } from '../lib/auth';
import type { Category, Item, Member, Task } from '../lib/types';

export interface AppState {
  role: Role;
  meId: string | null;
  members: Member[];
  categories: Category[];
  tasks: Task[];
  items: Item[];
}

export const state: AppState = { role: null, meId: null, members: [], categories: [], tasks: [], items: [] };

export function memberName(id: string | null): string {
  if (!id) return '';
  return state.members.find((m) => m.id === id)?.name ?? '?';
}
```

`src/ui/view.ts`:
```ts
export interface ViewContext {
  /** Reload everything from Supabase and re-render the current view. */
  refresh(): Promise<void>;
}
```

- [ ] **Step 4: Implement top bar, login and picker**

`src/ui/topbar.ts`:
```ts
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
```

`src/ui/login-view.ts`:
```ts
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
```

`src/ui/picker-view.ts`:
```ts
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/dom.test.ts tests/toast.test.ts tests/router.test.ts tests/picker.test.ts`
Expected: PASS.

- [ ] **Step 6: Add view stubs, main entry, page and styles**

Stubs (replaced by Tasks 7–9). `src/ui/board-view.ts`:
```ts
import { h } from './dom';
import type { ViewContext } from './view';

export function renderBoard(root: HTMLElement, _ctx: ViewContext): void {
  root.replaceChildren(h('p', { class: 'label' }, 'board'));
}
```
`src/ui/files-view.ts`:
```ts
import { h } from './dom';
import type { ViewContext } from './view';

export function renderFiles(root: HTMLElement, _ctx: ViewContext): void {
  root.replaceChildren(h('p', { class: 'label' }, 'files'));
}
```
`src/ui/admin-view.ts`:
```ts
import { h } from './dom';
import type { ViewContext } from './view';

export function renderAdmin(root: HTMLElement, _ctx: ViewContext): void {
  root.replaceChildren(h('p', { class: 'label' }, 'admin'));
}
```

`src/ui/main.ts`:
```ts
import { getLang, t } from '../i18n';
import { currentRole, signIn, signOut } from '../lib/auth';
import { listCategories } from '../lib/categories';
import { LS_MEMBER } from '../lib/constants';
import { toAppError } from '../lib/errors';
import { listItems } from '../lib/items';
import { readLocal, writeLocal } from '../lib/local';
import { addMember, listMembers, pickValidMember } from '../lib/members';
import { config, db } from '../lib/supabase';
import { listTasks } from '../lib/tasks';
import { renderAdmin } from './admin-view';
import { renderBoard } from './board-view';
import { h } from './dom';
import { renderFiles } from './files-view';
import { renderLogin, type LoginMode } from './login-view';
import { renderPicker } from './picker-view';
import { parseRoute } from './router';
import { run, setAuthLostHandler } from './run';
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
  state.meId = pickValidMember(readLocal(LS_MEMBER), state.members);
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
  await signOut(db).catch(() => undefined);
  state.role = null;
  history.replaceState(null, '', location.pathname);
  showLogin();
}

setAuthLostHandler(() => {
  state.role = null;
  toast(t('error.auth'), 'error');
  void signOut(db).catch(() => undefined);
  showLogin();
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
```

`src/pages/index.astro` (replace the whole file):
```astro
---
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import '@fontsource/geist-mono/700.css';
import '@fontsource-variable/doto';
import '../styles/global.css';
import '../styles/app.css';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
---

<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <link rel="icon" type="image/svg+xml" href={`${base}/favicon.svg`} />
    <title>M2proj</title>
  </head>
  <body>
    <div id="app"><div class="center"><p class="label">M2proj</p></div></div>
    <noscript><p class="wrap">JavaScript est nécessaire. / JavaScript is required.</p></noscript>
    <script>
      import '../ui/main';
    </script>
  </body>
</html>
```

`src/styles/app.css` (all app styles; Tasks 7–9 only use these classes):
```css
.muted { color: var(--muted); }
.small { font-size: 11.5px; }

/* ---------- top bar ---------- */
.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
}
.topbar .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 22px; padding-top: 12px; padding-bottom: 12px; }
.brand { font-family: var(--font-display); font-variation-settings: 'ROND' 100; font-weight: 900; font-size: 17px; color: var(--ink); text-decoration: none; }
.brand.big { font-size: 40px; margin: 0 0 4px; line-height: 1.1; }
.tabs { display: flex; gap: 14px; font-size: 11.5px; }
.tab { text-decoration: none; color: var(--soft); }
.tab:hover { background: none; }
.tab.active .fn, .tab:hover .fn { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
.paren { color: var(--muted); }
.tools { margin-left: auto; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; font-size: 11.5px; }
.link-btn { background: none; border: none; padding: 0; font: inherit; color: var(--fg); cursor: pointer; }
.link-btn:hover { text-decoration: underline; text-underline-offset: 3px; }
.langs { display: inline-flex; gap: 4px; align-items: center; }
.lang { background: none; border: none; padding: 0 2px; font: inherit; color: var(--muted); cursor: pointer; }
.lang.active { color: var(--ink); font-weight: 700; }
.badge { border: 1px solid var(--accent); color: var(--accent); border-radius: var(--radius); padding: 1px 6px; font-size: 10.5px; letter-spacing: 0.1em; }
@media (max-width: 560px) { .tools { margin-left: 0; width: 100%; } }

/* ---------- views ---------- */
.view { padding-top: 28px; padding-bottom: 56px; }
.view-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 18px; }
.view-head .label { margin: 0; }
.empty { font-size: 11.5px; color: var(--muted); margin: 4px 2px; }

/* ---------- board ---------- */
.board { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; align-items: start; }
.column { background: #16161605; border: 1px solid var(--border); border-radius: var(--radius); padding: 12px; }
.col-head { font-family: var(--font-display); font-variation-settings: 'ROND' 100; font-weight: 800; font-size: 15px; margin: 0 0 12px; letter-spacing: 0.04em; text-transform: uppercase; }
.col-head .marker { font-family: var(--font-mono); font-weight: 500; color: var(--muted); }
.col-taken .marker { color: var(--ink); }
.col-finished .marker { color: var(--accent); }
.col-head .count { font-family: var(--font-mono); font-weight: 400; font-size: 12px; color: var(--muted); }
.card-list { display: flex; flex-direction: column; gap: 8px; min-height: 64px; }
.card { background: var(--surface); border: 1px solid var(--border-dark); border-radius: var(--radius); padding: 10px 12px; cursor: grab; transition: transform 0.15s ease, box-shadow 0.15s ease; }
.card:hover { transform: translate(-1px, -1px); box-shadow: 2px 2px 0 0 var(--border-dark); }
.card:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.card h3 { font-size: 13px; font-weight: 500; margin: 0 0 4px; overflow-wrap: anywhere; }
.card .meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 11.5px; color: var(--soft); }
.card .owner { font-size: 11.5px; color: var(--fg); margin-top: 2px; }
.card .move { margin-top: 8px; width: 100%; font: inherit; font-size: 11px; color: var(--soft); background: transparent; border: 1px dashed var(--border-dark); border-radius: var(--radius); padding: 3px 6px; cursor: pointer; }
.card.late { border-color: var(--danger); }
.late-tag { color: var(--danger); font-weight: 700; letter-spacing: 0.08em; }
.col-finished .card h3 { color: var(--soft); text-decoration: line-through; text-decoration-color: var(--muted); }
.card-ghost { opacity: 0.4; }
@media (max-width: 760px) { .board { grid-template-columns: 1fr; } }

/* ---------- forms & modals ---------- */
.modal { border: 1px solid var(--border-dark); border-radius: var(--radius); padding: 18px 20px 20px; width: min(520px, calc(100vw - 32px)); background: var(--surface); color: var(--fg); box-shadow: 4px 4px 0 0 var(--border-dark); }
.modal::backdrop { background: #16161640; }
.modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.modal-head h2 { font-size: 15px; margin: 0; }
.icon-btn { background: none; border: none; font: inherit; font-size: 20px; line-height: 1; cursor: pointer; color: var(--soft); }
.form { display: flex; flex-direction: column; gap: 12px; }
.field { display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; color: var(--soft); }
input[type='text'], input[type='password'], input[type='date'], textarea, select {
  font: inherit; font-size: 13px; color: var(--fg); background: var(--surface);
  border: 1px solid var(--border-dark); border-radius: var(--radius); padding: 7px 9px; width: 100%;
}
input:focus-visible, textarea:focus-visible, select:focus-visible { outline: 2px solid var(--ink); outline-offset: -1px; }
textarea { resize: vertical; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
.modal-actions .danger { margin-right: auto; }
.form-error { color: var(--danger); font-size: 12px; margin: 0; }
.form-error:empty { display: none; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
.btn.small { padding: 4px 10px; font-size: 11.5px; }
.btn.danger { background: var(--surface); color: var(--danger); border-color: var(--danger); }
.btn.danger:hover { background: var(--danger); color: var(--surface); }
.seg { display: inline-flex; border: 1px solid var(--border-dark); border-radius: var(--radius); align-self: flex-start; }
.seg-btn { background: none; border: none; font: inherit; font-size: 12px; padding: 5px 12px; cursor: pointer; color: var(--soft); }
.seg-btn.active { background: var(--ink); color: var(--bg); }
.inline-form { display: flex; gap: 8px; margin-top: 12px; }
.inline-form input { flex: 1; min-width: 0; }

/* ---------- login & picker ---------- */
.center { min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; position: relative; }
.corner { position: absolute; top: 16px; right: 16px; font-size: 11.5px; }
.login-card { width: min(380px, 100%); background: var(--surface); border: 1px solid var(--border-dark); border-radius: var(--radius); padding: 26px 24px; display: flex; flex-direction: column; gap: 14px; box-shadow: 4px 4px 0 0 var(--border-dark); }
.login-card .label { margin: 0; }
.login-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.picker { display: flex; flex-wrap: wrap; gap: 8px; }

/* ---------- files ---------- */
.file-group { margin-bottom: 22px; }
.group-head { font-size: 13px; font-weight: 700; margin: 0 0 8px; }
.group-head .count { color: var(--muted); font-weight: 400; }
.file-list { list-style: none; margin: 0; padding: 0; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
.file-row { display: flex; align-items: center; gap: 12px; padding: 9px 12px; border-top: 1px solid var(--border); }
.file-row:first-child { border-top: none; }
.kind { color: var(--muted); font-size: 11.5px; flex: none; }
.file-main { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.file-title { overflow-wrap: anywhere; color: var(--ink); }
.file-actions { display: flex; gap: 6px; flex: none; }
@media (max-width: 560px) { .file-row { flex-wrap: wrap; } .file-actions { width: 100%; justify-content: flex-end; } }

/* ---------- admin ---------- */
.admin-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 14px; }
.panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
.panel h2 { font-size: 13px; margin: 0 0 10px; }
.admin-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.admin-row { display: flex; gap: 6px; align-items: center; }
.admin-row input { flex: 1; min-width: 0; }
.admin-row.inactive input { color: var(--muted); text-decoration: line-through; }
@media (max-width: 760px) { .admin-grid { grid-template-columns: 1fr; } .admin-row { flex-wrap: wrap; } }

/* ---------- toasts ---------- */
.toasts { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 8px; z-index: 100; width: min(440px, calc(100vw - 32px)); }
.toast { background: var(--ink); color: var(--bg); border-radius: var(--radius); padding: 10px 14px; font-size: 12.5px; box-shadow: 3px 3px 0 0 var(--border-dark); }
.toast.error { background: var(--danger); }
```

- [ ] **Step 7: Type-check, test and verify in the browser**

Run: `npm test && npm run check && npm run build`
Expected: PASS, `0 errors`, build OK.

Then `npm run dev` and open `http://localhost:4321/M2proj/` (Claude in Chrome if available, otherwise ask Mo). Check:
1. Login card in the site's style (dotted background, Doto "M2proj", mono font); FR/EN switch changes every label.
2. Wrong password → "Mot de passe incorrect." under the field.
3. "Admin?" → admin password → "Qui es-tu ?" with an add form → add "Mo" → click "Mo" → top bar with `.tableau()` `.fichiers()` `.admin()`, `~ Mo (changer)`, `ADMIN` badge.
4. Reload the page → goes straight to the board (session + name remembered).
5. `.quitter()` → back to team login; team password → board directly (name still remembered).
6. At 375px width (DevTools device mode) nothing scrolls horizontally.

- [ ] **Step 8: Commit**

```bash
git add src tests
git commit -m "feat: app shell with login, name picker, top bar and FR/EN switch"
```

---

### Task 7: Board — columns, cards, drag and drop, task form

**Files:**
- Modify: `src/ui/board-view.ts` (replace stub)
- Create: `src/ui/task-form.ts`

**Interfaces:**
- Consumes: `moveTask`, `createTask`, `updateTaskFields`, `deleteTask`, `TaskFields` (Task 4); `STATUSES`, `groupByStatus`, `isLate`, `todayLocal` (Task 1); `h`, `field`, `openModal`, `confirmModal`, `run`, `toast`, `state`, `memberName`, `ViewContext` (Task 6); `t`, `formatDay` (Task 3).
- Produces: `renderBoard(root: HTMLElement, ctx: ViewContext): void`, `MARKERS: Record<Status, string>`, `openTaskForm(task: Task | null, ctx: ViewContext): void`

- [ ] **Step 1: Write the task form**

`src/ui/task-form.ts`:
```ts
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
```

- [ ] **Step 2: Write the board**

`src/ui/board-view.ts` (replace the stub):
```ts
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
```

- [ ] **Step 3: Type-check and build**

Run: `npm test && npm run check && npm run build`
Expected: PASS, `0 errors`.

- [ ] **Step 4: Verify in the browser**

`npm run dev`, log in, then check:
1. "+ Nouvelle tâche" → title only → it appears in **En attente** with no owner. Whitespace-only title shows "Le titre est obligatoire."
2. Drag it to **Pris** → it shows `~ Mo`. Drag to **Terminé** → "fait par Mo", title struck through. Drag back to **En attente** → owner gone.
3. Set a deadline of yesterday → red border and "EN RETARD"; move it to Terminé → no longer red.
4. The "Déplacer vers…" menu moves a card the same way and does **not** open the edit modal.
5. Click a card → edit modal with "Créée par Mo"; change the title → saved.
6. Race: open the app in a second browser profile (same team password, other name), both see a waiting card; take it in one, then drag it in the other → toast "Déjà pris par …" and the card snaps to Pris.
7. As admin, the edit modal has "Supprimer" → confirm → card gone. As team, no delete button.
8. Phone width (375px): columns stacked; scrolling the page with a finger does not start a drag (long-press does).

- [ ] **Step 5: Commit**

```bash
git add src/ui/board-view.ts src/ui/task-form.ts
git commit -m "feat: task board with drag and drop, move menu and task form"
```

---

### Task 8: Files and links

**Files:**
- Modify: `src/ui/files-view.ts` (replace stub)
- Create: `src/ui/item-form.ts`

**Interfaces:**
- Consumes: `addFile`, `addLink`, `fileUrl`, `deleteItem` (Task 4); `isFileSizeOk`, `normalizeLink` (Task 2); `formatSize`, `formatTimestamp`, `t` (Task 3); UI helpers (Task 6).
- Produces: `renderFiles(root: HTMLElement, ctx: ViewContext): void`, `openItemForm(ctx: ViewContext): void`

- [ ] **Step 1: Write the add form**

`src/ui/item-form.ts`:
```ts
import { t } from '../i18n';
import { addFile, addLink } from '../lib/items';
import { db } from '../lib/supabase';
import type { Item, ItemKind } from '../lib/types';
import { isFileSizeOk, normalizeLink } from '../lib/validate';
import { field, h } from './dom';
import { openModal } from './modal';
import { run } from './run';
import { state } from './store';
import type { ViewContext } from './view';

export function openItemForm(ctx: ViewContext): void {
  let kind: ItemKind = 'file';
  const fileInput = h('input', { type: 'file' });
  const urlInput = h('input', { type: 'text', inputmode: 'url', placeholder: 'https://…' });
  const titleInput = h('input', { type: 'text', maxlength: 200 });
  const categorySelect = h('select', {}, state.categories.map((c) => h('option', { value: c.id }, c.name)));
  const error = h('p', { class: 'form-error', role: 'alert' });
  const fileField = field(t('files.file'), fileInput);
  const urlField = field(t('files.url'), urlInput);
  urlField.hidden = true;

  const fileBtn = h('button', { type: 'button', class: 'seg-btn active', onclick: () => setKind('file') }, t('files.kindFile'));
  const linkBtn = h('button', { type: 'button', class: 'seg-btn', onclick: () => setKind('link') }, t('files.kindLink'));
  function setKind(next: ItemKind): void {
    kind = next;
    fileField.hidden = next !== 'file';
    urlField.hidden = next !== 'link';
    fileBtn.classList.toggle('active', next === 'file');
    linkBtn.classList.toggle('active', next === 'link');
    error.textContent = '';
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file && !titleInput.value) titleInput.value = file.name;
    error.textContent = file && !isFileSizeOk(file.size) ? t('error.too-big') : '';
  });

  const save = h('button', { class: 'btn', type: 'submit' }, t('files.add'));
  const form = h(
    'form',
    {
      class: 'form',
      onsubmit: async (e: Event) => {
        e.preventDefault();
        error.textContent = '';
        const category_id = categorySelect.value;
        const added_by = state.meId as string;
        let action: () => Promise<Item>;
        if (kind === 'file') {
          const file = fileInput.files?.[0];
          if (!file) {
            error.textContent = t('files.pickFile');
            return;
          }
          if (!isFileSizeOk(file.size)) {
            error.textContent = t('error.too-big');
            return;
          }
          const title = titleInput.value.trim() || file.name;
          action = () => addFile(db, { category_id, title, file, fileName: file.name, added_by });
        } else {
          const url = normalizeLink(urlInput.value);
          if (!url) {
            error.textContent = t('error.bad-url');
            return;
          }
          const title = titleInput.value.trim() || url;
          action = () => addLink(db, { category_id, title, url, added_by });
        }
        save.disabled = true;
        save.textContent = t('files.uploading');
        const r = await run(action);
        save.disabled = false;
        save.textContent = t('files.add');
        if (r.ok) {
          modal.close();
          await ctx.refresh();
        }
      },
    },
    h('div', { class: 'seg' }, fileBtn, linkBtn),
    fileField,
    urlField,
    field(t('files.title'), titleInput),
    field(t('files.category'), categorySelect),
    error,
    h('div', { class: 'modal-actions' }, save),
  );

  const modal = openModal(t('files.add'), form);
}
```

- [ ] **Step 2: Write the files view**

`src/ui/files-view.ts` (replace the stub):
```ts
import { formatSize, formatTimestamp, t } from '../i18n';
import { deleteItem, fileUrl } from '../lib/items';
import { db } from '../lib/supabase';
import type { Item } from '../lib/types';
import { h } from './dom';
import { openItemForm } from './item-form';
import { confirmModal } from './modal';
import { run } from './run';
import { memberName, state } from './store';
import type { ViewContext } from './view';

export function renderFiles(root: HTMLElement, ctx: ViewContext): void {
  const head = h(
    'div',
    { class: 'view-head' },
    h('p', { class: 'label' }, t('files.label')),
    h('button', { class: 'btn', type: 'button', disabled: state.categories.length === 0, onclick: () => openItemForm(ctx) }, t('files.add')),
  );
  if (state.categories.length === 0) {
    root.replaceChildren(head, h('p', { class: 'empty' }, t('files.noCategories')));
    return;
  }
  const groups = state.categories.map((category) => {
    const items = state.items.filter((i) => i.category_id === category.id);
    return h(
      'section',
      { class: 'file-group' },
      h('h2', { class: 'group-head' }, category.name, h('span', { class: 'count' }, ` (${items.length})`)),
      items.length
        ? h('ul', { class: 'file-list' }, items.map((item) => renderItem(item, ctx)))
        : h('p', { class: 'empty' }, t('files.emptyCategory')),
    );
  });
  root.replaceChildren(head, ...groups);
}

function renderItem(item: Item, ctx: ViewContext): HTMLElement {
  const meta = [
    memberName(item.added_by),
    formatTimestamp(item.created_at),
    item.kind === 'file' && item.size_bytes !== null ? formatSize(item.size_bytes) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const open =
    item.kind === 'link'
      ? h('a', { class: 'btn ghost small', href: item.url ?? '#', target: '_blank', rel: 'noopener noreferrer' }, t('files.open'))
      : h(
          'button',
          {
            class: 'btn ghost small',
            type: 'button',
            onclick: async () => {
              // Navigate instead of window.open: popup blockers stop window.open after an await.
              const r = await run(() => fileUrl(db, item));
              if (r.ok) window.location.assign(r.value);
            },
          },
          t('files.download'),
        );

  const remove =
    state.role === 'admin'
      ? h(
          'button',
          {
            class: 'btn danger small',
            type: 'button',
            onclick: async () => {
              if (!(await confirmModal(t('files.confirmDelete', { title: item.title }), t('common.delete')))) return;
              const r = await run(() => deleteItem(db, item));
              if (r.ok) await ctx.refresh();
            },
          },
          t('common.delete'),
        )
      : null;

  return h(
    'li',
    { class: 'file-row' },
    h('span', { class: 'kind' }, item.kind === 'file' ? '[f]' : '[↗]'),
    h('div', { class: 'file-main' }, h('span', { class: 'file-title' }, item.title), h('span', { class: 'muted small' }, meta)),
    h('div', { class: 'file-actions' }, open, remove),
  );
}
```

- [ ] **Step 3: Type-check and build**

Run: `npm test && npm run check && npm run build`
Expected: PASS, `0 errors`.

- [ ] **Step 4: Verify in the browser**

(Needs at least one category: create it in Supabase's table editor for now, or do Task 9 first and come back.)
1. With no categories: "+ Ajouter" is disabled and the empty message shows.
2. Add a file named `Compte rendu réunion.pdf` → row shows title, "Mo · date · size"; "Télécharger" downloads `Compte-rendu-reunion.pdf` and the page stays.
3. Choose a file > 50 MB → "Fichier trop lourd (50 Mo max)." immediately, nothing uploaded.
4. Add link `docs.google.com/document/d/x` → stored as `https://…`; "Ouvrir" opens a new tab. `javascript:alert(1)` → "Ce lien ne semble pas valide."
5. Turn the network off (DevTools → Offline) and add a link → the error toast is visible **above** the modal.
6. As admin, "Supprimer" removes a row after confirmation; as team there is no delete button.

- [ ] **Step 5: Commit**

```bash
git add src/ui/files-view.ts src/ui/item-form.ts
git commit -m "feat: files and links by category with upload, download and admin delete"
```

---

### Task 9: Admin page — members and categories

**Files:**
- Modify: `src/ui/admin-view.ts` (replace stub)

**Interfaces:**
- Consumes: `addMember`, `renameMember`, `setMemberActive` (members.ts), `addCategory`, `renameCategory`, `swapCategoryPositions`, `deleteCategory` (categories.ts), UI helpers.
- Produces: `renderAdmin(root: HTMLElement, ctx: ViewContext): void`

- [ ] **Step 1: Write the admin view**

`src/ui/admin-view.ts` (replace the stub):
```ts
import { t } from '../i18n';
import { addCategory, deleteCategory, renameCategory, swapCategoryPositions } from '../lib/categories';
import { addMember, renameMember, setMemberActive } from '../lib/members';
import { db } from '../lib/supabase';
import type { Category } from '../lib/types';
import { h } from './dom';
import { confirmModal } from './modal';
import { run } from './run';
import { state } from './store';
import type { ViewContext } from './view';

export function renderAdmin(root: HTMLElement, ctx: ViewContext): void {
  root.replaceChildren(h('p', { class: 'label' }, t('admin.label')), h('div', { class: 'admin-grid' }, membersPanel(ctx), categoriesPanel(ctx)));
}

async function act(ctx: ViewContext, fn: () => Promise<unknown>): Promise<void> {
  const r = await run(fn);
  if (r.ok) await ctx.refresh();
}

function addForm(placeholder: string, onAdd: (name: string) => Promise<void>): HTMLFormElement {
  const input = h('input', { type: 'text', maxlength: 60, placeholder, 'aria-label': placeholder });
  return h(
    'form',
    {
      class: 'inline-form',
      onsubmit: async (e: Event) => {
        e.preventDefault();
        const name = input.value.trim();
        if (name) await onAdd(name);
      },
    },
    input,
    h('button', { class: 'btn', type: 'submit' }, t('common.add')),
  );
}

function membersPanel(ctx: ViewContext): HTMLElement {
  const rows = state.members.map((m) => {
    const name = h('input', { type: 'text', value: m.name, maxlength: 60, 'aria-label': t('admin.memberName') });
    return h(
      'li',
      { class: m.active ? 'admin-row' : 'admin-row inactive' },
      name,
      h(
        'button',
        {
          class: 'btn ghost small',
          type: 'button',
          onclick: () => {
            const next = name.value.trim();
            if (next && next !== m.name) void act(ctx, () => renameMember(db, m.id, next));
          },
        },
        t('common.save'),
      ),
      h(
        'button',
        { class: 'btn ghost small', type: 'button', onclick: () => void act(ctx, () => setMemberActive(db, m.id, !m.active)) },
        m.active ? t('admin.deactivate') : t('admin.reactivate'),
      ),
    );
  });
  return h(
    'section',
    { class: 'panel' },
    h('h2', {}, t('admin.members')),
    h('ul', { class: 'admin-list' }, rows),
    addForm(t('admin.memberName'), (name) => act(ctx, () => addMember(db, name))),
  );
}

function categoriesPanel(ctx: ViewContext): HTMLElement {
  const cats: Category[] = state.categories;
  const rows = cats.map((c, i) => {
    const name = h('input', { type: 'text', value: c.name, maxlength: 60, 'aria-label': t('admin.categoryName') });
    return h(
      'li',
      { class: 'admin-row' },
      name,
      h(
        'button',
        {
          class: 'btn ghost small',
          type: 'button',
          onclick: () => {
            const next = name.value.trim();
            if (next && next !== c.name) void act(ctx, () => renameCategory(db, c.id, next));
          },
        },
        t('common.save'),
      ),
      h(
        'button',
        { class: 'btn ghost small', type: 'button', disabled: i === 0, 'aria-label': t('admin.moveUp'), onclick: () => void act(ctx, () => swapCategoryPositions(db, cats[i - 1], c)) },
        '↑',
      ),
      h(
        'button',
        { class: 'btn ghost small', type: 'button', disabled: i === cats.length - 1, 'aria-label': t('admin.moveDown'), onclick: () => void act(ctx, () => swapCategoryPositions(db, c, cats[i + 1])) },
        '↓',
      ),
      h(
        'button',
        {
          class: 'btn danger small',
          type: 'button',
          onclick: async () => {
            if (await confirmModal(t('admin.confirmDeleteCategory', { name: c.name }), t('common.delete'))) {
              await act(ctx, () => deleteCategory(db, c.id));
            }
          },
        },
        t('common.delete'),
      ),
    );
  });
  return h(
    'section',
    { class: 'panel' },
    h('h2', {}, t('admin.categories')),
    h('ul', { class: 'admin-list' }, rows),
    addForm(t('admin.categoryName'), (name) => act(ctx, () => addCategory(db, name, cats))),
  );
}
```

- [ ] **Step 2: Type-check and build**

Run: `npm test && npm run check && npm run build`
Expected: PASS, `0 errors`.

- [ ] **Step 3: Verify in the browser (as admin)**

1. Add members "Léa", "Sami"; rename "Sami" → "Samy"; "Masquer" greys it out and it disappears from "Qui es-tu ?" (check via "(changer)").
2. Add categories "Du prof", "Livrables", "Ressources", "Comptes rendus"; ↑/↓ reorders them and the Files tab follows the order.
3. Delete a category that has a file → toast "Cette catégorie n'est pas vide…"; delete an empty one → gone.
4. As team, `#admin` in the URL shows the board, and there is no admin tab.

- [ ] **Step 4: Commit**

```bash
git add src/ui/admin-view.ts
git commit -m "feat: admin page for members and categories"
```

---

### Task 10: Deploy to GitHub Pages and keep Supabase awake

**Files:**
- Create: `.github/workflows/deploy.yml`, `.github/workflows/keepalive.yml`
- Modify: `README.md` (append "Deploy" section)

**Interfaces:**
- Consumes: the whole app; `public.ping()` from Task 5.
- Produces: live site at `https://mosouab.github.io/M2proj/`; scheduled ping every 3 days.

- [ ] **Step 1: Write the deploy workflow**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run check

  build:
    needs: test
    runs-on: ubuntu-latest
    env:
      PUBLIC_SUPABASE_URL: ${{ vars.PUBLIC_SUPABASE_URL }}
      PUBLIC_SUPABASE_ANON_KEY: ${{ vars.PUBLIC_SUPABASE_ANON_KEY }}
      PUBLIC_TEAM_EMAIL: ${{ vars.PUBLIC_TEAM_EMAIL }}
      PUBLIC_ADMIN_EMAIL: ${{ vars.PUBLIC_ADMIN_EMAIL }}
    steps:
      - name: Refuse to build without the Supabase settings
        run: |
          for v in PUBLIC_SUPABASE_URL PUBLIC_SUPABASE_ANON_KEY PUBLIC_TEAM_EMAIL PUBLIC_ADMIN_EMAIL; do
            if [ -z "${!v}" ]; then echo "::error::Repository variable $v is not set"; exit 1; fi
          done
      - uses: actions/checkout@v4
      - uses: withastro/action@v3

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Write the keep-alive workflow**

`.github/workflows/keepalive.yml`:
```yaml
name: Keep Supabase awake

on:
  schedule:
    - cron: '0 6 */3 * *'
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Call public.ping()
        run: |
          curl --fail --silent --show-error -X POST \
            "${{ vars.PUBLIC_SUPABASE_URL }}/rest/v1/rpc/ping" \
            -H "apikey: ${{ vars.PUBLIC_SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}'
```

- [ ] **Step 3: Append the deploy section to the README**

Append to `README.md`:
````markdown

## Deploy

Pushing to `main` runs tests, builds and publishes to GitHub Pages. The build needs four repository
variables (Settings → Secrets and variables → Actions → Variables): `PUBLIC_SUPABASE_URL`,
`PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_TEAM_EMAIL`, `PUBLIC_ADMIN_EMAIL`. They are public by design;
the passwords are never stored in GitHub.

`keepalive.yml` calls the database every 3 days so the free Supabase project never pauses.
GitHub stops scheduled workflows after 60 days without commits; if that happens, re-enable it in the Actions tab.
````

- [ ] **Step 4: Commit**

```bash
git add .github README.md
git commit -m "ci: deploy to GitHub Pages and keep Supabase awake"
```

- [ ] **Step 5: HUMAN CHECKPOINT — GitHub login and repo creation**

Run `gh auth status`. If not logged in, ask Mo to run `! gh auth login`.
Then **ask Mo to confirm** before creating anything on GitHub: "Create the public repo `mosouab/M2proj` and push? (The code is public; tasks and files stay private in Supabase. A private repo needs GitHub Pro, free with the Student Developer Pack.)" Use his answer for `--public` / `--private`.

- [ ] **Step 6: Create the repo, set variables, enable Pages, push**

```bash
cd /home/mo/Documents/M2proj
gh repo create mosouab/M2proj --public --source . --remote origin
for v in PUBLIC_SUPABASE_URL PUBLIC_SUPABASE_ANON_KEY PUBLIC_TEAM_EMAIL PUBLIC_ADMIN_EMAIL; do
  gh variable set "$v" -R mosouab/M2proj --body "$(grep "^$v=" .env | cut -d= -f2-)"
done
gh api -X POST repos/mosouab/M2proj/pages -f build_type=workflow
git push -u origin main
```
Expected: `gh variable list -R mosouab/M2proj` shows the 4 variables (never the passwords).

- [ ] **Step 7: Verify the deploy and the keep-alive**

```bash
gh run watch -R mosouab/M2proj --exit-status
curl -sI https://mosouab.github.io/M2proj/ | head -1
gh workflow run keepalive.yml -R mosouab/M2proj
sleep 20; gh run list -R mosouab/M2proj --workflow keepalive.yml --limit 1
```
Expected: deploy run succeeds; `HTTP/2 200`; the keep-alive run shows `completed success`. Open https://mosouab.github.io/M2proj/ and log in as team.

---

### Task 11: Final check on desktop and phone

**Files:** none (fix anything found in the file that owns it, with its own commit).

- [ ] **Step 1: Run every automated check**

Run: `npm test && npm run check && npm run check:permissions`
Expected: all PASS, `0 errors`, "All checks passed".

- [ ] **Step 2: Walk through the live site on desktop and on a real phone**

On `https://mosouab.github.io/M2proj/`:
1. Team login, name picker, FR/EN switch (choice survives a reload).
2. Create a task with a deadline; drag it Waiting → Taken → Finished → Waiting; same with "Déplacer vers…" on the phone.
3. Two devices race to take the same card → the second gets "Déjà pris par …".
4. Upload a photo from the phone into a category; download it on desktop.
5. Log out on the phone → the desktop session still works (Review Focus 1).
6. Admin: hide a member, reorder categories, delete a task and a file.
7. Leave the tab, change something from the other device, come back → the board refreshes.

- [ ] **Step 3: Hand over**

Tell Mo: the live link, the team password goes to teammates only, and the README "Locking someone out" steps. Mark the spec status as "implemented" in `docs/superpowers/specs/2026-11-19-m2proj-team-hub-design.md` and commit:
```bash
sed -i 's/Status: approved by Mo on 2026-11-19/Status: implemented/' docs/superpowers/specs/2026-11-19-m2proj-team-hub-design.md
git commit -am "docs: mark spec implemented" && git push
```
