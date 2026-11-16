-- ════════════════════════════════════════════════════════════════════
-- Replace an email everywhere in CertiSphere
--   rk@qmicssolutions.com  →  ramakrishna@qmicssolutions.com
-- Changes: the login (auth user + identity), the profile (Users & Access),
-- the demo-credentials list, and every saved record (registrations,
-- enquiries, applications, workflow, dispatches…) that mentions it.
-- The password stays the same. Safe to run twice.
-- Run in Supabase → SQL Editor → New query → paste → Run.
-- ════════════════════════════════════════════════════════════════════
do $$
declare
  old_email text := 'rk@qmicssolutions.com';
  new_email text := 'ramakrishna@qmicssolutions.com';
  n_auth int; n_ident int; n_prof int; n_demo int; n_data int;
begin
  -- stop if the new email already has its own separate login
  if exists (select 1 from auth.users where lower(email) = lower(new_email))
     and exists (select 1 from auth.users where lower(email) = lower(old_email)) then
    raise exception '% already has its own login. Delete or disable one of the two users in Users & Access first.', new_email;
  end if;

  update auth.users
     set email = new_email, updated_at = now()
   where lower(email) = lower(old_email);
  get diagnostics n_auth = row_count;

  update auth.identities
     set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(new_email)),
         provider_id   = case when lower(provider_id) = lower(old_email) then new_email else provider_id end,
         updated_at    = now()
   where provider = 'email' and lower(identity_data->>'email') = lower(old_email);
  get diagnostics n_ident = row_count;

  update public.profiles    set email = new_email where lower(email) = lower(old_email);
  get diagnostics n_prof = row_count;

  update public.demo_logins set email = new_email, updated_at = now() where lower(email) = lower(old_email);
  get diagnostics n_demo = row_count;

  -- every saved record (case-insensitive, whole address only)
  update public.app_data
     set data = regexp_replace(data::text, '(?<![A-Za-z0-9._%+-])rk@qmicssolutions\.com', new_email, 'gi')::jsonb,
         updated_at = now()
   where data::text ~* '(?<![A-Za-z0-9._%+-])rk@qmicssolutions\.com';
  get diagnostics n_data = row_count;

  raise notice 'Login users: %, identities: %, profiles: %, demo list: %, saved records: %',
    n_auth, n_ident, n_prof, n_demo, n_data;
end $$;

-- Check: both lists should show only the new email (0 rows with the old one)
select 'still has old email' as check, count(*) as rows
  from public.app_data where data::text ~* '(?<![A-Za-z0-9._%+-])rk@qmicssolutions\.com'
union all
select 'logins with new email', count(*) from auth.users where lower(email) = 'ramakrishna@qmicssolutions.com';
