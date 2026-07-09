/**
 * src/lib/database.types.ts
 * ──────────────────────────
 * TypeScript types generated from the CertiSphere Supabase schema.
 * Every table, row type and insert type is defined here.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      // ── Users (mirrors Supabase Auth + role metadata) ──────────────
      users: {
        Row: {
          id: string;           // uuid — matches auth.users.id
          email: string;
          role: string;         // Management | Audit Coordinator | Lead Auditor | Auditor | Auditee | Client Coordinator
          full_name: string | null;
          phone: string | null;
          status: 'Active' | 'Inactive';
          org_id: number | null; // FK → organizations.id
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };

      // ── Organizations (client companies) ───────────────────────────
      organizations: {
        Row: {
          id: number;
          name: string;
          industry: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          country: string | null;
          website: string | null;
          status: 'Active' | 'Inactive' | 'Pending';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['organizations']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>;
      };

      // ── Org Branches ───────────────────────────────────────────────
      org_branches: {
        Row: {
          id: number;
          org_id: number;
          branch_name: string;
          address: string | null;
          city: string | null;
          country: string | null;
          contact_person: string | null;
          email: string | null;
          phone: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['org_branches']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['org_branches']['Insert']>;
      };

      // ── Auditors ───────────────────────────────────────────────────
      auditors: {
        Row: {
          id: number;
          user_id: string | null;   // FK → users.id
          name: string;
          email: string;
          role: string;
          department: string | null;
          specialization: string | null;
          certifications: string[];
          skills: Json | null;
          ratings: Json | null;
          approval_status: 'Pending Approval' | 'Approved' | 'Rejected' | null;
          approved_by: string | null;
          approved_at: string | null;
          approval_notes: string | null;
          status: 'Active' | 'Inactive';
          join_date: string | null;
          country: string | null;
          region: string | null;
          phone: string | null;
          languages: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['auditors']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['auditors']['Insert']>;
      };

      // ── Certificates ───────────────────────────────────────────────
      certificates: {
        Row: {
          id: string;
          org_id: number | null;
          certificate_number: string;
          standard: string;
          scope: string | null;
          category: string | null;
          issue_date: string | null;
          expiry_date: string | null;
          status: 'Active' | 'Expiring Soon' | 'Expired' | 'Suspended' | 'Withdrawn';
          audit_status: string | null;
          method: string | null;
          type: 'Registration' | 'Surveillance' | null;
          recertification_due: string | null;
          surveillance1_due: string | null;
          surveillance2_due: string | null;
          address: string | null;
          attachment: string | null;
          issued_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['certificates']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['certificates']['Insert']>;
      };

      // ── Audit Schedules ────────────────────────────────────────────
      audit_schedules: {
        Row: {
          id: string;
          org_id: number | null;
          audit_name: string | null;
          audit_type: string | null;
          standard: string | null;
          scheduled_date: string | null;
          lead_auditor: string | null;
          auditor: string | null;
          auditor_email: string | null;
          auditee: string | null;
          auditee_email: string | null;
          location: string | null;
          duration: string | null;
          scope: string | null;
          department: string | null;
          status: 'Scheduled' | 'Pending' | 'Submitted' | 'Approved' | 'Completed';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_schedules']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['audit_schedules']['Insert']>;
      };

      // ── Audit Applications (dispatch) ──────────────────────────────
      audit_applications: {
        Row: {
          id: number;
          org_id: number | null;
          application_number: string | null;
          standard: string | null;
          audit_type: string | null;
          status: string;
          dispatch_method: string | null;
          dispatched_at: string | null;
          received_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_applications']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['audit_applications']['Insert']>;
      };

      // ── Client Enquiries ───────────────────────────────────────────
      client_enquiries: {
        Row: {
          id: number;
          org_name: string | null;
          contact_name: string;
          email: string;
          phone: string | null;
          standard: string | null;
          message: string | null;
          status: 'New' | 'In Progress' | 'Converted' | 'Closed';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['client_enquiries']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['client_enquiries']['Insert']>;
      };

      // ── Notifications ──────────────────────────────────────────────
      notifications: {
        Row: {
          id: number;
          user_id: string | null;
          role: string | null;
          org_id: number | null;
          title: string;
          message: string;
          type: 'info' | 'warning' | 'success' | 'error';
          read: boolean;
          link: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
      };

      // ── Audit Checklists ───────────────────────────────────────────
      audit_checklists: {
        Row: {
          id: number;
          standard: string;
          audit_type: string | null;
          items: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_checklists']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['audit_checklists']['Insert']>;
      };

      // ── Audit Findings ────────────────────────────────────────────
      audit_findings: {
        Row: {
          id: string;
          schedule_id: string | null;
          org_id: number | null;
          finding_type: 'Non-Conformity' | 'Observation' | 'Opportunity for Improvement';
          clause: string | null;
          description: string;
          evidence: string | null;
          severity: 'Critical' | 'Major' | 'Minor';
          status: 'Open' | 'In Progress' | 'Closed' | 'Verified';
          raised_by: string | null;
          assigned_to: string | null;
          due_date: string | null;
          corrective_action: string | null;
          closed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_findings']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['audit_findings']['Insert']>;
      };

      // ── Audit Workflows ───────────────────────────────────────────
      audit_workflows: {
        Row: {
          id: string;
          schedule_id: string | null;
          org_id: number | null;
          client_name: string | null;
          standard: string | null;
          current_stage: number;
          stage_name: string;
          status: 'In Progress' | 'Completed' | 'On Hold' | 'Cancelled';
          assigned_to: string | null;
          notes: string | null;
          stage_data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_workflows']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['audit_workflows']['Insert']>;
      };

      // ── Audit Reports ─────────────────────────────────────────────
      audit_reports: {
        Row: {
          id: string;
          schedule_id: string | null;
          org_id: number | null;
          report_number: string | null;
          report_type: 'Stage 1' | 'Stage 2' | 'Surveillance' | 'Recertification' | 'Special';
          standard: string | null;
          audit_date: string | null;
          lead_auditor: string | null;
          summary: string | null;
          conclusion: 'Satisfactory' | 'Satisfactory with Observations' | 'Unsatisfactory' | null;
          status: 'Draft' | 'Under Review' | 'Approved' | 'Issued';
          findings_count: number;
          file_url: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_reports']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['audit_reports']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
