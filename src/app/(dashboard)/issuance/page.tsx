'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Package } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { issuanceSchema, type IssuanceInput } from '@/lib/validations/qualification'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ApprovalBadge } from '@/components/columns/StatusBadge'
import { formatDate, nowISO } from '@/lib/utils'
import type { Column } from '@/types'

export default function IssuancePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState('')
  const [userRole, setUserRole] = useState('')
  const [activeColumns, setActiveColumns] = useState<Column[]>([])
  const [analysts, setAnalysts] = useState<any[]>([])
  const [recentIssuances, setRecentIssuances] = useState<any[]>([])

  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors } } = useForm<IssuanceInput>({
    resolver: zodResolver(issuanceSchema),
  })

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setUserRole(profile?.role || '')

      const { data: cols } = await supabase
        .from('columns')
        .select('id, column_id_number, status, column_type:column_types(name), assigned_product, assigned_method')
        .eq('status', 'active')
        .order('column_id_number')
      setActiveColumns((cols as any[]) || [])

      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'analyst')
        .eq('is_active', true)
        .order('full_name')
      setAnalysts(profs || [])

      const { data: iss } = await supabase
        .from('column_issuance')
        .select('*, column:columns(column_id_number), issued_to_profile:profiles!column_issuance_issued_to_fkey(full_name), issued_by_profile:profiles!column_issuance_issued_by_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(10)
      setRecentIssuances((iss as any[]) || [])
    }
    init()
  }, [])

  if (userRole && !['supervisor', 'qc_head'].includes(userRole)) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Column Issuance</h1>
        <p className="text-gray-500 mt-2">This page is restricted to QC Supervisors and QC Head.</p>
      </div>
    )
  }

  const onSubmit = async (data: IssuanceInput) => {
    setLoading(true)
    try {
      const approvalChain = {
        supervisor: {
          user_id: userId,
          action: 'submitted',
          timestamp: nowISO(),
          remarks: data.remarks || `Column issued to analyst for ${data.product_name}`,
        },
      }

      const { error } = await supabase.from('column_issuance').insert({
        column_id: data.column_id,
        issued_to: data.issued_to,
        issued_by: userId,
        product_name: data.product_name,
        method_reference: data.method_reference,
        ar_number: data.ar_number,
        approval_status: 'pending_qc_head',
        approval_chain: approvalChain,
        remarks: data.remarks || null,
      })

      if (error) throw error

      // NOTE: Column assignment fields (analyst, product, method) are updated
      // by the DB trigger sync_column_assignment_on_issuance_approval
      // only AFTER QA gives final approval — not at submission time.

      toast.success('Column issuance submitted for QC Head approval')
      reset()
      router.push('/approvals')
    } catch (err: any) {
      toast.error(err.message || 'Failed to issue column')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Issue Column to Analyst</h1>
        <p className="text-sm text-gray-500 mt-1">Link a qualified column to an analyst with product and method details.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Issue Column
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Active Column <span className="text-red-500">*</span></Label>
                <Controller
                  name="column_id"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a qualified, active column..." />
                      </SelectTrigger>
                      <SelectContent>
                        {activeColumns.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="font-mono font-semibold">{c.column_id_number}</span>
                            {' — '}{(c as any).column_type?.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.column_id && <p className="text-xs text-red-600">{errors.column_id.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Issue to Analyst <span className="text-red-500">*</span></Label>
                <Controller
                  name="issued_to"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select analyst..." />
                      </SelectTrigger>
                      <SelectContent>
                        {analysts.map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.full_name} ({a.email})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.issued_to && <p className="text-xs text-red-600">{errors.issued_to.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Product Name <span className="text-red-500">*</span></Label>
                <Input {...register('product_name')} placeholder="e.g. Metformin HCl Tablets 500mg" />
                {errors.product_name && <p className="text-xs text-red-600">{errors.product_name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Method Reference <span className="text-red-500">*</span></Label>
                <Input {...register('method_reference')} placeholder="e.g. QC-METH-001 Rev.3" />
                {errors.method_reference && <p className="text-xs text-red-600">{errors.method_reference.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>AR / Batch Number <span className="text-red-500">*</span></Label>
                <Input {...register('ar_number')} placeholder="e.g. AR/2024/0125" />
                {errors.ar_number && <p className="text-xs text-red-600">{errors.ar_number.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Remarks</Label>
                <Textarea {...register('remarks')} placeholder="Optional notes about this issuance..." rows={2} />
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Issue Column (Pending QC Head Approval)
              </Button>
            </form>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Recent Issuances</h2>
          {recentIssuances.length === 0 ? (
            <p className="text-sm text-gray-400">No issuances yet</p>
          ) : (
            <div className="space-y-3">
              {recentIssuances.map(i => (
                <div key={i.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm font-bold text-blue-700">{i.column?.column_id_number}</span>
                    <ApprovalBadge status={i.approval_status} />
                  </div>
                  <p className="text-sm">{i.issued_to_profile?.full_name} ← {i.product_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">By {i.issued_by_profile?.full_name} · {formatDate(i.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
