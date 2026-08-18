// src/app/api/irm/route.ts
// GET /api/irm?user_id=…&company_name=…
// Returns the full IRM payload: BS + IS rows in LCY/USD, plus ratios.
// Uses analyst-entered FX rates from period_fx_rates.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { LineItem } from '@/types/database.types'
import { aggregateIrm, type IrmPeriod } from '@/lib/irm/aggregate'
import { computeRatios } from '@/lib/irm/ratios'
import { checkFxCompleteness, type PeriodFxRate } from '@/lib/irm/fx'

function inferPeriodType(key: string): IrmPeriod['type'] {
  // Dates like 2024-06-30 → H1, anything ending in 12-31 → FY, otherwise undefined
  if (/-06-30$/.test(key)) return 'H1'
  if (/-12-31$/.test(key)) return 'FY'
  if (/H1/i.test(key)) return 'H1'
  return 'FY'
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const user_id = searchParams.get('user_id')
  const company_name = searchParams.get('company_name')
  const unitDivisor = Number(searchParams.get('unit_divisor') ?? '1')

  if (!user_id || !company_name) {
    return NextResponse.json(
      { error: 'user_id and company_name are required' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient() as any

  const [{ data: stmts, error: sErr }, { data: fxRows, error: fErr }] =
    await Promise.all([
      supabase
        .from('financial_statements')
        .select('statement_type, type_institution, periods, line_items')
        .eq('user_id', user_id)
        .eq('company_name', company_name),
      supabase
        .from('period_fx_rates')
        .select('period, fx_eop, fx_avg, source, notes')
        .eq('user_id', user_id)
        .eq('company_name', company_name),
    ])

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })
  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 })

  if (!stmts || stmts.length === 0) {
    return NextResponse.json(
      { error: 'No statements found for this company' },
      { status: 404 }
    )
  }

  // Group by statement type
  const byType: Record<string, { periods: string[]; line_items: LineItem[] }> =
    {}
  for (const row of stmts) {
    byType[row.statement_type] = {
      periods: row.periods ?? [],
      line_items: row.line_items ?? [],
    }
  }

  // Intersect periods across the three statements we care about, preserving order
  // from actifs (or the first available statement).
  const primary =
    byType.actifs ?? byType.passifs ?? byType.compte_resultats ?? null
  if (!primary) {
    return NextResponse.json(
      { error: 'Company has no actifs/passifs/compte_resultats statements' },
      { status: 404 }
    )
  }
  const commonPeriods: string[] = primary.periods.filter((p: string) =>
    ['actifs', 'passifs', 'compte_resultats'].every(
      (t) => !byType[t] || byType[t].periods.includes(p)
    )
  )

  const periods: IrmPeriod[] = commonPeriods.map((key: string) => ({
    key,
    label: key,
    type: inferPeriodType(key),
  }))

  // Remap each statement's line_items to the common period order
  function remap(
    items: LineItem[],
    sourcePeriods: string[]
  ): LineItem[] {
    if (sourcePeriods.length === commonPeriods.length &&
        sourcePeriods.every((p, i) => p === commonPeriods[i])) {
      return items
    }
    const indexMap = commonPeriods.map((p) => sourcePeriods.indexOf(p))
    return items.map((it) => ({
      ...it,
      amounts: indexMap.map((idx) => (idx >= 0 ? it.amounts?.[idx] ?? 0 : 0)),
    }))
  }

  const actifs = byType.actifs
    ? remap(byType.actifs.line_items, byType.actifs.periods)
    : []
  const passifs = byType.passifs
    ? remap(byType.passifs.line_items, byType.passifs.periods)
    : []
  const compte_resultats = byType.compte_resultats
    ? remap(byType.compte_resultats.line_items, byType.compte_resultats.periods)
    : []

  const fxRates: PeriodFxRate[] = (fxRows ?? []) as PeriodFxRate[]
  const completeness = checkFxCompleteness(commonPeriods, fxRates)

  const aggregate = aggregateIrm({
    actifs,
    passifs,
    compte_resultats,
    periods,
    fxRates,
    unitDivisor: Number.isFinite(unitDivisor) && unitDivisor > 0 ? unitDivisor : 1,
  })

  const ratios = computeRatios(aggregate)

  return NextResponse.json({
    company_name,
    periods: aggregate.periods,
    rows: aggregate.rows,
    ratios: ratios.rows,
    fxCompleteness: completeness,
  })
}
