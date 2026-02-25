import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge, ApprovalBadge, SSTBadge } from '@/components/columns/StatusBadge'
import { ApprovalStepper } from '@/components/approval/ApprovalStepper'
import { formatDate, formatIST, DISCARD_REASON_LABELS, TRANSFER_TYPE_LABELS } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ExternalLink } from 'lucide-react'

export default async function ColumnDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  const { data: column, error } = await supabase
    .from('columns')
    .select(`
      *,
      column_type:column_types(name, description),
      assigned_analyst:profiles!columns_assigned_analyst_id_fkey(full_name, email),
      received_by_profile:profiles!columns_received_by_fkey(full_name)
    `)
    .eq('id', params.id)
    .single()

  if (error || !column) notFound()

  // Fetch all related records
  const [
    { data: qualifications },
    { data: usageLogs },
    { data: regenerations },
    { data: transfers },
    { data: discard },
    { data: auditLogs },
    { data: issuances },
  ] = await Promise.all([
    supabase.from('column_qualification').select('*, performed_by_profile:profiles!column_qualification_performed_by_fkey(full_name)').eq('column_id', params.id).order('created_at', { ascending: false }),
    supabase.from('column_usage_log').select('*, analyst:profiles!column_usage_log_analyst_id_fkey(full_name)').eq('column_id', params.id).order('usage_date', { ascending: false }),
    supabase.from('column_regeneration').select('*, initiated_by_profile:profiles!column_regeneration_initiated_by_fkey(full_name)').eq('column_id', params.id).order('created_at', { ascending: false }),
    supabase.from('column_transfers').select('*, initiated_by_profile:profiles!column_transfers_initiated_by_fkey(full_name)').eq('column_id', params.id).order('created_at', { ascending: false }),
    supabase.from('column_discard').select('*, initiated_by_profile:profiles!column_discard_initiated_by_fkey(full_name)').eq('column_id', params.id).single(),
    supabase.from('audit_log').select('*, changed_by_profile:profiles!audit_log_changed_by_fkey(full_name)').eq('record_id', params.id).order('changed_at', { ascending: false }).limit(50),
    supabase.from('column_issuance').select('*, issued_to_profile:profiles!column_issuance_issued_to_fkey(full_name), issued_by_profile:profiles!column_issuance_issued_by_fkey(full_name)').eq('column_id', params.id).order('created_at', { ascending: false }),
  ])

  const ct = column.column_type as any
  const analyst = column.assigned_analyst as any
  const receivedBy = column.received_by_profile as any

  return (
    <div className="p-6 space-y-6">
      {/* Back + Header */}
      <div className="flex items-start gap-4">
        <Link href="/columns">
          <Button variant="ghost" size="sm" className="mt-1">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold font-mono text-blue-700">{column.column_id_number}</h1>
            <StatusBadge status={column.status} />
            <ApprovalBadge status={column.receipt_approval_status} />
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {ct?.name} · {column.manufacturer} {column.brand && `· ${column.brand}`}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {column.length_mm}mm × {column.internal_diameter_mm}mm ID · {column.particle_size_um}µm · {column.bonded_phase}
          </p>
        </div>
        {profile?.role !== 'qa' && column.status === 'qualification_pending' && (
          <Link href={`/qualification/${params.id}`}>
            <Button size="sm">Perform Qualification</Button>
          </Link>
        )}
        {profile?.role !== 'qa' && column.status === 'active' && (
          <Link href={`/transfers?column=${params.id}`}>
            <Button size="sm" variant="outline">Transfer</Button>
          </Link>
        )}
        {profile?.role === 'qc_head' && column.status !== 'discarded' && (
          <Link href={`/discard?column=${params.id}`}>
            <Button size="sm" variant="destructive">Initiate Discard</Button>
          </Link>
        )}
      </div>

      {/* Approval chain for receipt */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-600 font-medium">Receipt Authorization Chain</CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalStepper chain={column.receipt_approval_chain} status={column.receipt_approval_status} />
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="qualification">Qualification ({qualifications?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="usage">Usage History ({usageLogs?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="regeneration">Regeneration ({regenerations?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="transfers">Transfers ({transfers?.length ?? 0})</TabsTrigger>
          {discard && <TabsTrigger value="discard">Discard Record</TabsTrigger>}
          <TabsTrigger value="audit">Audit Trail ({auditLogs?.length ?? 0})</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Column Details</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Column Type" value={ct?.name} />
                <Row label="Manufacturer" value={column.manufacturer} />
                <Row label="Brand" value={column.brand} />
                <Row label="Part Number" value={column.part_number} />
                <Row label="Serial Number" value={column.serial_number} />
                <Row label="Lot Number" value={column.lot_number} />
                <Row label="Bonded Phase" value={column.bonded_phase} />
                <Separator />
                <Row label="Length" value={`${column.length_mm} mm`} />
                <Row label="Internal Diameter" value={`${column.internal_diameter_mm} mm`} />
                <Row label="Particle Size" value={`${column.particle_size_um} µm`} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Status & Assignment</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Status" value={<StatusBadge status={column.status} />} />
                <Row label="Assigned Product" value={column.assigned_product} />
                <Row label="Assigned Method" value={column.assigned_method} />
                <Row label="Assigned Analyst" value={analyst?.full_name} />
                <Separator />
                <Row label="Storage Location" value={column.storage_location} />
                <Row label="Storage Solvent" value={column.storage_solvent} />
                <Separator />
                <Row label="Received Date" value={formatDate(column.received_date)} />
                <Row label="Received By" value={receivedBy?.full_name} />
                <Row label="First Use Date" value={formatDate(column.first_use_date)} />
                <Row label="Last Used Date" value={formatDate(column.last_used_date)} />
                <Row label="Cumulative Injections" value={<span className="font-mono font-bold">{column.cumulative_injections.toLocaleString()}</span>} />
                {column.certificate_of_analysis_url && (
                  <Row label="CoA" value={
                    <a href={column.certificate_of_analysis_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline text-xs">
                      View CoA <ExternalLink className="h-3 w-3" />
                    </a>
                  } />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* QUALIFICATION */}
        <TabsContent value="qualification">
          <div className="mt-4 space-y-4">
            {!qualifications?.length ? (
              <EmptyState message="No qualification records" />
            ) : (
              qualifications.map((q: any) => (
                <Card key={q.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{formatDate(q.qualification_date)}</CardTitle>
                      <div className="flex gap-2">
                        <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${q.result === 'pass' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {q.result.toUpperCase()}
                        </span>
                        <ApprovalBadge status={q.approval_status} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
                    <QualParam label="Theoretical Plates" result={q.theoretical_plates_result} criteria={q.theoretical_plates_criteria} />
                    <QualParam label="Tailing Factor" result={q.tailing_factor_result} criteria={q.tailing_factor_criteria} />
                    <QualParam label="Resolution" result={q.resolution_result} criteria={q.resolution_criteria} />
                    <QualParam label="Back Pressure (bar)" result={q.back_pressure_result} criteria={q.back_pressure_criteria} />
                    <div className="col-span-full">
                      <Row label="Test Standard" value={q.test_standard_used} />
                      <Row label="Mobile Phase" value={q.mobile_phase} />
                      <Row label="Performed By" value={(q.performed_by_profile as any)?.full_name} />
                      <Row label="Remarks" value={q.remarks} />
                    </div>
                    <div className="col-span-full">
                      <p className="text-xs font-medium text-gray-500 mb-2">Approval Chain</p>
                      <ApprovalStepper chain={q.approval_chain} status={q.approval_status} />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* USAGE HISTORY */}
        <TabsContent value="usage">
          <div className="mt-4">
            {!usageLogs?.length ? (
              <EmptyState message="No usage logs recorded" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product / AR#</TableHead>
                    <TableHead>Test</TableHead>
                    <TableHead>Injections</TableHead>
                    <TableHead>Cumulative</TableHead>
                    <TableHead>SST</TableHead>
                    <TableHead>Analyst</TableHead>
                    <TableHead>Wash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usageLogs.map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell className="text-sm">{formatDate(u.usage_date)}</TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{u.product_name}</p>
                        <p className="text-xs text-gray-500">{u.ar_number}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{u.analysis_test_name}</p>
                        <p className="text-xs text-gray-500">{u.method_reference}</p>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{u.injections_in_session}</TableCell>
                      <TableCell className="font-mono text-sm">{u.cumulative_injections_after.toLocaleString()}</TableCell>
                      <TableCell><SSTBadge result={u.sst_result} /></TableCell>
                      <TableCell className="text-sm">{(u.analyst as any)?.full_name}</TableCell>
                      <TableCell className="text-xs">
                        <span className={u.pre_use_wash_done ? 'text-green-600' : 'text-red-500'}>Pre</span>{' / '}
                        <span className={u.post_use_wash_done ? 'text-green-600' : 'text-red-500'}>Post</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* REGENERATION */}
        <TabsContent value="regeneration">
          <div className="mt-4 space-y-4">
            {!regenerations?.length ? (
              <EmptyState message="No regeneration records" />
            ) : (
              regenerations.map((r: any) => (
                <Card key={r.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Regeneration · {formatDate(r.initiated_at)}</CardTitle>
                      <ApprovalBadge status={r.approval_status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <Row label="Failure Reason" value={r.failure_reason} />
                    <Row label="SST Failure Details" value={r.sst_failure_details} />
                    <Row label="Protocol Used" value={r.regeneration_protocol_used} />
                    <Row label="Outcome" value={r.outcome?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} />
                    {r.post_regeneration_sst_result && (
                      <Row label="Post-Regen SST" value={<SSTBadge result={r.post_regeneration_sst_result} />} />
                    )}
                    <Row label="Initiated By" value={(r.initiated_by_profile as any)?.full_name} />
                    {(r.regeneration_steps as any[])?.length > 0 && (
                      <div>
                        <p className="font-medium text-gray-700 mt-2">Regeneration Steps:</p>
                        <ol className="mt-1 space-y-1">
                          {(r.regeneration_steps as any[]).map((s: any) => (
                            <li key={s.step} className="text-xs text-gray-600 flex gap-2">
                              <span className="font-bold">{s.step}.</span>
                              <span>{s.description}</span>
                              {s.completed_at && <span className="text-gray-400">({formatIST(s.completed_at, 'dd MMM HH:mm')})</span>}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                    <div className="pt-2">
                      <p className="text-xs font-medium text-gray-500 mb-2">Approval Chain</p>
                      <ApprovalStepper chain={r.approval_chain} status={r.approval_status} />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* TRANSFERS */}
        <TabsContent value="transfers">
          <div className="mt-4">
            {!transfers?.length ? (
              <EmptyState message="No transfer records" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Initiated By</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">{formatDate(t.created_at)}</TableCell>
                      <TableCell className="text-sm">{TRANSFER_TYPE_LABELS[t.transfer_type]}</TableCell>
                      <TableCell className="text-sm">{t.from_value}</TableCell>
                      <TableCell className="text-sm font-medium">{t.to_value}</TableCell>
                      <TableCell className="text-sm max-w-[200px]">{t.reason}</TableCell>
                      <TableCell className="text-sm">{(t.initiated_by_profile as any)?.full_name}</TableCell>
                      <TableCell><ApprovalBadge status={t.approval_status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* DISCARD */}
        {discard && (
          <TabsContent value="discard">
            <Card className="mt-4 border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-red-700">Discard Record</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Discard Reason" value={DISCARD_REASON_LABELS[(discard as any).discard_reason]} />
                <Row label="Details" value={(discard as any).reason_details} />
                <Row label="Injections at Discard" value={`${(discard as any).cumulative_injections_at_discard?.toLocaleString()}`} />
                <Row label="Destruction Method" value={(discard as any).destruction_method} />
                <Row label="Discarded On" value={formatDate((discard as any).discarded_on)} />
                <Row label="Initiated By" value={((discard as any).initiated_by_profile as any)?.full_name} />
                <div className="pt-2">
                  <ApprovalStepper chain={(discard as any).approval_chain} status={(discard as any).approval_status} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* AUDIT TRAIL */}
        <TabsContent value="audit">
          <div className="mt-4">
            {!auditLogs?.length ? (
              <EmptyState message="No audit records for this column" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp (IST)</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Changed By</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs font-mono">{formatIST(a.changed_at)}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-semibold rounded px-1.5 py-0.5 ${
                          a.action === 'INSERT' ? 'bg-green-100 text-green-800' :
                          a.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>{a.action}</span>
                      </TableCell>
                      <TableCell className="text-sm">{(a.changed_by_profile as any)?.full_name || 'System'}</TableCell>
                      <TableCell className="text-xs font-mono text-gray-500">{a.ip_address || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Helper components
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex gap-2 py-0.5">
      <span className="w-44 shrink-0 text-gray-500 text-xs">{label}</span>
      <span className="text-gray-900 text-xs">{value}</span>
    </div>
  )
}

function QualParam({ label, result, criteria }: { label: string; result: number | null; criteria: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900">{result ?? '—'}</p>
      <p className="text-[10px] text-gray-400">Criterion: {criteria}</p>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <p>{message}</p>
    </div>
  )
}
