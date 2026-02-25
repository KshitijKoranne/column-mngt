import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Shield } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatIST } from '@/lib/utils'

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { table?: string; page?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  const PAGE_SIZE = 50
  const page = parseInt(searchParams.page || '1')
  const offset = (page - 1) * PAGE_SIZE

  let query = supabase
    .from('audit_log')
    .select('*, changed_by_profile:profiles!audit_log_changed_by_fkey(full_name)', { count: 'exact' })
    .order('changed_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (searchParams.table) {
    query = query.eq('table_name', searchParams.table)
  }

  const { data: logs, count } = await query
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE)

  const tables = ['columns', 'column_qualification', 'column_usage_log', 'column_regeneration', 'column_transfers', 'column_discard', 'column_issuance', 'profiles', 'column_types']

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-blue-700" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
          <p className="text-sm text-gray-500 mt-0.5">Immutable record of all system changes · GMP Compliant</p>
        </div>
      </div>

      {/* Table filter */}
      <div className="flex flex-wrap gap-2">
        <a href="/audit" className={`rounded-full px-3 py-1.5 text-xs font-medium ${!searchParams.table ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          All Tables
        </a>
        {tables.map(t => (
          <a
            key={t}
            href={`/audit?table=${t}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${searchParams.table === t ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </a>
        ))}
      </div>

      <div className="text-sm text-gray-500">
        Showing {logs?.length ?? 0} of {count ?? 0} records
        {searchParams.table && ` for table: ${searchParams.table}`}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp (IST)</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Record ID</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Changed By</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!logs?.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-gray-400">
                    No audit records found
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">{formatIST(log.changed_at)}</TableCell>
                    <TableCell className="text-xs">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">
                        {log.table_name}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-gray-500">
                      {log.record_id?.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                        log.action === 'INSERT' ? 'bg-green-100 text-green-800' :
                        log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.changed_by_profile?.full_name || 'System'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-gray-500">
                      {log.ip_address || '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <a href={`/audit?${searchParams.table ? `table=${searchParams.table}&` : ''}page=${page - 1}`}
              className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
              Previous
            </a>
          )}
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <a href={`/audit?${searchParams.table ? `table=${searchParams.table}&` : ''}page=${page + 1}`}
              className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
              Next
            </a>
          )}
        </div>
      )}
    </div>
  )
}
