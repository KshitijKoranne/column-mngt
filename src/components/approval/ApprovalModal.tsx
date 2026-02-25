'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { approvalActionSchema, type ApprovalActionInput } from '@/lib/validations/regeneration'

interface ApprovalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  onSubmit: (action: 'approved' | 'rejected', remarks: string) => Promise<void>
}

export function ApprovalModal({
  open, onOpenChange, title, description, onSubmit,
}: ApprovalModalProps) {
  const [loading, setLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState<'approved' | 'rejected' | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    getValues,
  } = useForm<ApprovalActionInput>({
    resolver: zodResolver(approvalActionSchema),
  })

  const handleAction = async (action: 'approved' | 'rejected') => {
    const remarks = getValues('remarks')
    if (!remarks || remarks.trim().length === 0) {
      return
    }
    setLoading(true)
    setPendingAction(action)
    try {
      await onSubmit(action, remarks)
      reset()
      onOpenChange(false)
    } finally {
      setLoading(false)
      setPendingAction(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) { onOpenChange(v); reset() } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="remarks" className="text-sm font-medium">
              Remarks <span className="text-red-500">*</span>
              <span className="ml-1 text-xs text-gray-500">(mandatory for GMP compliance)</span>
            </Label>
            <Textarea
              id="remarks"
              {...register('remarks')}
              placeholder="Enter your remarks / justification..."
              className="mt-1.5"
              rows={3}
              disabled={loading}
            />
            {errors.remarks && (
              <p className="mt-1 text-xs text-red-600">{errors.remarks.message}</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => { onOpenChange(false); reset() }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleAction('rejected')}
            disabled={loading}
          >
            {loading && pendingAction === 'rejected' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="mr-2 h-4 w-4" />
            )}
            Reject
          </Button>
          <Button
            variant="default"
            className="bg-green-700 hover:bg-green-800"
            onClick={() => handleAction('approved')}
            disabled={loading}
          >
            {loading && pendingAction === 'approved' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
