-- =====================================================================
--  CertiSphere · remove sample (demo) records from the LIVE database
--  Run once in Supabase → SQL Editor. Real data is kept:
--   • clients that have a workflow record (every real registration has one)
--   • applications sent from Enquiries (they carry sourceEnquiryId / sentAt)
-- =====================================================================

-- 1. Preview what will be removed (optional: run this part alone first)
select store, count(*) as rows_to_remove from public.app_data
where (store = 'cms_client_registrations'
        and row_key not in (select row_key from public.app_data where store = 'cms_audit_workflow'))
   or (store = 'cms_application_dispatch_v7'
        and data->>'sourceEnquiryId' is null and data->>'sentAt' is null)
   or store in ('cms_client_onboarding_v1', 'cms_audit_applications_v2')
   or (store = 'cms_audit_reports_v1' and data::text like '%"seed-%')
group by store;

-- 2. Remove them
delete from public.app_data
where (store = 'cms_client_registrations'
        and row_key not in (select row_key from public.app_data where store = 'cms_audit_workflow'))
   or (store = 'cms_application_dispatch_v7'
        and data->>'sourceEnquiryId' is null and data->>'sentAt' is null)
   or store in ('cms_client_onboarding_v1', 'cms_audit_applications_v2')
   or (store = 'cms_audit_reports_v1' and data::text like '%"seed-%');

-- 3. What is left (your real clients)
select row_key as client_id, data->>'organizationName' as organisation
from public.app_data where store = 'cms_client_registrations' order by row_key::int;
