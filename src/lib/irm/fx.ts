// src/lib/irm/fx.ts
// Pure helpers for analyst-entered FX rates used by the IRM (USD) layer.
//
// Two rates per reporting period:
//   fx_eop — end-of-period, applied to balance-sheet items (stocks)
//   fx_avg — period average, applied to P&L items (flows)
//
// Analysts look these up in the internal IFC FX library and type them in —
// this module never fetches rates.

/** A single analyst-entered FX rate record for one period. */
export interface PeriodFxRate {
  /** Period identifier (ISO date string or label, e.g. "2023-12-31" / "H1 2024"). */
  period: string
  /** End-of-period rate (LCY per 1 USD). Used for balance-sheet items. */
  fx_eop: number | null
  /** Average rate over the period (LCY per 1 USD). Used for P&L items. */
  fx_avg: number | null
  /** Free-form source citation, e.g. "IFC FX library, 2023". */
  source?: string | null
  notes?: string | null
}

/** A single validation problem with a specific FX entry. */
export interface FxValidationIssue {
  period: string
  field: 'fx_eop' | 'fx_avg' | 'period'
  message: string
}

/** Result of validating a set of FX rate entries. */
export interface FxValidationResult {
  valid: boolean
  issues: FxValidationIssue[]
}

/** Result of checking whether a rate set covers every expected period. */
export interface FxCompletenessResult {
  /** True when every required period has both fx_eop and fx_avg set to finite > 0 values. */
  complete: boolean
  /** Periods missing an fx_eop value. */
  missingEop: string[]
  /** Periods missing an fx_avg value. */
  missingAvg: string[]
  /** Periods expected by the caller but absent from the rate set entirely. */
  missingPeriods: string[]
}

/**
 * Validate a raw FX rate entry. Returns every problem found; never throws.
 * A rate is valid when, if provided, it is a finite number strictly greater
 * than zero. `null`/`undefined` mean "not yet entered" and are allowed in
 * drafts — use {@link checkFxCompleteness} to gate the IRM view.
 */
export function validateFxRate(rate: Partial<PeriodFxRate>): FxValidationResult {
  const issues: FxValidationIssue[] = []
  const period = typeof rate.period === 'string' ? rate.period.trim() : ''

  if (!period) {
    issues.push({ period: '', field: 'period', message: 'Period is required' })
  }

  for (const field of ['fx_eop', 'fx_avg'] as const) {
    const value = rate[field]
    if (value === null || value === undefined) continue
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      issues.push({
        period,
        field,
        message: `${field} must be a finite number`,
      })
      continue
    }
    if (value <= 0) {
      issues.push({
        period,
        field,
        message: `${field} must be greater than zero`,
      })
    }
  }

  return { valid: issues.length === 0, issues }
}

/**
 * Validate an entire set of FX rate entries at once. Also flags duplicate
 * period keys, which would silently clobber each other in the DB.
 */
export function validateFxRates(rates: Partial<PeriodFxRate>[]): FxValidationResult {
  const issues: FxValidationIssue[] = []
  const seen = new Set<string>()

  for (const rate of rates) {
    const single = validateFxRate(rate)
    issues.push(...single.issues)

    const period = typeof rate.period === 'string' ? rate.period.trim() : ''
    if (period) {
      if (seen.has(period)) {
        issues.push({
          period,
          field: 'period',
          message: `Duplicate entry for period "${period}"`,
        })
      }
      seen.add(period)
    }
  }

  return { valid: issues.length === 0, issues }
}

/** Internal — is a value a usable, positive, finite rate? */
function isUsableRate(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/**
 * Check whether the supplied rates cover every `expectedPeriods` entry with
 * both `fx_eop` and `fx_avg` populated. The IRM view should not render unless
 * `complete === true`.
 */
export function checkFxCompleteness(
  expectedPeriods: string[],
  rates: PeriodFxRate[]
): FxCompletenessResult {
  const byPeriod = new Map<string, PeriodFxRate>()
  for (const rate of rates) {
    if (typeof rate.period === 'string' && rate.period) {
      byPeriod.set(rate.period, rate)
    }
  }

  const missingPeriods: string[] = []
  const missingEop: string[] = []
  const missingAvg: string[] = []

  for (const period of expectedPeriods) {
    const rate = byPeriod.get(period)
    if (!rate) {
      missingPeriods.push(period)
      missingEop.push(period)
      missingAvg.push(period)
      continue
    }
    if (!isUsableRate(rate.fx_eop)) missingEop.push(period)
    if (!isUsableRate(rate.fx_avg)) missingAvg.push(period)
  }

  return {
    complete:
      missingPeriods.length === 0 &&
      missingEop.length === 0 &&
      missingAvg.length === 0,
    missingEop,
    missingAvg,
    missingPeriods,
  }
}

/**
 * Build a convenient lookup map keyed by period identifier. Unknown or
 * malformed entries are silently skipped — use {@link validateFxRates} first
 * if you need to surface errors.
 */
export function buildFxMap(rates: PeriodFxRate[]): Map<string, PeriodFxRate> {
  const map = new Map<string, PeriodFxRate>()
  for (const rate of rates) {
    if (typeof rate.period === 'string' && rate.period) {
      map.set(rate.period, rate)
    }
  }
  return map
}

/**
 * Convert an LCY value to USD using the analyst-entered rates.
 * Pass `mode: 'stock'` for balance-sheet items (uses `fx_eop`),
 * `mode: 'flow'` for P&L items (uses `fx_avg`).
 * Returns `null` when the required rate is missing or invalid.
 */
export function convertToUsd(
  value: number,
  rate: PeriodFxRate | undefined | null,
  mode: 'stock' | 'flow',
  unitDivisor = 1
): number | null {
  if (!rate) return null
  if (!Number.isFinite(value)) return null
  const fx = mode === 'stock' ? rate.fx_eop : rate.fx_avg
  if (!isUsableRate(fx)) return null
  if (!Number.isFinite(unitDivisor) || unitDivisor <= 0) return null
  return value / (fx * unitDivisor)
}
