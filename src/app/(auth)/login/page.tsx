'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FlaskRound, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        return
      }

      window.location.href = '/dashboard'
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-white/10">
            <FlaskRound className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">QC Column Manager</h1>
          <p className="mt-1 text-sm text-blue-200">
            GMP-Compliant HPLC/UPLC Column Management
          </p>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>
              Enter your credentials to access the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="analyst@pharma.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>

            {/* Demo credentials */}
            <div className="mt-6 rounded-lg bg-gray-50 p-3">
              <p className="mb-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Demo Credentials
              </p>
              <div className="space-y-1">
                {[
                  { role: 'Analyst', email: 'analyst@pharma.com' },
                  { role: 'Supervisor', email: 'supervisor@pharma.com' },
                  { role: 'QC Head', email: 'qchead@pharma.com' },
                  { role: 'QA', email: 'qa@pharma.com' },
                ].map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => { setEmail(u.email); setPassword('Test@1234') }}
                    className="flex w-full items-center justify-between rounded px-2 py-1 text-xs hover:bg-gray-100"
                  >
                    <span className="font-medium text-gray-700">{u.role}</span>
                    <span className="text-gray-500">{u.email}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-center text-[10px] text-gray-400">Password: Test@1234</p>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-blue-200">
          GMP-Compliant System · All actions are logged and audited
        </p>
      </div>
    </div>
  )
}
