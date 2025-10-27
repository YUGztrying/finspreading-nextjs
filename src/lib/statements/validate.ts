// src/lib/statements/validate.ts
// Validation and sanitization functions for financial data
// Ported from Base44 Upload.jsx validation logic

export interface FinancialRow {
  poste?: string
  description?: string
  net_amount?: number
  net_amount_N?: number
  net_amount_N_1?: number
  brut_amount?: number
  amort_prov_amount?: number
  is_subtotal?: boolean
  is_total?: boolean
  indent_level?: number
  flags?: string[]
  [key: string]: any
}

export interface ValidationResult {
  cleanedRows: FinancialRow[]
  warnings: string[]
}

/**
 * Validates and sanitizes financial rows
 * Ensures data quality before saving to database
 */
export function validateFinancialRows(rows: any[]): ValidationResult {
  const cleanedRows = rows.map((row, index) => {
    let cleanRow: FinancialRow = { ...row, flags: [] }

    // Poste => always string
    if (cleanRow.poste !== undefined) {
      cleanRow.poste = String(cleanRow.poste ?? "").trim()
      if (/^[0-9.,()-]+$/.test(cleanRow.poste)) {
        cleanRow.poste = cleanRow.poste.replace(/\s+/g, '')
      }
    } else {
      cleanRow.poste = ""
    }

    // Description => should not be a pure number
    if (cleanRow.description !== undefined) {
      cleanRow.description = String(cleanRow.description ?? "").trim()
      if (/^[0-9.,()]+$/.test(cleanRow.description) && cleanRow.description.length > 0) {
        if (!cleanRow.flags!.includes('invalid_description')) {
          cleanRow.flags!.push('invalid_description')
        }
      }
      if (!cleanRow.description || cleanRow.description.trim() === "") {
        if (!cleanRow.flags!.includes('empty_description')) {
          cleanRow.flags!.push('empty_description')
        }
      }
    } else {
      cleanRow.description = ""
      if (!cleanRow.flags!.includes('empty_description')) {
        cleanRow.flags!.push('empty_description')
      }
    }

    // Numeric amounts => improved normalization
    const amountKeys = [
      'net_amount',
      'net_amount_N',
      'net_amount_N_1',
      'brut_amount',
      'amort_prov_amount'
    ]

    amountKeys.forEach(key => {
      if (cleanRow[key] !== undefined && cleanRow[key] !== null) {
        let raw = String(cleanRow[key]).replace(/\s/g, "").replace(",", ".")
        // Handle parentheses as negative
        if (/^\(.*\)$/.test(raw)) {
          raw = "-" + raw.replace(/[()]/g, "")
        }
        const num = parseFloat(raw)
        if (isNaN(num)) {
          cleanRow[key] = 0
          if (!cleanRow.flags!.includes('invalid_amount')) {
            cleanRow.flags!.push('invalid_amount')
          }
        } else {
          cleanRow[key] = num
        }
      } else {
        cleanRow[key] = 0
      }
    })

    cleanRow.is_subtotal = typeof cleanRow.is_subtotal === 'boolean' ? cleanRow.is_subtotal : false
    cleanRow.is_total = typeof cleanRow.is_total === 'boolean' ? cleanRow.is_total : false
    cleanRow.indent_level = typeof cleanRow.indent_level === 'number' ? cleanRow.indent_level : 0

    return cleanRow
  })

  return { cleanedRows, warnings: [] }
}

/**
 * Creates a robust unique key for line items
 * Used for matching lines during merges
 */
export function createLineKey(
  item: FinancialRow,
  institutionType: string,
  statementType: string
): string {
  const posteStr = String(item.poste || '')
  
  // ✅ NORMALIZE: Remove all standard prefixes
  let normalizedPoste = posteStr
  const prefixes = [
    'MFA_', 'MFP_', 'MFC_', 'MFOB_', 'MFI_',
    'ACTIF_', 'PASSIF_', 'CR_', 'BANK_'
  ]
  
  for (const prefix of prefixes) {
    if (normalizedPoste.startsWith(prefix)) {
      normalizedPoste = normalizedPoste.substring(prefix.length)
      break
    }
  }

  // ✅ Create unique key based on normalized poste
  return `${institutionType}_${statementType}_${normalizedPoste}`
}

/**
 * Validates period dates
 * Ensures dates are valid and in correct format
 */
export function validatePeriods(periods: string[]): string[] {
  return periods.filter(period => {
    if (!period) return false
    const testDate = new Date(period)
    return !isNaN(testDate.getTime())
  }).sort((a, b) => {
    const dateA = new Date(a)
    const dateB = new Date(b)
    return dateA.getTime() - dateB.getTime()
  })
}

/**
 * Checks if a balance sheet balances
 * Actifs should equal Passifs + Equity
 */
export function checkBalance(
  actifs: FinancialRow[],
  passifs: FinancialRow[],
  periodIndex: number
): { balanced: boolean; difference: number } {
  const actifTotal = actifs.find(line => line.poste === 'ACTIF_TOTAL')
  const passifTotal = passifs.find(line => line.poste === 'PASSIF_TOTAL')

  if (!actifTotal || !passifTotal) {
    return { balanced: false, difference: 0 }
  }

  const actifAmount = actifTotal.amounts?.[periodIndex] || 0
  const passifAmount = passifTotal.amounts?.[periodIndex] || 0
  const difference = Math.abs(actifAmount - passifAmount)

  // Allow 1% margin for rounding errors
  const tolerance = Math.max(actifAmount, passifAmount) * 0.01
  const balanced = difference <= tolerance

  return { balanced, difference }
}