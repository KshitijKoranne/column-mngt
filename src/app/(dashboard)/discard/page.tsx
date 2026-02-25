'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, AlertTriangle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { discardSchema, type DiscardInput } from '@/lib/validations/regeneration'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { nowISO, DISCARD_REASON_LABELS } from '@/lib/utils'
import Link from 'next/link'
import type { Column } from '@/types'

export default function DiscardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preColumnId = searchParams.get('column')
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [columns, setColumns] = useState<Column[]>([])
  const [userId, setUserId] = useState('')
  const [userRole, setUserRole] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [formData, setFormData] = useState<DiscardInput | null>(null)

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<DiscardInput>({
    resolver: zodResolver(discardSchema),
    defaultValues: {
      column_id: preColumnId || '',
      discard_reason: 'qc_head_decision',
    },
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
        .select('id, column_id_number, cumulative_injections, status, column_type:column_types(name), manufacturer')
        .neq('status', 'discarded')
        .order('column_id_number')
      setColumns((cols as any[]) || [])
    }
    init()
  }, [])

  if (userRole && userRole !== 'qc_head') {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Column Discard</h1>
        <Alert variant="destructive" className="mt-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Only QC Head can initiate column discard. This page is restricted.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const onSubmit = (data: DiscardInput) => {
    setFormData(data)
    setConfirmOpen(true)
  }

  const handleConfirmedDiscard = async () => {
    if (!formData) return
    setLoading(true)
    try {
      const selectedCol = columns.find(c => c.id === formData.column_id)
      if (!selectedCol) throw new Error('Column not found')

      const approvalChain = {
        qc_head: {
          user_id: userId,
          action: 'submitted',
          timestamp: nowISO(),
          remarks: formData.reason_details,
        },
      }

      const { error } = await supabase.from('column_discard').insert({
        column_id: formData.column_id,
        discard_reason: formData.discard_reason,
        reason_details: formData.reason_details,
        cumulative_injections_at_discard: selectedCol.cumulative_injections,
        destruction_method: formData.destruction_method || null,
        initiated_by: userId,
        approval_status: 'pending_supervisor',
        approval_chain: approvalChain,
      })

      if (error) throw error

      toast.success('Discard request submitted for approval chain')
      setConfirmOpen(false)
      router.push('/columns')
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate discard')
    } finally {
      setLoading(false)
    }
  }

  const selectedColumn = columns.find(c => c.id === watch('column_id'))

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-red-700 flex items-center gap-2">
          <Trash2 className="h-6 w-6" />
          Initiate Column Discard
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          QC Head authority only. This action triggers the full approval chain.
        </p>
      </div>

      <Alert variant="warning">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>GMP Notice:</strong> Column discard is irreversible once fully approved.
          The column will be permanently locked from all future activities.
          Ensure all relevant data has been reviewed before proceeding.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Column Selection</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Select Column <span className="text-red-500">*</span></Label>
              <Controller
                name="column_id"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select column to discard..." />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="font-mono font-semibold">{c.column_id_number}</span>
                          {' — '}{(c as any).column_type?.name}
                          {' · '}{c.cumulative_injections.toLocaleString()} injections
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.column_id && <p className="text-xs text-red-600">{errors.column_id.message}</p>}
            </div>

            {selectedColumn && (
              <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
                <p><strong>Column ID:</strong> {selectedColumn.column_id_number}</p>
                <p><strong>Manufacturer:</strong> {selectedColumn.manufacturer}</p>
                <p><strong>Cumulative Injections:</strong> {selectedColumn.cumulative_injections.toLocaleString()}</p>
                <p><strong>Current Status:</strong> {selectedColumn.status}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Discard Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Discard Reason <span className="text-red-500">*</span></Label>
              <Controller
                name="discard_reason"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DISCARD_REASON_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Detailed Justification <span className="text-red-500">*</span></Label>
              <Textarea
                {...register('reason_details')}
                placeholder="Mandatory: Provide complete justification for column discard. Reference supporting data (SST records, maintenance logs, etc.)"
                rows={4}
              />
              {errors.reason_details && <p className="text-xs text-red-600">{errors.reason_details.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Physical Destruction Method</Label>
              <Input
                {...register('destruction_method')}
                placeholder="e.g. Physically cut and disposed in chemical waste container"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" variant="destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Initiate Discard
          </Button>
        </div>
      </form>

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={(v) => { if (!loading) setConfirmOpen(v) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-700">Confirm Column Discard</DialogTitle>
            <DialogDescription>
              This action will initiate the discard workflow for{' '}
              <strong>{selectedColumn?.column_id_number}</strong>.
              The column will go through the full approval chain before being permanently discarded.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to proceed? This cannot be undone once the approval chain is completed.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmedDiscard} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Yes, Initiate Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
