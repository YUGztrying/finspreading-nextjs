// src/app/api/fx-rates/route.ts
// GET  — fetch analyst-entered FX rates for a user + company.
// POST — upsert one or more FX rate entries (batch).
//
// Rates are entered manually by the analyst from the internal IFC FX library;
// this endpoint never fetches or computes rates.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { validateFxRates, type PeriodFxRate } from '@/lib/irm/fx'

// GET /api/fx-rates?user_id=…&company_name=…
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const user_id = searchParams.get('user_id')
  const company_name = searchParams.get('company_name')

  if (!user_id || !company_name) {
    return NextResponse.json(
      { error: 'user_id and company_name are required' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient() as any

  const { data, error } = await supabase
    .from('period_fx_rates')
    .select('period, fx_eop, fx_avg, source, notes, updated_at')
    .eq('user_id', user_id)
    .eq('company_name', company_name)
    .order('period', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rates: (data as PeriodFxRate[] | null) ?? [] })
}

// POST /api/fx-rates
// Body: { user_id, company_name, rates: PeriodFxRate[] }
// Upserts every entry; use DELETE to remove one.
export async function POST(request: NextRequest) {
  try {
    const { user_id, company_name, rates } = await request.json()

    if (!user_id || !company_name || !Array.isArray(rates)) {
      return NextResponse.json(
        { error: 'user_id, company_name, and rates[] are required' },
        { status: 400 }
      )
    }

    const validation = validateFxRates(rates)
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid FX rates', issues: validation.issues },
        { status: 400 }
      )
    }

    const supabase = createServiceClient() as any

    const rows = rates.map((r: PeriodFxRate) => ({
      user_id,
      company_name,
      period: r.period.trim(),
      fx_eop: r.fx_eop ?? null,
      fx_avg: r.fx_avg ?? null,
      source: r.source ?? null,
      notes: r.notes ?? null,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('period_fx_rates')
      .upsert(rows, { onConflict: 'user_id,company_name,period' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: rows.length })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to save FX rates' },
      { status: 500 }
    )
  }
}

// DELETE /api/fx-rates?user_id=…&company_name=…&period=…
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const user_id = searchParams.get('user_id')
  const company_name = searchParams.get('company_name')
  const period = searchParams.get('period')

  if (!user_id || !company_name || !period) {
    return NextResponse.json(
      { error: 'user_id, company_name, and period are required' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient() as any

  const { error } = await supabase
    .from('period_fx_rates')
    .delete()
    .eq('user_id', user_id)
    .eq('company_name', company_name)
    .eq('period', period)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
