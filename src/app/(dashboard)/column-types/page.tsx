'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Pencil, CheckCircle, XCircle, Loader2, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { columnTypeSchema, type ColumnTypeInput } from '@/lib/validations/column'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { formatDate } from '@/lib/utils'
import type { ColumnType } from '@/types'

export default function ColumnTypesPage() {
  const supabase = createClient()
  const [columnTypes, setColumnTypes] = useState<ColumnType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingType, setEditingType] = useState<ColumnType | null>(null)
  const [saving, setSaving] = useState(false)
  const [userRole, setUserRole] = useState('')
  const [userId, setUserId] = useState('')

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ColumnTypeInput>({
    resolver: zodResolver(columnTypeSchema),
  })

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setUserRole(profile?.role || '')
      }
      await fetchTypes()
    }
    init()
  }, [])

  const fetchTypes = async () => {
    const { data } = await supabase
      .from('column_types')
      .select('*, creator:profiles!column_types_created_by_fkey(full_name)')
      .order('name')
    setColumnTypes((data as any[]) || [])
    setLoading(false)
  }

  const openAdd = () => { setEditingType(null); reset(); setDialogOpen(true) }
  const openEdit = (ct: ColumnType) => {
    setEditingType(ct)
    setValue('name', ct.name)
    setValue('description', ct.description || '')
    setDialogOpen(true)
  }

  const onSubmit = async (data: ColumnTypeInput) => {
    setSaving(true)
    try {
      if (editingType) {
        const { error } = await supabase
          .from('column_types')
          .update({ name: data.name, description: data.description || null })
          .eq('id', editingType.id)
        if (error) throw error
        toast.success('Column type updated')
      } else {
        const { error } = await supabase
          .from('column_types')
          .insert({ name: data.name, description: data.description || null, created_by: userId })
        if (error) throw error
        toast.success('Column type added')
      }
      setDialogOpen(false)
      reset()
      await fetchTypes()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save column type')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (ct: ColumnType) => {
    if (userRole !== 'qc_head') return
    const { error } = await supabase
      .from('column_types')
      .update({ is_active: !ct.is_active })
      .eq('id', ct.id)
    if (error) { toast.error('Failed to update status'); return }
    toast.success(`Column type ${ct.is_active ? 'deactivated' : 'activated'}`)
    await fetchTypes()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Column Types</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage the column type catalog. These types appear in the column registration form.
          </p>
        </div>
        {userRole === 'qc_head' && (
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Column Type
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {columnTypes.map(ct => (
            <Card key={ct.id} className={ct.is_active ? '' : 'opacity-60'}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                      <Tag className="h-4 w-4 text-blue-700" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{ct.name}</p>
                      <p className="text-xs text-gray-400">Added {formatDate(ct.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {userRole === 'qc_head' && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(ct)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Switch checked={ct.is_active} onCheckedChange={() => toggleActive(ct)} />
                      </>
                    )}
                    {!userRole.includes('qc_head') && (
                      <Badge variant={ct.is_active ? 'success' : 'secondary'}>
                        {ct.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    )}
                  </div>
                </div>
                {ct.description && (
                  <p className="mt-2 text-xs text-gray-600">{ct.description}</p>
                )}
                {(ct as any).creator && (
                  <p className="mt-2 text-[10px] text-gray-400">Created by: {(ct as any).creator.full_name}</p>
                )}
              </CardContent>
            </Card>
          ))}
          {columnTypes.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
              <Tag className="h-12 w-12 text-gray-200 mb-4" />
              <p>No column types defined yet.</p>
              {userRole === 'qc_head' && (
                <Button className="mt-4" onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Add First Type</Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!saving) { setDialogOpen(v); reset() } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType ? 'Edit Column Type' : 'Add New Column Type'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Column Type Name <span className="text-red-500">*</span></Label>
              <Input id="name" {...register('name')} placeholder="e.g. Reverse Phase C18" disabled={saving} />
              {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...register('description')} placeholder="Optional description of this column type..." disabled={saving} rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); reset() }} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingType ? 'Save Changes' : 'Add Type'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
