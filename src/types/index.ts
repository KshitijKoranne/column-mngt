// ============================================================
// Type Definitions for HPLC Column Management System
// ============================================================

export type UserRole = 'analyst' | 'supervisor' | 'qc_head' | 'qa'

export type ColumnStatus =
  | 'received'
  | 'qualification_pending'
  | 'active'
  | 'regeneration'
  | 'rejected'
  | 'discarded'
  | 'transferred'

export type ApprovalStatus =
  | 'pending_supervisor'
  | 'pending_qc_head'
  | 'pending_qa'
  | 'approved'
  | 'rejected'

export type DiscardReason =
  | 'qc_head_decision'
  | 'sst_failure_post_regen'
  | 'high_backpressure'
  | 'physical_damage'
  | 'other'

export type TransferType = 'product' | 'method' | 'location' | 'analyst'

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE'

// ============================================================
// Approval Chain
// ============================================================

export interface ApprovalEntry {
  user_id: string
  action: 'submitted' | 'approved' | 'rejected' | 'pending'
  timestamp: string
  remarks: string
}

export interface ApprovalChain {
  analyst?: ApprovalEntry
  supervisor?: ApprovalEntry
  qc_head?: ApprovalEntry
  qa?: ApprovalEntry
}

// ============================================================
// Domain Types
// ============================================================

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  department: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ColumnType {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  // joined
  creator?: Profile
}

export interface Column {
  id: string
  column_id_number: string
  manufacturer: string
  part_number: string
  serial_number: string
  lot_number: string
  column_type_id: string
  length_mm: number
  internal_diameter_mm: number
  particle_size_um: number
  bonded_phase: string
  brand: string | null
  received_date: string
  received_by: string
  certificate_of_analysis_url: string | null
  assigned_product: string | null
  assigned_method: string | null
  assigned_analyst_id: string | null
  storage_location: string
  storage_solvent: string
  status: ColumnStatus
  cumulative_injections: number
  first_use_date: string | null
  last_used_date: string | null
  receipt_approval_status: ApprovalStatus
  receipt_approval_chain: ApprovalChain
  remarks: string | null
  created_at: string
  updated_at: string
  // joined
  column_type?: ColumnType
  assigned_analyst?: Profile
  received_by_profile?: Profile
}

export interface ColumnQualification {
  id: string
  column_id: string
  qualification_date: string
  test_standard_used: string
  mobile_phase: string
  theoretical_plates_result: number | null
  tailing_factor_result: number | null
  resolution_result: number | null
  back_pressure_result: number | null
  theoretical_plates_criteria: string
  tailing_factor_criteria: string
  resolution_criteria: string
  back_pressure_criteria: string
  result: 'pass' | 'fail'
  remarks: string | null
  performed_by: string
  approval_status: ApprovalStatus
  approval_chain: ApprovalChain
  created_at: string
  updated_at: string
  // joined
  performed_by_profile?: Profile
  column?: Column
}

export interface ColumnIssuance {
  id: string
  column_id: string
  issued_to: string
  issued_by: string
  product_name: string
  method_reference: string
  ar_number: string
  approval_status: ApprovalStatus
  approval_chain: ApprovalChain
  remarks: string | null
  issued_at: string | null
  created_at: string
  updated_at: string
  // joined
  column?: Column
  issued_to_profile?: Profile
  issued_by_profile?: Profile
}

export interface SSTParameters {
  theoretical_plates?: number
  tailing_factor?: number
  resolution?: number
  back_pressure?: number
  [key: string]: number | undefined
}

export interface ColumnUsageLog {
  id: string
  column_id: string
  usage_date: string
  analyst_id: string
  product_name: string
  ar_number: string
  analysis_test_name: string
  method_reference: string
  injections_in_session: number
  cumulative_injections_after: number
  sst_result: 'pass' | 'fail'
  sst_parameters: SSTParameters
  pre_use_wash_done: boolean
  post_use_wash_done: boolean
  remarks: string | null
  created_at: string
  updated_at: string
  // joined
  analyst?: Profile
  column?: Column
}

export interface RegenerationStep {
  step: number
  description: string
  completed_at?: string
}

export interface ColumnRegeneration {
  id: string
  column_id: string
  initiated_by: string
  initiated_at: string
  failure_reason: string
  sst_failure_details: string | null
  regeneration_protocol_used: string | null
  regeneration_steps: RegenerationStep[]
  post_regeneration_sst_result: 'pass' | 'fail' | null
  post_sst_parameters: SSTParameters | null
  outcome: 'returned_to_service' | 'sent_for_discard' | null
  approval_status: ApprovalStatus
  approval_chain: ApprovalChain
  completed_at: string | null
  created_at: string
  updated_at: string
  // joined
  initiated_by_profile?: Profile
  column?: Column
}

export interface ColumnTransfer {
  id: string
  column_id: string
  transfer_type: TransferType
  from_value: string
  to_value: string
  reason: string
  initiated_by: string
  approval_status: ApprovalStatus
  approval_chain: ApprovalChain
  transfer_date: string | null
  created_at: string
  updated_at: string
  // joined
  initiated_by_profile?: Profile
  column?: Column
}

export interface ColumnDiscard {
  id: string
  column_id: string
  discard_reason: DiscardReason
  reason_details: string
  cumulative_injections_at_discard: number
  destruction_method: string | null
  initiated_by: string
  approval_status: ApprovalStatus
  approval_chain: ApprovalChain
  discarded_on: string | null
  created_at: string
  updated_at: string
  // joined
  initiated_by_profile?: Profile
  column?: Column
}

export interface AuditLog {
  id: string
  table_name: string
  record_id: string
  action: AuditAction
  changed_by: string | null
  changed_at: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  session_id: string | null
  // joined
  changed_by_profile?: Profile
}

// ============================================================
// UI / Utility Types
// ============================================================

export interface PendingApproval {
  id: string
  type: 'receipt' | 'qualification' | 'issuance' | 'regeneration' | 'transfer' | 'discard'
  column_id: string
  column_id_number: string
  description: string
  initiated_by_name: string
  initiated_at: string
  current_step: ApprovalStatus
  record_id: string
}

export interface DashboardStats {
  total: number
  active: number
  qualification_pending: number
  regeneration: number
  discarded: number
  received: number
}
