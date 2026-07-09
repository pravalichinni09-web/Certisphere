-- ============================================================
--  CertiSphere — Supabase Database Schema
--  Run this entire script in:
--  Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────
--  TABLE: organizations
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id            SERIAL PRIMARY KEY,
  name          TEXT        NOT NULL,
  industry      TEXT,
  email         TEXT,
  phone         TEXT,
  address       TEXT,
  country       TEXT        DEFAULT 'India',
  website       TEXT,
  status        TEXT        NOT NULL DEFAULT 'Active'
                CHECK (status IN ('Active','Inactive','Pending')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
--  TABLE: org_branches
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_branches (
  id             SERIAL PRIMARY KEY,
  org_id         INTEGER     NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_name    TEXT        NOT NULL,
  address        TEXT,
  city           TEXT,
  country        TEXT,
  contact_person TEXT,
  email          TEXT,
  phone          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
--  TABLE: users (profile layer on top of auth.users)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL UNIQUE,
  role        TEXT        NOT NULL
              CHECK (role IN ('Management','Audit Coordinator','Lead Auditor','Auditor','Auditee','Client Coordinator')),
  full_name   TEXT,
  phone       TEXT,
  status      TEXT        NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  org_id      INTEGER     REFERENCES public.organizations(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
--  TABLE: auditors
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auditors (
  id              SERIAL PRIMARY KEY,
  user_id         UUID        REFERENCES public.users(id),
  name            TEXT        NOT NULL,
  email           TEXT        NOT NULL UNIQUE,
  role            TEXT        NOT NULL DEFAULT 'Auditor',
  department      TEXT,
  specialization  TEXT,
  certifications  TEXT[]      NOT NULL DEFAULT '{}',
  skills          JSONB,
  ratings         JSONB,
  approval_status TEXT        CHECK (approval_status IN ('Pending Approval','Approved','Rejected')),
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  approval_notes  TEXT,
  status          TEXT        NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  join_date       DATE,
  country         TEXT,
  region          TEXT,
  phone           TEXT,
  languages       TEXT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
--  TABLE: certificates
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.certificates (
  id                   TEXT        PRIMARY KEY,
  org_id               INTEGER     REFERENCES public.organizations(id),
  certificate_number   TEXT        NOT NULL UNIQUE,
  standard             TEXT        NOT NULL,
  scope                TEXT,
  category             TEXT,
  issue_date           DATE,
  expiry_date          DATE,
  status               TEXT        NOT NULL DEFAULT 'Active'
                       CHECK (status IN ('Active','Expiring Soon','Expired','Suspended','Withdrawn')),
  audit_status         TEXT,
  method               TEXT,
  type                 TEXT        CHECK (type IN ('Registration','Surveillance')),
  recertification_due  DATE,
  surveillance1_due    DATE,
  surveillance2_due    DATE,
  address              TEXT,
  attachment           TEXT,
  issued_by            TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
--  TABLE: audit_schedules
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_schedules (
  id              TEXT        PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  org_id          INTEGER     REFERENCES public.organizations(id),
  audit_name      TEXT,
  audit_type      TEXT,
  standard        TEXT,
  scheduled_date  DATE,
  lead_auditor    TEXT,
  auditor         TEXT,
  auditor_email   TEXT,
  auditee         TEXT,
  auditee_email   TEXT,
  location        TEXT,
  duration        TEXT,
  scope           TEXT,
  department      TEXT,
  status          TEXT        NOT NULL DEFAULT 'Scheduled'
                  CHECK (status IN ('Scheduled','Pending','Submitted','Approved','Completed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
--  TABLE: audit_applications
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_applications (
  id                 SERIAL      PRIMARY KEY,
  org_id             INTEGER     REFERENCES public.organizations(id),
  application_number TEXT,
  standard           TEXT,
  audit_type         TEXT,
  status             TEXT        NOT NULL DEFAULT 'Pending',
  dispatch_method    TEXT,
  dispatched_at      TIMESTAMPTZ,
  received_at        TIMESTAMPTZ,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
--  TABLE: client_enquiries
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_enquiries (
  id            SERIAL      PRIMARY KEY,
  org_name      TEXT,
  contact_name  TEXT        NOT NULL,
  email         TEXT        NOT NULL,
  phone         TEXT,
  standard      TEXT,
  message       TEXT,
  status        TEXT        NOT NULL DEFAULT 'New'
                CHECK (status IN ('New','In Progress','Converted','Closed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
--  TABLE: notifications
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          SERIAL      PRIMARY KEY,
  user_id     UUID        REFERENCES public.users(id),
  role        TEXT,
  org_id      INTEGER     REFERENCES public.organizations(id),
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  type        TEXT        NOT NULL DEFAULT 'info'
              CHECK (type IN ('info','warning','success','error')),
  read        BOOLEAN     NOT NULL DEFAULT FALSE,
  link        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
--  TABLE: audit_checklists
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_checklists (
  id          SERIAL      PRIMARY KEY,
  standard    TEXT        NOT NULL,
  audit_type  TEXT,
  items       JSONB       NOT NULL DEFAULT '[]',
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  AUTO-UPDATE updated_at TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations','users','auditors','certificates',
    'audit_schedules','audit_applications','client_enquiries','audit_checklists']
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at
       BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();', t, t);
  END LOOP;
END $$;

-- ============================================================
--  ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.organizations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_branches     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_schedules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_checklists ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all rows (you can tighten later)
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations','org_branches','auditors','certificates',
    'audit_schedules','audit_applications','client_enquiries','audit_checklists']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_read_%I"  ON public.%I;', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_write_%I" ON public.%I;', t, t);
    EXECUTE format(
      'CREATE POLICY "authenticated_read_%I" ON public.%I
       FOR SELECT TO authenticated USING (true);', t, t);
    EXECUTE format(
      'CREATE POLICY "authenticated_write_%I" ON public.%I
       FOR ALL TO authenticated USING (true) WITH CHECK (true);', t, t);
  END LOOP;
END $$;

-- Users can read/update their own profile
DROP POLICY IF EXISTS "users_own_row" ON public.users;
CREATE POLICY "users_own_row" ON public.users
  FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Notifications visible only to the owning user or role
DROP POLICY IF EXISTS "notifications_own" ON public.notifications;
CREATE POLICY "notifications_own" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "notifications_write" ON public.notifications;
CREATE POLICY "notifications_write" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
--  SEED: Default demo users
--  NOTE: These are created via Auth, not directly in this table.
--  Run this AFTER you create the auth users via the Auth UI/API.
-- ============================================================
-- INSERT INTO public.organizations (name, industry, email, phone, country) VALUES
--   ('Green Energy Solutions', 'Renewable Energy', 'contact@greenenergy.com', '+91 9876543210', 'India'),
--   ('Acme Corp',              'Manufacturing',    'contact@acme.com',        '+91 9876543211', 'India');

-- ============================================================
--  ADDITIONAL TABLES (audit lifecycle)
-- ============================================================

-- ── audit_findings ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_findings (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  schedule_id     TEXT        REFERENCES public.audit_schedules(id) ON DELETE SET NULL,
  org_id          INTEGER     REFERENCES public.organizations(id) ON DELETE CASCADE,
  finding_type    TEXT        NOT NULL DEFAULT 'Non-Conformity'
                  CHECK (finding_type IN ('Non-Conformity','Observation','Opportunity for Improvement')),
  clause          TEXT,
  description     TEXT        NOT NULL,
  evidence        TEXT,
  severity        TEXT        NOT NULL DEFAULT 'Minor'
                  CHECK (severity IN ('Critical','Major','Minor')),
  status          TEXT        NOT NULL DEFAULT 'Open'
                  CHECK (status IN ('Open','In Progress','Closed','Verified')),
  raised_by       TEXT,
  assigned_to     TEXT,
  due_date        DATE,
  corrective_action TEXT,
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── audit_workflows ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_workflows (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  schedule_id     TEXT        REFERENCES public.audit_schedules(id) ON DELETE SET NULL,
  org_id          INTEGER     REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_name     TEXT,
  standard        TEXT,
  current_stage   INTEGER     NOT NULL DEFAULT 1,
  stage_name      TEXT        NOT NULL DEFAULT 'Application',
  status          TEXT        NOT NULL DEFAULT 'In Progress'
                  CHECK (status IN ('In Progress','Completed','On Hold','Cancelled')),
  assigned_to     TEXT,
  notes           TEXT,
  stage_data      JSONB       DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── audit_reports ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_reports (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  schedule_id     TEXT        REFERENCES public.audit_schedules(id) ON DELETE SET NULL,
  org_id          INTEGER     REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_number   TEXT        UNIQUE,
  report_type     TEXT        NOT NULL DEFAULT 'Stage 1'
                  CHECK (report_type IN ('Stage 1','Stage 2','Surveillance','Recertification','Special')),
  standard        TEXT,
  audit_date      DATE,
  lead_auditor    TEXT,
  summary         TEXT,
  conclusion      TEXT        DEFAULT 'Satisfactory'
                  CHECK (conclusion IN ('Satisfactory','Satisfactory with Observations','Unsatisfactory')),
  status          TEXT        NOT NULL DEFAULT 'Draft'
                  CHECK (status IN ('Draft','Under Review','Approved','Issued')),
  findings_count  INTEGER     DEFAULT 0,
  file_url        TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RLS for new tables ────────────────────────────────────────
ALTER TABLE public.audit_findings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_workflows  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_reports    ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['audit_findings','audit_workflows','audit_reports']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "auth_read_%I"  ON public.%I;', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_write_%I" ON public.%I;', t, t);
    EXECUTE format(
      'CREATE POLICY "auth_read_%I"  ON public.%I FOR SELECT TO authenticated USING (true);', t, t);
    EXECUTE format(
      'CREATE POLICY "auth_write_%I" ON public.%I FOR ALL    TO authenticated USING (true) WITH CHECK (true);', t, t);
  END LOOP;
END $$;

-- ── updated_at triggers for new tables ───────────────────────
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['audit_findings','audit_workflows','audit_reports']
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at
       BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();', t, t);
  END LOOP;
END $$;
