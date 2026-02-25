import { z } from 'zod'

export const qualificationSchema = z.object({
  column_id: z.string().uuid(),
  qualification_date: z.string().min(1, 'Qualification date is required'),
  test_standard_used: z.string().min(1, 'Test standard is required'),
  mobile_phase: z.string().min(1, 'Mobile phase is required'),
  theoretical_plates_result: z.coerce.number().optional(),
  tailing_factor_result: z.coerce.number().optional(),
  resolution_result: z.coerce.number().optional(),
  back_pressure_result: z.coerce.number().optional(),
  theoretical_plates_criteria: z.string().min(1, 'Criteria required'),
  tailing_factor_criteria: z.string().min(1, 'Criteria required'),
  resolution_criteria: z.string().min(1, 'Criteria required'),
  back_pressure_criteria: z.string().min(1, 'Criteria required'),
  result: z.enum(['pass', 'fail']),
  remarks: z.string().min(1, 'Remarks are mandatory for GMP compliance'),
})

export type QualificationInput = z.infer<typeof qualificationSchema>

export const issuanceSchema = z.object({
  column_id: z.string().uuid(),
  issued_to: z.string().uuid('Select an analyst'),
  product_name: z.string().min(1, 'Product name is required'),
  method_reference: z.string().min(1, 'Method reference is required'),
  ar_number: z.string().min(1, 'AR number is required'),
  remarks: z.string().optional(),
})

export type IssuanceInput = z.infer<typeof issuanceSchema>
