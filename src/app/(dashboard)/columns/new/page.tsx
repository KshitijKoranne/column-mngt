'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Upload, FlaskConical } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { columnReceiptSchema, type ColumnReceiptInput } from '@/lib/validations/column'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import type { ColumnType } from '@/types'
import { nowISO } from '@/lib/utils'

export default function RegisterColumnPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [columnTypes, setColumnTypes] = useState<ColumnType[]>([])
  const [coaFile, setCoaFile] = useState<File | null>(null)
  const [userId, setUserId] = useState<string>('')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ColumnReceiptInput>({
    resolver: zodResolver(columnReceiptSchema),
  })

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)

      const { data: types } = await supabase
        .from('column_types')
        .select('*')
        .eq('is_active', true)
        .order('name')
      setColumnTypes(types || [])
    }
    init()
  }, [])

  const onSubmit = async (data: ColumnReceiptInput) => {
    setLoading(true)
    try {
      let coaUrl: string | null = null

      // Upload CoA if provided
      if (coaFile) {
        const ext = coaFile.name.split('.').pop()
        const path = `coa/${Date.now()}-${userId}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('column-documents')
          .upload(path, coaFile)
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('column-documents').getPublicUrl(path)
          coaUrl = urlData.publicUrl
        }
      }

      const approvalChain = {
        analyst: {
          user_id: userId,
          action: 'submitted',
          timestamp: nowISO(),
          remarks: data.remarks || 'Column receipt submitted for authorization.',
        },
      }

      const { data: column, error } = await supabase
        .from('columns')
        .insert({
          manufacturer: data.manufacturer,
          part_number: data.part_number,
          serial_number: data.serial_number,
          lot_number: data.lot_number,
          column_type_id: data.column_type_id,
          length_mm: data.length_mm,
          internal_diameter_mm: data.internal_diameter_mm,
          particle_size_um: data.particle_size_um,
          bonded_phase: data.bonded_phase,
          brand: data.brand || null,
          received_date: data.received_date,
          received_by: userId,
          certificate_of_analysis_url: coaUrl,
          storage_location: data.storage_location,
          storage_solvent: data.storage_solvent,
          status: 'received',
          receipt_approval_status: 'pending_supervisor',
          receipt_approval_chain: approvalChain,
          remarks: data.remarks || null,
        })
        .select()
        .single()

      if (error) throw error

      toast.success(`Column registered successfully! ID: ${column.column_id_number}`)
      router.push(`/columns/${column.id}`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to register column')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Register New Column</h1>
        <p className="text-sm text-gray-500 mt-1">
          Fill in all details from the Certificate of Analysis. A unique Column ID will be auto-assigned.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Identification */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-blue-700" />
              Column Identification
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="manufacturer">Manufacturer <span className="text-red-500">*</span></Label>
              <Input id="manufacturer" {...register('manufacturer')} placeholder="e.g. Waters Corporation" />
              {errors.manufacturer && <p className="text-xs text-red-600">{errors.manufacturer.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brand">Brand / Product Name</Label>
              <Input id="brand" {...register('brand')} placeholder="e.g. Atlantis T3" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="part_number">Part Number <span className="text-red-500">*</span></Label>
              <Input id="part_number" {...register('part_number')} placeholder="e.g. 186002352" />
              {errors.part_number && <p className="text-xs text-red-600">{errors.part_number.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="serial_number">Serial Number <span className="text-red-500">*</span></Label>
              <Input id="serial_number" {...register('serial_number')} placeholder="e.g. SN-WC18-2024-0042" />
              {errors.serial_number && <p className="text-xs text-red-600">{errors.serial_number.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lot_number">Lot/Batch Number <span className="text-red-500">*</span></Label>
              <Input id="lot_number" {...register('lot_number')} placeholder="e.g. LOT-2024-0156" />
              {errors.lot_number && <p className="text-xs text-red-600">{errors.lot_number.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Column Type <span className="text-red-500">*</span></Label>
              <Select onValueChange={(v) => setValue('column_type_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select column type..." />
                </SelectTrigger>
                <SelectContent>
                  {columnTypes.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.column_type_id && <p className="text-xs text-red-600">{errors.column_type_id.message}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Dimensions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Column Specifications</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="length_mm">Length (mm) <span className="text-red-500">*</span></Label>
              <Input id="length_mm" type="number" step="0.01" {...register('length_mm')} placeholder="150" />
              {errors.length_mm && <p className="text-xs text-red-600">{errors.length_mm.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="internal_diameter_mm">ID (mm) <span className="text-red-500">*</span></Label>
              <Input id="internal_diameter_mm" type="number" step="0.01" {...register('internal_diameter_mm')} placeholder="4.6" />
              {errors.internal_diameter_mm && <p className="text-xs text-red-600">{errors.internal_diameter_mm.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="particle_size_um">Particle Size (µm) <span className="text-red-500">*</span></Label>
              <Input id="particle_size_um" type="number" step="0.1" {...register('particle_size_um')} placeholder="3.5" />
              {errors.particle_size_um && <p className="text-xs text-red-600">{errors.particle_size_um.message}</p>}
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="bonded_phase">Bonded Phase <span className="text-red-500">*</span></Label>
              <Input id="bonded_phase" {...register('bonded_phase')} placeholder="e.g. C18 (Octadecylsilane)" />
              {errors.bonded_phase && <p className="text-xs text-red-600">{errors.bonded_phase.message}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Receipt & Storage */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Receipt & Storage</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="received_date">Received Date <span className="text-red-500">*</span></Label>
              <Input id="received_date" type="date" {...register('received_date')} />
              {errors.received_date && <p className="text-xs text-red-600">{errors.received_date.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="storage_location">Storage Location <span className="text-red-500">*</span></Label>
              <Input id="storage_location" {...register('storage_location')} placeholder="e.g. Cabinet A, Shelf 2" />
              {errors.storage_location && <p className="text-xs text-red-600">{errors.storage_location.message}</p>}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="storage_solvent">Storage Solvent <span className="text-red-500">*</span></Label>
              <Input id="storage_solvent" {...register('storage_solvent')} placeholder="e.g. 90:10 Water:Acetonitrile" />
              {errors.storage_solvent && <p className="text-xs text-red-600">{errors.storage_solvent.message}</p>}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="coa">Certificate of Analysis (CoA)</Label>
              <div className="flex items-center gap-3">
                <label htmlFor="coa-upload" className="cursor-pointer flex items-center gap-2 rounded-md border border-dashed px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                  <Upload className="h-4 w-4" />
                  {coaFile ? coaFile.name : 'Upload PDF / Image'}
                </label>
                <input
                  id="coa-upload"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => setCoaFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Remarks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Remarks</CardTitle>
            <CardDescription>Any additional notes for the receipt record</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea {...register('remarks')} placeholder="e.g. Column received in good condition. CoA verified." rows={3} />
          </CardContent>
        </Card>

        <div className="flex items-center gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registering...</> : 'Register Column'}
          </Button>
        </div>
      </form>
    </div>
  )
}
