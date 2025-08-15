
# VAULT — Secure Private Web App (Frontend)

This is a **frontend-only** scaffold for your VAULT project. It is ready for **Netlify** deploy.
It uses **Supabase (anon key only)** for auth and data. **Never** put your `service_role` key in any frontend code or Netlify env — that key is for server-side only.

## What works out-of-the-box (after you add your Supabase project URL + anon key in `js/config.js`)
- Sign-in (email + password), **no sign-up** UI
- Session persistence and sign-out
- Role-gated Admin view (reads `profiles.is_admin` = true)
- Placeholder UI for Chats, Documents, Members, Share Links
- Storage upload & signed-url sharing (once you create a bucket)
- Realtime chat (once you create the tables + RLS policies)

## One-time Supabase setup (do this in Supabase Web UI)
1) **Auth → Settings**
   - Enable Email/Password
   - (Optional) Disable new sign-ups if you want admin-only user creation
2) **Table: `profiles`**
   - Columns:
     - `id` uuid (PK) — default: `auth.uid()`
     - `full_name` text
     - `is_admin` boolean — default false
     - `created_at` timestamp — default `now()`
   - Row Level Security: **ON**
   - Policies (example):
     - "Read own profile": `auth.uid() = id`
     - "Admins read all": `exists(select 1 from profiles p where p.id = auth.uid() and p.is_admin)`
     - "User can update own": `auth.uid() = id`
3) **Table: `groups`**
   - `id` uuid (PK) default `gen_random_uuid()`
   - `name` text
   - `created_by` uuid (FK -> profiles.id)
   - `created_at` timestamp default `now()`
   - RLS ON. Allow members/admins to read; admins create/update/delete.
4) **Table: `group_members`**
   - `group_id` uuid (FK -> groups.id)
   - `user_id` uuid (FK -> profiles.id)
   - `role` text (e.g., "member" | "admin")
   - Composite PK (`group_id`, `user_id`)
   - RLS ON. Allow users to read rows where `user_id = auth.uid()`. Admins manage.
5) **Table: `messages`**
   - `id` bigserial PK
   - `group_id` uuid (FK -> groups.id)
   - `sender_id` uuid (FK -> profiles.id)
   - `content` text
   - `created_at` timestamp default `now()`
   - RLS ON. Allow read/insert for members of the group; admins read all.
   - Realtime: enable on this table.
6) **Storage bucket:** `vault-docs`
   - Public: **OFF**
   - RLS: Allow users to read files they uploaded; admins read all.
   - Uploads via app; share with **signed URLs** (temporary links).

> Security reminder: **Do NOT** use `service_role` in the browser or Netlify.
> That key can bypass RLS and would expose your entire database if leaked.

## Local preview (optional)
Just open `index.html` in a browser or use a simple static server. For Netlify, just deploy this folder.

## Where to put your Supabase values
Edit `js/config.js` — your URL and public anon key are prefilled from your message.

## Git push (beginner-friendly)
If your repo already exists and has content:
```bash
git fetch origin
git checkout main
git pull origin main
git add .
git commit -m "feat: VAULT frontend v1 — auth + UI scaffold"
git push origin main
```
If you want to work on a new branch:
```bash
git fetch origin
git checkout -b vault-frontend
git add .
git commit -m "feat: VAULT frontend v1 — auth + UI scaffold"
git push -u origin vault-frontend
```
