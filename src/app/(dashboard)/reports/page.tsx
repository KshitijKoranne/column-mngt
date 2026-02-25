'use client'

import { useState } from 'react'
import { FileBarChart, Download, FileSpreadsheet, File } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatDate, formatIST, COLUMN_STATUS_CONFIG, DISCARD_REASON_LABELS } from '@/lib/utils'
import * as XLSX from 'xlsx'

type ReportType = 'inventory' | 'usage' | 'qualification' | 'discard' | 'audit'

export default function ReportsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const generateExcel = async (type: ReportType) => {
    setLoading(type)
    try {
      let data: any[] = []
      let sheetName = ''
      let filename = ''

      if (type === 'inventory') {
        const { data: cols } = await supabase
          .from('columns')
          .select('*, column_type:column_types(name), assigned_analyst:profiles!columns_assigned_analyst_id_fkey(full_name)')
          .order('column_id_number')
        data = (cols || []).map(c => ({
          'Column ID': c.column_id_number,
          'Manufacturer': c.manufacturer,
          'Brand': c.brand || '',
          'Type': (c.column_type as any)?.name || '',
          'Dimensions (LxID mm)': `${c.length_mm}x${c.internal_diameter_mm}`,
          'Particle Size (µm)': c.particle_size_um,
          'Bonded Phase': c.bonded_phase,
          'Status': COLUMN_STATUS_CONFIG[c.status as keyof typeof COLUMN_STATUS_CONFIG]?.label || c.status,
          'Assigned Product': c.assigned_product || '',
          'Assigned Method': c.assigned_method || '',
          'Assigned Analyst': (c.assigned_analyst as any)?.full_name || '',
          'Cumulative Injections': c.cumulative_injections,
          'First Use Date': formatDate(c.first_use_date),
          'Last Used Date': formatDate(c.last_used_date),
          'Storage Location': c.storage_location,
          'Storage Solvent': c.storage_solvent,
          'Received Date': formatDate(c.received_date),
        }))
        sheetName = 'Column Inventory'
        filename = `Column_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`

      } else if (type === 'usage') {
        let query = supabase
          .from('column_usage_log')
          .select('*, column:columns(column_id_number), analyst:profiles!column_usage_log_analyst_id_fkey(full_name)')
          .order('usage_date', { ascending: false })
        if (dateFrom) query = query.gte('usage_date', dateFrom)
        if (dateTo) query = query.lte('usage_date', dateTo)
        const { data: logs } = await query
        data = (logs || []).map(l => ({
          'Usage Date': formatDate(l.usage_date),
          'Column ID': (l.column as any)?.column_id_number || '',
          'Analyst': (l.analyst as any)?.full_name || '',
          'Product': l.product_name,
          'AR Number': l.ar_number,
          'Test Name': l.analysis_test_name,
          'Method Reference': l.method_reference,
          'Injections (Session)': l.injections_in_session,
          'Cumulative Injections': l.cumulative_injections_after,
          'SST Result': l.sst_result.toUpperCase(),
          'SST Theoretical Plates': (l.sst_parameters as any)?.theoretical_plates || '',
          'SST Tailing Factor': (l.sst_parameters as any)?.tailing_factor || '',
          'SST Resolution': (l.sst_parameters as any)?.resolution || '',
          'Pre-use Wash': l.pre_use_wash_done ? 'Yes' : 'No',
          'Post-use Wash': l.post_use_wash_done ? 'Yes' : 'No',
          'Remarks': l.remarks || '',
        }))
        sheetName = 'Usage Log'
        filename = `Column_Usage_Report_${new Date().toISOString().split('T')[0]}.xlsx`

      } else if (type === 'qualification') {
        const { data: quals } = await supabase
          .from('column_qualification')
          .select('*, column:columns(column_id_number), performed_by_profile:profiles!column_qualification_performed_by_fkey(full_name)')
          .order('qualification_date', { ascending: false })
        data = (quals || []).map(q => ({
          'Qualification Date': formatDate(q.qualification_date),
          'Column ID': (q.column as any)?.column_id_number || '',
          'Test Standard': q.test_standard_used,
          'Mobile Phase': q.mobile_phase,
          'Theoretical Plates (Obs.)': q.theoretical_plates_result || '',
          'Theoretical Plates (Criteria)': q.theoretical_plates_criteria,
          'Tailing Factor (Obs.)': q.tailing_factor_result || '',
          'Tailing Factor (Criteria)': q.tailing_factor_criteria,
          'Resolution (Obs.)': q.resolution_result || '',
          'Resolution (Criteria)': q.resolution_criteria,
          'Back Pressure (Obs.)': q.back_pressure_result || '',
          'Back Pressure (Criteria)': q.back_pressure_criteria,
          'Result': q.result.toUpperCase(),
          'Approval Status': q.approval_status.replace(/_/g, ' '),
          'Performed By': (q.performed_by_profile as any)?.full_name || '',
          'Remarks': q.remarks || '',
        }))
        sheetName = 'Qualification Records'
        filename = `Column_Qualification_Report_${new Date().toISOString().split('T')[0]}.xlsx`

      } else if (type === 'discard') {
        const { data: discards } = await supabase
          .from('column_discard')
          .select('*, column:columns(column_id_number, manufacturer), initiated_by_profile:profiles!column_discard_initiated_by_fkey(full_name)')
          .order('created_at', { ascending: false })
        data = (discards || []).map(d => ({
          'Column ID': (d.column as any)?.column_id_number || '',
          'Manufacturer': (d.column as any)?.manufacturer || '',
          'Discard Reason': DISCARD_REASON_LABELS[d.discard_reason as string] || d.discard_reason,
          'Reason Details': d.reason_details,
          'Injections at Discard': d.cumulative_injections_at_discard,
          'Destruction Method': d.destruction_method || '',
          'Discarded On': formatDate(d.discarded_on),
          'Initiated By': (d.initiated_by_profile as any)?.full_name || '',
          'Approval Status': d.approval_status.replace(/_/g, ' '),
        }))
        sheetName = 'Discard Records'
        filename = `Column_Discard_Report_${new Date().toISOString().split('T')[0]}.xlsx`

      } else if (type === 'audit') {
        const { data: audits } = await supabase
          .from('audit_log')
          .select('*, changed_by_profile:profiles!audit_log_changed_by_fkey(full_name)')
          .order('changed_at', { ascending: false })
          .limit(1000)
        data = (audits || []).map(a => ({
          'Timestamp (IST)': formatIST(a.changed_at),
          'Table': a.table_name,
          'Record ID': a.record_id,
          'Action': a.action,
          'Changed By': (a.changed_by_profile as any)?.full_name || 'System',
          'IP Address': a.ip_address || '',
          'Session ID': a.session_id || '',
        }))
        sheetName = 'Audit Trail'
        filename = `Audit_Trail_${new Date().toISOString().split('T')[0]}.xlsx`
      }

      if (data.length === 0) {
        toast.warning('No data found for the selected criteria')
        return
      }

      const ws = XLSX.utils.json_to_sheet(data)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, sheetName)

      // Add header row styling metadata
      const wscols = Object.keys(data[0] || {}).map(k => ({ wch: Math.max(k.length, 15) }))
      ws['!cols'] = wscols

      XLSX.writeFile(wb, filename)
      toast.success(`${sheetName} exported successfully`)
    } catch (err: any) {
      toast.error(err.message || 'Export failed')
    } finally {
      setLoading(null)
    }
  }

  const generatePDF = async (type: ReportType) => {
    setLoading(`pdf-${type}`)
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF({ orientation: 'landscape' })
      const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || 'Pharmaceutical QC Laboratory'
      const appName = process.env.NEXT_PUBLIC_APP_NAME || 'QC Column Management System'
      const generatedAt = formatIST(new Date().toISOString())

      // Header
      doc.setFontSize(14)
      doc.setTextColor(30, 58, 138)
      doc.text(companyName, 14, 15)
      doc.setFontSize(11)
      doc.setTextColor(0, 0, 0)

      const titles: Record<ReportType, string> = {
        inventory: 'HPLC Column Inventory Report',
        usage: 'Column Usage Report',
        qualification: 'Column Qualification Report',
        discard: 'Column Discard Report',
        audit: 'System Audit Trail Report',
      }
      doc.text(titles[type], 14, 22)
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      doc.text(`Generated: ${generatedAt} | System: ${appName}`, 14, 28)
      doc.line(14, 30, doc.internal.pageSize.width - 14, 30)

      // Fetch and format data (reuse same queries)
      let head: string[][] = [[]]
      let body: string[][] = []

      if (type === 'inventory') {
        const { data: cols } = await supabase
          .from('columns')
          .select('*, column_type:column_types(name), assigned_analyst:profiles!columns_assigned_analyst_id_fkey(full_name)')
          .order('column_id_number')
        head = [['Column ID', 'Manufacturer', 'Type', 'Dimensions', 'Status', 'Product', 'Injections', 'Last Used']]
        body = (cols || []).map(c => [
          c.column_id_number,
          `${c.manufacturer}${c.brand ? ` (${c.brand})` : ''}`,
          (c.column_type as any)?.name || '',
          `${c.length_mm}×${c.internal_diameter_mm}mm, ${c.particle_size_um}µm`,
          COLUMN_STATUS_CONFIG[c.status as keyof typeof COLUMN_STATUS_CONFIG]?.label || c.status,
          c.assigned_product || '—',
          c.cumulative_injections.toLocaleString(),
          formatDate(c.last_used_date),
        ])
      } else if (type === 'usage') {
        let query = supabase
          .from('column_usage_log')
          .select('*, column:columns(column_id_number), analyst:profiles!column_usage_log_analyst_id_fkey(full_name)')
          .order('usage_date', { ascending: false })
        if (dateFrom) query = query.gte('usage_date', dateFrom)
        if (dateTo) query = query.lte('usage_date', dateTo)
        const { data: logs } = await query
        head = [['Date', 'Column ID', 'Analyst', 'Product', 'AR#', 'Injections', 'Cumulative', 'SST']]
        body = (logs || []).map(l => [
          formatDate(l.usage_date),
          (l.column as any)?.column_id_number || '',
          (l.analyst as any)?.full_name || '',
          l.product_name,
          l.ar_number,
          l.injections_in_session.toString(),
          l.cumulative_injections_after.toLocaleString(),
          l.sst_result.toUpperCase(),
        ])
      }

      autoTable(doc, {
        head,
        body,
        startY: 35,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        didDrawPage: (data: any) => {
          doc.setFontSize(7)
          doc.setTextColor(150)
          doc.text(
            `Page ${data.pageNumber} | Confidential — For QC Use Only | ${companyName}`,
            doc.internal.pageSize.width / 2,
            doc.internal.pageSize.height - 8,
            { align: 'center' }
          )
        },
      })

      doc.save(`${titles[type].replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`)
      toast.success('PDF exported successfully')
    } catch (err: any) {
      toast.error(err.message || 'PDF export failed')
    } finally {
      setLoading(null)
    }
  }

  const reports = [
    {
      type: 'inventory' as ReportType,
      title: 'Column Inventory Report',
      description: 'All columns with current status, specifications, and assignment details',
      icon: '📊',
    },
    {
      type: 'usage' as ReportType,
      title: 'Column Usage Report',
      description: 'Usage sessions with SST results, injections, and analyst details',
      icon: '📋',
    },
    {
      type: 'qualification' as ReportType,
      title: 'Qualification Report',
      description: 'All column qualification records with pass/fail results and approval status',
      icon: '✅',
    },
    {
      type: 'discard' as ReportType,
      title: 'Discard Report',
      description: 'All column discard records with reasons and approval history',
      icon: '🗑️',
    },
    {
      type: 'audit' as ReportType,
      title: 'Full Audit Trail',
      description: 'Complete immutable log of all system changes (last 1000 records)',
      icon: '🛡️',
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileBarChart className="h-6 w-6 text-blue-700" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Export</h1>
          <p className="text-sm text-gray-500 mt-0.5">Export GMP-formatted reports as Excel or PDF</p>
        </div>
      </div>

      {/* Date filter for usage report */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Date Range Filter (for Usage Report)</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="date-from">From Date</Label>
            <Input id="date-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date-to">To Date</Label>
            <Input id="date-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => { setDateFrom(''); setDateTo('') }}>Clear</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map(report => (
          <Card key={report.type}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <span>{report.icon}</span>
                {report.title}
              </CardTitle>
              <CardDescription className="text-xs">{report.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={!!loading}
                onClick={() => generateExcel(report.type)}
              >
                {loading === report.type ? (
                  <span className="animate-spin mr-1">⏳</span>
                ) : (
                  <FileSpreadsheet className="mr-1.5 h-4 w-4 text-green-600" />
                )}
                Excel
              </Button>
              {(report.type === 'inventory' || report.type === 'usage') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={!!loading}
                  onClick={() => generatePDF(report.type)}
                >
                  {loading === `pdf-${report.type}` ? (
                    <span className="animate-spin mr-1">⏳</span>
                  ) : (
                    <File className="mr-1.5 h-4 w-4 text-red-600" />
                  )}
                  PDF
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-medium">GMP Export Notice</p>
        <p className="mt-1 text-xs text-blue-700">
          All exported reports include generation timestamp, user identity, and system metadata.
          Reports are for internal QC use only. Exported files should be reviewed, signed, and archived
          per your document control SOP.
        </p>
      </div>
    </div>
  )
}
