// src/lib/irm/ratios.ts
// Config-driven ratio engine. Ratios are declared as pure data so the set
// can be extended without code changes. Mirrors the BNDA Mali IRM block:
//   DuPont decomposition → ROAA, ROAE
//   Liquidity, asset quality, cost-to-income
//
// Averaging rule: any "avg" denominator uses (opening + closing) / 2 of the
// corresponding balance sheet row. First period falls back to closing.
// Half-year flows are multiplied by 2 before use in ratios.

import {
  annualizeFlow,
  averageBalance,
  type IrmAggregate,
} from './aggregate'

// ─── Ratio definition ─────────────────────────────────────────────────────
export type RatioGroup =
  | 'profitability'
  | 'liquidity'
  | 'capital'
  | 'asset_quality'
  | 'efficiency'

export interface RatioDef {
  id: string
  label: string
  label_fr: string
  group: RatioGroup
  /** IRM row id whose flow value is the numerator, if any. */
  flowNumeratorId?: string
  /**
   * Denominator is the average of this row's USD values (opening + closing).
   * If omitted, `stockDenominatorId` is used as-is (closing value).
   */
  avgDenominatorId?: string
  /** Stock denominator (closing value, no averaging). */
  stockDenominatorId?: string
  /** Stock numerator (closing value, no averaging). */
  stockNumeratorId?: string
  /** Flip sign (useful for `-opex / income`). */
  negate?: boolean
  /** Formatting hint for the UI. */
  format?: 'percent' | 'ratio' | 'multiple'
}

export const BANK_RATIOS: RatioDef[] = [
  // DuPont decomposition — each component is a flow / avg assets.
  {
    id: 'nii_avg_assets',
    label: '(a) NII / Avg Assets',
    label_fr: "(a) Marge nette d'intérêts / Actifs moyens",
    group: 'profitability',
    flowNumeratorId: 'net_interest_income',
    avgDenominatorId: 'total_assets',
    format: 'percent',
  },
  {
    id: 'non_int_income_avg_assets',
    label: '(b) Non-int income / Avg Assets',
    label_fr: '(b) Produits non-intérêts / Actifs moyens',
    group: 'profitability',
    flowNumeratorId: 'non_interest_income',
    avgDenominatorId: 'total_assets',
    format: 'percent',
  },
  {
    id: 'opex_avg_assets',
    label: '(c) Opex / Avg Assets',
    label_fr: '(c) Charges / Actifs moyens',
    group: 'profitability',
    flowNumeratorId: 'operating_expenses',
    avgDenominatorId: 'total_assets',
    format: 'percent',
  },
  {
    id: 'provisions_avg_assets',
    label: '(d) Cost of risk / Avg Assets',
    label_fr: '(d) Coût du risque / Actifs moyens',
    group: 'profitability',
    flowNumeratorId: 'cost_of_risk',
    avgDenominatorId: 'total_assets',
    format: 'percent',
  },
  {
    id: 'tax_avg_assets',
    label: '(e) Tax / Avg Assets',
    label_fr: '(e) Impôt / Actifs moyens',
    group: 'profitability',
    flowNumeratorId: 'tax',
    avgDenominatorId: 'total_assets',
    format: 'percent',
  },
  // Liquidity
  {
    id: 'loans_to_deposits',
    label: 'Loans / Deposits',
    label_fr: 'Crédits / Dépôts',
    group: 'liquidity',
    stockNumeratorId: 'net_loans',
    stockDenominatorId: 'deposits',
    format: 'percent',
  },
  // Capital
  {
    id: 'equity_to_assets',
    label: 'Equity / Assets',
    label_fr: 'Fonds propres / Actifs',
    group: 'capital',
    stockNumeratorId: 'shareholders_equity',
    stockDenominatorId: 'total_assets',
    format: 'percent',
  },
  // Efficiency
  {
    id: 'cost_to_income',
    label: 'Cost / Income',
    label_fr: 'Coefficient d\'exploitation',
    group: 'efficiency',
    flowNumeratorId: 'operating_expenses',
    stockDenominatorId: 'operating_income',
    negate: true,
    format: 'percent',
  },
]

// ─── Derived ratios (composed from other ratios) ──────────────────────────
export interface DerivedRatio {
  id: string
  label: string
  label_fr: string
  group: RatioGroup
  format: 'percent' | 'ratio' | 'multiple'
  compute: (values: Record<string, (number | null)[]>, periodIndex: number) => number | null
}

export const DERIVED_RATIOS: DerivedRatio[] = [
  {
    id: 'roaa',
    label: 'ROAA (DuPont)',
    label_fr: 'ROAA (DuPont)',
    group: 'profitability',
    format: 'percent',
    compute: (values, i) => {
      const ids = [
        'nii_avg_assets',
        'non_int_income_avg_assets',
        'opex_avg_assets',
        'provisions_avg_assets',
        'tax_avg_assets',
      ]
      let sum = 0
      let seen = 0
      for (const id of ids) {
        const v = values[id]?.[i]
        if (v === null || v === undefined || !Number.isFinite(v)) continue
        sum += v
        seen++
      }
      return seen > 0 ? sum : null
    },
  },
  {
    id: 'leverage',
    label: 'Leverage (Avg Assets / Avg Equity)',
    label_fr: 'Levier (Actifs moyens / Fonds propres moyens)',
    group: 'profitability',
    format: 'multiple',
    compute: (values, i) => values.__leverage__?.[i] ?? null,
  },
  {
    id: 'roae',
    label: 'ROAE',
    label_fr: 'ROAE',
    group: 'profitability',
    format: 'percent',
    compute: (values, i) => {
      const roaa = values.roaa?.[i]
      const lev = values.leverage?.[i]
      if (roaa === null || roaa === undefined || lev === null || lev === undefined) return null
      if (!Number.isFinite(roaa) || !Number.isFinite(lev)) return null
      return roaa * lev
    },
  },
]

// ─── Engine ───────────────────────────────────────────────────────────────
export interface RatioRow {
  id: string
  label: string
  label_fr: string
  group: RatioGroup
  format: 'percent' | 'ratio' | 'multiple'
  /** One value per period in the aggregate. null = insufficient data. */
  values: Array<number | null>
  /** Flags per period (e.g. "incomplete opening balance"). */
  flags: Array<string[] | null>
}

export interface RatioResult {
  rows: RatioRow[]
}

/**
 * Compute every configured ratio for every period in the aggregate.
 * Pure — relies only on the aggregate and the declarative ratio defs.
 */
export function computeRatios(aggregate: IrmAggregate): RatioResult {
  const byId = aggregate.byId
  const periodCount = aggregate.periods.length
  const computed: Record<string, Array<number | null>> = {}
  const rows: RatioRow[] = []

  // Pass 1 — base ratios
  for (const def of BANK_RATIOS) {
    const values: Array<number | null> = []
    const flags: Array<string[] | null> = []

    for (let i = 0; i < periodCount; i++) {
      const periodFlags: string[] = []

      // Numerator
      let numerator: number | null = null
      if (def.flowNumeratorId) {
        const row = byId[def.flowNumeratorId]
        const raw = row?.usd[i] ?? null
        numerator = annualizeFlow(raw, aggregate.periods[i])
      } else if (def.stockNumeratorId) {
        numerator = byId[def.stockNumeratorId]?.usd[i] ?? null
      }

      // Denominator
      let denominator: number | null = null
      if (def.avgDenominatorId) {
        const row = byId[def.avgDenominatorId]
        if (row) {
          const avg = averageBalance(row, i)
          denominator = avg.value
          if (avg.incompleteOpening) {
            periodFlags.push('incomplete_opening_balance')
          }
        }
      } else if (def.stockDenominatorId) {
        denominator = byId[def.stockDenominatorId]?.usd[i] ?? null
      }

      let value: number | null = null
      if (
        numerator !== null &&
        denominator !== null &&
        Number.isFinite(numerator) &&
        Number.isFinite(denominator) &&
        denominator !== 0
      ) {
        value = numerator / denominator
        if (def.negate) value = -value
      }

      values.push(value)
      flags.push(periodFlags.length > 0 ? periodFlags : null)
    }

    computed[def.id] = values
    rows.push({
      id: def.id,
      label: def.label,
      label_fr: def.label_fr,
      group: def.group,
      format: def.format ?? 'percent',
      values,
      flags,
    })
  }

  // Leverage: avg assets / avg equity (needed by ROAE)
  const leverageValues: Array<number | null> = []
  for (let i = 0; i < periodCount; i++) {
    const assets = byId['total_assets']
    const equity = byId['shareholders_equity']
    if (!assets || !equity) {
      leverageValues.push(null)
      continue
    }
    const avgA = averageBalance(assets, i).value
    const avgE = averageBalance(equity, i).value
    if (
      avgA === null ||
      avgE === null ||
      !Number.isFinite(avgA) ||
      !Number.isFinite(avgE) ||
      avgE === 0
    ) {
      leverageValues.push(null)
      continue
    }
    leverageValues.push(avgA / avgE)
  }
  computed.__leverage__ = leverageValues
  computed.leverage = leverageValues

  // Pass 2 — derived ratios
  for (const d of DERIVED_RATIOS) {
    const values: Array<number | null> = []
    for (let i = 0; i < periodCount; i++) {
      values.push(d.compute(computed, i))
    }
    computed[d.id] = values
    rows.push({
      id: d.id,
      label: d.label,
      label_fr: d.label_fr,
      group: d.group,
      format: d.format,
      values,
      flags: new Array(periodCount).fill(null),
    })
  }

  return { rows }
}
