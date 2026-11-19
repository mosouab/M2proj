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

## Deploy

Pushing to `main` runs tests, builds and publishes to GitHub Pages. The build needs four repository
variables (Settings → Secrets and variables → Actions → Variables): `PUBLIC_SUPABASE_URL`,
`PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_TEAM_EMAIL`, `PUBLIC_ADMIN_EMAIL`. They are public by design;
the passwords are never stored in GitHub.

`keepalive.yml` calls the database every 3 days so the free Supabase project never pauses.
GitHub stops scheduled workflows after 60 days without commits; if that happens, re-enable it in the Actions tab.
