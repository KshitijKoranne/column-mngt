import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function getCallerRole() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, role: null, supabase }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return { user, role: profile?.role ?? null, supabase }
}

export async function GET() {
  const { user, role, supabase } = await getCallerRole()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (role !== 'qc_head') return NextResponse.json({ error: 'Forbidden — QC Head only' }, { status: 403 })

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, department, is_active, created_at')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const { user, role } = await getCallerRole()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (role !== 'qc_head') return NextResponse.json({ error: 'Forbidden — QC Head only' }, { status: 403 })

  const body = await request.json()
  const { email, password, full_name, role: newRole, department } = body

  if (!email || !password || !full_name || !newRole) {
    return NextResponse.json({ error: 'email, password, full_name and role are required' }, { status: 400 })
  }

  const adminSupabase = createServiceClient()
  const { data: newUser, error } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role: newRole, department: department || 'QC Laboratory' },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(newUser.user, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const { user, role } = await getCallerRole()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (role !== 'qc_head') return NextResponse.json({ error: 'Forbidden — QC Head only' }, { status: 403 })

  const body = await request.json()
  const { id, is_active } = body
  if (!id || is_active === undefined) {
    return NextResponse.json({ error: 'id and is_active are required' }, { status: 400 })
  }

  const supabase = createClient()
  const { error } = await supabase.from('profiles').update({ is_active }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
