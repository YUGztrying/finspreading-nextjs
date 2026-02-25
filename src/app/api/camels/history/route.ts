// src/app/api/camels/history/route.ts
// GET: Retrieve saved CAMELS analyses for a user, optionally filtered by company.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const companyName = searchParams.get('company_name')

    if (!userId) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient() as any

    let query = supabase
      .from('camels_analyses')
      .select('*')
      .eq('user_id', userId)
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
