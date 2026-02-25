import { Badge } from '@/components/ui/badge'
import { COLUMN_STATUS_CONFIG, APPROVAL_STATUS_CONFIG } from '@/lib/utils'
import type { ColumnStatus, ApprovalStatus } from '@/types'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: ColumnStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = COLUMN_STATUS_CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        config.bgColor,
        config.textColor,
        className
      )}
    >
      {config.label}
    </span>
  )
}

interface ApprovalBadgeProps {
  status: ApprovalStatus
  className?: string
}

export function ApprovalBadge({ status, className }: ApprovalBadgeProps) {
  const config = APPROVAL_STATUS_CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        config.bgColor,
        config.textColor,
        className
      )}
    >
      {config.label}
    </span>
  )
}

interface SSTBadgeProps {
  result: 'pass' | 'fail'
  className?: string
}

export function SSTBadge({ result, className }: SSTBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        result === 'pass'
          ? 'bg-green-100 text-green-800'
          : 'bg-red-100 text-red-800',
        className
      )}
    >
      SST {result.toUpperCase()}
    </span>
  )
}
