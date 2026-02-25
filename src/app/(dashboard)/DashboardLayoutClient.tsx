'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sidebar } from '@/components/layout/Sidebar'
import type { Profile } from '@/types'
import { toast } from 'sonner'

interface DashboardLayoutClientProps {
  profile: Profile
  children: React.ReactNode
}

export function DashboardLayoutClient({ profile, children }: DashboardLayoutClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    toast.success('Signed out successfully')
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Sidebar */}
      <aside className="hidden md:flex md:flex-shrink-0">
        <Sidebar
          userRole={profile.role}
          userName={profile.full_name}
          userEmail={profile.email}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
