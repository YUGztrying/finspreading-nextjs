// src/app/api/camels/overrides/route.ts
// GET  — fetch analyst overrides for a company across all periods.
// POST — save or clear a single override field for a specific company + period.
// Auth enforced via requireUser(); user_id always derived from session.

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/camels/overrides?company_name=…
export async function GET(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.user) return auth.response
  const { user } = auth

  const { searchParams } = new URL(request.url)
  const company_name = searchParams.get('company_name')

  if (!company_name) {
    return NextResponse.json({ error: 'company_name is required' }, { status: 400 })
  }

  const supabase = createServiceClient() as any

  const { data, error } = await supabase
    .from('camels_analyses')
    .select('period, car_override, npl_amount_override')
    .eq('user_id', user.id)
    .eq('company_name', company_name)
    .order('period', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Map: period → { car_override, npl_amount_override }
  const overrideMap: Record<string, { car_override: number | null; npl_amount_override: number | null }> = {}
  for (const row of data ?? []) {
    overrideMap[row.period] = {
      car_override: row.car_override ?? null,
      npl_amount_override: row.npl_amount_override ?? null,
    }
  }

  return NextResponse.json({ overrides: overrideMap })
}

// POST /api/camels/overrides
// Body: { company_name, period, field: 'car_override'|'npl_amount_override', value: number|null }
export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.user) return auth.response
  const { user } = auth

  try {
    const { company_name, period, field, value } = await request.json()

    if (!company_name || !period || !field) {
      return NextResponse.json(
        { error: 'company_name, period, and field are required' },
        { status: 400 }
      )
    }

    if (field !== 'car_override' && field !== 'npl_amount_override') {
      return NextResponse.json(
        { error: 'field must be car_override or npl_amount_override' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient() as any

    const { error } = await supabase
      .from('camels_analyses')
      .update({ [field]: value ?? null, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('company_name', company_name)
      .eq('period', period)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save override' }, { status: 500 })
  }
}
