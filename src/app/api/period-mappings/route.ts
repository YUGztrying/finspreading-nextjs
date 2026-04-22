// src/app/api/period-mappings/route.ts
// GET  — fetch saved period mappings for the authenticated user + company.
// POST — upsert period mappings for the authenticated user + company.

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { createServiceClient } from '@/lib/supabase/server'
import type { PeriodMapping } from '@/types/database.types'

// GET /api/period-mappings?company_name=…
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
    .from('period_mappings')
    .select('mappings')
    .eq('user_id', user.id)
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
// Body: { company_name, mappings: PeriodMapping[] }
export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.user) return auth.response
  const { user } = auth

  try {
    const { company_name, mappings } = await request.json()

    if (!company_name || !Array.isArray(mappings)) {
      return NextResponse.json(
        { error: 'company_name and mappings[] are required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient() as any

    const { error } = await supabase
      .from('period_mappings')
      .upsert(
        {
          user_id: user.id,
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
