# 💪 Sheheryar Fitness

A web app for gym trainers to manage clients and track their progress.
Live at https://sheheryarfitness.pages.dev

## Features

**Trainer**
- Add, edit and delete clients (each client gets a generated username and password)
- Log measurements: weight (kg) and chest, waist, arms, thigh (in); a weigh-in updates the client's current weight
- Set goals per metric, grouped into Active, Past Deadline and Completed
- Coach notes, weekly check-ins with ratings, progress photos
- Reset a client's password

**Client**
- Profile, measurement history, goals, coach notes and check-ins (read-only)
- Upload own progress photos
- Change password

## Install as an App

The site is a Progressive Web App (`public/manifest.webmanifest`, icons in `public/icons/`).
- **Android / Chrome / Edge (desktop too):** the **Install App** button (sidebar and login page) opens the browser's install dialog
- **iPhone / iPad:** the button explains Share → Add to Home Screen (Apple has no install API)
- **Mac Safari:** the button explains File → Add to Dock
- The button hides where installing isn't possible or the app is already installed

`public/sw.js` only shows `offline.html` when there's no connection; it does not cache app files,
so installed apps always load the latest deploy. If you change `offline.html`, rename
`OFFLINE_CACHE` in `sw.js` so installed apps pick up the new copy.

## Tech Stack
- React 19 + Vite, React Router
- Supabase: Postgres with row level security, Auth, Storage
- Cloudflare Pages (hosting)

## Local Development

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and anon key
3. `npm run dev`

## Database Setup (new Supabase project)

Run these files in the Supabase SQL Editor, **in this order**:

1. `supabase/schema.sql` - tables and types
2. `supabase/seed.sql` - first trainer account: `admin` / `admin123`
3. `supabase/migrations.sql` - goals, coach notes, check-ins, photos, measurement weight
4. Create a storage bucket named `photos` (Storage → New bucket)
5. `supabase/security_1_auth.sql` - moves logins to Supabase Auth
6. `supabase/security_2_rls.sql` - locks the tables (row level security)
7. `supabase/security_3_storage.sql` - makes photos private

Then:
- Authentication settings → turn off **Allow new users to sign up** (the app creates client logins itself)
- Log in as `admin` and change the password straight away (🔑 Change Password)

`schema.sql` and `migrations.sql` still contain the original open setup (a password column,
old login functions, "allow all" policies); the security files replace all of that, which is
why the order matters.

## How Logins Work

- Users log in with a username, but Supabase Auth needs an email. Each username maps to an
  internal address that never receives mail: the first 32 hex characters of
  `sha256(lowercase username)` + `@users.example.com` (`src/lib/authEmail.js` and
  `public.login_email()` must stay in sync). Usernames are therefore not case-sensitive.
- Passwords live only in Supabase Auth. In the Supabase dashboard (Authentication → Users)
  accounts show these internal emails; the username is in the user's metadata.
- The role (`admin` = trainer, `client`) is stored in `public.users` and in the Auth user's
  `app_metadata`, which only the database can change.
- Trainers manage client logins through database functions that check the caller:
  `create_client_login`, `reset_client_password` (also signs the client out everywhere) and
  `delete_client` (removes the client, all their data and their login).

## Access Rules

- **Trainer:** reads and writes only their own clients and those clients' data
- **Client:** reads only their own data; can add and delete only their own photo uploads
- **Logged out:** no access to any table or photo
- Photos are stored in the private `photos` bucket in a folder named after the client id and
  shown through signed links that expire after 1 hour

## Deployment

Cloudflare Pages builds `main` of
[Sheheryar-fit/Fitness-Tracker](https://github.com/Sheheryar-fit/Fitness-Tracker) with
`npm run build` (output `dist`). Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the
Pages project's environment variables.

- There is no top-level `404.html`, so Pages serves `index.html` for every route (single-page
  app mode). Adding a `404.html` would break routes like `/admin/clients` unless rewrites are added.
- `public/_headers` stops caching of the HTML routes. Files in `/assets/` keep Pages' default
  (revalidate every time) on purpose: a missing asset is answered with `index.html`, and caching
  that long-term would break the page for returning visitors.
- If a change needs new SQL, run the SQL before deploying code that depends on it.

## Database

| Table | Contents |
| --- | --- |
| `users` | username, role, trainer (logins themselves are in Supabase Auth) |
| `clients` | profile, height (stored in total inches, entered as ft + in), starting/current weight, goal |
| `measurements` | date, weight (kg), chest, waist, arms, thigh (in) |
| `goals` | metric, starting and target value, deadline |
| `coach_notes`, `weekly_checkins` | trainer feedback, check-in rating 1-5 |
| `progress_photos` | photo record; the file is in the `photos` bucket |

---

**Last Updated:** September 2026
