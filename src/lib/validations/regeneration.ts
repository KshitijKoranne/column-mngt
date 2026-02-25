import { z } from 'zod'

export const regenerationInitSchema = z.object({
  column_id: z.string().uuid(),
  failure_reason: z.string().min(10, 'Please provide detailed failure reason (min 10 chars)'),
  sst_failure_details: z.string().optional(),
  regeneration_protocol_used: z.string().min(1, 'Protocol reference is required'),
  remarks: z.string().optional(),
})

export type RegenerationInitInput = z.infer<typeof regenerationInitSchema>

export const regenerationStepSchema = z.object({
  regeneration_id: z.string().uuid(),
  step_number: z.coerce.number().int().positive(),
  description: z.string().min(1, 'Step description is required'),
})

export const regenerationCompleteSchema = z.object({
  regeneration_id: z.string().uuid(),
  post_regeneration_sst_result: z.enum(['pass', 'fail']),
  post_sst_theoretical_plates: z.coerce.number().optional(),
  post_sst_tailing_factor: z.coerce.number().optional(),
  post_sst_resolution: z.coerce.number().optional(),
  post_sst_back_pressure: z.coerce.number().optional(),
  remarks: z.string().min(1, 'Remarks are mandatory'),
})

export type RegenerationCompleteInput = z.infer<typeof regenerationCompleteSchema>

export const transferSchema = z.object({
  column_id: z.string().uuid(),
  transfer_type: z.enum(['product', 'method', 'location', 'analyst']),
  from_value: z.string().min(1, 'From value is required'),
  to_value: z.string().min(1, 'To value is required'),
  reason: z.string().min(10, 'Please provide detailed reason (min 10 chars)'),
})

export type TransferInput = z.infer<typeof transferSchema>

export const discardSchema = z.object({
  column_id: z.string().uuid(),
  discard_reason: z.enum([
    'qc_head_decision',
    'sst_failure_post_regen',
    'high_backpressure',
    'physical_damage',
    'other',
  ]),
  reason_details: z.string().min(10, 'Please provide detailed reason (min 10 chars)'),
  destruction_method: z.string().optional(),
})

export type DiscardInput = z.infer<typeof discardSchema>

export const approvalActionSchema = z.object({
  action: z.enum(['approved', 'rejected']),
  remarks: z.string().min(1, 'Remarks are mandatory for all approval/rejection actions'),
})

export type ApprovalActionInput = z.infer<typeof approvalActionSchema>
