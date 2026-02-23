// src/lib/camels/field-mapper.ts
// Maps line_items[].poste codes from financial_statements into a flat
// FinancialData dict that the CAMELS calculator can consume.

import { LineItem } from '@/types/database.types'
import { FinancialData } from './types'

// ─── Bank poste → CAMELS field mapping ──────────────────────────────────────
// String = single poste, Array = sum of postes
const BANK_ASSET_MAP: Record<string, string | string[]> = {
  total_assets:          'ACTIF_TOTAL',
  cash_and_equivalents:  'ACTIF_01',
  liquid_assets:         'ACTIF_03',
  investment_securities: ['ACTIF_02', 'ACTIF_05', 'ACTIF_06'],
  gross_loans:           'ACTIF_04',
  fixed_assets:          'ACTIF_14',
}

const BANK_LIABILITY_MAP: Record<string, string | string[]> = {
  total_deposits:        'PASSIF_03',
  short_term_borrowings: ['PASSIF_01', 'PASSIF_02'],
  long_term_debt:        'PASSIF_04',
  subordinated_debt:     'PASSIF_08',
  total_equity:          ['PASSIF_10', 'PASSIF_11', 'PASSIF_12', 'PASSIF_14', 'PASSIF_15', 'PASSIF_16'],
}

const BANK_INCOME_MAP: Record<string, string | string[]> = {
  interest_income:       'CR_01',
  interest_expenses:     'CR_02',
  non_interest_income:   'CR_04',
  operating_expenses:    'CR_12',
  depreciation:          'CR_13',
  provision_expenses:    'CR_15',
  net_income:            'CR_20',
}

// ─── Microfinance poste → CAMELS field mapping ─────────────────────────────
const MFI_ASSET_MAP: Record<string, string | string[]> = {
  total_assets:          'MFA_TOTAL_ACTIF',
  cash_and_equivalents:  ['MFA_A10', 'MFA_A11', 'MFA_A12'],
  liquid_assets:         ['MFA_A2A', 'MFA_A2H', 'MFA_A2I', 'MFA_A2J'],
  investment_securities: 'MFA_C10',
  gross_loans:           ['MFA_B2D', 'MFA_B30', 'MFA_B40'],
  npls:                  ['MFA_B70', 'MFA_B71', 'MFA_B72', 'MFA_B73'],
  fixed_assets:          ['MFA_D25', 'MFA_D36', 'MFA_D45', 'MFA_D47'],
}

const MFI_LIABILITY_MAP: Record<string, string | string[]> = {
  total_deposits:        ['MFP_G2A', 'MFP_G15', 'MFP_G30', 'MFP_G60', 'MFP_G70'],
  short_term_borrowings: ['MFP_F1A', 'MFP_F3E', 'MFP_F50', 'MFP_F2A'],
  long_term_debt:        'MFP_F3F',
  subordinated_debt:     'MFP_L41',
  total_equity:          ['MFP_L50', 'MFP_L55', 'MFP_L60', 'MFP_L70', 'MFP_L75', 'MFP_L80'],
}

const MFI_INCOME_MAP: Record<string, string | string[]> = {
  interest_income:       'MFP_V3B',
  interest_expenses:     ['MFC_R1L', 'MFC_R2A', 'MFC_R3C', 'MFC_R5Y'],
  non_interest_income:   ['MFP_V2T', 'MFP_V3X'],
  operating_expenses:    'MFC_S02',
  depreciation:          ['MFC_T53', 'MFC_T54', 'MFC_T55'],
  provision_expenses:    'MFC_T6B',
  taxes:                 'MFC_T82',
}

// ─── Core lookup functions ──────────────────────────────────────────────────

/** Build a fast lookup: poste code → line item */
function buildPosteIndex(lineItems: LineItem[]): Map<string, LineItem> {
  const index = new Map<string, LineItem>()
  for (const item of lineItems) {
    if (item.poste) {
      index.set(item.poste, item)
    }
  }
  return index
}

/** Get amount for a period from a single poste or sum of postes */
function resolveValue(
  mapping: string | string[],
  index: Map<string, LineItem>,
  periodIdx: number
): number {
  if (typeof mapping === 'string') {
    const item = index.get(mapping)
    return item?.amounts?.[periodIdx] ?? 0
  }
  // Array of postes → sum
  let sum = 0
  for (const code of mapping) {
    const item = index.get(code)
    sum += item?.amounts?.[periodIdx] ?? 0
  }
  return sum
}

/** Apply a mapping dict to produce partial FinancialData */
function applyMapping(
  map: Record<string, string | string[]>,
  index: Map<string, LineItem>,
  periodIdx: number
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const [field, mapping] of Object.entries(map)) {
    result[field] = resolveValue(mapping, index, periodIdx)
  }
  return result
}

// ─── Derived fields (calculated from base values) ───────────────────────────

function computeDerivedFields(data: Record<string, number>): void {
  // Net interest income
  data.net_interest_income = (data.interest_income ?? 0) - Math.abs(data.interest_expenses ?? 0)

  // Net loans (gross - provisions)
  data.net_loans = (data.gross_loans ?? 0) - Math.abs(data.loan_loss_provisions ?? 0)

  // Operating income = net interest income + non-interest income
  data.operating_income = data.net_interest_income + (data.non_interest_income ?? 0)

  // Total liabilities = total assets - total equity
  if (data.total_assets && data.total_equity) {
    data.total_liabilities = data.total_assets - data.total_equity
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Extract financial data for a given period from all statement types.
 *
 * @param statements - Map of statement_type → { line_items, periods }
 * @param periodDate - The period to extract (ISO date string, e.g. "2023-12-31")
 * @param institutionType - 'banque' or 'microfinance'
 */
export function extractFinancialData(
  statements: Record<string, { line_items: LineItem[]; periods: string[] }>,
  periodDate: string,
  institutionType: 'banque' | 'microfinance'
): FinancialData {
  const isBank = institutionType === 'banque'

  // Build indexes for each statement type we have
  const actifs = statements.actifs
  const passifs = statements.passifs
  const cr = statements.compte_resultats

  const actifsIdx = actifs ? buildPosteIndex(actifs.line_items) : new Map()
  const passifsIdx = passifs ? buildPosteIndex(passifs.line_items) : new Map()
  const crIdx = cr ? buildPosteIndex(cr.line_items) : new Map()

  // Find the period index in each statement's period array
  const actifsPeriodIdx = actifs?.periods?.indexOf(periodDate) ?? -1
  const passifsPeriodIdx = passifs?.periods?.indexOf(periodDate) ?? -1
  const crPeriodIdx = cr?.periods?.indexOf(periodDate) ?? -1

  // Apply the right mapping for the institution type
  const assetMap = isBank ? BANK_ASSET_MAP : MFI_ASSET_MAP
  const liabilityMap = isBank ? BANK_LIABILITY_MAP : MFI_LIABILITY_MAP
  const incomeMap = isBank ? BANK_INCOME_MAP : MFI_INCOME_MAP

  const result: Record<string, number> = {
    ...applyMapping(assetMap, actifsIdx, actifsPeriodIdx >= 0 ? actifsPeriodIdx : 0),
    ...applyMapping(liabilityMap, passifsIdx, passifsPeriodIdx >= 0 ? passifsPeriodIdx : 0),
    ...applyMapping(incomeMap, crIdx, crPeriodIdx >= 0 ? crPeriodIdx : 0),
  }

  // Default zeros for fields not in the mapping
  result.npls = result.npls ?? 0
  result.loan_loss_provisions = result.loan_loss_provisions ?? 0
  result.taxes = result.taxes ?? 0
  result.total_liabilities = result.total_liabilities ?? 0
  result.net_loans = result.net_loans ?? 0
  result.net_interest_income = result.net_interest_income ?? 0
  result.operating_income = result.operating_income ?? 0

  // Compute derived fields
  computeDerivedFields(result)

  return result as FinancialData
}

/**
 * Get all available periods across all statement types.
 */
export function getAllPeriods(
  statements: Record<string, { periods: string[] }>
): string[] {
  const allPeriods = new Set<string>()
  for (const stmt of Object.values(statements)) {
    for (const p of stmt.periods ?? []) {
      allPeriods.add(p)
    }
  }
  return Array.from(allPeriods).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  )
}
