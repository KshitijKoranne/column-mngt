import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'
import type { ApprovalStatus, ColumnStatus, UserRole } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============================================================
// Date / Time Utilities (store UTC, display IST)
// ============================================================

const IST_TIMEZONE = 'Asia/Kolkata'

export function formatIST(dateStr: string | null | undefined, fmt = 'dd MMM yyyy, HH:mm'): string {
  if (!dateStr) return '—'
  try {
    // Use a simple approach since date-fns-tz might not be available
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '—'
    // Convert to IST (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000
    const istDate = new Date(date.getTime() + istOffset)
    return format(istDate, fmt) + ' IST'
  } catch {
    return '—'
  }
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const date = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
    if (isNaN(date.getTime())) return '—'
    return format(date, 'dd MMM yyyy')
  } catch {
    return '—'
  }
}

export function nowISO(): string {
  return new Date().toISOString()
}

// ============================================================
// Status Helpers
// ============================================================

export const COLUMN_STATUS_CONFIG: Record<
  ColumnStatus,
  { label: string; color: string; bgColor: string; textColor: string }
> = {
  received: {
    label: 'Received',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
  },
  qualification_pending: {
    label: 'Qualification Pending',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
  },
  active: {
    label: 'Active',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
  },
  regeneration: {
    label: 'Regeneration',
    color: 'orange',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
  },
  rejected: {
    label: 'Rejected',
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
  },
  discarded: {
    label: 'Discarded',
    color: 'red',
    bgColor: 'bg-red-200',
    textColor: 'text-red-900',
  },
  transferred: {
    label: 'Transferred',
    color: 'purple',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-800',
  },
}

export const APPROVAL_STATUS_CONFIG: Record<
  ApprovalStatus,
  { label: string; bgColor: string; textColor: string }
> = {
  pending_supervisor: {
    label: 'Pending Supervisor',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
  },
  pending_qc_head: {
    label: 'Pending QC Head',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
  },
  pending_qa: {
    label: 'Pending QA',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-800',
  },
  approved: {
    label: 'Approved',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
  },
  rejected: {
    label: 'Rejected',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
  },
}

export const ROLE_CONFIG: Record<UserRole, { label: string; color: string }> = {
  analyst: { label: 'Analyst', color: 'bg-blue-100 text-blue-800' },
  supervisor: { label: 'QC Supervisor', color: 'bg-green-100 text-green-800' },
  qc_head: { label: 'QC Head', color: 'bg-purple-100 text-purple-800' },
  qa: { label: 'QA', color: 'bg-orange-100 text-orange-800' },
}

// ============================================================
// Approval Chain Helpers
// ============================================================

export function getNextApprovalStep(current: ApprovalStatus): ApprovalStatus | null {
  const steps: ApprovalStatus[] = [
    'pending_supervisor',
    'pending_qc_head',
    'pending_qa',
    'approved',
  ]
  const idx = steps.indexOf(current)
  if (idx === -1 || idx >= steps.length - 1) return null
  return steps[idx + 1]
}

export function canApprove(userRole: UserRole, approvalStatus: ApprovalStatus): boolean {
  const map: Partial<Record<UserRole, ApprovalStatus>> = {
    supervisor: 'pending_supervisor',
    qc_head: 'pending_qc_head',
    qa: 'pending_qa',
  }
  return map[userRole] === approvalStatus
}

export function getApprovalStepForRole(role: UserRole): keyof import('@/types').ApprovalChain | null {
  const map: Partial<Record<UserRole, keyof import('@/types').ApprovalChain>> = {
    analyst: 'analyst',
    supervisor: 'supervisor',
    qc_head: 'qc_head',
    qa: 'qa',
  }
  return map[role] ?? null
}

// ============================================================
// Miscellaneous
// ============================================================

export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n - 1) + '...' : str
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export const DISCARD_REASON_LABELS: Record<string, string> = {
  qc_head_decision: 'QC Head Decision',
  sst_failure_post_regen: 'SST Failure Post Regeneration',
  high_backpressure: 'High Back Pressure',
  physical_damage: 'Physical Damage',
  other: 'Other',
}

export const TRANSFER_TYPE_LABELS: Record<string, string> = {
  product: 'Product Transfer',
  method: 'Method Transfer',
  location: 'Location Transfer',
  analyst: 'Analyst Re-assignment',
}
