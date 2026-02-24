// src/app/api/camels/analyze/route.ts
// POST: Run CAMELS analysis for a company across all available periods.
// Reads financial_statements, computes ratios, saves to camels_analyses.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { extractFinancialData, getAllPeriods } from '@/lib/camels/field-mapper'
import { runFullAnalysis } from '@/lib/camels/calculator'
import { generateNarrative } from '@/lib/camels/narrative-generator'
import { FinancialData } from '@/lib/camels/types'
import { LineItem } from '@/types/database.types'

export async function POST(request: NextRequest) {
  try {
    const { user_id, company_name } = await request.json()

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

    // Get all periods sorted chronologically
    const periods = getAllPeriods(stmtsByType)

    if (periods.length === 0) {
      return NextResponse.json(
        { error: 'No periods found in statements' },
        { status: 400 }
      )
    }

    // Run analysis for each period with previous-period lookback for averages
    const results: Array<{
      period: string
      data: FinancialData
      analysis: ReturnType<typeof runFullAnalysis>
    }> = []

    let prevData: FinancialData | null = null

    for (const period of periods) {
      const data = extractFinancialData(stmtsByType, period, institutionType)
      const analysis = runFullAnalysis(data, prevData)
      results.push({ period, data, analysis })
      prevData = data
    }

    // Build period labels
    const periodLabels = periods.map(p => {
      const d = new Date(p)
      return `FY${String(d.getFullYear()).slice(-2)}`
    })

    const latestResult = results[results.length - 1]

    // Try AI narrative (Layer 2) — falls back to deterministic (Layer 1) if unavailable
    let analysisText = latestResult.analysis.analysis
    const narrative = await generateNarrative({
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
    })

    if (narrative) {
      console.log('CAMELS: Using AI-generated narrative')
      analysisText = narrative
    } else {
      console.log('CAMELS: Using deterministic analysis paragraphs')
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
        console.error(`Failed to save analysis for period ${period}:`, upsertError)
      }
    }

    // Build financial summary
    const balanceSheetKeys = [
      { label: 'Total Assets', key: 'total_assets' },
      { label: 'Gross Loans', key: 'gross_loans' },
      { label: 'Total Deposits', key: 'total_deposits' },
      { label: 'Total Equity', key: 'total_equity' },
    ]
    const incomeKeys = [
      { label: 'Interest Income', key: 'interest_income' },
      { label: 'Interest Expenses', key: 'interest_expenses' },
      { label: 'Operating Expenses', key: 'operating_expenses' },
      { label: 'Net Income', key: 'net_income' },
    ]

    const buildSummary = (keys: Array<{ label: string; key: string }>) =>
      keys.map(({ label, key }) => ({
        label,
        key,
        values: results.map(r => r.data[key] ?? 0),
      }))

    // Build ratio tables
    const ratioKeys = {
      solvency: [
        { label: 'Equity / Assets', key: 'equity_assets', format: 'percent' as const },
        { label: 'Debt / Assets', key: 'debt_assets', format: 'percent' as const },
      ],
      asset_quality: [
        { label: 'NPL Ratio', key: 'npl_ratio', format: 'percent' as const },
        { label: 'Coverage Ratio', key: 'coverage_ratio', format: 'percent' as const },
      ],
      profitability: [
        { label: 'ROAA', key: 'roaa', format: 'percent' as const },
        { label: 'ROAE', key: 'roae', format: 'percent' as const },
        { label: 'Net Interest Margin', key: 'net_interest_margin', format: 'percent' as const },
        { label: 'Cost-to-Income', key: 'cost_to_income', format: 'percent' as const },
      ],
      liquidity: [
        { label: 'Liquid Assets / Total Assets', key: 'liquid_assets_total_assets', format: 'percent' as const },
        { label: 'Gross Loans / Deposits', key: 'gross_loans_deposits', format: 'percent' as const },
      ],
    }

    const buildRatioTable = (keys: Array<{ label: string; key: string; format: 'percent' | 'number' | 'multiple' }>) =>
      keys.map(({ label, key, format }) => ({
        label,
        key,
        values: results.map(r => r.analysis.ratios[key as keyof typeof r.analysis.ratios] ?? null),
        format,
      }))

    return NextResponse.json({
      success: true,
      company_name,
      type_institution: institutionType,
      periods,
      period_labels: periodLabels,
      financial_summary: {
        balance_sheet: buildSummary(balanceSheetKeys),
        income_statement: buildSummary(incomeKeys),
      },
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
    console.error('CAMELS analysis error:', error)
    return NextResponse.json(
      { error: error.message || 'CAMELS analysis failed' },
      { status: 500 }
    )
  }
}
