-- =====================================================================
--  CertiSphere · demo logins for every role (live site)
--  Run once in Supabase → SQL Editor. Safe to run again: existing
--  demo emails get their password
--  reset to demo_pw. Also lists them on the sign-in page (demo_logins).
--  Demo emails use the reserved .test domain — no real mailbox. Change demo_pw below before running.
-- =====================================================================
-- Sign-in page demo list (same as migrations/002_demo_logins.sql)
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

do $$
declare
  demo_pw    text := 'Certi@Demo2026';           -- ← change this
  demo_org   text := 'Demo Client Pvt Ltd';
  cid        bigint;
  uid        uuid;
  acc        record;
  now_txt    text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
begin
  -- 0. Remove the earlier demo logins that used a personal Gmail (+ addresses)
  delete from auth.identities where user_id in (select id from auth.users where email like 'pravalichinni09+%@gmail.com');
  delete from public.profiles where email like 'pravalichinni09+%@gmail.com';
  delete from auth.users      where email like 'pravalichinni09+%@gmail.com';

  -- 1. Demo client company (for the Auditee / Client Coordinator logins)
  select (data->>'id')::bigint into cid
    from public.app_data
   where store = 'cms_client_registrations' and data->>'organizationName' = demo_org
   limit 1;

  if cid is null then
    select coalesce(max(row_key::bigint), 0) + 1 into cid
      from public.app_data
     where store = 'cms_client_registrations' and row_key ~ '^[0-9]+$';

    insert into public.app_data (store, row_key, kind, pos, client_id, data) values
    ('cms_client_registrations', cid::text, 'array',
       (select count(*) from public.app_data where store = 'cms_client_registrations'), cid,
       jsonb_build_object(
         'id', cid, 'organizationName', demo_org, 'contactPerson', 'Demo Auditee',
         'email', 'auditee@certisphere.test', 'phone', '', 'address', 'Tirupati, India',
         'standard', 'ISO 9001:2015', 'clientType', 'Initial', 'status', 'Pending',
         'registrationNumber', 'REG-' || extract(year from now())::int || '-' || lpad(cid::text, 3, '0'),
         'registrationDate', now_txt, 'source', 'Demo setup')),
    ('cms_audit_workflow', cid::text, 'array',
       (select count(*) from public.app_data where store = 'cms_audit_workflow'), cid,
       jsonb_build_object(
         'clientId', cid, 'currentStage', 'Registration Submitted',
         'history', jsonb_build_array(jsonb_build_object('stage', 'Registration Submitted', 'at', now_txt, 'by', 'Demo setup')),
         'createdAt', now_txt, 'updatedAt', now_txt));
  end if;
  update public.app_data set data = jsonb_set(data, '{email}', '"auditee@certisphere.test"')
   where store = 'cms_client_registrations' and row_key = cid::text;

  -- 2. One login per role
  for acc in
    select * from (values
      ('management@certisphere.test',  'Demo Management',        'Management',         false),
      ('coordinator@certisphere.test', 'Demo Audit Coordinator', 'Audit Coordinator',  false),
      ('leadauditor@certisphere.test',        'Demo Lead Auditor',      'Lead Auditor',       false),
      ('auditor@certisphere.test',     'Demo Auditor',           'Auditor',            false),
      ('auditee@certisphere.test',     'Demo Auditee',           'Auditee',            true),
      ('clientcoord@certisphere.test', 'Demo Client Coordinator','Client Coordinator', true)
    ) as t(email, full_name, role, is_client)
  loop
    select id into uid from auth.users where email = acc.email;
    if uid is not null then
      -- already there: just make its password match the demo password
      update auth.users set encrypted_password = extensions.crypt(demo_pw, extensions.gen_salt('bf')), updated_at = now() where id = uid;
      insert into public.demo_logins (user_id, email, role, password)
        select uid, acc.email, p.role, demo_pw from public.profiles p where p.id = uid
      on conflict (user_id) do update set password = excluded.password, role = excluded.role, updated_at = now();
      continue;
    end if;

    uid := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      acc.email, extensions.crypt(demo_pw, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', acc.full_name),
      now(), now(), '', '', '', '');

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text,
            jsonb_build_object('sub', uid::text, 'email', acc.email, 'email_verified', true),
            'email', now(), now(), now());

    insert into public.profiles (id, email, full_name, role, client_id, active)
    values (uid, acc.email, acc.full_name, acc.role, case when acc.is_client then cid end, true);

    insert into public.demo_logins (user_id, email, role, password)
    values (uid, acc.email, acc.role, demo_pw)
    on conflict (user_id) do update set password = excluded.password, role = excluded.role, updated_at = now();
  end loop;
end $$;

-- 3. Show the result
select email, role, password from public.demo_logins order by role;
