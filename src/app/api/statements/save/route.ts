// src/app/api/statements/save/route.ts
// API endpoint to save processed financial statement data
// Normalizes line items before saving. Auth enforced via requireUser().

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { saveFinancialStatement, ProcessedData } from '@/lib/statements/database'
import { normalizeFinancialLines } from '@/lib/normalization/normalize'

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.user) return auth.response
  const { user } = auth

  try {
    const body = await request.json()
    const { data: statementData } = body as { data: ProcessedData }

    if (!statementData) {
      return NextResponse.json(
        { error: 'Statement data is required' },
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

    // Apply normalization before saving
    const normalizeResult = normalizeFinancialLines(
      statementData.line_items || [],
      {
        institutionType: statementData.type_institution || 'banque',
        statementType: statementData.statement_type,
        companyName: statementData.company_name,
        sourceFile: statementData.source_file
      }
    )


    // Update statement data with normalized line items
    const normalizedStatementData: ProcessedData = {
      ...statementData,
      line_items: normalizeResult.normalizedLines
    }

    // Save to database — user.id comes from the verified session, never from body
    const result = await saveFinancialStatement(normalizedStatementData, user.id)

    if (!result.success) {
      throw new Error(result.error || 'Failed to save statement')
    }


    return NextResponse.json({
      success: true,
      statement_id: result.statement_id,
      normalization_stats: normalizeResult.stats,
      unmapped_lines: normalizeResult.unmappedLines.length,
      message: 'Statement saved successfully with normalization'
    })

  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || 'Failed to save statement',
        details: 'An error occurred while saving the financial statement to database'
      },
      { status: 500 }
    )
  }
}