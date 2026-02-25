import { redirect } from 'next/navigation'

export const revalidate = 0  // Never cache — always fetch fresh data
import { createClient } from '@/lib/supabase/server'
import {
  FlaskConical, Activity, CheckCircle2, AlertTriangle, ArchiveX, Package,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/columns/StatusBadge'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  // Fetch column stats
  const { data: columns } = await supabase.from('columns').select('id, status, column_id_number, assigned_analyst_id, assigned_product, last_used_date, cumulative_injections')
  const allCols = columns || []

  const stats = {
    total: allCols.length,
    active: allCols.filter(c => c.status === 'active').length,
    qualification_pending: allCols.filter(c => c.status === 'qualification_pending').length,
    regeneration: allCols.filter(c => c.status === 'regeneration').length,
    discarded: allCols.filter(c => c.status === 'discarded').length,
    received: allCols.filter(c => c.status === 'received').length,
  }

  // Pending approvals count by role — checks ALL approval tables
  const roleStatus =
    profile.role === 'supervisor' ? 'pending_supervisor' :
    profile.role === 'qc_head'   ? 'pending_qc_head' :
    profile.role === 'qa'        ? 'pending_qa' : 'none'

  let totalPending = 0
  if (roleStatus !== 'none') {
    const [receipts, quals, regens, transfers, discards, issuances] = await Promise.all([
      supabase.from('columns').select('id', { count: 'exact', head: true }).eq('receipt_approval_status', roleStatus),
      supabase.from('column_qualification').select('id', { count: 'exact', head: true }).eq('approval_status', roleStatus),
      supabase.from('column_regeneration').select('id', { count: 'exact', head: true }).eq('approval_status', roleStatus),
      supabase.from('column_transfers').select('id', { count: 'exact', head: true }).eq('approval_status', roleStatus),
      supabase.from('column_discard').select('id', { count: 'exact', head: true }).eq('approval_status', roleStatus),
      supabase.from('column_issuance').select('id', { count: 'exact', head: true }).eq('approval_status', roleStatus),
    ])
    totalPending = (receipts.count || 0) + (quals.count || 0) + (regens.count || 0) +
                   (transfers.count || 0) + (discards.count || 0) + (issuances.count || 0)
  }

  // My assigned columns (for analyst)
  const myColumns = profile.role === 'analyst'
    ? allCols.filter(c => c.assigned_analyst_id === user.id && c.status === 'active')
    : []

  // Recent SST failures
  const { data: recentFailures } = await supabase
    .from('column_usage_log')
    .select('id, column_id, usage_date, sst_result, product_name, ar_number')
    .eq('sst_result', 'fail')
    .order('created_at', { ascending: false })
    .limit(5)

  const statCards = [
    { label: 'Total Columns',          value: stats.total,                  icon: FlaskConical,  color: 'text-blue-700',   bg: 'bg-blue-50' },
    { label: 'Active',                  value: stats.active,                 icon: Activity,      color: 'text-green-700',  bg: 'bg-green-50' },
    { label: 'Qualification Pending',   value: stats.qualification_pending,  icon: AlertTriangle, color: 'text-yellow-700', bg: 'bg-yellow-50' },
    { label: 'In Regeneration',         value: stats.regeneration,           icon: CheckCircle2,  color: 'text-orange-700', bg: 'bg-orange-50' },
    { label: 'Discarded',               value: stats.discarded,              icon: ArchiveX,      color: 'text-red-700',    bg: 'bg-red-50' },
    { label: 'Received / Pending Auth', value: stats.received,               icon: Package,       color: 'text-purple-700', bg: 'bg-purple-50' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome back, {profile.full_name} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Pending approvals alert */}
      {totalPending > 0 && profile.role !== 'analyst' && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800">
                {totalPending} item{totalPending > 1 ? 's' : ''} pending your approval
              </p>
              <p className="text-sm text-yellow-700">Review and act on pending approvals to keep workflows moving.</p>
            </div>
          </div>
          <Link href="/approvals">
            <Button size="sm" variant="outline" className="border-yellow-400 text-yellow-800 hover:bg-yellow-100">
              View Approvals
            </Button>
          </Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((card) => (
          <Card key={card.label} className="border shadow-sm">
            <CardContent className="p-4">
              <div className={`inline-flex rounded-lg p-2 ${card.bg} mb-3`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500 mt-1">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* My assigned columns (analyst view) */}
        {profile.role === 'analyst' && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">My Assigned Columns</CardTitle>
            </CardHeader>
            <CardContent>
              {myColumns.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FlaskConical className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-sm">No columns currently assigned to you</p>
                  <p className="text-xs text-gray-400 mt-1">Your supervisor will issue columns when needed</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myColumns.map((col) => (
                    <Link key={col.id} href={`/columns/${col.id}`}>
                      <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50">
                        <div>
                          <p className="font-mono text-sm font-semibold text-blue-700">{col.column_id_number}</p>
                          <p className="text-xs text-gray-500">{col.assigned_product || 'No product assigned'}</p>
                        </div>
                        <div className="text-right">
                          <StatusBadge status={col.status} />
                          <p className="text-xs text-gray-400 mt-1">{col.cumulative_injections} injections</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <div className="mt-4">
                <Link href="/usage/new">
                  <Button size="sm" className="w-full">Log Usage Session</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent SST Failures */}
        <Card className={profile.role === 'analyst' ? '' : 'lg:col-span-1'}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Recent SST Failures
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!recentFailures || recentFailures.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle2 className="mx-auto h-8 w-8 text-green-300 mb-2" />
                <p className="text-sm">No recent SST failures</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentFailures.map((f) => (
                  <Link key={f.id} href={`/columns/${f.column_id}`}>
                    <div className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 p-3 hover:bg-red-100">
                      <div>
                        <p className="text-xs font-semibold text-red-800">SST FAILED</p>
                        <p className="text-xs text-red-600">{f.product_name} · {f.ar_number}</p>
                      </div>
                      <p className="text-xs text-gray-500">{formatDate(f.usage_date)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card className={profile.role === 'analyst' ? 'lg:col-span-2' : 'lg:col-span-1'}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {profile.role !== 'qa' && (
                <Link href="/columns/new">
                  <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1">
                    <FlaskConical className="h-5 w-5" />
                    <span className="text-xs">Register Column</span>
                  </Button>
                </Link>
              )}
              {profile.role !== 'qa' && (
                <Link href="/usage/new">
                  <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1">
                    <Activity className="h-5 w-5" />
                    <span className="text-xs">Log Usage</span>
                  </Button>
                </Link>
              )}
              <Link href="/columns">
                <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1">
                  <Package className="h-5 w-5" />
                  <span className="text-xs">View Inventory</span>
                </Button>
              </Link>
              <Link href="/reports">
                <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-xs">Reports</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
