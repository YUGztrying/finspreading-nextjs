import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { old_company_name, new_company_name, statement_type, user_id } = await request.json()

    if (!old_company_name || !new_company_name || !user_id) {
      return NextResponse.json(
        { error: 'old_company_name, new_company_name, and user_id are required' },
        { status: 400 }
      )
    }


    // Use service role client to bypass RLS
    const supabase = createServiceClient() as any

    // Check if new company name already exists
    const { data: existingStatements, error: checkError } = await supabase
      .from('financial_statements')
      .select('*')
      .eq('user_id', user_id)
      .eq('company_name', new_company_name)

    if (checkError) {
      return NextResponse.json({ error: checkError.message }, { status: 500 })
    }

    // If new name exists, we need to merge
    if (existingStatements && existingStatements.length > 0) {
      
      // Get statements to rename
      const { data: statementsToRename, error: fetchError } = await supabase
        .from('financial_statements')
        .select('*')
        .eq('user_id', user_id)
        .eq('company_name', old_company_name)

      if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 500 })
      }

      if (!statementsToRename || statementsToRename.length === 0) {
        return NextResponse.json({ error: 'No statements found to rename' }, { status: 404 })
      }

      // Merge logic: for each statement type, merge periods and line_items
      const merged: any[] = []
      const deleted: string[] = []

      for (const statementToRename of statementsToRename) {
        const existingStatement = existingStatements.find(
          (s: any) => s.statement_type === statementToRename.statement_type
        )

        if (existingStatement) {
          
          // Merge periods (union)
          const allPeriods = [...new Set([
            ...existingStatement.periods,
            ...statementToRename.periods
          ])].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

          // Merge line_items (by poste)
          const lineItemsMap = new Map()
          
          // Add existing line items
          existingStatement.line_items.forEach((item: any) => {
            lineItemsMap.set(item.poste, item)
          })

          // Merge with new line items
          statementToRename.line_items.forEach((item: any) => {
            const existing = lineItemsMap.get(item.poste)
            if (existing) {
              // Merge amounts arrays
              const mergedAmounts = [...existing.amounts, ...item.amounts]
              lineItemsMap.set(item.poste, {
                ...existing,
                amounts: mergedAmounts
              })
            } else {
              lineItemsMap.set(item.poste, item)
            }
          })

          const mergedLineItems = Array.from(lineItemsMap.values())

          // Update existing statement
          const { error: updateError } = await supabase
            .from('financial_statements')
            .update({
              periods: allPeriods,
              line_items: mergedLineItems,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingStatement.id)

          if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 })
          }

          merged.push(statementToRename.statement_type)
          deleted.push(statementToRename.id)
        } else {
          // No existing statement of this type, just rename
          const { error: updateError } = await supabase
            .from('financial_statements')
            .update({ company_name: new_company_name })
            .eq('id', statementToRename.id)

          if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 })
          }
        }
      }

      // Delete old statements that were merged
      if (deleted.length > 0) {
        const { error: deleteError } = await supabase
          .from('financial_statements')
          .delete()
          .in('id', deleted)

        if (deleteError) {
          return NextResponse.json({ error: deleteError.message }, { status: 500 })
        }
      }

      return NextResponse.json({
        success: true,
        merged: merged.length,
        renamed: statementsToRename.length - merged.length,
        message: `Merged ${merged.length} statements, renamed ${statementsToRename.length - merged.length} statements`
      })
    }

    // No existing statements with new name, just rename
    
    const { data: updatedData, error: updateError } = await supabase
      .from('financial_statements')
      .update({ company_name: new_company_name })
      .eq('user_id', user_id)
      .eq('company_name', old_company_name)
      .select()


    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    if (!updatedData || updatedData.length === 0) {
      return NextResponse.json({ 
        error: 'No statements found to rename. The company name might not exist.' 
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      updated: updatedData.length,
      message: `All statements for "${old_company_name}" renamed to "${new_company_name}"`
    })

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}