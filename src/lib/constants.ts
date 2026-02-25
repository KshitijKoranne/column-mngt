import type { UserRole } from '@/types'

// Navigation items by role
export const NAV_ITEMS: {
  href: string
  label: string
  icon: string
  roles: UserRole[]
}[] = [
  { href: '/dashboard',     label: 'Dashboard',       icon: 'LayoutDashboard', roles: ['analyst', 'supervisor', 'qc_head', 'qa'] },
  { href: '/columns',       label: 'Column Inventory', icon: 'FlaskConical',    roles: ['analyst', 'supervisor', 'qc_head', 'qa'] },
  { href: '/columns/new',   label: 'Register Column',  icon: 'Plus',            roles: ['analyst', 'supervisor', 'qc_head'] },
  { href: '/usage/new',     label: 'Log Usage',        icon: 'ClipboardList',   roles: ['analyst', 'supervisor', 'qc_head'] },
  { href: '/approvals',     label: 'Approvals',        icon: 'CheckSquare',     roles: ['supervisor', 'qc_head', 'qa'] },
  { href: '/column-types',  label: 'Column Types',     icon: 'Tag',             roles: ['qc_head'] },
  { href: '/users',         label: 'User Management',  icon: 'Users',           roles: ['qc_head'] },
  { href: '/issuance',      label: 'Issue Column',     icon: 'Package',         roles: ['supervisor', 'qc_head'] },
  { href: '/transfers',     label: 'Transfers',        icon: 'ArrowLeftRight',  roles: ['analyst', 'supervisor', 'qc_head', 'qa'] },
  { href: '/discard',       label: 'Discard',          icon: 'Trash2',          roles: ['qc_head'] },
  { href: '/reports',       label: 'Reports',          icon: 'FileBarChart',    roles: ['analyst', 'supervisor', 'qc_head', 'qa'] },
  { href: '/audit',         label: 'Audit Trail',      icon: 'Shield',          roles: ['supervisor', 'qc_head', 'qa'] },
]

export const ROLE_LABELS: Record<UserRole, string> = {
  analyst: 'Analyst',
  supervisor: 'QC Supervisor',
  qc_head: 'QC Head',
  qa: 'QA',
}

// The approval chain flow
export const APPROVAL_FLOW = ['analyst', 'supervisor', 'qc_head', 'qa'] as const

export const APPROVAL_STEP_LABELS = {
  pending_supervisor: 'Awaiting Supervisor Approval',
  pending_qc_head:    'Awaiting QC Head Approval',
  pending_qa:         'Awaiting QA Approval',
  approved:           'Fully Approved',
  rejected:           'Rejected',
}
