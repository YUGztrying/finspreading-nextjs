// src/app/api/statements/delete-company/route.ts
// DELETE — remove all data for a company (statements, analyses, mappings, overrides).
// Auth enforced via requireUser(); user_id is derived from session, not the body.

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { createServiceClient } from '@/lib/supabase/server'

export async function DELETE(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.user) return auth.response
  const { user } = auth

  try {
    const { company_name } = await request.json()

    if (!company_name) {
      return NextResponse.json(
        { error: 'company_name is required' },
        { status: 400 }
      )
    }

    // Service client is fine here because user.id comes from the verified session.
    const supabase = createServiceClient() as any

    // Delete from every table that scopes data by company
    const tables = [
      'financial_statements',
      'camels_analyses',
      'period_mappings',
      'irp_overrides',
      'irp_aliases',
    ]

    const failures: Array<{ table: string; message: string }> = []

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('user_id', user.id)
        .eq('company_name', company_name)

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = table/relation not found — expected for optional tables
        failures.push({ table, message: error.message })
      }
    }

    if (failures.length > 0) {
      return NextResponse.json(
        { error: 'Partial delete failure', failures },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Delete failed' },
      { status: 500 }
    )
  }
}
