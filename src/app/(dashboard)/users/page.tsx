'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, AlertTriangle, UserPlus, Users, ShieldCheck, ShieldOff } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ROLE_LABELS } from '@/lib/constants'
import { ROLE_CONFIG, formatIST } from '@/lib/utils'
import type { Profile, UserRole } from '@/types'

const createUserSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['analyst', 'supervisor', 'qc_head', 'qa'] as const),
  department: z.string().min(1, 'Department is required'),
})
type CreateUserInput = z.infer<typeof createUserSchema>

export default function UsersPage() {
  const supabase = createClient()
  const [userRole, setUserRole] = useState('')
  const [users, setUsers] = useState<Profile[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { department: 'QC Laboratory', role: 'analyst' },
  })

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true)
    const res = await fetch('/api/admin/users')
    if (res.ok) {
      const data = await res.json()
      setUsers(data)
    }
    setLoadingUsers(false)
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setUserRole(profile?.role || '')
      fetchUsers()
    }
    init()
  }, [fetchUsers])

  const onSubmit = async (data: CreateUserInput) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create user')
      toast.success(`User ${data.full_name} created successfully`)
      setDialogOpen(false)
      reset({ department: 'QC Laboratory', role: 'analyst' })
      fetchUsers()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (id: string, currentActive: boolean) => {
    setTogglingId(id)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentActive }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to update user')
      toast.success(`User ${currentActive ? 'deactivated' : 'activated'}`)
      fetchUsers()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setTogglingId(null)
    }
  }

  if (userRole && userRole !== 'qc_head') {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <Alert variant="destructive" className="mt-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Only QC Head can manage users. This page is restricted.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6" />
            User Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage application users. QC Head only.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingUsers ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-gray-500 py-12 text-sm">No users found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell className="text-gray-600">{u.email}</TableCell>
                    <TableCell>
                      <Badge className={ROLE_CONFIG[u.role as UserRole]?.color || 'bg-gray-100 text-gray-800'}>
                        {ROLE_LABELS[u.role as UserRole] || u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-600">{u.department || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={u.is_active ? 'default' : 'secondary'}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">{formatIST(u.created_at, 'dd MMM yyyy')}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(u.id, u.is_active)}
                        disabled={togglingId === u.id}
                      >
                        {togglingId === u.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : u.is_active
                            ? <><ShieldOff className="h-4 w-4 mr-1" />Deactivate</>
                            : <><ShieldCheck className="h-4 w-4 mr-1" />Activate</>
                        }
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!submitting) { setDialogOpen(v); if (!v) reset({ department: 'QC Laboratory', role: 'analyst' }) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Full Name <span className="text-red-500">*</span></Label>
              <Input {...register('full_name')} placeholder="e.g. Priya Sharma" />
              {errors.full_name && <p className="text-xs text-red-600">{errors.full_name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input {...register('email')} type="email" placeholder="user@pharma.com" />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Password <span className="text-red-500">*</span></Label>
              <Input {...register('password')} type="password" placeholder="Min. 8 characters" />
              {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Role <span className="text-red-500">*</span></Label>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.role && <p className="text-xs text-red-600">{errors.role.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Department <span className="text-red-500">*</span></Label>
              <Input {...register('department')} placeholder="e.g. QC Laboratory" />
              {errors.department && <p className="text-xs text-red-600">{errors.department.message}</p>}
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
