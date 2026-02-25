'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { qualificationSchema, type QualificationInput } from '@/lib/validations/qualification'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { nowISO } from '@/lib/utils'
import Link from 'next/link'
import type { Column } from '@/types'

export default function QualificationPage() {
  const router = useRouter()
  const params = useParams()
  const columnId = params.columnId as string
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState('')
  const [column, setColumn] = useState<Column | null>(null)

  const { register, handleSubmit, control, setValue, watch, formState: { errors } } = useForm<QualificationInput>({
    resolver: zodResolver(qualificationSchema),
    defaultValues: {
      column_id: columnId,
      qualification_date: new Date().toISOString().split('T')[0],
      result: 'pass',
    },
  })

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)
      const { data: col } = await supabase
        .from('columns')
        .select('*, column_type:column_types(name)')
        .eq('id', columnId)
        .single()
      setColumn(col as any)
    }
    init()
  }, [columnId])

  const onSubmit = async (data: QualificationInput) => {
    setLoading(true)
    try {
      const approvalChain = {
        analyst: {
          user_id: userId,
          action: 'submitted',
          timestamp: nowISO(),
          remarks: `Qualification submitted. Result: ${data.result.toUpperCase()}`,
        },
      }

      const { error } = await supabase.from('column_qualification').insert({
        column_id: data.column_id,
        qualification_date: data.qualification_date,
        test_standard_used: data.test_standard_used,
        mobile_phase: data.mobile_phase,
        theoretical_plates_result: data.theoretical_plates_result || null,
        tailing_factor_result: data.tailing_factor_result || null,
        resolution_result: data.resolution_result || null,
        back_pressure_result: data.back_pressure_result || null,
        theoretical_plates_criteria: data.theoretical_plates_criteria,
        tailing_factor_criteria: data.tailing_factor_criteria,
        resolution_criteria: data.resolution_criteria,
        back_pressure_criteria: data.back_pressure_criteria,
        result: data.result,
        remarks: data.remarks,
        performed_by: userId,
        approval_status: 'pending_supervisor',
        approval_chain: approvalChain,
      })

      if (error) throw error

      // If result is pass, update column status to await qualification approval
      // (Status will change to 'active' only after full approval chain)
      toast.success('Qualification submitted for approval')
      router.push(`/columns/${columnId}`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit qualification')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/columns/${columnId}`}>
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Column Qualification</h1>
          {column && <p className="text-sm text-gray-500">{column.column_id_number} · {(column as any).column_type?.name}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Test Parameters</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="qualification_date">Qualification Date <span className="text-red-500">*</span></Label>
              <Input id="qualification_date" type="date" {...register('qualification_date')} />
              {errors.qualification_date && <p className="text-xs text-red-600">{errors.qualification_date.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="test_standard_used">Test Standard Used <span className="text-red-500">*</span></Label>
              <Input id="test_standard_used" {...register('test_standard_used')} placeholder="e.g. Uracil, Benzophenone" />
              {errors.test_standard_used && <p className="text-xs text-red-600">{errors.test_standard_used.message}</p>}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="mobile_phase">Mobile Phase <span className="text-red-500">*</span></Label>
              <Input id="mobile_phase" {...register('mobile_phase')} placeholder="e.g. Acetonitrile:Water (10:90) with 0.1% TFA" />
              {errors.mobile_phase && <p className="text-xs text-red-600">{errors.mobile_phase.message}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Results vs. Criteria</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { field: 'theoretical_plates', label: 'Theoretical Plates (N)', placeholder: '12580', criteriaPlaceholder: 'NLT 2000' },
              { field: 'tailing_factor', label: 'Tailing Factor (T)', placeholder: '1.12', criteriaPlaceholder: 'NMT 2.0' },
              { field: 'resolution', label: 'Resolution (Rs)', placeholder: '2.45', criteriaPlaceholder: 'NLT 2.0' },
              { field: 'back_pressure', label: 'Back Pressure (bar)', placeholder: '185', criteriaPlaceholder: 'NMT 250 bar' },
            ].map(({ field, label, placeholder, criteriaPlaceholder }) => (
              <div key={field} className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>{label} — Observed</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...register(`${field}_result` as any)}
                    placeholder={placeholder}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{label} — Acceptance Criteria</Label>
                  <Input
                    {...register(`${field}_criteria` as any)}
                    placeholder={criteriaPlaceholder}
                  />
                  {errors[`${field}_criteria` as keyof QualificationInput] && (
                    <p className="text-xs text-red-600">{(errors as any)[`${field}_criteria`]?.message}</p>
                  )}
                </div>
              </div>
            ))}

            <div className="space-y-1.5">
              <Label>Overall Result <span className="text-red-500">*</span></Label>
              <Controller
                name="result"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pass">PASS — All criteria met</SelectItem>
                      <SelectItem value="fail">FAIL — One or more criteria not met</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Remarks <span className="text-red-500">*</span></CardTitle></CardHeader>
          <CardContent>
            <Textarea
              {...register('remarks')}
              placeholder="Mandatory: Describe the qualification procedure, observations, and conclusions. Reference the SOP used."
              rows={4}
            />
            {errors.remarks && <p className="mt-1 text-xs text-red-600">{errors.remarks.message}</p>}
          </CardContent>
        </Card>

        <div className="flex items-center gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : 'Submit Qualification'}
          </Button>
        </div>
      </form>
    </div>
  )
}
