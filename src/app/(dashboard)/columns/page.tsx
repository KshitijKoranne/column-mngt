import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Search, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge, ApprovalBadge } from '@/components/columns/StatusBadge'
import { formatDate } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function ColumnsPage({ searchParams }: { searchParams: { status?: string; search?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  let query = supabase
    .from('columns')
    .select(`
      *,
      column_type:column_types(name),
      assigned_analyst:profiles!columns_assigned_analyst_id_fkey(full_name)
    `)
    .order('created_at', { ascending: false })

  if (searchParams.status) {
    query = query.eq('status', searchParams.status)
  }

  const { data: columns } = await query
  const allColumns = columns || []

  const filtered = searchParams.search
    ? allColumns.filter(c =>
        c.column_id_number.toLowerCase().includes(searchParams.search!.toLowerCase()) ||
        c.manufacturer.toLowerCase().includes(searchParams.search!.toLowerCase()) ||
        (c.assigned_product || '').toLowerCase().includes(searchParams.search!.toLowerCase()) ||
        (c.brand || '').toLowerCase().includes(searchParams.search!.toLowerCase())
      )
    : allColumns

  const statusCounts = {
    all: allColumns.length,
    active: allColumns.filter(c => c.status === 'active').length,
    received: allColumns.filter(c => c.status === 'received').length,
    qualification_pending: allColumns.filter(c => c.status === 'qualification_pending').length,
    regeneration: allColumns.filter(c => c.status === 'regeneration').length,
    discarded: allColumns.filter(c => c.status === 'discarded').length,
  }

  const filterLinks = [
    { label: 'All', value: undefined, count: statusCounts.all },
    { label: 'Active', value: 'active', count: statusCounts.active },
    { label: 'Received', value: 'received', count: statusCounts.received },
    { label: 'Qual. Pending', value: 'qualification_pending', count: statusCounts.qualification_pending },
    { label: 'Regeneration', value: 'regeneration', count: statusCounts.regeneration },
    { label: 'Discarded', value: 'discarded', count: statusCounts.discarded },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Column Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} column{filtered.length !== 1 ? 's' : ''} found</p>
        </div>
        {profile?.role !== 'qa' && (
          <Link href="/columns/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Register Column
            </Button>
          </Link>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {filterLinks.map(f => (
          <Link key={f.label} href={f.value ? `/columns?status=${f.value}` : '/columns'}>
            <button
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                (searchParams.status === f.value || (!searchParams.status && !f.value))
                  ? 'bg-blue-700 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
              <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">{f.count}</span>
            </button>
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <FlaskConical className="h-12 w-12 text-gray-200 mb-4" />
              <p className="text-lg font-medium">No columns found</p>
              <p className="text-sm text-gray-400 mt-1">
                {searchParams.status ? 'No columns match this filter.' : 'Register your first column to get started.'}
              </p>
              {profile?.role !== 'qa' && !searchParams.status && (
                <Link href="/columns/new" className="mt-4">
                  <Button><Plus className="mr-2 h-4 w-4" />Register Column</Button>
                </Link>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Column ID</TableHead>
                  <TableHead>Type / Brand</TableHead>
                  <TableHead>Dimensions</TableHead>
                  <TableHead>Product / Method</TableHead>
                  <TableHead>Injections</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((col) => (
                  <TableRow key={col.id}>
                    <TableCell>
                      <span className="font-mono text-sm font-bold text-blue-700">{col.column_id_number}</span>
                      <p className="text-xs text-gray-500">{col.manufacturer}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{(col.column_type as any)?.name || '—'}</p>
                      <p className="text-xs text-gray-500">{col.brand || col.bonded_phase}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {col.length_mm}×{col.internal_diameter_mm}mm
                      <p className="text-xs text-gray-500">{col.particle_size_um}µm</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm truncate max-w-[160px]">{col.assigned_product || '—'}</p>
                      <p className="text-xs text-gray-500 truncate max-w-[160px]">{col.assigned_method || '—'}</p>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{col.cumulative_injections.toLocaleString()}</TableCell>
                    <TableCell><StatusBadge status={col.status} /></TableCell>
                    <TableCell className="text-sm text-gray-500">{formatDate(col.last_used_date)}</TableCell>
                    <TableCell>
                      <Link href={`/columns/${col.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
