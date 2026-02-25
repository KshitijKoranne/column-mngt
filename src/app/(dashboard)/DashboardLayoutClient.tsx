'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sidebar } from '@/components/layout/Sidebar'
import type { Profile } from '@/types'
import { toast } from 'sonner'

// Auto-logout after 30 minutes of inactivity
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000
// Warn user 2 minutes before logout
const WARN_BEFORE_MS = 2 * 60 * 1000

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click']

interface DashboardLayoutClientProps {
  profile: Profile
  children: React.ReactNode
}

export function DashboardLayoutClient({ profile, children }: DashboardLayoutClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnToastRef = useRef<string | number | null>(null)

  const handleSignOut = useCallback(async (reason?: 'inactivity' | 'manual') => {
    await supabase.auth.signOut()
    if (reason === 'inactivity') {
      toast.error('You were signed out due to inactivity.')
    } else {
      toast.success('Signed out successfully')
    }
    router.push('/login')
    router.refresh()
  }, [supabase, router])

  const resetTimers = useCallback(() => {
    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warnTimeoutRef.current) clearTimeout(warnTimeoutRef.current)
    // Dismiss any active warning toast
    if (warnToastRef.current) {
      toast.dismiss(warnToastRef.current)
      warnToastRef.current = null
    }

    // Set warning toast timer
    warnTimeoutRef.current = setTimeout(() => {
      warnToastRef.current = toast.warning(
        'You will be signed out in 2 minutes due to inactivity.',
        { duration: WARN_BEFORE_MS }
      )
    }, INACTIVITY_TIMEOUT_MS - WARN_BEFORE_MS)

    // Set auto-logout timer
    timeoutRef.current = setTimeout(() => {
      handleSignOut('inactivity')
    }, INACTIVITY_TIMEOUT_MS)
  }, [handleSignOut])

  useEffect(() => {
    // Start timers on mount
    resetTimers()

    // Reset on any user activity
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetTimers, { passive: true }))

    // Re-check session when user returns to tab
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          toast.error('Your session has expired. Please log in again.')
          router.push('/login')
          router.refresh()
        } else {
          // User came back to tab — reset inactivity timer
          resetTimers()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (warnTimeoutRef.current) clearTimeout(warnTimeoutRef.current)
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetTimers))
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [resetTimers, supabase, router])


  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Sidebar */}
      <aside className="hidden md:flex md:flex-shrink-0">
        <Sidebar
          userRole={profile.role}
          userName={profile.full_name}
          userEmail={profile.email}
          onSignOut={() => handleSignOut('manual')}
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
