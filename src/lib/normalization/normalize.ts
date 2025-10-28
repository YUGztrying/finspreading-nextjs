// src/lib/normalization/normalize.ts
// Main normalization service - applies appropriate normalization based on institution and statement type

import { normalizeActifKey, normalizePassifKey, normalizeCompteResultatsKey } from './banks'
import { normalizeActifKeyMicro, normalizePassifKeyMicro, normalizeCompteResultatsKeyMicro } from './microfinance'
import { UnmappedLine, InstitutionType, StatementType } from './types'
import { LineItem } from '@/types/database.types'

interface NormalizeOptions {
  institutionType: InstitutionType
  statementType: StatementType
  companyName?: string
  sourceFile?: string
}

interface NormalizeResult {
  normalizedLines: LineItem[]
  unmappedLines: UnmappedLine[]
  stats: {
    total: number
    mapped: number
    unmapped: number
    totals: number
    subtotals: number
  }
}

/**
 * Normalize financial statement lines to IRP standard
 * 
 * @param lines - Raw line items from extraction
 * @param options - Normalization options (institution type, statement type, etc.)
 * @returns Normalized lines with statistics
 */
export function normalizeFinancialLines(
  lines: LineItem[],
  options: NormalizeOptions
): NormalizeResult {
  const { institutionType, statementType, companyName, sourceFile } = options
  const unmappedCollector: UnmappedLine[] = []
  const normalizedLines: LineItem[] = []

  // Context for unmapped lines
  const context = {
    company_name: companyName,
    statement_type: statementType,
    source_file_url: sourceFile
  }

  // Select normalization function based on institution and statement type
  const getNormalizeFunction = () => {
    if (institutionType === 'microfinance') {
      // Microfinance normalizations
      switch (statementType) {
        case 'actifs':
          return normalizeActifKeyMicro
        case 'passifs':
          return normalizePassifKeyMicro
        case 'compte_resultats':
          return normalizeCompteResultatsKeyMicro
        case 'hors_bilan':
          // Not implemented yet for microfinance
          return null
        default:
          return null
      }
    }

    // Banks
    switch (statementType) {
      case 'actifs':
        return normalizeActifKey
      case 'passifs':
        return normalizePassifKey
      case 'compte_resultats':
        return normalizeCompteResultatsKey
      case 'hors_bilan':
        // Not implemented yet
        return null
      default:
        return null
    }
  }

  const normalizeFunction = getNormalizeFunction()

  if (!normalizeFunction) {
    console.warn(
      `No normalization function available for ${institutionType} / ${statementType}`
    )
    return {
      normalizedLines: lines,
      unmappedLines: [],
      stats: {
        total: lines.length,
        mapped: 0,
        unmapped: 0,
        totals: 0,
        subtotals: 0
      }
    }
  }

  // Apply normalization to each line
  let totalCount = 0
  let subtotalCount = 0

  for (const line of lines) {
    const normalizedPoste = normalizeFunction(
      line.poste,
      line.description,
      unmappedCollector,
      {
        ...context,
        original_amounts: line.amounts
      }
    )

    // Detect totals and subtotals
    const isTotal = normalizedPoste.includes('_TOTAL')
    const isSubtotal = line.is_subtotal || false

    if (isTotal) totalCount++
    if (isSubtotal) subtotalCount++

    normalizedLines.push({
      ...line,
      poste: normalizedPoste,
      is_total: isTotal,
      is_subtotal: isSubtotal,
      flags: normalizedPoste.includes('_UNDEFINED') ? ['unmapped'] : []
    })
  }

  const mappedCount = lines.length - unmappedCollector.length

  console.log(`
📊 Normalization complete:
  - Institution: ${institutionType}
  - Statement: ${statementType}
  - Total lines: ${lines.length}
  - Mapped: ${mappedCount}
  - Unmapped: ${unmappedCollector.length}
  - Totals: ${totalCount}
  - Subtotals: ${subtotalCount}
  `)

  return {
    normalizedLines,
    unmappedLines: unmappedCollector,
    stats: {
      total: lines.length,
      mapped: mappedCount,
      unmapped: unmappedCollector.length,
      totals: totalCount,
      subtotals: subtotalCount
    }
  }
}

/**
 * Quick helper to normalize a single statement
 */
export function normalizeStatement(
  statement: {
    line_items: LineItem[]
    type_institution: InstitutionType
    statement_type: StatementType
    company_name?: string
    source_files?: string[]
  }
) {
  return normalizeFinancialLines(statement.line_items, {
    institutionType: statement.type_institution,
    statementType: statement.statement_type,
    companyName: statement.company_name,
    sourceFile: statement.source_files?.[0]
  })
}