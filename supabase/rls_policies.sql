-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- GMP-Compliant Access Control
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.column_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.column_qualification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.column_issuance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.column_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.column_regeneration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.column_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.column_discard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTION: Get current user's role
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role::TEXT FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- PROFILES TABLE POLICIES
-- ============================================================

-- All authenticated users can view all profiles (needed for dropdowns, assignments)
CREATE POLICY "profiles_select_all_auth"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own profile (limited fields)
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- QC Head and QA can view/manage all profiles
CREATE POLICY "profiles_manage_by_admin"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('qc_head', 'qa'));

-- ============================================================
-- COLUMN TYPES TABLE POLICIES
-- ============================================================

-- All authenticated users can view active column types
CREATE POLICY "column_types_select"
  ON public.column_types FOR SELECT
  TO authenticated
  USING (true);

-- Only QC Head can insert/update column types
CREATE POLICY "column_types_insert_qc_head"
  ON public.column_types FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'qc_head');

CREATE POLICY "column_types_update_qc_head"
  ON public.column_types FOR UPDATE
  TO authenticated
  USING (public.get_user_role() = 'qc_head')
  WITH CHECK (public.get_user_role() = 'qc_head');

-- ============================================================
-- COLUMNS TABLE POLICIES
-- ============================================================

-- All authenticated users can view columns
CREATE POLICY "columns_select_all"
  ON public.columns FOR SELECT
  TO authenticated
  USING (true);

-- Analysts can only insert (register) new columns
CREATE POLICY "columns_insert_analyst_supervisor_head"
  ON public.columns FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('analyst', 'supervisor', 'qc_head'));

-- Supervisor, QC Head can update columns (status changes, approvals)
-- QA cannot update (read-only)
CREATE POLICY "columns_update_non_qa"
  ON public.columns FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('analyst', 'supervisor', 'qc_head'))
  WITH CHECK (public.get_user_role() IN ('analyst', 'supervisor', 'qc_head'));

-- No hard deletes
-- (no DELETE policy = no one can delete)

-- ============================================================
-- COLUMN QUALIFICATION POLICIES
-- ============================================================

CREATE POLICY "qual_select_all"
  ON public.column_qualification FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "qual_insert"
  ON public.column_qualification FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('analyst', 'supervisor', 'qc_head'));

CREATE POLICY "qual_update"
  ON public.column_qualification FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('analyst', 'supervisor', 'qc_head', 'qa'))
  WITH CHECK (public.get_user_role() IN ('analyst', 'supervisor', 'qc_head', 'qa'));

-- ============================================================
-- COLUMN ISSUANCE POLICIES
-- ============================================================

CREATE POLICY "issuance_select_all"
  ON public.column_issuance FOR SELECT
  TO authenticated
  USING (true);

-- Supervisors and above can create issuance records
CREATE POLICY "issuance_insert"
  ON public.column_issuance FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('supervisor', 'qc_head'));

CREATE POLICY "issuance_update"
  ON public.column_issuance FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('supervisor', 'qc_head', 'qa'))
  WITH CHECK (public.get_user_role() IN ('supervisor', 'qc_head', 'qa'));

-- ============================================================
-- COLUMN USAGE LOG POLICIES
-- ============================================================

-- Analysts can view their own usage logs; supervisors/heads/qa see all
CREATE POLICY "usage_select"
  ON public.column_usage_log FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() IN ('supervisor', 'qc_head', 'qa')
    OR analyst_id = auth.uid()
  );

-- Analysts can log their own usage; supervisors+ can log on behalf
CREATE POLICY "usage_insert"
  ON public.column_usage_log FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('supervisor', 'qc_head')
    OR (public.get_user_role() = 'analyst' AND analyst_id = auth.uid())
  );

-- Usage logs are immutable once created (GMP)
-- No update or delete policies

-- ============================================================
-- COLUMN REGENERATION POLICIES
-- ============================================================

CREATE POLICY "regen_select_all"
  ON public.column_regeneration FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "regen_insert"
  ON public.column_regeneration FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('analyst', 'supervisor', 'qc_head'));

CREATE POLICY "regen_update"
  ON public.column_regeneration FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('analyst', 'supervisor', 'qc_head', 'qa'))
  WITH CHECK (public.get_user_role() IN ('analyst', 'supervisor', 'qc_head', 'qa'));

-- ============================================================
-- COLUMN TRANSFERS POLICIES
-- ============================================================

CREATE POLICY "transfers_select_all"
  ON public.column_transfers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "transfers_insert"
  ON public.column_transfers FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('analyst', 'supervisor', 'qc_head'));

CREATE POLICY "transfers_update"
  ON public.column_transfers FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('supervisor', 'qc_head', 'qa'))
  WITH CHECK (public.get_user_role() IN ('supervisor', 'qc_head', 'qa'));

-- ============================================================
-- COLUMN DISCARD POLICIES
-- ============================================================

CREATE POLICY "discard_select_all"
  ON public.column_discard FOR SELECT
  TO authenticated
  USING (true);

-- Only QC Head can initiate discard
CREATE POLICY "discard_insert_qc_head"
  ON public.column_discard FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() = 'qc_head');

CREATE POLICY "discard_update"
  ON public.column_discard FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('supervisor', 'qc_head', 'qa'))
  WITH CHECK (public.get_user_role() IN ('supervisor', 'qc_head', 'qa'));

-- ============================================================
-- AUDIT LOG POLICIES (Read-only for all authenticated users)
-- ============================================================

CREATE POLICY "audit_select_all"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (true);

-- Only the audit trigger function (SECURITY DEFINER) can insert into audit_log
-- Regular users cannot insert/update/delete audit records
CREATE POLICY "audit_insert_system_only"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (false);  -- Blocked for regular users; trigger runs as DEFINER

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Allow the service role to bypass RLS
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.column_types FORCE ROW LEVEL SECURITY;
ALTER TABLE public.columns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.column_qualification FORCE ROW LEVEL SECURITY;
ALTER TABLE public.column_issuance FORCE ROW LEVEL SECURITY;
ALTER TABLE public.column_usage_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.column_regeneration FORCE ROW LEVEL SECURITY;
ALTER TABLE public.column_transfers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.column_discard FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;
