'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { regenerationInitSchema, regenerationCompleteSchema, type RegenerationInitInput, type RegenerationCompleteInput } from '@/lib/validations/regeneration'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { nowISO } from '@/lib/utils'
import Link from 'next/link'
import type { Column, ColumnRegeneration } from '@/types'

interface Step {
  description: string
  completed_at?: string
}

export default function RegenerationPage() {
  const router = useRouter()
  const params = useParams()
  const columnId = params.columnId as string
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState('')
  const [column, setColumn] = useState<Column | null>(null)
  const [existingRegen, setExistingRegen] = useState<ColumnRegeneration | null>(null)
  const [steps, setSteps] = useState<Step[]>([{ description: '' }])
  const [phase, setPhase] = useState<'initiate' | 'complete'>('initiate')

  const initForm = useForm<RegenerationInitInput>({
    resolver: zodResolver(regenerationInitSchema),
    defaultValues: { column_id: columnId },
  })

  const completeForm = useForm<RegenerationCompleteInput>({
    resolver: zodResolver(regenerationCompleteSchema),
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

      // Check if there's an existing open regeneration
      const { data: regen } = await supabase
        .from('column_regeneration')
        .select('*')
        .eq('column_id', columnId)
        .in('approval_status', ['pending_supervisor', 'pending_qc_head', 'pending_qa'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (regen) {
        setExistingRegen(regen as any)
        setSteps((regen.regeneration_steps as Step[]) || [{ description: '' }])
        setPhase('complete')
        completeForm.setValue('regeneration_id', regen.id)
      }
    }
    init()
  }, [columnId])

  const addStep = () => setSteps(prev => [...prev, { description: '' }])
  const removeStep = (idx: number) => setSteps(prev => prev.filter((_, i) => i !== idx))
  const updateStep = (idx: number, value: string) => {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, description: value } : s))
  }
  const markCompleted = (idx: number) => {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, completed_at: nowISO() } : s))
  }

  const onInitSubmit = async (data: RegenerationInitInput) => {
    setLoading(true)
    try {
      const approvalChain = {
        analyst: {
          user_id: userId,
          action: 'submitted',
          timestamp: nowISO(),
          remarks: data.failure_reason,
        },
      }

      const stepsWithNumbers = steps
        .filter(s => s.description.trim())
        .map((s, i) => ({ step: i + 1, ...s }))

      const { data: regen, error } = await supabase
        .from('column_regeneration')
        .insert({
          column_id: columnId,
          initiated_by: userId,
          initiated_at: nowISO(),
          failure_reason: data.failure_reason,
          sst_failure_details: data.sst_failure_details || null,
          regeneration_protocol_used: data.regeneration_protocol_used,
          regeneration_steps: stepsWithNumbers,
          approval_status: 'pending_supervisor',
          approval_chain: approvalChain,
        })
        .select()
        .single()

      if (error) throw error

      // Update column status to regeneration
      const { error: statusErr } = await supabase.from('columns').update({ status: 'regeneration' }).eq('id', columnId)
      if (statusErr) throw statusErr

      toast.success('Regeneration initiated and submitted for approval')
      router.push(`/columns/${columnId}`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate regeneration')
    } finally {
      setLoading(false)
    }
  }

  const onCompleteSubmit = async (data: RegenerationCompleteInput) => {
    if (!existingRegen) return
    setLoading(true)
    try {
      const completedSteps = steps.map((s, i) => ({
        step: i + 1,
        description: s.description,
        completed_at: s.completed_at || nowISO(),
      }))

      const outcome = data.post_regeneration_sst_result === 'pass'
        ? 'returned_to_service'
        : 'sent_for_discard'

      const { error } = await supabase
        .from('column_regeneration')
        .update({
          regeneration_steps: completedSteps,
          post_regeneration_sst_result: data.post_regeneration_sst_result,
          post_sst_parameters: {
            theoretical_plates: data.post_sst_theoretical_plates,
            tailing_factor: data.post_sst_tailing_factor,
            resolution: data.post_sst_resolution,
            back_pressure: data.post_sst_back_pressure,
          },
          outcome,
          completed_at: nowISO(),
        })
        .eq('id', existingRegen.id)

      if (error) throw error

      if (outcome === 'returned_to_service') {
        toast.success('Post-regeneration SST passed. Submitted for return-to-service approval.')
      } else {
        // SST failed — auto-raise discard via RPC (bypasses RLS since analyst cannot insert discard directly)
        toast.warning('Post-regeneration SST failed. Discard request raised for approval.')
        const { error: discardErr } = await supabase.rpc('auto_raise_discard_on_sst_failure', {
          p_column_id: columnId,
          p_initiated_by: userId,
          p_reason_details: `Post-regeneration SST failed. ${data.remarks || ''}`,
          p_cumulative_injections: column?.cumulative_injections ?? 0,
        })
        if (discardErr) throw discardErr
        // Column stays in 'regeneration' status until discard is approved
      }

      router.push(`/columns/${columnId}`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete regeneration')
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
          <h1 className="text-2xl font-bold text-gray-900">
            {phase === 'initiate' ? 'Initiate Column Regeneration' : 'Complete Regeneration'}
          </h1>
          {column && (
            <p className="text-sm text-gray-500">
              {column.column_id_number} · {(column as any).column_type?.name}
            </p>
          )}
        </div>
      </div>

      {phase === 'initiate' ? (
        <form onSubmit={initForm.handleSubmit(onInitSubmit)} className="space-y-6">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Failure Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Failure Reason <span className="text-red-500">*</span></Label>
                <Textarea
                  {...initForm.register('failure_reason')}
                  placeholder="Describe in detail why regeneration is needed (SST failure, high back pressure, etc.)"
                  rows={3}
                />
                {initForm.formState.errors.failure_reason && (
                  <p className="text-xs text-red-600">{initForm.formState.errors.failure_reason.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>SST Failure Details</Label>
                <Textarea
                  {...initForm.register('sst_failure_details')}
                  placeholder="e.g. Tailing factor: 2.45 (criterion: NMT 2.0). Theoretical plates: 8000 (criterion: NLT 10000)"
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Regeneration Protocol Reference <span className="text-red-500">*</span></Label>
                <Input
                  {...initForm.register('regeneration_protocol_used')}
                  placeholder="e.g. SOP-QC-COL-REGEN-001 Rev.2"
                />
                {initForm.formState.errors.regeneration_protocol_used && (
                  <p className="text-xs text-red-600">{initForm.formState.errors.regeneration_protocol_used.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Regeneration Steps</CardTitle>
                <Button type="button" size="sm" variant="outline" onClick={addStep}>
                  <Plus className="h-4 w-4 mr-1" />Add Step
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <span className="mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                    {idx + 1}
                  </span>
                  <Input
                    value={step.description}
                    onChange={e => updateStep(idx, e.target.value)}
                    placeholder={`Step ${idx + 1} description...`}
                    className="flex-1"
                  />
                  {steps.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="mt-0.5 h-9 w-9 text-red-400 hover:text-red-600" onClick={() => removeStep(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit Regeneration Request
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={completeForm.handleSubmit(onCompleteSubmit)} className="space-y-6">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Update Regeneration Steps</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <span className={`mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.completed_at ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm">{step.description}</p>
                    {step.completed_at ? (
                      <p className="text-xs text-green-600">Completed</p>
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => markCompleted(idx)}
                      >
                        Mark complete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Post-Regeneration SST</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Post-Regeneration SST Result <span className="text-red-500">*</span></Label>
                <Controller
                  name="post_regeneration_sst_result"
                  control={completeForm.control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select result..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pass">PASS — Column can return to service</SelectItem>
                        <SelectItem value="fail">FAIL — Column to be discarded</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="space-y-1.5">
                  <Label>Theoretical Plates</Label>
                  <Input type="number" {...completeForm.register('post_sst_theoretical_plates')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tailing Factor</Label>
                  <Input type="number" step="0.01" {...completeForm.register('post_sst_tailing_factor')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Resolution</Label>
                  <Input type="number" step="0.01" {...completeForm.register('post_sst_resolution')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Back Pressure</Label>
                  <Input type="number" {...completeForm.register('post_sst_back_pressure')} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Remarks <span className="text-red-500">*</span></Label>
                <Textarea {...completeForm.register('remarks')} placeholder="Describe post-regeneration SST results and conclusion..." rows={3} />
                {completeForm.formState.errors.remarks && (
                  <p className="text-xs text-red-600">{completeForm.formState.errors.remarks.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Complete Regeneration
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
