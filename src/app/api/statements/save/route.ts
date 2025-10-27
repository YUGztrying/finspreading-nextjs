// src/app/api/statements/save/route.ts
// API endpoint to save processed financial statement data

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { saveFinancialStatement, ProcessedData } from '@/lib/statements/database'

export async function POST(request: NextRequest) {
  try {
    // Note: Route is protected by middleware, user is authenticated
    // Get user_id from request header (set by middleware) or session
    
    const body = await request.json()
    const { data: statementData, user_id } = body as { data: ProcessedData; user_id: string }

    if (!statementData || !user_id) {
      return NextResponse.json(
        { error: 'Statement data and user_id are required' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!statementData.company_name || !statementData.statement_type) {
      return NextResponse.json(
        { error: 'Missing required fields: company_name, statement_type' },
        { status: 400 }
      )
    }

    console.log('💾 Saving statement:', {
      company: statementData.company_name,
      type: statementData.statement_type,
      periods: statementData.periods?.length || 0,
      lines: statementData.line_items?.length || 0
    })

    // Save to database
    const result = await saveFinancialStatement(statementData, user_id)

    if (!result.success) {
      throw new Error(result.error || 'Failed to save statement')
    }

    console.log('✅ Statement saved successfully:', result.statement_id)

    return NextResponse.json({
      success: true,
      statement_id: result.statement_id,
      message: 'Statement saved successfully'
    })

  } catch (error: any) {
    console.error('❌ Save statement error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to save statement',
        details: 'An error occurred while saving the financial statement to database'
      },
      { status: 500 }
    )
  }
}