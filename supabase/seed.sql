-- ============================================================
-- SEED DATA
-- Demo users (one per role) and sample columns
-- Run AFTER schema.sql and rls_policies.sql and triggers.sql
-- ============================================================

-- NOTE: For Supabase, create users via the Supabase dashboard or API.
-- The profiles below use fixed UUIDs for demo purposes.
-- Replace these UUIDs with actual auth.users UUIDs from your Supabase project.

-- ============================================================
-- Step 1: Create users in Supabase Auth (via dashboard or API)
-- Use these fixed UUIDs for testing, or run:
-- supabase auth admin create-user --email analyst@pharma.com --password Test@1234
-- ============================================================

-- Demo Profile UUIDs (these will be created by the trigger on auth.users insert)
-- analyst_id  = 'a1000000-0000-0000-0000-000000000001'
-- supervisor_id = 'a2000000-0000-0000-0000-000000000002'
-- qc_head_id  = 'a3000000-0000-0000-0000-000000000003'
-- qa_id       = 'a4000000-0000-0000-0000-000000000004'

-- Direct profile inserts (use with service role or after creating auth users)
-- These will be auto-created by trigger, but for seed data we insert directly:

INSERT INTO public.profiles (id, email, full_name, role, department, is_active) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'analyst@pharma.com',    'Priya Sharma',    'analyst',    'QC Laboratory', true),
  ('a2000000-0000-0000-0000-000000000002', 'supervisor@pharma.com', 'Rahul Verma',     'supervisor', 'QC Laboratory', true),
  ('a3000000-0000-0000-0000-000000000003', 'qchead@pharma.com',     'Dr. Sunita Rao',  'qc_head',    'QC Laboratory', true),
  ('a4000000-0000-0000-0000-000000000004', 'qa@pharma.com',         'Amit Patel',      'qa',         'Quality Assurance', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Step 2: Seed column types
-- ============================================================

INSERT INTO public.column_types (id, name, description, is_active, created_by) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Reverse Phase C18',    'Octadecylsilane bonded silica, most common RP column for API analysis',            true, 'a3000000-0000-0000-0000-000000000003'),
  ('b2000000-0000-0000-0000-000000000002', 'Reverse Phase C8',     'Octylsilane bonded silica, less retentive than C18',                                true, 'a3000000-0000-0000-0000-000000000003'),
  ('b3000000-0000-0000-0000-000000000003', 'Chiral',               'Chiral stationary phase for enantiomer separation',                                true, 'a3000000-0000-0000-0000-000000000003'),
  ('b4000000-0000-0000-0000-000000000004', 'Size Exclusion (SEC)', 'Size-based separation for protein and polymer analysis',                           true, 'a3000000-0000-0000-0000-000000000003'),
  ('b5000000-0000-0000-0000-000000000005', 'Phenyl',               'Phenyl bonded phase for compounds with aromatic rings',                            true, 'a3000000-0000-0000-0000-000000000003'),
  ('b6000000-0000-0000-0000-000000000006', 'HILIC',                'Hydrophilic interaction chromatography for polar compounds',                       true, 'a3000000-0000-0000-0000-000000000003'),
  ('b7000000-0000-0000-0000-000000000007', 'Ion Exchange',         'Ion exchange chromatography for ionic compounds',                                  true, 'a3000000-0000-0000-0000-000000000003')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- Step 3: Seed sample columns in various lifecycle stages
-- ============================================================

-- Column 1: Active column (fully approved, in use)
INSERT INTO public.columns (
  id, column_id_number, manufacturer, part_number, serial_number, lot_number,
  column_type_id, length_mm, internal_diameter_mm, particle_size_um,
  bonded_phase, brand, received_date, received_by,
  assigned_product, assigned_method, assigned_analyst_id,
  storage_location, storage_solvent, status, cumulative_injections,
  first_use_date, last_used_date,
  receipt_approval_status, receipt_approval_chain
) VALUES (
  'c1000000-0000-0000-0000-000000000001',
  'COL-2024-001',
  'Waters Corporation',
  '186002352',
  'SN-WC18-2024-0042',
  'LOT-2024-0156',
  'b1000000-0000-0000-0000-000000000001',
  150, 4.6, 3.5,
  'C18 (Octadecylsilane)',
  'Atlantis T3',
  '2024-01-10',
  'a3000000-0000-0000-0000-000000000003',
  'Metformin HCl',
  'QC-METH-001 Rev.3',
  'a1000000-0000-0000-0000-000000000001',
  'Cabinet A, Shelf 2',
  '10:90 Acetonitrile:Water',
  'active',
  342,
  '2024-01-18',
  '2024-02-15',
  'approved',
  '{"analyst": {"user_id": "a1000000-0000-0000-0000-000000000001", "action": "submitted", "timestamp": "2024-01-10T09:00:00Z", "remarks": "New column received from supplier."}, "supervisor": {"user_id": "a2000000-0000-0000-0000-000000000002", "action": "approved", "timestamp": "2024-01-10T11:00:00Z", "remarks": "Verified CoA and physical condition."}, "qc_head": {"user_id": "a3000000-0000-0000-0000-000000000003", "action": "approved", "timestamp": "2024-01-11T09:30:00Z", "remarks": "Receipt authorized. Column ID assigned."}, "qa": {"user_id": "a4000000-0000-0000-0000-000000000004", "action": "approved", "timestamp": "2024-01-11T14:00:00Z", "remarks": "Final QA sign-off on receipt."}}'::JSONB
);

-- Column 2: Pending qualification approval
INSERT INTO public.columns (
  id, column_id_number, manufacturer, part_number, serial_number, lot_number,
  column_type_id, length_mm, internal_diameter_mm, particle_size_um,
  bonded_phase, brand, received_date, received_by,
  storage_location, storage_solvent, status,
  receipt_approval_status, receipt_approval_chain
) VALUES (
  'c2000000-0000-0000-0000-000000000002',
  'COL-2024-002',
  'Phenomenex',
  '00F-4462-E0',
  'SN-PH-2024-0089',
  'LOT-PH-2024-0023',
  'b1000000-0000-0000-0000-000000000001',
  250, 4.6, 5.0,
  'C18 (Octadecylsilane)',
  'Luna C18(2)',
  '2024-02-01',
  'a3000000-0000-0000-0000-000000000003',
  'Cabinet B, Shelf 1',
  '95:5 Water:Acetonitrile with 0.1% TFA',
  'qualification_pending',
  'approved',
  '{"analyst": {"user_id": "a1000000-0000-0000-0000-000000000001", "action": "submitted", "timestamp": "2024-02-01T08:30:00Z", "remarks": "Column received. Initiating receipt process."}, "supervisor": {"user_id": "a2000000-0000-0000-0000-000000000002", "action": "approved", "timestamp": "2024-02-01T10:00:00Z", "remarks": "Physical check done, CoA verified."}, "qc_head": {"user_id": "a3000000-0000-0000-0000-000000000003", "action": "approved", "timestamp": "2024-02-01T15:00:00Z", "remarks": "Authorized receipt."}, "qa": {"user_id": "a4000000-0000-0000-0000-000000000004", "action": "approved", "timestamp": "2024-02-02T09:00:00Z", "remarks": "QA approved receipt."}}'::JSONB
);

-- Column 3: In regeneration
INSERT INTO public.columns (
  id, column_id_number, manufacturer, part_number, serial_number, lot_number,
  column_type_id, length_mm, internal_diameter_mm, particle_size_um,
  bonded_phase, brand, received_date, received_by,
  assigned_product, assigned_method, assigned_analyst_id,
  storage_location, storage_solvent, status, cumulative_injections,
  first_use_date, last_used_date,
  receipt_approval_status, receipt_approval_chain
) VALUES (
  'c3000000-0000-0000-0000-000000000003',
  'COL-2023-047',
  'Agilent Technologies',
  '959763-902',
  'SN-AG-2023-0234',
  'LOT-AG-2023-0891',
  'b2000000-0000-0000-0000-000000000002',
  150, 4.6, 3.5,
  'C8 (Octylsilane)',
  'Zorbax Eclipse Plus C8',
  '2023-05-10',
  'a3000000-0000-0000-0000-000000000003',
  'Atorvastatin',
  'QC-METH-007 Rev.2',
  'a1000000-0000-0000-0000-000000000001',
  'Cabinet A, Shelf 3',
  'Methanol:Water 60:40',
  'regeneration',
  1250,
  '2023-05-20',
  '2024-02-10',
  'approved',
  '{"analyst": {"user_id": "a1000000-0000-0000-0000-000000000001", "action": "submitted", "timestamp": "2023-05-10T09:00:00Z", "remarks": ""}, "supervisor": {"user_id": "a2000000-0000-0000-0000-000000000002", "action": "approved", "timestamp": "2023-05-10T11:00:00Z", "remarks": ""}, "qc_head": {"user_id": "a3000000-0000-0000-0000-000000000003", "action": "approved", "timestamp": "2023-05-11T09:00:00Z", "remarks": ""}, "qa": {"user_id": "a4000000-0000-0000-0000-000000000004", "action": "approved", "timestamp": "2023-05-11T14:00:00Z", "remarks": ""}}'::JSONB
);

-- ============================================================
-- Step 4: Seed qualification records
-- ============================================================

-- Qualification for Column 1 (approved)
INSERT INTO public.column_qualification (
  id, column_id, qualification_date, test_standard_used, mobile_phase,
  theoretical_plates_result, tailing_factor_result, resolution_result, back_pressure_result,
  theoretical_plates_criteria, tailing_factor_criteria, resolution_criteria, back_pressure_criteria,
  result, remarks, performed_by, approval_status, approval_chain
) VALUES (
  'd1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  '2024-01-18',
  'Uracil (column void volume marker)',
  'Acetonitrile:Water (10:90) with 0.1% TFA',
  12580, 1.12, 2.45, 185,
  'NLT 2000', 'NMT 2.0', 'NLT 2.0', 'NMT 250 bar',
  'pass',
  'All parameters within acceptance criteria. Column qualified for use.',
  'a1000000-0000-0000-0000-000000000001',
  'approved',
  '{"analyst": {"user_id": "a1000000-0000-0000-0000-000000000001", "action": "submitted", "timestamp": "2024-01-18T10:00:00Z", "remarks": "Qualification completed as per SOP-QC-COL-001."}, "supervisor": {"user_id": "a2000000-0000-0000-0000-000000000002", "action": "approved", "timestamp": "2024-01-18T14:00:00Z", "remarks": "Results verified. All criteria met."}, "qc_head": {"user_id": "a3000000-0000-0000-0000-000000000003", "action": "approved", "timestamp": "2024-01-19T09:00:00Z", "remarks": "Column qualified and approved for active use."}, "qa": {"user_id": "a4000000-0000-0000-0000-000000000004", "action": "approved", "timestamp": "2024-01-19T14:30:00Z", "remarks": "QA final approval. Column may be issued."}}'::JSONB
);

-- Qualification for Column 2 (pending supervisor approval)
INSERT INTO public.column_qualification (
  id, column_id, qualification_date, test_standard_used, mobile_phase,
  theoretical_plates_result, tailing_factor_result, resolution_result, back_pressure_result,
  theoretical_plates_criteria, tailing_factor_criteria, resolution_criteria, back_pressure_criteria,
  result, remarks, performed_by, approval_status, approval_chain
) VALUES (
  'd2000000-0000-0000-0000-000000000002',
  'c2000000-0000-0000-0000-000000000002',
  '2024-02-05',
  'Benzophenone (USP system suitability standard)',
  'Acetonitrile:0.1% TFA (30:70)',
  9800, 1.35, 3.12, 220,
  'NLT 2000', 'NMT 2.0', 'NLT 2.0', 'NMT 300 bar',
  'pass',
  'Qualification performed per SOP-QC-COL-001 Rev.4.',
  'a1000000-0000-0000-0000-000000000001',
  'pending_supervisor',
  '{"analyst": {"user_id": "a1000000-0000-0000-0000-000000000001", "action": "submitted", "timestamp": "2024-02-05T11:00:00Z", "remarks": "Qualification complete. Submitting for approval."}}'::JSONB
);

-- ============================================================
-- Step 5: Seed usage logs for Column 1
-- ============================================================

INSERT INTO public.column_usage_log (
  id, column_id, usage_date, analyst_id,
  product_name, ar_number, analysis_test_name, method_reference,
  injections_in_session, cumulative_injections_after,
  sst_result, sst_parameters, pre_use_wash_done, post_use_wash_done, remarks
) VALUES
  (
    'e1000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    '2024-01-25', 'a1000000-0000-0000-0000-000000000001',
    'Metformin HCl Tablets 500mg', 'AR/2024/0125', 'Assay by HPLC', 'QC-METH-001 Rev.3',
    42, 42, 'pass',
    '{"theoretical_plates": 11980, "tailing_factor": 1.15, "resolution": 2.38}'::JSONB,
    true, true, 'Routine assay analysis. SST passed.'
  ),
  (
    'e2000000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000001',
    '2024-01-30', 'a1000000-0000-0000-0000-000000000001',
    'Metformin HCl Tablets 500mg', 'AR/2024/0130', 'Related Substances', 'QC-METH-001 Rev.3',
    120, 162, 'pass',
    '{"theoretical_plates": 12100, "tailing_factor": 1.12, "resolution": 2.51}'::JSONB,
    true, true, 'Related substances analysis batch AR/2024/0130.'
  ),
  (
    'e3000000-0000-0000-0000-000000000003',
    'c1000000-0000-0000-0000-000000000001',
    '2024-02-05', 'a1000000-0000-0000-0000-000000000001',
    'Metformin HCl Tablets 850mg', 'AR/2024/0205', 'Assay by HPLC', 'QC-METH-001 Rev.3',
    90, 252, 'pass',
    '{"theoretical_plates": 11850, "tailing_factor": 1.18, "resolution": 2.42}'::JSONB,
    true, true, 'Analysis of 850mg tablets.'
  );

-- ============================================================
-- Step 6: Seed regeneration record for Column 3
-- ============================================================

INSERT INTO public.column_regeneration (
  id, column_id, initiated_by, initiated_at,
  failure_reason, sst_failure_details,
  regeneration_protocol_used,
  regeneration_steps,
  approval_status, approval_chain
) VALUES (
  'f1000000-0000-0000-0000-000000000001',
  'c3000000-0000-0000-0000-000000000003',
  'a1000000-0000-0000-0000-000000000001',
  '2024-02-10T14:00:00Z',
  'SST failure - tailing factor exceeded acceptance criteria (observed: 2.35, criteria: NMT 2.0)',
  'Tailing factor: 2.35 (Criterion: NMT 2.0). Theoretical plates: 8200 (Criterion: NLT 10000). Back pressure normal.',
  'SOP-QC-COL-REGEN-001 Rev.2',
  '[{"step": 1, "description": "Flush with 100% acetonitrile (10 column volumes)", "completed_at": "2024-02-11T09:00:00Z"}, {"step": 2, "description": "Flush with 50:50 acetonitrile:water (5 column volumes)", "completed_at": "2024-02-11T09:30:00Z"}, {"step": 3, "description": "Flush with 0.1% TFA in water (5 column volumes)", "completed_at": "2024-02-11T10:00:00Z"}]'::JSONB,
  'pending_supervisor',
  '{"analyst": {"user_id": "a1000000-0000-0000-0000-000000000001", "action": "submitted", "timestamp": "2024-02-10T14:00:00Z", "remarks": "SST failed during AR/2024/0210 analysis. Initiating regeneration per SOP-QC-COL-REGEN-001."}}'::JSONB
);
