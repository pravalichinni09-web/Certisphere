-- =====================================================================
-- CertiSphere — remove SAMPLE data from the live site (safe to run again)
-- Supabase → SQL Editor → New query → paste everything → Run
--
-- Removes only made-up demo records:
--   • sample applications / onboarding queue / seeded audit reports
--   • sample certificates in Certificate Delivery   (CERT-…, SURV-…, cert-gen-…)
--   • invented company certificates / schedules / reports shown to client logins
--     (CRT-1xxxx, asch-…, arep-…)
-- Keeps: every client registration, workflow, finding, real certificate
-- (CS-…), enquiry, application sent from Enquiries, users and settings.
-- Also: any client registered by hand before the workflow fix gets its
-- workflow started (stage 1 "Registration Submitted"), so it appears in
-- Client Onboarding.
-- =====================================================================

-- 1. Preview what will be removed
select store, count(*) as rows_to_remove from public.app_data
where (store = 'cms_application_dispatch_v7' and data->>'sourceEnquiryId' is null and data->>'sentAt' is null)
   or store in ('cms_client_onboarding_v1', 'cms_audit_applications_v2')
   or (store = 'cms_audit_reports_v1' and data::text like '%"seed-%')
   or (store in ('cms_certificate_delivery_v1', 'cms_certificate_delivery_surv_v1')
        and (data->>'certificateNumber' like 'CERT-%' or data->>'certificateNumber' like 'SURV-%' or data->>'id' like 'cert-gen-%'))
   or (store like 'cms_org_certs_v1_%' and data->>'certNumber' ~ '^CRT-1[0-9]{4}$')
   or (store like 'cms_org_schedules_v1_%' and data->>'id' like 'asch-%')
   or (store like 'cms_org_reports_v1_%' and data->>'id' like 'arep-%')
group by store order by store;

-- 2. Remove them
delete from public.app_data
where (store = 'cms_application_dispatch_v7' and data->>'sourceEnquiryId' is null and data->>'sentAt' is null)
   or store in ('cms_client_onboarding_v1', 'cms_audit_applications_v2')
   or (store = 'cms_audit_reports_v1' and data::text like '%"seed-%')
   or (store in ('cms_certificate_delivery_v1', 'cms_certificate_delivery_surv_v1')
        and (data->>'certificateNumber' like 'CERT-%' or data->>'certificateNumber' like 'SURV-%' or data->>'id' like 'cert-gen-%'))
   or (store like 'cms_org_certs_v1_%' and data->>'certNumber' ~ '^CRT-1[0-9]{4}$')
   or (store like 'cms_org_schedules_v1_%' and data->>'id' like 'asch-%')
   or (store like 'cms_org_reports_v1_%' and data->>'id' like 'arep-%');

-- 3. Start the workflow for clients registered by hand that have none yet
insert into public.app_data (store, row_key, kind, pos, client_id, data)
select 'cms_audit_workflow', r.row_key, 'array',
       coalesce((select max(pos) from public.app_data where store = 'cms_audit_workflow'), -1)
         + row_number() over (order by r.row_key::int),
       r.row_key::bigint,
       jsonb_build_object(
         'clientId', r.row_key::int,
         'currentStage', 'Registration Submitted',
         'history', jsonb_build_array(jsonb_build_object('stage', 'Registration Submitted', 'at', now(), 'by', 'Audit Coordinator', 'note', 'Workflow started')),
         'createdAt', now(), 'updatedAt', now())
from public.app_data r
where r.store = 'cms_client_registrations'
  and r.row_key ~ '^[0-9]+$'
  and not exists (select 1 from public.app_data w where w.store = 'cms_audit_workflow' and w.row_key = r.row_key);

-- 4. What is left: your real clients and their workflow step
select r.row_key as client_id, r.data->>'organizationName' as organisation, w.data->>'currentStage' as workflow_stage
from public.app_data r
left join public.app_data w on w.store = 'cms_audit_workflow' and w.row_key = r.row_key
where r.store = 'cms_client_registrations'
order by r.row_key::int;
