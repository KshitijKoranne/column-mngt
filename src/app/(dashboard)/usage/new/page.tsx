'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { usageLogSchema, type UsageLogInput } from '@/lib/validations/usage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { nowISO } from '@/lib/utils'
import type { Column } from '@/types'
import Link from 'next/link'

export default function UsageLogPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState('')
  const [assignedColumns, setAssignedColumns] = useState<Column[]>([])
  const [userRole, setUserRole] = useState('')
  const [showSSTAlert, setShowSSTAlert] = useState(false)
  const [newRegenId, setNewRegenId] = useState<string | null>(null)

  const {
    register, handleSubmit, control, watch, setValue, formState: { errors },
  } = useForm<UsageLogInput>({
    resolver: zodResolver(usageLogSchema),
    defaultValues: {
      usage_date: new Date().toISOString().split('T')[0],
      pre_use_wash_done: true,
      post_use_wash_done: true,
      sst_result: 'pass',
    },
  })

  const sstResult = watch('sst_result')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile) setUserRole(profile.role)

      const { data: cols } = await supabase
        .from('columns')
        .select('id, column_id_number, assigned_product, assigned_method, column_type:column_types(name)')
        .eq('status', 'active')
        .order('column_id_number')
      setAssignedColumns((cols as any[]) || [])
    }
    init()
  }, [])

  const onSubmit = async (data: UsageLogInput) => {
    setLoading(true)
    try {
      const { data: log, error } = await supabase
        .from('column_usage_log')
        .insert({
          column_id: data.column_id,
          usage_date: data.usage_date,
          analyst_id: userId,
          product_name: data.product_name,
          ar_number: data.ar_number,
          analysis_test_name: data.analysis_test_name,
          method_reference: data.method_reference,
          injections_in_session: data.injections_in_session,
          cumulative_injections_after: 0, // will be updated by trigger
          sst_result: data.sst_result,
          sst_parameters: {
            theoretical_plates: data.sst_theoretical_plates,
            tailing_factor: data.sst_tailing_factor,
            resolution: data.sst_resolution,
            back_pressure: data.sst_back_pressure,
          },
          pre_use_wash_done: data.pre_use_wash_done,
          post_use_wash_done: data.post_use_wash_done,
          remarks: data.remarks || null,
        })
        .select()
        .single()

      if (error) throw error

      if (data.sst_result === 'fail') {
        toast.warning('SST Failed! Please initiate a regeneration request for this column.')
        setShowSSTAlert(true)
      } else {
        toast.success('Usage log recorded successfully')
        router.push('/columns')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to record usage')
    } finally {
      setLoading(false)
    }
  }

  const handleInitiateRegen = () => {
    const columnId = watch('column_id')
    if (columnId) router.push(`/regeneration/${columnId}`)
  }

  if (userRole && userRole !== 'analyst') {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Log Usage Session</h1>
        <p className="text-gray-500 mt-2">Usage logging is performed by analysts only.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Log Usage Session</h1>
        <p className="text-sm text-gray-500 mt-1">Record your HPLC/UPLC analysis session details and SST results.</p>
      </div>

      {showSSTAlert && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>SST Failure recorded.</strong> This column must be regenerated before further use.{' '}
            <button onClick={handleInitiateRegen} className="underline font-semibold">
              Click here to initiate regeneration
            </button>
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Session Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Column <span className="text-red-500">*</span></Label>
              <Controller
                name="column_id"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select active column..." />
                    </SelectTrigger>
                    <SelectContent>
                      {assignedColumns.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="font-mono font-semibold">{c.column_id_number}</span>
                          {' — '}{(c as any).column_type?.name}
                          {c.assigned_product && ` · ${c.assigned_product}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.column_id && <p className="text-xs text-red-600">{errors.column_id.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="usage_date">Usage Date <span className="text-red-500">*</span></Label>
              <Input id="usage_date" type="date" {...register('usage_date')} />
              {errors.usage_date && <p className="text-xs text-red-600">{errors.usage_date.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="injections_in_session">Injections This Session <span className="text-red-500">*</span></Label>
              <Input id="injections_in_session" type="number" min={1} {...register('injections_in_session')} />
              {errors.injections_in_session && <p className="text-xs text-red-600">{errors.injections_in_session.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product_name">Product Name <span className="text-red-500">*</span></Label>
              <Input id="product_name" {...register('product_name')} placeholder="e.g. Metformin HCl Tablets 500mg" />
              {errors.product_name && <p className="text-xs text-red-600">{errors.product_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ar_number">AR / Batch Number <span className="text-red-500">*</span></Label>
              <Input id="ar_number" {...register('ar_number')} placeholder="e.g. AR/2024/0125" />
              {errors.ar_number && <p className="text-xs text-red-600">{errors.ar_number.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="analysis_test_name">Test Name <span className="text-red-500">*</span></Label>
              <Input id="analysis_test_name" {...register('analysis_test_name')} placeholder="e.g. Assay by HPLC" />
              {errors.analysis_test_name && <p className="text-xs text-red-600">{errors.analysis_test_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="method_reference">Method Reference <span className="text-red-500">*</span></Label>
              <Input id="method_reference" {...register('method_reference')} placeholder="e.g. QC-METH-001 Rev.3" />
              {errors.method_reference && <p className="text-xs text-red-600">{errors.method_reference.message}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">System Suitability Test (SST)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>SST Result <span className="text-red-500">*</span></Label>
              <Controller
                name="sst_result"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className={sstResult === 'fail' ? 'border-red-400' : ''}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pass">PASS</SelectItem>
                      <SelectItem value="fail">FAIL</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {sstResult === 'fail' && (
                <p className="text-xs text-red-600 font-medium">
                  Warning: SST Failure will flag this column for regeneration.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="sst_theoretical_plates">Theoretical Plates</Label>
                <Input id="sst_theoretical_plates" type="number" {...register('sst_theoretical_plates')} placeholder="12000" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sst_tailing_factor">Tailing Factor</Label>
                <Input id="sst_tailing_factor" type="number" step="0.01" {...register('sst_tailing_factor')} placeholder="1.15" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sst_resolution">Resolution</Label>
                <Input id="sst_resolution" type="number" step="0.01" {...register('sst_resolution')} placeholder="2.45" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sst_back_pressure">Back Pressure (bar)</Label>
                <Input id="sst_back_pressure" type="number" {...register('sst_back_pressure')} placeholder="185" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Column Care</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium text-sm">Pre-use wash completed</p>
                <p className="text-xs text-gray-500">Column conditioned before analysis</p>
              </div>
              <Controller
                name="pre_use_wash_done"
                control={control}
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium text-sm">Post-use wash completed</p>
                <p className="text-xs text-gray-500">Column flushed with storage solvent after analysis</p>
              </div>
              <Controller
                name="post_use_wash_done"
                control={control}
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea id="remarks" {...register('remarks')} placeholder="Any observations, anomalies, or notes about this session..." rows={2} />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Record Usage Session'}
          </Button>
        </div>
      </form>
    </div>
  )
}
