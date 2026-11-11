-- =====================================================================
--  CertiSphere · demo logins shown on the sign-in page
-- ---------------------------------------------------------------------
--  Management edits these in the app (Management → Users & Access →
--  "Login page" column). The server changes the account's real password
--  and stores the same password here, so the sign-in page always matches.
--  Anyone may READ this table (it is shown publicly on the sign-in page);
--  only the server (service role) can change it.
-- =====================================================================
create table if not exists public.demo_logins (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  email       text not null,
  role        text not null,
  password    text not null,
  updated_at  timestamptz not null default now()
);

alter table public.demo_logins enable row level security;

drop policy if exists demo_logins_public_read on public.demo_logins;
create policy demo_logins_public_read on public.demo_logins
  for select to anon, authenticated using (true);

grant select on public.demo_logins to anon, authenticated;
grant all on public.demo_logins to service_role;
