-- ============================================================
-- HPLC/UPLC Column Management System - Database Schema
-- GMP Compliant | Pharmaceutical API QC Laboratory
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('analyst', 'supervisor', 'qc_head', 'qa');

CREATE TYPE column_status AS ENUM (
  'received',
  'qualification_pending',
  'active',
  'regeneration',
  'rejected',
  'discarded',
  'transferred'
);

CREATE TYPE approval_status AS ENUM (
  'pending_supervisor',
  'pending_qc_head',
  'pending_qa',
  'approved',
  'rejected'
);

CREATE TYPE discard_reason AS ENUM (
  'qc_head_decision',
  'sst_failure_post_regen',
  'high_backpressure',
  'physical_damage',
  'other'
);

CREATE TYPE transfer_type AS ENUM (
  'product',
  'method',
  'location',
  'analyst'
);

CREATE TYPE audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- ============================================================
-- SEQUENCE FOR COLUMN ID GENERATION
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS column_id_seq START 1 INCREMENT 1;

-- ============================================================
-- TABLE: profiles (extends auth.users)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  full_name    TEXT NOT NULL,
  role         user_role NOT NULL DEFAULT 'analyst',
  department   TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: column_types (dynamic, managed by QC Head)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.column_types (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: columns (master inventory)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.columns (
  id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  column_id_number          TEXT NOT NULL UNIQUE,  -- e.g. COL-2024-001
  manufacturer              TEXT NOT NULL,
  part_number               TEXT NOT NULL,
  serial_number             TEXT NOT NULL,
  lot_number                TEXT NOT NULL,
  column_type_id            UUID REFERENCES public.column_types(id) NOT NULL,
  length_mm                 NUMERIC(10,2) NOT NULL,
  internal_diameter_mm      NUMERIC(10,2) NOT NULL,
  particle_size_um          NUMERIC(10,2) NOT NULL,
  bonded_phase              TEXT NOT NULL,
  brand                     TEXT,
  received_date             DATE NOT NULL,
  received_by               UUID REFERENCES public.profiles(id) NOT NULL,
  certificate_of_analysis_url TEXT,
  assigned_product          TEXT,
  assigned_method           TEXT,
  assigned_analyst_id       UUID REFERENCES public.profiles(id),
  storage_location          TEXT NOT NULL,
  storage_solvent           TEXT NOT NULL,
  status                    column_status NOT NULL DEFAULT 'received',
  cumulative_injections     INTEGER NOT NULL DEFAULT 0,
  first_use_date            DATE,
  last_used_date            DATE,
  -- Receipt approval chain
  receipt_approval_status   approval_status NOT NULL DEFAULT 'pending_supervisor',
  receipt_approval_chain    JSONB NOT NULL DEFAULT '{}'::JSONB,
  remarks                   TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: column_qualification
-- ============================================================

CREATE TABLE IF NOT EXISTS public.column_qualification (
  id                            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  column_id                     UUID REFERENCES public.columns(id) NOT NULL,
  qualification_date            DATE NOT NULL,
  test_standard_used            TEXT NOT NULL,
  mobile_phase                  TEXT NOT NULL,
  -- Results
  theoretical_plates_result     NUMERIC(12,2),
  tailing_factor_result         NUMERIC(8,4),
  resolution_result             NUMERIC(8,4),
  back_pressure_result          NUMERIC(10,2),
  -- Criteria
  theoretical_plates_criteria   TEXT NOT NULL,
  tailing_factor_criteria       TEXT NOT NULL,
  resolution_criteria           TEXT NOT NULL,
  back_pressure_criteria        TEXT NOT NULL,
  -- Overall result
  result                        TEXT NOT NULL CHECK (result IN ('pass', 'fail')),
  remarks                       TEXT,
  performed_by                  UUID REFERENCES public.profiles(id) NOT NULL,
  approval_status               approval_status NOT NULL DEFAULT 'pending_supervisor',
  approval_chain                JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: column_issuance
-- ============================================================

CREATE TABLE IF NOT EXISTS public.column_issuance (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  column_id        UUID REFERENCES public.columns(id) NOT NULL,
  issued_to        UUID REFERENCES public.profiles(id) NOT NULL,
  issued_by        UUID REFERENCES public.profiles(id) NOT NULL,
  product_name     TEXT NOT NULL,
  method_reference TEXT NOT NULL,
  ar_number        TEXT NOT NULL,
  approval_status  approval_status NOT NULL DEFAULT 'pending_qc_head',
  approval_chain   JSONB NOT NULL DEFAULT '{}'::JSONB,
  remarks          TEXT,
  issued_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: column_usage_log
-- ============================================================

CREATE TABLE IF NOT EXISTS public.column_usage_log (
  id                           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  column_id                    UUID REFERENCES public.columns(id) NOT NULL,
  usage_date                   DATE NOT NULL,
  analyst_id                   UUID REFERENCES public.profiles(id) NOT NULL,
  product_name                 TEXT NOT NULL,
  ar_number                    TEXT NOT NULL,
  analysis_test_name           TEXT NOT NULL,
  method_reference             TEXT NOT NULL,
  injections_in_session        INTEGER NOT NULL CHECK (injections_in_session > 0),
  cumulative_injections_after  INTEGER NOT NULL,
  sst_result                   TEXT NOT NULL CHECK (sst_result IN ('pass', 'fail')),
  sst_parameters               JSONB NOT NULL DEFAULT '{}'::JSONB,
  pre_use_wash_done            BOOLEAN NOT NULL DEFAULT false,
  post_use_wash_done           BOOLEAN NOT NULL DEFAULT false,
  remarks                      TEXT,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: column_regeneration
-- ============================================================

CREATE TABLE IF NOT EXISTS public.column_regeneration (
  id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  column_id                   UUID REFERENCES public.columns(id) NOT NULL,
  initiated_by                UUID REFERENCES public.profiles(id) NOT NULL,
  initiated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  failure_reason              TEXT NOT NULL,
  sst_failure_details         TEXT,
  regeneration_protocol_used  TEXT,
  regeneration_steps          JSONB NOT NULL DEFAULT '[]'::JSONB,
  post_regeneration_sst_result TEXT CHECK (post_regeneration_sst_result IN ('pass', 'fail')),
  post_sst_parameters         JSONB DEFAULT '{}'::JSONB,
  outcome                     TEXT CHECK (outcome IN ('returned_to_service', 'sent_for_discard')),
  approval_status             approval_status NOT NULL DEFAULT 'pending_supervisor',
  approval_chain              JSONB NOT NULL DEFAULT '{}'::JSONB,
  completed_at                TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: column_transfers
-- ============================================================

CREATE TABLE IF NOT EXISTS public.column_transfers (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  column_id       UUID REFERENCES public.columns(id) NOT NULL,
  transfer_type   transfer_type NOT NULL,
  from_value      TEXT NOT NULL,
  to_value        TEXT NOT NULL,
  reason          TEXT NOT NULL,
  initiated_by    UUID REFERENCES public.profiles(id) NOT NULL,
  approval_status approval_status NOT NULL DEFAULT 'pending_supervisor',
  approval_chain  JSONB NOT NULL DEFAULT '{}'::JSONB,
  transfer_date   DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: column_discard
-- ============================================================

CREATE TABLE IF NOT EXISTS public.column_discard (
  id                              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  column_id                       UUID REFERENCES public.columns(id) NOT NULL UNIQUE,
  discard_reason                  discard_reason NOT NULL,
  reason_details                  TEXT NOT NULL,
  cumulative_injections_at_discard INTEGER NOT NULL,
  destruction_method              TEXT,
  initiated_by                    UUID REFERENCES public.profiles(id) NOT NULL,
  approval_status                 approval_status NOT NULL DEFAULT 'pending_supervisor',
  approval_chain                  JSONB NOT NULL DEFAULT '{}'::JSONB,
  discarded_on                    DATE,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: audit_log (GMP compliance - immutable, no RLS updates)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name   TEXT NOT NULL,
  record_id    UUID NOT NULL,
  action       audit_action NOT NULL,
  changed_by   UUID,  -- can be null for system actions
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  old_values   JSONB,
  new_values   JSONB,
  ip_address   TEXT,
  session_id   TEXT
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_columns_status ON public.columns(status);
CREATE INDEX idx_columns_column_type_id ON public.columns(column_type_id);
CREATE INDEX idx_columns_assigned_analyst ON public.columns(assigned_analyst_id);
CREATE INDEX idx_columns_receipt_approval ON public.columns(receipt_approval_status);

CREATE INDEX idx_column_qual_column_id ON public.column_qualification(column_id);
CREATE INDEX idx_column_qual_approval ON public.column_qualification(approval_status);
CREATE INDEX idx_column_qual_performed_by ON public.column_qualification(performed_by);

CREATE INDEX idx_issuance_column_id ON public.column_issuance(column_id);
CREATE INDEX idx_issuance_issued_to ON public.column_issuance(issued_to);
CREATE INDEX idx_issuance_approval ON public.column_issuance(approval_status);

CREATE INDEX idx_usage_column_id ON public.column_usage_log(column_id);
CREATE INDEX idx_usage_analyst_id ON public.column_usage_log(analyst_id);
CREATE INDEX idx_usage_date ON public.column_usage_log(usage_date);

CREATE INDEX idx_regen_column_id ON public.column_regeneration(column_id);
CREATE INDEX idx_regen_approval ON public.column_regeneration(approval_status);

CREATE INDEX idx_transfers_column_id ON public.column_transfers(column_id);
CREATE INDEX idx_transfers_approval ON public.column_transfers(approval_status);

CREATE INDEX idx_discard_column_id ON public.column_discard(column_id);
CREATE INDEX idx_discard_approval ON public.column_discard(approval_status);

CREATE INDEX idx_audit_table_name ON public.audit_log(table_name);
CREATE INDEX idx_audit_record_id ON public.audit_log(record_id);
CREATE INDEX idx_audit_changed_by ON public.audit_log(changed_by);
CREATE INDEX idx_audit_changed_at ON public.audit_log(changed_at);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-generate Column ID (COL-YYYY-NNN)
CREATE OR REPLACE FUNCTION public.generate_column_id()
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_seq  TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  v_seq  := LPAD(NEXTVAL('column_id_seq')::TEXT, 3, '0');
  RETURN 'COL-' || v_year || '-' || v_seq;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set column_id_number on insert
CREATE OR REPLACE FUNCTION public.set_column_id_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.column_id_number IS NULL OR NEW.column_id_number = '' THEN
    NEW.column_id_number := public.generate_column_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, department)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'analyst'),
    NEW.raw_user_meta_data->>'department'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_column_types_updated_at
  BEFORE UPDATE ON public.column_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_columns_updated_at
  BEFORE UPDATE ON public.columns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_column_qual_updated_at
  BEFORE UPDATE ON public.column_qualification
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_issuance_updated_at
  BEFORE UPDATE ON public.column_issuance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_usage_updated_at
  BEFORE UPDATE ON public.column_usage_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_regen_updated_at
  BEFORE UPDATE ON public.column_regeneration
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_transfers_updated_at
  BEFORE UPDATE ON public.column_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_discard_updated_at
  BEFORE UPDATE ON public.column_discard
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-generate column_id_number
CREATE TRIGGER trg_columns_set_id
  BEFORE INSERT ON public.columns
  FOR EACH ROW EXECUTE FUNCTION public.set_column_id_number();

-- Auto-create profile on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
