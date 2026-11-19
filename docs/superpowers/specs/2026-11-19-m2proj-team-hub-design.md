# M2proj Team Hub — Design Spec

Date: 2026-11-19 · Status: approved by Mo on 2026-11-19

## Goal

A private team hub for a school group project, run by Mo as project manager. It
gives the team one place to:

1. track tasks on a board with three statuses — **Waiting / Taken (by whom) /
   Finished** — moved by drag and drop, and
2. share files and links, organised in categories.

Teammates are not technical and do not use GitHub, so they must never need a
GitHub account: they open a link, type a password, pick their name.

Live at `https://mosouab.github.io/M2proj/` (GitHub Pages project site). The
personal site (`mosouab.github.io`) is not modified.

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Hosting | Separate repo `mosouab/M2proj`, GitHub Pages, path not subdomain |
| Backend | Supabase free tier (Postgres + Auth + Storage) |
| Login | One shared team password, then "who are you?" name picker |
| Permissions | Everyone adds/edits; only admin (Mo, separate password) deletes and manages members/categories |
| Task fields | Title, description, optional deadline, status, taken by, created by |
| Files | Fixed categories defined by admin; each entry is a file or a link |
| Look | Same design system as the personal site |
| Language | FR/EN toggle, default from browser language |
| Stack | Astro 5 + TypeScript, vanilla modules, no UI framework |

## Non-goals

Individual accounts, real-time live updates, sprints / priority / story points,
comments, notifications, task history, manual ordering inside a column, nested
folders, file previews, offline mode. Any of these is a new request.

## Architecture

```
Browser (static Astro app on GitHub Pages)
  └─ supabase-js ──► Supabase
                       ├─ Auth: 2 fixed accounts (team, admin), sign-ups disabled
                       ├─ Postgres: members, categories, tasks, items  (RLS on)
                       └─ Storage: private bucket "files"               (policies on)
GitHub Actions
  ├─ deploy.yml    build + deploy on push to main
  └─ keepalive.yml ping Supabase every 3 days so the free project never pauses
```

All data access happens in the browser with the Supabase public (anon) key.
Security comes entirely from Row Level Security and Storage policies, never from
hiding buttons.

## Data model (`supabase/schema.sql`)

```
members     id uuid pk, name text not null, active bool default true,
            created_at timestamptz default now()

categories  id uuid pk, name text not null, position int not null default 0

tasks       id uuid pk, title text not null, description text default '',
            deadline date null,
            status text not null check (status in ('waiting','taken','finished'))
                   default 'waiting',
            taken_by uuid null references members(id),
            created_by uuid not null references members(id),
            created_at timestamptz default now(),
            updated_at timestamptz default now(),   -- set by trigger on update
            finished_at timestamptz null

items       id uuid pk,
            category_id uuid not null references categories(id) on delete restrict,
            kind text not null check (kind in ('file','link')),
            title text not null,
            url text null,            -- kind = 'link', must be http(s)
            storage_path text null,   -- kind = 'file'
            size_bytes bigint null,   -- kind = 'file'
            added_by uuid not null references members(id),
            created_at timestamptz default now(),
            check ((kind = 'link' and url is not null and storage_path is null)
                or (kind = 'file' and storage_path is not null and url is null))
```

Storage: private bucket `files`, `file_size_limit` 50 MB. Objects stored at
`<uuid>-<sanitised original name>`.

User-entered content (task titles, category names…) is stored as typed and is
not translated; only the interface is bilingual.

## Auth and permissions

Two Supabase Auth users, created by hand in the dashboard (auto-confirmed, no
email is ever sent):

- `team@m2proj.invalid` — password = the team password shared with teammates
- `admin@m2proj.invalid` — password = Mo's admin password

The addresses are configuration (`PUBLIC_TEAM_EMAIL`, `PUBLIC_ADMIN_EMAIL`), so
other addresses can be used if the dashboard refuses `.invalid`.

Each account gets a role claim, `app_metadata.m2proj_role` = `team` / `admin`,
set once with `supabase/roles.sql`. Public sign-ups are **disabled** in Supabase
Auth settings.

SQL helpers:

- `m2_role()` → `coalesce(auth.jwt() -> 'app_metadata' ->> 'm2proj_role', '')`
- `is_member()` → `m2_role() in ('team', 'admin')`
- `is_admin()` → `m2_role() = 'admin'`

Logging out uses `signOut({ scope: 'local' })`: the team shares one account, so
a global sign-out would log everyone out.

Policies (RLS enabled on every table):

| Table / object | select | insert | update | delete |
|---|---|---|---|---|
| members | member | admin | admin | none (deactivate instead) |
| categories | member | admin | admin | admin (blocked by FK if it has items) |
| tasks | member | member | member | admin |
| items | member | member | member | admin |
| storage `files` | member | member | none | admin |

Anonymous visitors can read nothing. `is_member()` is a second line of defence in
case sign-ups are ever re-enabled by mistake.

**Locking someone out:** change the team password and use "sign out all
sessions" in the dashboard; the rest of the team logs in again.

## Session and identity

- Login screen: one password field → `signInWithPassword(team email, password)`.
- Name picker: buttons for every active member. Chosen member id stored in
  `localStorage` (`m2proj.member`). If that member is missing or inactive, the
  picker is shown again. "change" next to the name reopens it.
- Admin: an "Admin" link (on the login screen and in the top bar) asks for the
  admin password → `signInWithPassword(admin email, password)`. This replaces
  the team session; the chosen name is kept (or the picker is shown if none).
  Leaving admin mode = log out.
- Expired or invalid session on any request → back to the login screen.
- Wrong password → inline error, no detail about which account exists.

## Task rules (`src/lib/transitions.ts`, pure functions)

Moves (by drag and drop or by the card's "Move to…" menu):

| From → To | Effect | Guard |
|---|---|---|
| waiting → taken | `taken_by = me` | update only `where status = 'waiting'` |
| waiting → finished | `taken_by = me`, `finished_at = now()` | `where status = 'waiting'` |
| taken → finished | `finished_at = now()`, keep `taken_by` | `where status = 'taken'` |
| taken → waiting ("Give back") | `taken_by = null` | `where status = 'taken'` |
| finished → waiting ("Reopen") | `taken_by = null`, `finished_at = null` | `where status = 'finished'` |
| finished → taken | `finished_at = null`, keep `taken_by`, or `taken_by = me` if null | `where status = 'finished'` |

Every move is a conditional update on the status the client last saw. If it
affects 0 rows, someone else moved the card first: the card snaps back, the
board reloads, and a message says what happened (e.g. "already taken by Sami").

**Late:** `deadline < today (local date)` and `status != 'finished'` → card
marked LATE in red.

**Sorting:** Waiting and Taken by deadline ascending (no deadline last), then
`created_at`. Finished by `finished_at` descending.

## Screens

Single Astro page (`src/pages/index.astro`) acting as an app shell. Views are
switched client-side with hash routes: `#board` (default), `#files`, `#admin`.

**Login** — project title in Doto, password field, FR | EN toggle. Then "Who are
you?" with one button per member.

**Top bar** (all views) — `M2proj` · `<name> (change)` · `FR | EN` ·
`Admin` (or `ADMIN` badge when active) · `Log out`. Tabs: Board | Files
(+ Admin when in admin mode).

**Board**

```
[ ] WAITING (4)        [~] TAKEN (3)          [x] FINISHED (5)
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ Write intro      │   │ ROS launch file  │   │ Gantt chart      │
│ due 24 Nov       │   │ due 21 Nov  LATE │   │ done by Léa      │
└──────────────────┘   │ ~ Sami           │   └──────────────────┘
  + New task           └──────────────────┘
```

- Drag and drop between columns with SortableJS (mouse and touch).
- Each card also has a "Move to…" menu (phone + keyboard access).
- On narrow screens the three columns stack vertically.
- Click a card → modal: edit title, description, deadline; shows creator and
  owner. Admin sees a Delete button.
- "+ New task" → modal: title (required), description, deadline (optional).
- Board reloads after each own action and when the tab becomes visible again.

**Files**

- One section per category (ordered by `position`). Rows: file/link icon, title,
  added by, date, size (files only), Open/Download.
- Download: a signed URL valid 300 s, generated on click.
- Links open in a new tab. Only `http://` and `https://` URLs are accepted.
- "+ Add" → modal: choose File (drop or pick, max 50 MB, checked before upload)
  or Link (URL), title (defaults to file name), category.
- Admin sees Delete on each row.

**Admin** (admin mode only)

- Members: add, rename, deactivate / reactivate.
- Categories: add, rename, reorder (up/down), delete (refused with a message if
  the category still has items).

## Write order for multi-step operations

- **Upload file:** upload object → insert `items` row. If the insert fails, try
  to remove the uploaded object, then show the error.
- **Delete file item (admin):** delete `items` row → remove storage object. A
  failed object removal leaves an orphan file (harmless, invisible).

## Internationalisation

- `src/i18n/fr.ts` and `src/i18n/en.ts` export the same keys; `t(key)` looks up
  the current language.
- Default: `fr` if `navigator.language` starts with `fr`, else `en`. Choice
  stored in `localStorage` (`m2proj.lang`).
- Dates formatted with `Intl.DateTimeFormat` in the current language.

## Style

- Copy the personal site's `global.css` tokens: `--bg #fbfbfa`, `--surface #fff`,
  `--ink #161616`, `--border #e4e4e4`, `--accent #00875f`, `--radius 2px`,
  dotted background, Geist Mono body, Doto display.
- Fonts via the same Fontsource packages (`@fontsource/geist-mono`,
  `@fontsource-variable/doto`).
- New token: `--danger` (red) for LATE and destructive buttons.
- Column headers in Doto with `[ ]`, `[~]`, `[x]` markers. Cards: white surface,
  1px border, sharp corners.
- Works at phone width (16px gutters, no horizontal scroll).

## Error handling

- Any failed request → short toast message in the current language; optimistic
  moves are reverted.
- File > 50 MB → refused client-side with a message, nothing uploaded.
- Auth error (expired / invalid session) → login screen.

## Repository layout

```
M2proj/
  astro.config.mjs        site: https://mosouab.github.io, base: '/M2proj'
  package.json            astro, @supabase/supabase-js, sortablejs, fontsource, vitest
  src/pages/index.astro   app shell
  src/styles/global.css   tokens copied from personal site + app styles
  src/lib/supabase.ts     client from PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY
  src/lib/auth.ts         login, admin login, logout, role from the session
  src/lib/transitions.ts  pure task-move rules, late check, sorting
  src/lib/validate.ts     file size, link and file-name rules
  src/lib/errors.ts       error codes shown to the user
  src/lib/tasks.ts        task queries / conditional updates
  src/lib/items.ts        items + storage
  src/lib/members.ts      members
  src/lib/categories.ts   categories
  src/i18n/{fr,en,index}.ts
  src/ui/                 main, login-view, picker-view, topbar, board-view, task-form,
                          files-view, item-form, admin-view, modal, toast, dom, run, router, store
  supabase/schema.sql     tables, triggers, RLS, storage bucket + policies, ping()
  supabase/roles.sql      sets the team/admin role claims
  scripts/check-permissions.ts
  tests/                  vitest unit tests
  .github/workflows/deploy.yml     copy of personal site's, passing repo variables as env
  .github/workflows/keepalive.yml  cron every 3 days
  README.md               one-time setup steps (below)
```

## Deploy and setup

**Deploy:** `deploy.yml` is the personal site's workflow, with
`PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` read from GitHub repo
variables (`vars.*`) and passed as `env` to the build step. Pages source = GitHub
Actions.

**One-time Supabase setup (documented in README):**

1. Create a free Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Authentication → Users → add `team@m2proj.invalid` and
   `admin@m2proj.invalid` with their passwords, auto-confirmed.
4. Authentication → Settings → disable new sign-ups.
5. Copy project URL + anon key into the GitHub repo variables.
6. In admin mode, add the members and categories.

**Keep-alive:** `keepalive.yml` runs on cron `0 6 */3 * *` and calls
`POST /rest/v1/rpc/ping` with the anon key. `public.ping()` runs `select 1` in
the database and exposes no data. Anonymous visitors have no other privileges.

The Pages URL is `/M2proj/` with that exact capitalisation; share that link.

## Testing

- **Unit (Vitest):** every row of the task-rules table (effect + guard), the late
  rule (today, yesterday, no deadline, finished), sorting, file-size check, link
  URL validation, and an i18n test that `fr` and `en` have identical key sets.
- **Permissions script** (`scripts/check-permissions.ts`, run locally with the
  two passwords in env vars, never in CI): anon reads nothing; team can
  read/insert/update but delete fails on tasks, items and storage, and can't
  write members/categories; admin can do all of it.
- **Manual pass:** desktop and phone — login, name picker, create task, drag in
  every direction, "Move to…" menu, two browsers racing to take the same task,
  upload/download/link, admin delete, FR/EN switch, late marker.
