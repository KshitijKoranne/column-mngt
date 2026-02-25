import { z } from 'zod'

export const usageLogSchema = z.object({
  column_id: z.string().uuid('Select a column'),
  usage_date: z.string().min(1, 'Usage date is required'),
  product_name: z.string().min(1, 'Product name is required'),
  ar_number: z.string().min(1, 'AR/Batch number is required'),
  analysis_test_name: z.string().min(1, 'Test name is required'),
  method_reference: z.string().min(1, 'Method reference is required'),
  injections_in_session: z.coerce.number().int().positive('Must be at least 1 injection'),
  sst_result: z.enum(['pass', 'fail']),
  sst_theoretical_plates: z.coerce.number().optional(),
  sst_tailing_factor: z.coerce.number().optional(),
  sst_resolution: z.coerce.number().optional(),
  sst_back_pressure: z.coerce.number().optional(),
  pre_use_wash_done: z.boolean(),
  post_use_wash_done: z.boolean(),
  remarks: z.string().optional(),
})

export type UsageLogInput = z.infer<typeof usageLogSchema>
