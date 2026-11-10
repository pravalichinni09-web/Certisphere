-- =====================================================================
--  CertiSphere · live database (accounts, shared data, access rules)
-- ---------------------------------------------------------------------
--  profiles   one row per login: role + (for client users) their client
--  app_data   every piece of CertiSphere data, one row per record,
--             tagged with the client it belongs to (client_id)
--
--  Access rules (Row Level Security):
--   • Staff (Management, Audit Coordinator, Lead Auditor, Auditor)
--     read and write all data.
--   • Client users (Auditee, Client Coordinator) read and write ONLY
--     rows tagged with their own client_id, plus read shared reference
--     data (audit types, scopes, settings) that holds no client data.
--   • Visitors who are not signed in can only SUBMIT an enquiry or an
--     auditor application; they can never read anything.
--   • Roles are assigned only by the server (service role) — nobody can
--     change their own role from the browser.
-- =====================================================================

-- ---------- profiles ---------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  role        text not null check (role in (
                'Management', 'Audit Coordinator', 'Lead Auditor', 'Auditor',
                'Auditee', 'Client Coordinator')),
  client_id   bigint,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint client_users_need_client
    check (role not in ('Auditee', 'Client Coordinator') or client_id is not null)
);

-- ---------- app_data ---------------------------------------------------
create table if not exists public.app_data (
  store       text   not null,                 -- e.g. cms_audit_workflow
  row_key     text   not null,                 -- record id / client id / '_'
  kind        text   not null check (kind in ('array', 'map', 'value')),
  pos         integer not null default 0,      -- order inside an array store
  client_id   bigint,                          -- owner client (null = staff/shared)
  data        jsonb  not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid(),
  primary key (store, row_key)
);
create index if not exists app_data_client_idx on public.app_data (client_id);
create index if not exists app_data_store_idx  on public.app_data (store);

-- ---------- helper functions (run as owner, so RLS can call them) ------
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.app_client_id() returns bigint
language sql stable security definer set search_path = public as $$
  select client_id from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() in
    ('Management', 'Audit Coordinator', 'Lead Auditor', 'Auditor'), false)
$$;

-- Reference stores client users may read (they contain no client data)
create or replace function public.is_shared_reference(store text) returns boolean
language sql immutable as $$
  select store in ('cms_audit_types', 'cms_audit_scopes', 'cms_global_config_v1',
                   'cms_departments_v1', 'cms_audit_checklists')
$$;

-- Stores a signed-out visitor may submit into (insert only)
create or replace function public.is_public_submission(store text) returns boolean
language sql immutable as $$
  select store in ('cms_client_enquiries_v1', 'cms_auditor_requests_v1')
$$;

-- keep updated_at / updated_by current
create or replace function public.touch_app_data() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists app_data_touch on public.app_data;
create trigger app_data_touch before insert or update on public.app_data
  for each row execute function public.touch_app_data();

-- ---------- Row Level Security ----------------------------------------
alter table public.profiles enable row level security;
alter table public.app_data enable row level security;

-- profiles: everyone reads their own row; Management reads everyone.
-- No insert/update/delete policies: only the server (service role) writes.
drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.app_role() = 'Management');

-- app_data: staff — full access
drop policy if exists app_data_staff_all on public.app_data;
create policy app_data_staff_all on public.app_data
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- app_data: client users — only their own client's rows
drop policy if exists app_data_client_read on public.app_data;
create policy app_data_client_read on public.app_data
  for select to authenticated
  using (
    public.app_role() in ('Auditee', 'Client Coordinator')
    and (client_id = public.app_client_id()
         or (client_id is null and public.is_shared_reference(store)))
  );

drop policy if exists app_data_client_insert on public.app_data;
create policy app_data_client_insert on public.app_data
  for insert to authenticated
  with check (
    public.app_role() in ('Auditee', 'Client Coordinator')
    and client_id = public.app_client_id()
  );

drop policy if exists app_data_client_update on public.app_data;
create policy app_data_client_update on public.app_data
  for update to authenticated
  using (public.app_role() in ('Auditee', 'Client Coordinator') and client_id = public.app_client_id())
  with check (public.app_role() in ('Auditee', 'Client Coordinator') and client_id = public.app_client_id());

-- app_data: visitors — submit an enquiry / auditor application only
drop policy if exists app_data_public_submit on public.app_data;
create policy app_data_public_submit on public.app_data
  for insert to anon
  with check (public.is_public_submission(store) and kind = 'array' and client_id is null);

-- ---------- privileges -------------------------------------------------
-- Explicit grants (new tables are not exposed automatically)
grant usage on schema public to anon, authenticated, service_role;
grant all on public.profiles, public.app_data to service_role;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.app_data to authenticated;
grant insert on public.app_data to anon;

-- ---------- live updates ----------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_data'
  ) then
    execute 'alter publication supabase_realtime add table public.app_data';
  end if;
end $$;
