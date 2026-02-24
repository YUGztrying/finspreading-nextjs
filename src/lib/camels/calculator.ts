// src/lib/camels/calculator.ts
// Port of camels_calculator.py — pure functions, no mutation, no side effects.
// Computes CAMELS ratios, ratings, and analysis text from FinancialData.

import { FinancialData, CAMELSRatios, ComponentRating, CompositeRating, CAMELSAnalysisResult } from './types'

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeDivide(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null
  return numerator / denominator
}

function get(data: FinancialData, key: string, fallback = 0): number {
  return data[key] ?? fallback
}

function avg(current: number, previous: number | null): number {
  if (previous == null || previous === 0) return current
  return (current + previous) / 2
}

function pct(value: number | null): string {
  if (value == null) return 'N/A'
  return `${(value * 100).toFixed(1)}%`
}

// ─── Ratio Calculations ─────────────────────────────────────────────────────

export function calculateAllRatios(
  statement: FinancialData,
  prevStatement: FinancialData | null = null
): CAMELSRatios {
  const totalAssets = get(statement, 'total_assets')
  const totalEquity = get(statement, 'total_equity')
  const grossLoans = get(statement, 'gross_loans')
  const npls = get(statement, 'npls')
  const loanLossProvisions = Math.abs(get(statement, 'loan_loss_provisions'))
  const netIncome = get(statement, 'net_income')
  const operatingIncome = get(statement, 'operating_income')
  const operatingExpenses = Math.abs(get(statement, 'operating_expenses'))
  const provisionExpenses = Math.abs(get(statement, 'provision_expenses'))
  const netInterestIncome = get(statement, 'net_interest_income')
  const totalDeposits = get(statement, 'total_deposits')

  // Liquid assets = cash + interbank deposits + investment securities
  const liquidAssets =
    get(statement, 'cash_and_equivalents') +
    get(statement, 'liquid_assets') +
    get(statement, 'investment_securities')

  // Average assets/equity for returns
  const avgTotalAssets = avg(totalAssets, prevStatement ? get(prevStatement, 'total_assets') : null)
  const avgTotalEquity = avg(totalEquity, prevStatement ? get(prevStatement, 'total_equity') : null)

  // Short + long term debt for debt/assets
  const totalDebt =
    get(statement, 'short_term_borrowings') + get(statement, 'long_term_debt')

  return {
    // Capital
    equity_assets: safeDivide(totalEquity, totalAssets),
    debt_assets: safeDivide(totalDebt, totalAssets),
    // Asset quality
    npl_ratio: safeDivide(npls, grossLoans),
    coverage_ratio: safeDivide(loanLossProvisions, npls),
    cost_of_risk_avg_assets: safeDivide(provisionExpenses, avgTotalAssets),
    // Management
    cost_to_income: safeDivide(operatingExpenses, operatingIncome),
    // Earnings
    roaa: safeDivide(netIncome, avgTotalAssets),
    roae: safeDivide(netIncome, avgTotalEquity),
    net_interest_margin: safeDivide(netInterestIncome, avgTotalAssets),
    // Liquidity
    liquid_assets_total_assets: safeDivide(liquidAssets, totalAssets),
    gross_loans_deposits: safeDivide(grossLoans, totalDeposits),
  }
}

// ─── Scoring Thresholds ─────────────────────────────────────────────────────

interface ThresholdEntry {
  thresholds: number[]
  ascending: boolean // true = higher is better
}

const THRESHOLDS: Record<string, ThresholdEntry> = {
  equity_assets:             { thresholds: [0.04, 0.06, 0.09, 0.12], ascending: true },
  npl_ratio:                 { thresholds: [0.02, 0.05, 0.08, 0.12], ascending: false },
  cost_to_income:            { thresholds: [0.40, 0.55, 0.70, 0.85], ascending: false },
  roae:                      { thresholds: [0.00, 0.05, 0.10, 0.15], ascending: true },
  liquid_assets_total_assets:{ thresholds: [0.10, 0.15, 0.25, 0.35], ascending: true },
}

const RATING_LABELS = ['Unsatisfactory', 'Marginal', 'Fair', 'Satisfactory', 'Strong']

function scoreRatio(value: number | null, key: string): { rating: number | null; status: string } {
  if (value == null) return { rating: null, status: 'Insufficient data' }

  const entry = THRESHOLDS[key]
  if (!entry) return { rating: null, status: 'No threshold defined' }

  const { thresholds, ascending } = entry

  if (ascending) {
    // Higher is better: >= threshold[3] → 1, >= threshold[2] → 2, etc.
    if (value >= thresholds[3]) return { rating: 1, status: RATING_LABELS[4] }
    if (value >= thresholds[2]) return { rating: 2, status: RATING_LABELS[3] }
    if (value >= thresholds[1]) return { rating: 3, status: RATING_LABELS[2] }
    if (value >= thresholds[0]) return { rating: 4, status: RATING_LABELS[1] }
    return { rating: 5, status: RATING_LABELS[0] }
  } else {
    // Lower is better: < threshold[0] → 1, < threshold[1] → 2, etc.
    if (value < thresholds[0]) return { rating: 1, status: RATING_LABELS[4] }
    if (value < thresholds[1]) return { rating: 2, status: RATING_LABELS[3] }
    if (value < thresholds[2]) return { rating: 3, status: RATING_LABELS[2] }
    if (value < thresholds[3]) return { rating: 4, status: RATING_LABELS[1] }
    return { rating: 5, status: RATING_LABELS[0] }
  }
}

// ─── Component Ratings ──────────────────────────────────────────────────────

function rateCapital(ratios: CAMELSRatios): ComponentRating {
  const primary = scoreRatio(ratios.equity_assets, 'equity_assets')
  return {
    ...primary,
    ratios: {
      equity_assets: ratios.equity_assets,
      debt_assets: ratios.debt_assets,
    },
  }
}

function rateAssetQuality(ratios: CAMELSRatios): ComponentRating {
  const primary = scoreRatio(ratios.npl_ratio, 'npl_ratio')
  return {
    ...primary,
    ratios: {
      npl_ratio: ratios.npl_ratio,
      coverage_ratio: ratios.coverage_ratio,
      cost_of_risk_avg_assets: ratios.cost_of_risk_avg_assets,
    },
  }
}

function rateManagement(ratios: CAMELSRatios): ComponentRating {
  const primary = scoreRatio(ratios.cost_to_income, 'cost_to_income')
  return {
    ...primary,
    ratios: {
      cost_to_income: ratios.cost_to_income,
    },
  }
}

function rateEarnings(ratios: CAMELSRatios): ComponentRating {
  const primary = scoreRatio(ratios.roae, 'roae')
  return {
    ...primary,
    ratios: {
      roaa: ratios.roaa,
      roae: ratios.roae,
      net_interest_margin: ratios.net_interest_margin,
    },
  }
}

function rateLiquidity(ratios: CAMELSRatios): ComponentRating {
  const primary = scoreRatio(ratios.liquid_assets_total_assets, 'liquid_assets_total_assets')
  return {
    ...primary,
    ratios: {
      liquid_assets_total_assets: ratios.liquid_assets_total_assets,
      gross_loans_deposits: ratios.gross_loans_deposits,
    },
  }
}

function computeComposite(ratings: Record<string, ComponentRating>): CompositeRating {
  const validRatings = Object.values(ratings)
    .map(r => r.rating)
    .filter((r): r is number => r != null)

  if (validRatings.length === 0) {
    return { composite_rating: null, average: null, status: 'Insufficient data' }
  }

  const average = validRatings.reduce((s, v) => s + v, 0) / validRatings.length
  const composite = Math.round(average)

  return {
    composite_rating: composite,
    average: Math.round(average * 10) / 10,
    status: RATING_LABELS[Math.max(0, 5 - composite)] ?? 'Unknown',
  }
}

// ─── Analysis Text Generation ───────────────────────────────────────────────

function generateAnalysis(
  ratios: CAMELSRatios,
  ratings: Record<string, ComponentRating>,
  composite: CompositeRating
): CAMELSAnalysisResult['analysis'] {
  const cap = ratings.capital
  const aq = ratings.asset_quality
  const mgmt = ratings.management
  const earn = ratings.earnings
  const liq = ratings.liquidity

  return {
    capital: `Capital Adequacy — Rating: ${cap.rating ?? 'N/A'} (${cap.status}). ` +
      `Equity/Assets: ${pct(ratios.equity_assets)}. ` +
      `Debt/Assets: ${pct(ratios.debt_assets)}.`,

    asset_quality: `Asset Quality — Rating: ${aq.rating ?? 'N/A'} (${aq.status}). ` +
      `NPL Ratio: ${pct(ratios.npl_ratio)}. ` +
      `Coverage Ratio: ${pct(ratios.coverage_ratio)}. ` +
      `Cost of Risk/Avg Assets: ${pct(ratios.cost_of_risk_avg_assets)}.`,

    management: `Management — Rating: ${mgmt.rating ?? 'N/A'} (${mgmt.status}). ` +
      `Cost-to-Income: ${pct(ratios.cost_to_income)}.`,

    earnings: `Earnings — Rating: ${earn.rating ?? 'N/A'} (${earn.status}). ` +
      `ROAA: ${pct(ratios.roaa)}. ROAE: ${pct(ratios.roae)}. ` +
      `Net Interest Margin: ${pct(ratios.net_interest_margin)}.`,

    liquidity: `Liquidity — Rating: ${liq.rating ?? 'N/A'} (${liq.status}). ` +
      `Liquid Assets/Total Assets: ${pct(ratios.liquid_assets_total_assets)}. ` +
      `Gross Loans/Deposits: ${pct(ratios.gross_loans_deposits)}.`,

    composite: `Composite CAMELS Rating: ${composite.composite_rating ?? 'N/A'} ` +
      `(${composite.status}). Average: ${composite.average ?? 'N/A'}. ` +
      `Based on ${Object.values(ratings).filter(r => r.rating != null).length} of 5 components.`,
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Run a full CAMELS analysis on a single period's financial data.
 */
export function runFullAnalysis(
  statement: FinancialData,
  prevStatement: FinancialData | null = null
): CAMELSAnalysisResult {
  const ratios = calculateAllRatios(statement, prevStatement)

  const componentRatings = {
    capital: rateCapital(ratios),
    asset_quality: rateAssetQuality(ratios),
    management: rateManagement(ratios),
    earnings: rateEarnings(ratios),
    liquidity: rateLiquidity(ratios),
  }

  const composite = computeComposite(componentRatings)
  const analysis = generateAnalysis(ratios, componentRatings, composite)

  return {
    ratios,
    ratings: {
      ...componentRatings,
      composite,
    },
    analysis,
  }
}
