// src/app/api/camels/analyze/route.ts
// POST: Run CAMELS analysis for a company across all available periods.
// Reads financial_statements, computes ratios, saves to camels_analyses.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { extractFinancialData, getAllPeriods } from '@/lib/camels/field-mapper'
import { runFullAnalysis } from '@/lib/camels/calculator'
import { generateNarrative } from '@/lib/camels/narrative-generator'
import { FinancialData } from '@/lib/camels/types'
import { LineItem, PeriodMapping } from '@/types/database.types'

export async function POST(request: NextRequest) {
  try {
    const { user_id, company_name, force_refresh = false, period_mappings: rawMappings } = await request.json()
    const periodMappings: PeriodMapping[] | null = Array.isArray(rawMappings) && rawMappings.length > 0 ? rawMappings : null

    if (!user_id || !company_name) {
      return NextResponse.json(
        { error: 'user_id and company_name are required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient() as any

    // Fetch all statements for this company
    const { data: statements, error: fetchError } = await supabase
      .from('financial_statements')
      .select('*')
      .eq('user_id', user_id)
      .eq('company_name', company_name)

    if (fetchError) {
      throw new Error(`Failed to fetch statements: ${fetchError.message}`)
    }

    if (!statements || statements.length === 0) {
      return NextResponse.json(
        { error: 'No financial statements found for this company' },
        { status: 404 }
      )
    }

    // Organize statements by type
    const stmtsByType: Record<string, { line_items: LineItem[]; periods: string[] }> = {}
    let institutionType: 'banque' | 'microfinance' = 'banque'

    for (const stmt of statements) {
      stmtsByType[stmt.statement_type] = {
        line_items: stmt.line_items as LineItem[],
        periods: stmt.periods as string[],
      }
      institutionType = stmt.type_institution as 'banque' | 'microfinance'
    }

    // ── Determine analysis periods ──────────────────────────────────────────
    // If the caller supplied period_mappings (user-confirmed alignment),
    // use those.  Otherwise fall back to the union of all statement periods.
    let periods: string[]
    let periodLabels: string[]

    const results: Array<{
      period: string
      data: FinancialData
      analysis: ReturnType<typeof runFullAnalysis>
    }> = []

    let prevData: FinancialData | null = null

    if (periodMappings) {
      // User-confirmed period alignment: each mapping specifies per-type lookups
      periods = periodMappings.map(m => m.bs_period ?? m.is_period ?? m.hb_period ?? '')
      periodLabels = periodMappings.map(m => m.label)

      for (const mapping of periodMappings) {
        const canonicalPeriod = mapping.bs_period ?? mapping.is_period ?? mapping.hb_period ?? ''
        const data = extractFinancialData(stmtsByType, canonicalPeriod, institutionType, {
          bs_period: mapping.bs_period,
          is_period: mapping.is_period,
          hb_period: mapping.hb_period,
        })
        const analysis = runFullAnalysis(data, prevData)
        results.push({ period: canonicalPeriod, data, analysis })
        prevData = data
      }
    } else {
      // No explicit mappings — use union of all periods (backward compatible)
      periods = getAllPeriods(stmtsByType)

      if (periods.length === 0) {
        return NextResponse.json(
          { error: 'No periods found in statements' },
          { status: 400 }
        )
      }

      periodLabels = periods.map(p => {
        const d = new Date(p)
        return `FY${String(d.getFullYear()).slice(-2)}`
      })

      for (const period of periods) {
        const data = extractFinancialData(stmtsByType, period, institutionType)
        const analysis = runFullAnalysis(data, prevData)
        results.push({ period, data, analysis })
        prevData = data
      }
    }

    const latestResult = results[results.length - 1]

    // Try AI narrative (Layer 2) — falls back to deterministic (Layer 1) if unavailable
    let analysisText = latestResult.analysis.analysis
    let analysisCached = false
    let lastRun: string | null = null

    // Use cached narrative if it exists and a refresh was not explicitly requested
    if (!force_refresh) {
      const { data: cached } = await supabase
        .from('camels_analyses')
        .select('analysis_capital, analysis_asset_quality, analysis_management, analysis_earnings, analysis_liquidity, analysis_composite, updated_at')
        .eq('user_id', user_id)
        .eq('company_name', company_name)
        .eq('period', latestResult.period)
        .maybeSingle()

      if (cached?.analysis_composite) {
        analysisText = {
          capital: cached.analysis_capital ?? '',
          asset_quality: cached.analysis_asset_quality ?? '',
          management: cached.analysis_management ?? '',
          earnings: cached.analysis_earnings ?? '',
          liquidity: cached.analysis_liquidity ?? '',
          composite: cached.analysis_composite ?? '',
        }
        analysisCached = true
        lastRun = cached.updated_at ?? null
      }
    }

    const narrative = !analysisCached ? await generateNarrative({
      companyName: company_name,
      institutionType: institutionType,
      periods,
      periodLabels,
      periodData: results.map((r, i) => ({
        period: r.period,
        label: periodLabels[i],
        data: r.data,
      })),
      periodRatios: results.map((r, i) => ({
        period: r.period,
        label: periodLabels[i],
        ratios: r.analysis.ratios,
      })),
      ratings: latestResult.analysis.ratings as any,
    }) : null

    if (narrative) {
      analysisText = narrative
    } else if (!analysisCached) {
    }

    // Save each period's analysis to the database (upsert)
    for (const { period, analysis } of results) {
      // For the latest period, use the (possibly AI-enhanced) analysis text
      const isLatest = period === results[results.length - 1].period
      const periodAnalysis = isLatest ? analysisText : analysis.analysis

      const row = {
        user_id,
        company_name,
        period,
        type_institution: institutionType,
        // Ratio columns
        equity_assets: analysis.ratios.equity_assets,
        debt_assets: analysis.ratios.debt_assets,
        npl_ratio: analysis.ratios.npl_ratio,
        coverage_ratio: analysis.ratios.coverage_ratio,
        cost_of_risk_avg_assets: analysis.ratios.cost_of_risk_avg_assets,
        cost_to_income: analysis.ratios.cost_to_income,
        roaa: analysis.ratios.roaa,
        roae: analysis.ratios.roae,
        net_interest_margin: analysis.ratios.net_interest_margin,
        liquid_assets_total_assets: analysis.ratios.liquid_assets_total_assets,
        gross_loans_deposits: analysis.ratios.gross_loans_deposits,
        // Ratings JSONB
        capital_rating: analysis.ratings.capital,
        asset_quality_rating: analysis.ratings.asset_quality,
        management_rating: analysis.ratings.management,
        earnings_rating: analysis.ratings.earnings,
        liquidity_rating: analysis.ratings.liquidity,
        composite_rating: analysis.ratings.composite,
        // Analysis text
        analysis_capital: periodAnalysis.capital,
        analysis_asset_quality: periodAnalysis.asset_quality,
        analysis_management: periodAnalysis.management,
        analysis_earnings: periodAnalysis.earnings,
        analysis_liquidity: periodAnalysis.liquidity,
        analysis_composite: periodAnalysis.composite,
      }

      const { error: upsertError } = await supabase
        .from('camels_analyses')
        .upsert(row, { onConflict: 'user_id,company_name,period' })

      if (upsertError) {
      }
    }

    // ─── CAGR helper ─────────────────────────────────────────────────────────
    function computeCagr(values: number[]): number | null {
      if (values.length < 2) return null
      const first = values[0]
      const last = values[values.length - 1]
      if (first <= 0 || last <= 0) return null
      return Math.pow(last / first, 1 / (values.length - 1)) - 1
    }

    // ─── Balance Sheet ────────────────────────────────────────────────────────
    const balanceSheetKeys = [
      { label: 'Total Assets', key: 'total_assets', bold: true },
      { label: 'Total Liabilities', key: 'total_liabilities', bold: true },
      { label: "Shareholders' Equity", key: 'total_equity', bold: true },
      { label: 'Cash & Bank Deposits', key: 'cash_and_equivalents', bold: false },
      { label: 'Investment Securities', key: 'investment_securities', bold: false },
      { label: 'Gross Loans', key: 'gross_loans', bold: false },
      { label: 'Loan Loss Provisions', key: 'loan_loss_provisions', bold: false },
      { label: 'Customer Deposits', key: 'total_deposits', bold: false },
      { label: 'Borrowings', key: '_borrowings', bold: false },
      { label: 'Subordinated Debt', key: 'subordinated_debt', bold: false },
    ]

    const buildSummaryRow = (label: string, key: string, bold: boolean) => {
      const values = results.map(r => {
        if (key === '_borrowings') {
          return (r.data.short_term_borrowings ?? 0) + (r.data.long_term_debt ?? 0)
        }
        return r.data[key] ?? 0
      })
      return { label, key, values, cagr: computeCagr(values), bold }
    }

    const balanceSheet = balanceSheetKeys.map(k => buildSummaryRow(k.label, k.key, k.bold))

    // ─── Income Statement ─────────────────────────────────────────────────────
    const incomeKeys = [
      { label: 'Net Interest Income', key: 'net_interest_income', bold: false },
      { label: 'Non-Interest Income', key: 'non_interest_income', bold: false },
      { label: 'Operating Expenses', key: 'operating_expenses', bold: false },
      { label: 'Cost of Risk', key: 'provision_expenses', bold: false },
      { label: 'Net Profit', key: 'net_income', bold: true },
    ]

    const incomeStatement = incomeKeys.map(k => buildSummaryRow(k.label, k.key, k.bold))

    // ─── Growth Evolution ─────────────────────────────────────────────────────
    const growthKeys = [
      { label: 'Total Asset Growth', key: 'total_assets' },
      { label: 'Gross Loan Growth', key: 'gross_loans' },
      { label: 'Deposit Growth', key: 'total_deposits' },
      { label: 'Equity Growth', key: 'total_equity' },
    ]

    const growthEvolution = growthKeys.map(({ label, key }) => {
      const values = results.map((r, i) => {
        if (i === 0) return null
        const prev = results[i - 1].data[key] ?? 0
        const curr = r.data[key] ?? 0
        if (prev === 0) return null
        return (curr - prev) / Math.abs(prev)
      })
      return { label, key, values, format: 'percent' as const }
    })

    // ─── Ratio Tables ─────────────────────────────────────────────────────────
    // CAR (Capital Adequacy Ratio) = Total Equity / Total Assets (same as equity_assets)
    const ratioKeys = {
      solvency: [
        { label: 'CAR', key: 'equity_assets', format: 'percent' as const },
        { label: 'Equity / Assets', key: 'equity_assets', format: 'percent' as const },
      ],
      asset_quality: [
        { label: 'NPL Ratio', key: 'npl_ratio', format: 'percent' as const },
        { label: 'Coverage Ratio', key: 'coverage_ratio', format: 'percent' as const },
      ],
      profitability: [
        { label: 'ROAA', key: 'roaa', format: 'percent' as const },
        { label: 'ROAE', key: 'roae', format: 'percent' as const },
        { label: 'Cost-to-Income Ratio', key: 'cost_to_income', format: 'percent' as const },
      ],
      liquidity: [
        { label: 'Gross Loans / Deposits', key: 'gross_loans_deposits', format: 'percent' as const },
        { label: 'Liquid Assets / Total Assets', key: 'liquid_assets_total_assets', format: 'percent' as const },
      ],
    }

    const buildRatioTable = (keys: Array<{ label: string; key: string; format: 'percent' | 'number' | 'multiple' }>) =>
      keys.map(({ label, key, format }) => ({
        label,
        key,
        values: results.map(r => r.analysis.ratios[key as keyof typeof r.analysis.ratios] ?? null),
        format,
      }))

    // Set last_run to now for fresh analyses
    if (!lastRun) lastRun = new Date().toISOString()

    return NextResponse.json({
      success: true,
      last_run: lastRun,
      company_name,
      type_institution: institutionType,
      periods,
      period_labels: periodLabels,
      financial_summary: {
        balance_sheet: balanceSheet,
        income_statement: incomeStatement,
      },
      growth_evolution: growthEvolution,
      ratio_tables: {
        solvency: buildRatioTable(ratioKeys.solvency),
        asset_quality: buildRatioTable(ratioKeys.asset_quality),
        profitability: buildRatioTable(ratioKeys.profitability),
        liquidity: buildRatioTable(ratioKeys.liquidity),
      },
      ratings: latestResult.analysis.ratings,
      analysis: analysisText,
      key_metrics: latestResult.data,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'CAMELS analysis failed' },
      { status: 500 }
    )
  }
}
