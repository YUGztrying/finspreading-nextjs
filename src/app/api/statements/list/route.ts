// src/app/api/statements/list/route.ts
// API endpoint to list all statements for the authenticated user.
// user_id is always derived from the session — never from query params.

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
    const statementType = searchParams.get('statement_type')

    const supabase = createServiceClient() as any

    // Build query
    let query = supabase
      .from('financial_statements')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    // Apply filters if provided
    if (companyName) {
      query = query.eq('company_name', companyName)
    }

    if (statementType) {
      query = query.eq('statement_type', statementType)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch statements: ${error.message}`)
    }

    // Group by company for easy selection
    const companies = [...new Set(data.map((s: any) => s.company_name))]


    return NextResponse.json({
      success: true,
      statements: data,
      companies,
      count: data.length
    })

  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch statements',
        details: 'An error occurred while fetching financial statements'
      },
      { status: 500 }
    )
  }
}