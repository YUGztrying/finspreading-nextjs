// src/lib/irm/aggregate.ts
// Pure aggregation: collapses per-statement `LineItem[]` arrays into the
// IRM line structure, applies analyst-entered FX rates, and returns a
// period-indexed table ready for rendering or ratio computation.

import type { LineItem } from '@/types/database.types'
import {
  BANK_IRM_LINES,
  type IrmLineDef,
  type IrmMode,
} from './mappings'
import {
  buildFxMap,
  convertToUsd,
  type PeriodFxRate,
} from './fx'

/** Period metadata attached by the caller before aggregation. */
export interface IrmPeriod {
  /** Period key — must match keys used in FX rates. */
  key: string
  /** Display label (e.g. "FY2023", "H1-2024"). Defaults to key. */
  label?: string
  /** 'H1' flows are annualized ×2 before they hit ratios. */
  type?: 'FY' | 'H1' | 'Q'
}

/** Input: one bank's statements grouped by statement type. */
export interface IrmInput {
  /** Normalized actifs line items (LCY). */
  actifs: LineItem[]
  /** Normalized passifs line items (LCY). */
  passifs: LineItem[]
  /** Normalized compte de résultats line items (LCY). */
  compte_resultats: LineItem[]
  /** Ordered list of periods that every statement shares (already aligned). */
  periods: IrmPeriod[]
  /** Analyst-entered FX rates, one per period key. */
  fxRates: PeriodFxRate[]
  /** Unit divisor (1 = statements already in millions; 1_000_000 = raw units). */
  unitDivisor?: number
}

/** A single IRM row with USD values per period (null = missing FX / data). */
export interface IrmRow {
  id: string
  label: string
  label_fr: string
  section: 'balance_sheet' | 'income_statement'
  mode: IrmMode
  isSubtotal: boolean
  /** LCY sums straight from `line_items[i].amounts` (no FX applied). */
  lcy: Array<number | null>
  /** USD values after FX conversion, keyed by period index. */
  usd: Array<number | null>
}

export interface IrmAggregate {
  periods: IrmPeriod[]
  rows: IrmRow[]
  /** Quick lookup by IRM line id. */
  byId: Record<string, IrmRow>
}

/** Internal — which statement type feeds a given IRM line. */
function sourceFor(
  def: IrmLineDef,
  input: IrmInput
): LineItem[] {
  if (def.section === 'balance_sheet') {
    if (def.postes.some((p) => p.startsWith('ACTIF'))) return input.actifs
    if (def.postes.some((p) => p.startsWith('PASSIF'))) return input.passifs
  }
  if (def.section === 'income_statement') return input.compte_resultats
  return []
}

/** Sum amounts[periodIndex] across every line item whose poste matches. */
function sumForPeriod(
  items: LineItem[],
  postes: string[],
  periodIndex: number
): number | null {
  const wanted = new Set(postes)
  let total = 0
  let matched = 0
  for (const item of items) {
    if (!wanted.has(item.poste)) continue
    const amount = item.amounts?.[periodIndex]
    if (typeof amount === 'number' && Number.isFinite(amount)) {
      total += amount
      matched++
    }
  }
  return matched > 0 ? total : null
}

/**
 * Core aggregation. Pure — no DB or network access.
 * Returns one row per IRM line with both LCY and USD values.
 */
export function aggregateIrm(input: IrmInput): IrmAggregate {
  const fxMap = buildFxMap(input.fxRates)
  const unitDivisor = input.unitDivisor ?? 1
  const rows: IrmRow[] = []

  for (const def of BANK_IRM_LINES) {
    const source = sourceFor(def, input)
    const lcy: Array<number | null> = []
    const usd: Array<number | null> = []

    for (let i = 0; i < input.periods.length; i++) {
      const period = input.periods[i]
      let value = sumForPeriod(source, def.postes, i)
      if (value !== null && def.negate) value = -value
      lcy.push(value)

      if (value === null) {
        usd.push(null)
        continue
      }
      const rate = fxMap.get(period.key)
      usd.push(convertToUsd(value, rate, def.mode, unitDivisor))
    }

    rows.push({
      id: def.id,
      label: def.label,
      label_fr: def.label_fr,
      section: def.section,
      mode: def.mode,
      isSubtotal: !!def.isSubtotal,
      lcy,
      usd,
    })
  }

  const byId: Record<string, IrmRow> = {}
  for (const r of rows) byId[r.id] = r

  return { periods: input.periods, rows, byId }
}

/**
 * Annualize a single flow value if the period type is half-year.
 * BS values are returned unchanged.
 */
export function annualizeFlow(
  value: number | null,
  period: IrmPeriod
): number | null {
  if (value === null) return null
  if (period.type === 'H1') return value * 2
  return value
}

/**
 * Average of opening + closing for an "average balance" ratio denominator.
 * Returns null if the closing value is missing; if only the opening is
 * missing (first reported period) we fall back to the closing value and
 * the caller should flag it to the analyst.
 */
export interface AverageBalanceResult {
  value: number | null
  /** True when the opening balance was missing and we used closing as proxy. */
  incompleteOpening: boolean
}

export function averageBalance(
  row: IrmRow,
  periodIndex: number
): AverageBalanceResult {
  const closing = row.usd[periodIndex]
  if (closing === null || closing === undefined) {
    return { value: null, incompleteOpening: false }
  }
  const opening = periodIndex > 0 ? row.usd[periodIndex - 1] : null
  if (opening === null || opening === undefined) {
    return { value: closing, incompleteOpening: true }
  }
  return { value: (opening + closing) / 2, incompleteOpening: false }
}
