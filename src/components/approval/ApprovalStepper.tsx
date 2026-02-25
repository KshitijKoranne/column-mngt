import { Check, Clock, X, ChevronRight } from 'lucide-react'
import { cn, formatIST } from '@/lib/utils'
import type { ApprovalChain, ApprovalStatus } from '@/types'

interface Step {
  key: keyof ApprovalChain
  label: string
  role: string
}

const STEPS: Step[] = [
  { key: 'analyst',    label: 'Submitted',        role: 'Analyst' },
  { key: 'supervisor', label: 'Supervisor Review', role: 'QC Supervisor' },
  { key: 'qc_head',   label: 'QC Head Review',    role: 'QC Head' },
  { key: 'qa',        label: 'QA Final Sign-off',  role: 'QA' },
]

interface ApprovalStepperProps {
  chain: ApprovalChain
  status: ApprovalStatus
}

export function ApprovalStepper({ chain, status }: ApprovalStepperProps) {
  const getStepStatus = (key: keyof ApprovalChain) => {
    const entry = chain[key]
    if (!entry) return 'pending'
    return entry.action
  }

  return (
    <div className="w-full">
      <div className="flex items-start gap-0">
        {STEPS.map((step, idx) => {
          const entry = chain[step.key]
          const stepStatus = getStepStatus(step.key)
          const isLast = idx === STEPS.length - 1

          let iconBg = 'bg-gray-100 border-gray-300'
          let iconContent = <span className="text-xs font-bold text-gray-500">{idx + 1}</span>
          let textColor = 'text-gray-500'

          if (stepStatus === 'submitted' || stepStatus === 'approved') {
            iconBg = 'bg-green-500 border-green-500'
            iconContent = <Check className="h-3.5 w-3.5 text-white" />
            textColor = 'text-green-700'
          } else if (stepStatus === 'rejected') {
            iconBg = 'bg-red-500 border-red-500'
            iconContent = <X className="h-3.5 w-3.5 text-white" />
            textColor = 'text-red-700'
          } else if (
            (status === 'pending_supervisor' && step.key === 'supervisor') ||
            (status === 'pending_qc_head' && step.key === 'qc_head') ||
            (status === 'pending_qa' && step.key === 'qa')
          ) {
            iconBg = 'bg-yellow-100 border-yellow-400'
            iconContent = <Clock className="h-3.5 w-3.5 text-yellow-600" />
            textColor = 'text-yellow-700'
          }

          return (
            <div key={step.key} className="flex flex-1 flex-col items-start">
              <div className="flex w-full items-center">
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2',
                    iconBg
                  )}
                >
                  {iconContent}
                </div>
                {!isLast && (
                  <div
                    className={cn(
                      'h-0.5 flex-1',
                      stepStatus === 'approved' || stepStatus === 'submitted'
                        ? 'bg-green-400'
                        : 'bg-gray-200'
                    )}
                  />
                )}
              </div>
              <div className="mt-1.5 pr-4">
                <p className={cn('text-xs font-semibold', textColor)}>{step.role}</p>
                {entry && (
                  <p className="mt-0.5 text-[10px] text-gray-500">
                    {entry.action.charAt(0).toUpperCase() + entry.action.slice(1)} •{' '}
                    {formatIST(entry.timestamp, 'dd MMM, HH:mm')}
                  </p>
                )}
                {entry?.remarks && (
                  <p className="mt-0.5 text-[10px] italic text-gray-400 line-clamp-2">
                    "{entry.remarks}"
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
