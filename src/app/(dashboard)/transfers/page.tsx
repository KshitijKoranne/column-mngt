'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, ArrowLeftRight } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { transferSchema, type TransferInput } from '@/lib/validations/regeneration'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ApprovalBadge } from '@/components/columns/StatusBadge'
import { formatDate, nowISO, TRANSFER_TYPE_LABELS } from '@/lib/utils'
import Link from 'next/link'
import type { Column, ColumnTransfer } from '@/types'

export default function TransfersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preColumnId = searchParams.get('column')
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [columns, setColumns] = useState<Column[]>([])
  const [transfers, setTransfers] = useState<any[]>([])
  const [userId, setUserId] = useState('')
  const [analysts, setAnalysts] = useState<any[]>([])

  const { register, handleSubmit, control, watch, setValue, formState: { errors }, reset } = useForm<TransferInput>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      column_id: preColumnId || '',
      transfer_type: 'product',
    },
  })

  const selectedType = watch('transfer_type')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserId(user.id)

      const { data: cols } = await supabase
        .from('columns')
        .select('id, column_id_number, assigned_product, assigned_method, storage_location, assigned_analyst_id, status, column_type:column_types(name)')
        .in('status', ['active', 'qualification_pending'])
        .order('column_id_number')
      setColumns((cols as any[]) || [])

      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'analyst')
        .eq('is_active', true)
      setAnalysts(profs || [])

      const { data: txfrs } = await supabase
        .from('column_transfers')
        .select('*, column:columns(column_id_number), initiated_by_profile:profiles!column_transfers_initiated_by_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(20)
      setTransfers((txfrs as any[]) || [])
    }
    init()
  }, [])

  const selectedColumn = columns.find(c => c.id === watch('column_id'))

  // Auto-populate from_value based on transfer type and selected column
  const getFromValue = () => {
    if (!selectedColumn) return ''
    switch (selectedType) {
      case 'product': return selectedColumn.assigned_product || ''
      case 'method': return selectedColumn.assigned_method || ''
      case 'location': return (selectedColumn as any).storage_location || ''
      case 'analyst': {
        const a = analysts.find((x: any) => x.id === selectedColumn.assigned_analyst_id)
        return a?.full_name || ''
      }
      default: return ''
    }
  }

  // Sync from_value when column or type changes
  useEffect(() => {
    setValue('from_value', getFromValue())
  }, [watch('column_id'), selectedType])

  const onSubmit = async (data: TransferInput) => {
    setLoading(true)
    try {
      const approvalChain = {
        analyst: {
          user_id: userId,
          action: 'submitted',
          timestamp: nowISO(),
          remarks: data.reason,
        },
      }

      const { error } = await supabase.from('column_transfers').insert({
        column_id: data.column_id,
        transfer_type: data.transfer_type,
        from_value: data.from_value,
        to_value: data.to_value,
        reason: data.reason,
        initiated_by: userId,
        approval_status: 'pending_supervisor',
        approval_chain: approvalChain,
      })

      if (error) throw error

      toast.success('Transfer request submitted for approval')
      reset()
      router.push('/columns')
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit transfer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Column Transfers</h1>
        <p className="text-sm text-gray-500 mt-1">Request product, method, location, or analyst re-assignment for a column.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Transfer request form */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4" />
                New Transfer Request
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Column <span className="text-red-500">*</span></Label>
                  <Controller
                    name="column_id"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select column..." />
                        </SelectTrigger>
                        <SelectContent>
                          {columns.map(c => (
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
                  <Label>Transfer Type <span className="text-red-500">*</span></Label>
                  <Controller
                    name="transfer_type"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="product">Product Transfer</SelectItem>
                          <SelectItem value="method">Method Transfer</SelectItem>
                          <SelectItem value="location">Location Transfer</SelectItem>
                          <SelectItem value="analyst">Analyst Re-assignment</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>From <span className="text-red-500">*</span></Label>
                    <Input
                      {...register('from_value')}
                      placeholder={selectedColumn ? getFromValue() || 'Current value...' : 'Current value...'}
                      defaultValue={getFromValue()}
                    />
                    {errors.from_value && <p className="text-xs text-red-600">{errors.from_value.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>To <span className="text-red-500">*</span></Label>
                    <Input {...register('to_value')} placeholder="New value..." />
                    {errors.to_value && <p className="text-xs text-red-600">{errors.to_value.message}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Reason / Justification <span className="text-red-500">*</span></Label>
                  <Textarea
                    {...register('reason')}
                    placeholder="Mandatory: Provide detailed justification for the transfer request..."
                    rows={3}
                  />
                  {errors.reason && <p className="text-xs text-red-600">{errors.reason.message}</p>}
                </div>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Submit Transfer Request
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Recent transfers */}
        <div>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Recent Transfer Requests</h2>
          {transfers.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ArrowLeftRight className="mx-auto h-8 w-8 text-gray-200 mb-2" />
              <p>No transfer requests yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transfers.map(t => (
                <div key={t.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-1">
                    <Link href={`/columns/${t.column_id}`} className="font-mono text-sm font-bold text-blue-700 hover:underline">
                      {t.column?.column_id_number}
                    </Link>
                    <ApprovalBadge status={t.approval_status} />
                  </div>
                  <p className="text-sm text-gray-700">{TRANSFER_TYPE_LABELS[t.transfer_type]}</p>
                  <p className="text-xs text-gray-500">{t.from_value} → <strong>{t.to_value}</strong></p>
                  <p className="text-xs text-gray-400 mt-1">
                    By {t.initiated_by_profile?.full_name} · {formatDate(t.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
