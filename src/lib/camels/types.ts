// src/lib/camels/types.ts
// Type definitions for the CAMELS analysis system

import { Json } from '@/types/database.types'

/** Flat dict of financial values the calculator consumes */
export interface FinancialData {
  // Balance sheet - assets
  total_assets: number
  cash_and_equivalents: number
  liquid_assets: number
  investment_securities: number
  gross_loans: number
  net_loans: number
  fixed_assets: number
  // Balance sheet - liabilities
  total_deposits: number
  short_term_borrowings: number
  long_term_debt: number
  subordinated_debt: number
  total_liabilities: number
  // Balance sheet - equity
  total_equity: number
  // Income statement
  interest_income: number
  interest_expenses: number
  net_interest_income: number
  non_interest_income: number
  operating_income: number
  operating_expenses: number
  depreciation: number
  provision_expenses: number
  net_income: number
  taxes: number
  // Asset quality
  npls: number
  loan_loss_provisions: number
  // Derived (computed by computeDerivedFields)
  [key: string]: number
}

/** All ratios computed by the calculator */
export interface CAMELSRatios {
  // Capital
  equity_assets: number | null
  debt_assets: number | null
  // Asset quality
  npl_ratio: number | null
  coverage_ratio: number | null
  cost_of_risk_avg_assets: number | null
  // Management
  cost_to_income: number | null
  // Earnings
  roaa: number | null
  roae: number | null
  net_interest_margin: number | null
  // Liquidity
  liquid_assets_total_assets: number | null
  gross_loans_deposits: number | null
}

/** Rating for a single CAMELS component */
export interface ComponentRating {
  rating: number | null
  status: string
  ratios: Record<string, number | null>
}

/** Composite rating across all components */
export interface CompositeRating {
  composite_rating: number | null
  average: number | null
  status: string
}

/** Full analysis output from run_full_analysis */
export interface CAMELSAnalysisResult {
  ratios: CAMELSRatios
  ratings: {
    capital: ComponentRating
    asset_quality: ComponentRating
    management: ComponentRating
    earnings: ComponentRating
    liquidity: ComponentRating
    composite: CompositeRating
  }
  analysis: {
    capital: string
    asset_quality: string
    management: string
    earnings: string
    liquidity: string
    composite: string
  }
}

/** Multi-period analysis output */
export interface MultiPeriodAnalysis {
  company_name: string
  type_institution: string
  periods: string[]
  period_labels: string[]
  financial_summary: {
    balance_sheet: SummaryRow[]
    income_statement: SummaryRow[]
  }
  ratio_tables: {
    solvency: RatioTableRow[]
    asset_quality: RatioTableRow[]
    profitability: RatioTableRow[]
    liquidity: RatioTableRow[]
  }
  ratings: CAMELSAnalysisResult['ratings']
  analysis: CAMELSAnalysisResult['analysis']
  key_metrics: Record<string, number | null>
}

export interface SummaryRow {
  label: string
  key: string
  values: number[]
  cagr: number | null
}

export interface RatioTableRow {
  label: string
  key: string
  values: (number | null)[]
  format: 'percent' | 'number' | 'multiple'
}

/** Database row for camels_analyses table */
export interface CAMELSAnalysisRow {
  id: string
  user_id: string
  company_name: string
  period: string
  type_institution: string
  // Ratio columns
  equity_assets: number | null
  debt_assets: number | null
  npl_ratio: number | null
  coverage_ratio: number | null
  cost_of_risk_avg_assets: number | null
  cost_to_income: number | null
  roaa: number | null
  roae: number | null
  net_interest_margin: number | null
  liquid_assets_total_assets: number | null
  gross_loans_deposits: number | null
  // Rating JSONB columns
  capital_rating: Json
  asset_quality_rating: Json
  management_rating: Json
  earnings_rating: Json
  liquidity_rating: Json
  composite_rating: Json
  // Analysis text
  analysis_capital: string | null
  analysis_asset_quality: string | null
  analysis_management: string | null
  analysis_earnings: string | null
  analysis_liquidity: string | null
  analysis_composite: string | null
  created_at: string
  updated_at: string
}
