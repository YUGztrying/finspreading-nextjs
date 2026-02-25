// src/app/api/statements/delete-company/route.ts
// DELETE — remove all data for a company (statements, analyses, mappings, overrides).

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function DELETE(request: NextRequest) {
  try {
    const { user_id, company_name } = await request.json()

    if (!user_id || !company_name) {
      return NextResponse.json(
        { error: 'user_id and company_name are required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient() as any
    const filter = { user_id, company_name }

    // Delete from every table that scopes data by company
    const tables = [
      'financial_statements',
      'camels_analyses',
      'period_mappings',
      'irp_overrides',
      'irp_aliases',
    ]

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('user_id', user_id)
        .eq('company_name', company_name)

      if (error) {
        // irp_aliases etc. may not exist in all deployments — skip missing tables
        if (error.code !== 'PGRST116') {
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Delete failed' },
      { status: 500 }
    )
  }
}
