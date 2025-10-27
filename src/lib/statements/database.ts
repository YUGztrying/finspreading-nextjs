// src/lib/statements/database.ts
// Database operations for financial statements
// Handles saving, merging, and consolidation

import { createServiceClient } from '@/lib/supabase/server'
import { FinancialStatementInsert, LineItem } from '@/types/database.types'
import { validateFinancialRows, createLineKey } from './validate'

export interface ProcessedData {
  company_name: string
  type_institution: 'banque' | 'microfinance'
  statement_type: 'actifs' | 'passifs' | 'hors_bilan' | 'compte_resultats'
  periods: string[]
  line_items: LineItem[]
  source_file: string
}

/**
 * Save or merge financial statement data to database
 * If statement exists for this company/type, merge the data
 * Otherwise, create new statement
 */
export async function saveFinancialStatement(
  data: ProcessedData,
  userId: string
): Promise<{ success: boolean; statement_id?: string; error?: string }> {
  try {
    const supabase = createServiceClient()

    // Step 1: Validate the data
    const { cleanedRows } = validateFinancialRows(data.line_items)

    // Step 2: Check if statement already exists
    const { data: existingStatementsRaw, error: fetchError } = await supabase
      .from('financial_statements')
      .select('*')
      .eq('user_id', userId)
      .eq('company_name', data.company_name)
      .eq('statement_type', data.statement_type)
      .limit(1)

    if (fetchError) {
      throw new Error(`Database query failed: ${fetchError.message}`)
    }

    const existingStatements = Array.isArray(existingStatementsRaw) ? existingStatementsRaw : []
    const existingStatement = existingStatements.length > 0 ? existingStatements[0] : null

    if (existingStatement) {
      // Statement exists - MERGE the data
      console.log('📊 Existing statement found, merging data...')
      
      const mergedData = mergeStatements(
        {
          periods: existingStatement.periods || [],
          line_items: (existingStatement.line_items as LineItem[]) || []
        },
        {
          periods: data.periods,
          line_items: cleanedRows
        },
        data.type_institution,
        data.statement_type
      )

      const existingSourceFiles = Array.isArray(existingStatement.source_files)
        ? existingStatement.source_files
        : []

      // Update existing statement
      const { data: updatedStatement, error: updateError } = await supabase
        .from('financial_statements')
        .update({
          periods: mergedData.periods,
          line_items: mergedData.line_items,
          source_files: [...existingSourceFiles, data.source_file],
          updated_at: new Date().toISOString()
        })
        .eq('id', existingStatement.id)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Update failed: ${updateError.message}`)
      }

      console.log('✅ Statement merged successfully')
      return { success: true, statement_id: (updatedStatement as any)?.id }

    } else {
      // No existing statement - CREATE new one
      console.log('📝 Creating new statement...')

      const newStatement: FinancialStatementInsert = {
        user_id: userId,
        company_name: data.company_name,
        type_institution: data.type_institution,
        statement_type: data.statement_type,
        periods: data.periods,
        line_items: cleanedRows,
        source_files: [data.source_file]
      }

      const { data: createdStatement, error: insertError } = await supabase
        .from('financial_statements')
        .insert(newStatement)
        .select()
        .single()

      if (insertError) {
        throw new Error(`Insert failed: ${insertError.message}`)
      }

      console.log('✅ Statement created successfully')
      return { success: true, statement_id: (createdStatement as any)?.id }
    }

  } catch (error: any) {
    console.error('❌ Save statement error:', error)
    return { success: false, error: error?.message ?? String(error) }
  }
}

/**
 * Merge two financial statements
 * Combines periods and line items intelligently
 */
function mergeStatements(
  existing: { periods: string[]; line_items: LineItem[] },
  incoming: { periods: string[]; line_items: LineItem[] },
  institutionType: string,
  statementType: string
): { periods: string[]; line_items: LineItem[] } {
  
  // Step 1: Merge periods (union, sorted)
  const allPeriods = [...new Set([...existing.periods, ...incoming.periods])]
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

  console.log('📅 Merged periods:', allPeriods)

  // Step 2: Create lookup maps for existing lines
  const existingLineMap = new Map<string, LineItem>()
  existing.line_items.forEach(line => {
    const key = createLineKey(line, institutionType, statementType)
    existingLineMap.set(key, line)
  })

  // Step 3: Merge line items
  const mergedLines: LineItem[] = []
  const processedKeys = new Set<string>()

  // Process incoming lines
  incoming.line_items.forEach(incomingLine => {
    const key = createLineKey(incomingLine, institutionType, statementType)
    const existingLine = existingLineMap.get(key)

    if (existingLine) {
      // Line exists - merge amounts
      const mergedAmounts = mergeAmounts(
        existingLine.amounts || [],
        incomingLine.amounts || [],
        existing.periods,
        incoming.periods,
        allPeriods
      )

      mergedLines.push({
        ...existingLine,
        amounts: mergedAmounts,
        description: incomingLine.description || existingLine.description
      })

      processedKeys.add(key)
    } else {
      // New line - add with amounts positioned correctly
      const positionedAmounts = positionAmounts(
        incomingLine.amounts || [],
        incoming.periods,
        allPeriods
      )

      mergedLines.push({
        ...incomingLine,
        amounts: positionedAmounts
      })
    }
  })

  // Add existing lines that weren't in incoming data
  existing.line_items.forEach(existingLine => {
    const key = createLineKey(existingLine, institutionType, statementType)
    if (!processedKeys.has(key)) {
      const positionedAmounts = positionAmounts(
        existingLine.amounts || [],
        existing.periods,
        allPeriods
      )

      mergedLines.push({
        ...existingLine,
        amounts: positionedAmounts
      })
    }
  })

  console.log('🔗 Merged line items:', mergedLines.length)

  return {
    periods: allPeriods,
    line_items: mergedLines
  }
}

/**
 * Merge amounts from two line items across different period sets
 */
function mergeAmounts(
  existingAmounts: number[],
  incomingAmounts: number[],
  existingPeriods: string[],
  incomingPeriods: string[],
  mergedPeriods: string[]
): number[] {
  const result = new Array(mergedPeriods.length).fill(0)

  // Map existing amounts
  existingAmounts.forEach((amount, idx) => {
    const period = existingPeriods[idx]
    const mergedIdx = mergedPeriods.indexOf(period)
    if (mergedIdx !== -1) {
      result[mergedIdx] = amount
    }
  })

  // Overlay incoming amounts (overwrites if same period)
  incomingAmounts.forEach((amount, idx) => {
    const period = incomingPeriods[idx]
    const mergedIdx = mergedPeriods.indexOf(period)
    if (mergedIdx !== -1) {
      result[mergedIdx] = amount
    }
  })

  return result
}

/**
 * Position amounts correctly in the merged periods array
 */
function positionAmounts(
  amounts: number[],
  sourcePeriods: string[],
  targetPeriods: string[]
): number[] {
  const result = new Array(targetPeriods.length).fill(0)

  amounts.forEach((amount, idx) => {
    const period = sourcePeriods[idx]
    const targetIdx = targetPeriods.indexOf(period)
    if (targetIdx !== -1) {
      result[targetIdx] = amount
    }
  })

  return result
}

/**
 * Get all statements for a company
 */
export async function getCompanyStatements(
  userId: string,
  companyName: string
) {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('financial_statements')
    .select('*')
    .eq('user_id', userId)
    .eq('company_name', companyName)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch statements: ${error.message}`)
  }

  return data ?? []
}

/**
 * Get all companies for current user
 */
export async function getUserCompanies(userId: string) {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('user_companies')
    .select('*')
    .eq('user_id', userId)
    .order('last_updated', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch companies: ${error.message}`)
  }

  return data ?? []
}