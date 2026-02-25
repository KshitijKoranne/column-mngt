'use client'

import { Bell, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  title: string
  onMobileMenuToggle?: () => void
}

export function Header({ title, onMobileMenuToggle }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div className="flex items-center gap-4">
        {onMobileMenuToggle && (
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onMobileMenuToggle}>
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-xs text-gray-500">
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </div>
      </div>
    </header>
  )
}
