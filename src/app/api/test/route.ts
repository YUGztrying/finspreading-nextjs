// src/app/api/test/route.ts
// Test endpoint to verify Supabase connection and auth

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Test 1: Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      return NextResponse.json({
        success: false,
        error: 'Auth check failed',
        details: authError.message
      }, { status: 401 })
    }

    // Test 2: Check database connection
    const { data: statements, error: dbError } = await supabase
      .from('financial_statements')
      .select('id, company_name, statement_type')
      .limit(5)

    if (dbError) {
      return NextResponse.json({
        success: false,
        error: 'Database query failed',
        details: dbError.message
      }, { status: 500 })
    }

    // Test 3: Check views
    const { data: companies, error: viewError } = await supabase
      .from('user_companies')
      .select('*')
      .limit(5)

    return NextResponse.json({
      success: true,
      message: 'All tests passed!',
      data: {
        authenticated: !!user,
        user_id: user?.id,
        user_email: user?.email,
        statements_count: statements?.length || 0,
        companies_count: companies?.length || 0,
        sample_statements: statements || [],
      }
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Unexpected error',
      details: error.message
    }, { status: 500 })
  }
}