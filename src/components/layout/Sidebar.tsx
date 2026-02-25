'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FlaskConical, Plus, ClipboardList, CheckSquare,
  Tag, ArrowLeftRight, Trash2, FileBarChart, Shield, LogOut, FlaskRound, Package, Users,
} from 'lucide-react'
import { cn, ROLE_CONFIG } from '@/lib/utils'
import { NAV_ITEMS } from '@/lib/constants'
import type { UserRole } from '@/types'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { initials } from '@/lib/utils'

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  FlaskConical,
  Plus,
  ClipboardList,
  CheckSquare,
  Tag,
  ArrowLeftRight,
  Trash2,
  FileBarChart,
  Shield,
  Package,
  Users,
}

interface SidebarProps {
  userRole: UserRole
  userName: string
  userEmail: string
  onSignOut: () => void
}

export function Sidebar({ userRole, userName, userEmail, onSignOut }: SidebarProps) {
  const pathname = usePathname()

  const filteredNav = NAV_ITEMS.filter((item) => item.roles.includes(userRole))

  return (
    <div className="flex h-full w-64 flex-col border-r bg-gray-50">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-700">
          <FlaskRound className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-gray-900">Column Manager</p>
          <p className="truncate text-xs text-gray-500">QC Laboratory</p>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {filteredNav.map((item) => {
            const Icon = ICON_MAP[item.icon] ?? LayoutDashboard
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const isExact = item.href === '/dashboard' || item.href === '/columns/new'
              ? pathname === item.href
              : isActive

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isExact
                    ? 'bg-blue-700 text-white'
                    : 'text-gray-700 hover:bg-gray-200 hover:text-gray-900'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      {/* User info */}
      <div className="border-t p-4">
        <div className="flex items-center gap-3 rounded-md p-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-semibold">
              {initials(userName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">{userName}</p>
            <Badge
              className={cn('mt-0.5 text-[10px]', ROLE_CONFIG[userRole].color)}
              variant="outline"
            >
              {ROLE_CONFIG[userRole].label}
            </Badge>
          </div>
        </div>
        <Separator className="my-2" />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-gray-600 hover:text-red-600"
          onClick={onSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  )
}
