'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { CheckCircle, XCircle, Clock, Loader2, FlaskConical } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ApprovalModal } from '@/components/approval/ApprovalModal'
import { ApprovalBadge } from '@/components/columns/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatIST, getApprovalStepForRole, nowISO } from '@/lib/utils'
import type { UserRole, ApprovalChain } from '@/types'
import Link from 'next/link'

interface PendingItem {
  id: string
  type: string
  column_id: string
  column_id_number: string
  description: string
  initiated_by_name: string
  created_at: string
  approval_status: string
  approval_chain: ApprovalChain
  table: string
}

export default function ApprovalsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<UserRole>('analyst')
  const [userId, setUserId] = useState('')
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([])
  const [selectedItem, setSelectedItem] = useState<PendingItem | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!profile) return
      setUserRole(profile.role as UserRole)
      await fetchPending(profile.role as UserRole)
    }
    init()
  }, [])

  const statusForRole: Record<UserRole, string> = {
    analyst: 'none',
    supervisor: 'pending_supervisor',
    qc_head: 'pending_qc_head',
    qa: 'pending_qa',
  }

  const fetchPending = async (role: UserRole) => {
    setLoading(true)
    const status = statusForRole[role]
    if (status === 'none') { setLoading(false); return }

    const items: PendingItem[] = []

    // Column receipt approvals
    const { data: receipts } = await supabase
      .from('columns')
      .select('id, column_id_number, manufacturer, brand, receipt_approval_status, receipt_approval_chain, created_at, received_by_profile:profiles!columns_received_by_fkey(full_name)')
      .eq('receipt_approval_status', status)

    receipts?.forEach((r: any) => {
      items.push({
        id: r.id,
        type: 'Receipt Authorization',
        column_id: r.id,
        column_id_number: r.column_id_number,
        description: `New column from ${r.manufacturer}${r.brand ? ` (${r.brand})` : ''}`,
        initiated_by_name: r.received_by_profile?.full_name || 'Unknown',
        created_at: r.created_at,
        approval_status: r.receipt_approval_status,
        approval_chain: r.receipt_approval_chain,
        table: 'columns',
      })
    })

    // Qualification approvals
    const { data: quals } = await supabase
      .from('column_qualification')
      .select('id, column_id, qualification_date, approval_status, approval_chain, created_at, performed_by_profile:profiles!column_qualification_performed_by_fkey(full_name), column:columns(column_id_number)')
      .eq('approval_status', status)

    quals?.forEach((q: any) => {
      items.push({
        id: q.id,
        type: 'Column Qualification',
        column_id: q.column_id,
        column_id_number: q.column?.column_id_number || '—',
        description: `Qualification on ${formatIST(q.qualification_date, 'dd MMM yyyy')}`,
        initiated_by_name: q.performed_by_profile?.full_name || 'Unknown',
        created_at: q.created_at,
        approval_status: q.approval_status,
        approval_chain: q.approval_chain,
        table: 'column_qualification',
      })
    })

    // Regeneration approvals
    const { data: regens } = await supabase
      .from('column_regeneration')
      .select('id, column_id, initiated_at, approval_status, approval_chain, created_at, initiated_by_profile:profiles!column_regeneration_initiated_by_fkey(full_name), column:columns(column_id_number)')
      .eq('approval_status', status)

    regens?.forEach((r: any) => {
      items.push({
        id: r.id,
        type: 'Column Regeneration',
        column_id: r.column_id,
        column_id_number: r.column?.column_id_number || '—',
        description: `Regeneration initiated ${formatIST(r.initiated_at, 'dd MMM yyyy')}`,
        initiated_by_name: r.initiated_by_profile?.full_name || 'Unknown',
        created_at: r.created_at,
        approval_status: r.approval_status,
        approval_chain: r.approval_chain,
        table: 'column_regeneration',
      })
    })

    // Transfer approvals
    const { data: transfers } = await supabase
      .from('column_transfers')
      .select('id, column_id, transfer_type, from_value, to_value, approval_status, approval_chain, created_at, initiated_by_profile:profiles!column_transfers_initiated_by_fkey(full_name), column:columns(column_id_number)')
      .eq('approval_status', status)

    transfers?.forEach((t: any) => {
      items.push({
        id: t.id,
        type: 'Column Transfer',
        column_id: t.column_id,
        column_id_number: t.column?.column_id_number || '—',
        description: `${t.transfer_type} transfer: ${t.from_value} → ${t.to_value}`,
        initiated_by_name: t.initiated_by_profile?.full_name || 'Unknown',
        created_at: t.created_at,
        approval_status: t.approval_status,
        approval_chain: t.approval_chain,
        table: 'column_transfers',
      })
    })

    // Discard approvals
    const { data: discards } = await supabase
      .from('column_discard')
      .select('id, column_id, discard_reason, approval_status, approval_chain, created_at, initiated_by_profile:profiles!column_discard_initiated_by_fkey(full_name), column:columns(column_id_number)')
      .eq('approval_status', status)

    discards?.forEach((d: any) => {
      items.push({
        id: d.id,
        type: 'Column Discard',
        column_id: d.column_id,
        column_id_number: d.column?.column_id_number || '—',
        description: `Discard reason: ${d.discard_reason?.replace(/_/g, ' ')}`,
        initiated_by_name: d.initiated_by_profile?.full_name || 'Unknown',
        created_at: d.created_at,
        approval_status: d.approval_status,
        approval_chain: d.approval_chain,
        table: 'column_discard',
      })
    })

    // Issuance approvals
    const { data: issuances } = await supabase
      .from('column_issuance')
      .select('id, column_id, product_name, approval_status, approval_chain, created_at, issued_by_profile:profiles!column_issuance_issued_by_fkey(full_name), column:columns(column_id_number)')
      .eq('approval_status', status)

    issuances?.forEach((i: any) => {
      items.push({
        id: i.id,
        type: 'Column Issuance',
        column_id: i.column_id,
        column_id_number: i.column?.column_id_number || '—',
        description: `Issuance for ${i.product_name}`,
        initiated_by_name: i.issued_by_profile?.full_name || 'Unknown',
        created_at: i.created_at,
        approval_status: i.approval_status,
        approval_chain: i.approval_chain,
        table: 'column_issuance',
      })
    })

    items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    setPendingItems(items)
    setLoading(false)
  }

  const handleApproval = async (action: 'approved' | 'rejected', remarks: string) => {
    if (!selectedItem) return

    const step = getApprovalStepForRole(userRole)
    if (!step) return

    const newChain = {
      ...selectedItem.approval_chain,
      [step]: {
        user_id: userId,
        action,
        timestamp: nowISO(),
        remarks,
      },
    }

    // Determine next status
    const nextStatus =
      action === 'rejected' ? 'rejected' :
      userRole === 'supervisor' ? 'pending_qc_head' :
      userRole === 'qc_head'   ? 'pending_qa' :
      userRole === 'qa'        ? 'approved' : 'rejected'

    try {
      // Map table to update query
      if (selectedItem.table === 'columns') {
        const updates: any = { receipt_approval_chain: newChain, receipt_approval_status: nextStatus }
        if (nextStatus === 'approved') {
          updates.status = 'qualification_pending'
        } else if (nextStatus === 'rejected') {
          updates.status = 'rejected'
        }
        const { error } = await supabase.from('columns').update(updates).eq('id', selectedItem.id)
        if (error) throw error
      } else {
        const tableMap: Record<string, string> = {
          column_qualification: 'column_qualification',
          column_regeneration: 'column_regeneration',
          column_transfers: 'column_transfers',
          column_discard: 'column_discard',
          column_issuance: 'column_issuance',
        }
        const tbl = tableMap[selectedItem.table]
        if (!tbl) throw new Error('Unknown table')

        const { error } = await supabase
          .from(tbl)
          .update({ approval_chain: newChain, approval_status: nextStatus })
          .eq('id', selectedItem.id)
        if (error) throw error

        // Side effects on column status after final approval
        if (nextStatus === 'approved') {
          if (selectedItem.table === 'column_qualification') {
            const { error: colErr } = await supabase.from('columns').update({ status: 'active' }).eq('id', selectedItem.column_id)
            if (colErr) throw colErr
          } else if (selectedItem.table === 'column_discard') {
            const { error: colErr } = await supabase.from('columns').update({ status: 'discarded' }).eq('id', selectedItem.column_id)
            if (colErr) throw colErr
          } else if (selectedItem.table === 'column_transfers') {
            const { error: colErr } = await supabase.from('columns').update({ status: 'transferred' }).eq('id', selectedItem.column_id)
            if (colErr) throw colErr
          }
        } else if (nextStatus === 'rejected') {
          if (selectedItem.table === 'column_qualification') {
            const { error: colErr } = await supabase.from('columns').update({ status: 'qualification_pending' }).eq('id', selectedItem.column_id)
            if (colErr) throw colErr
          }
        }
      }

      toast.success(`${action === 'approved' ? 'Approved' : 'Rejected'} successfully`)
      setPendingItems(prev => prev.filter(i => i.id !== selectedItem.id))
      setSelectedItem(null)
      setModalOpen(false)
    } catch (err: any) {
      console.error('Approval error:', err)
      toast.error(`Action failed: ${err?.message || 'Permission denied or database error. Please contact your administrator.'}`)
    }
  }

  if (userRole === 'analyst') {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Approvals</h1>
        <p className="text-gray-500 mt-2">Analysts do not have approval authority. Use the dashboard to track your submissions.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
        <p className="text-sm text-gray-500 mt-1">
          Items awaiting your review as {userRole === 'qc_head' ? 'QC Head' : userRole === 'supervisor' ? 'QC Supervisor' : 'QA'}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : pendingItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <CheckCircle className="h-12 w-12 text-green-300 mb-4" />
          <p className="text-lg font-medium">No pending approvals</p>
          <p className="text-sm mt-1">All items are up to date.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingItems.map(item => (
            <Card key={`${item.table}-${item.id}`} className="border-l-4 border-l-yellow-400">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold bg-blue-100 text-blue-800 rounded px-2 py-0.5">{item.type}</span>
                    <Link href={`/columns/${item.column_id}`} className="font-mono text-sm font-bold text-blue-700 hover:underline">
                      {item.column_id_number}
                    </Link>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5 truncate">{item.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    By {item.initiated_by_name} · {formatIST(item.created_at)}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                    onClick={() => { setSelectedItem(item); setModalOpen(true) }}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-700 hover:bg-green-800"
                    onClick={() => { setSelectedItem(item); setModalOpen(true) }}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedItem && (
        <ApprovalModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title={`${selectedItem.type} — ${selectedItem.column_id_number}`}
          description={selectedItem.description}
          onSubmit={handleApproval}
        />
      )}
    </div>
  )
}
