import { z } from 'zod'

export const columnReceiptSchema = z.object({
  manufacturer: z.string().min(1, 'Manufacturer is required'),
  part_number: z.string().min(1, 'Part number is required'),
  serial_number: z.string().min(1, 'Serial number is required'),
  lot_number: z.string().min(1, 'Lot number is required'),
  column_type_id: z.string().uuid('Select a valid column type'),
  length_mm: z.coerce.number().positive('Length must be positive'),
  internal_diameter_mm: z.coerce.number().positive('Internal diameter must be positive'),
  particle_size_um: z.coerce.number().positive('Particle size must be positive'),
  bonded_phase: z.string().min(1, 'Bonded phase is required'),
  brand: z.string().optional(),
  received_date: z.string().min(1, 'Received date is required'),
  storage_location: z.string().min(1, 'Storage location is required'),
  storage_solvent: z.string().min(1, 'Storage solvent is required'),
  remarks: z.string().optional(),
})

export type ColumnReceiptInput = z.infer<typeof columnReceiptSchema>

export const columnTypeSchema = z.object({
  name: z.string().min(1, 'Column type name is required').max(100),
  description: z.string().optional(),
})

export type ColumnTypeInput = z.infer<typeof columnTypeSchema>
