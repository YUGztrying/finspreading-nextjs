// src/app/api/camels/history/route.ts
// GET: Retrieve saved CAMELS analyses for the authenticated user.

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.user) return auth.response
  const { user } = auth

  try {
    const { searchParams } = new URL(request.url)
    const companyName = searchParams.get('company_name')

    const supabase = createServiceClient() as any

    let query = supabase
      .from('camels_analyses')
      .select('*')
      .eq('user_id', user.id)
      .order('period', { ascending: false })

    if (companyName) {
      query = query.eq('company_name', companyName)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch analyses: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      analyses: data ?? [],
      count: data?.length ?? 0,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch CAMELS history' },
      { status: 500 }
    )
  }
}
