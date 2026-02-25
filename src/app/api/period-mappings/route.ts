// src/app/api/period-mappings/route.ts
// GET  — fetch saved period mappings for a user + company.
// POST — upsert period mappings for a user + company.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { PeriodMapping } from '@/types/database.types'

// GET /api/period-mappings?user_id=…&company_name=…
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const user_id = searchParams.get('user_id')
  const company_name = searchParams.get('company_name')

  if (!user_id || !company_name) {
    return NextResponse.json({ error: 'user_id and company_name are required' }, { status: 400 })
  }

  const supabase = createServiceClient() as any

  const { data, error } = await supabase
    .from('period_mappings')
    .select('mappings')
    .eq('user_id', user_id)
    .eq('company_name', company_name)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    mappings: (data?.mappings as PeriodMapping[] | null) ?? null,
  })
}

// POST /api/period-mappings
// Body: { user_id, company_name, mappings: PeriodMapping[] }
export async function POST(request: NextRequest) {
  try {
    const { user_id, company_name, mappings } = await request.json()

    if (!user_id || !company_name || !Array.isArray(mappings)) {
      return NextResponse.json(
        { error: 'user_id, company_name, and mappings[] are required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient() as any

    const { error } = await supabase
      .from('period_mappings')
      .upsert(
        {
          user_id,
          company_name,
          mappings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,company_name' }
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to save period mappings' },
      { status: 500 }
    )
  }
}
