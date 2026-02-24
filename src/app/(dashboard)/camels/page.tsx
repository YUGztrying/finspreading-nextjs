// src/app/(dashboard)/camels/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2, BarChart3, Play } from 'lucide-react'
import ScoreCard from '@/components/camels/ScoreCard'
import RatioTable from '@/components/camels/RatioTable'
import CompositeGauge from '@/components/camels/CompositeGauge'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SummaryRow {
  label: string
  key: string
  values: number[]
  cagr: number | null
  bold: boolean
}

interface RatioRow {
  label: string
  values: (number | null)[]
  format: 'percent' | 'number' | 'multiple'
}

interface GrowthRow {
  label: string
  values: (number | null)[]
  format: 'percent'
}

interface AnalysisResponse {
  success: boolean
  last_run: string
  company_name: string
  type_institution: string
  periods: string[]
  period_labels: string[]
  financial_summary: {
    balance_sheet: SummaryRow[]
    income_statement: SummaryRow[]
  }
  growth_evolution: GrowthRow[]
  ratio_tables: {
    solvency: RatioRow[]
    asset_quality: RatioRow[]
    profitability: RatioRow[]
    liquidity: RatioRow[]
  }
  ratings: {
    capital: { rating: number | null; status: string; ratios: Record<string, number | null> }
    asset_quality: { rating: number | null; status: string; ratios: Record<string, number | null> }
    management: { rating: number | null; status: string; ratios: Record<string, number | null> }
    earnings: { rating: number | null; status: string; ratios: Record<string, number | null> }
    liquidity: { rating: number | null; status: string; ratios: Record<string, number | null> }
    composite: { composite_rating: number | null; average: number | null; status: string }
  }
  analysis: Record<string, string>
  key_metrics: Record<string, number | null>
}

// Map of period → { car_override, npl_amount_override }
type Overrides = Record<string, { car_override: number | null; npl_amount_override: number | null }>

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CAMELSPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [companies, setCompanies] = useState<string[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [result, setResult] = useState<AnalysisResponse | null>(null)
  const [overrides, setOverrides] = useState<Overrides>({})
  const [error, setError] = useState<string | null>(null)

  // Fetch user and companies on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const supabase = createClient() as any
        const { data, error: authError } = await supabase.auth.getUser()

        if (authError || !data?.user) {
          router.push('/login')
          return
        }

        setUserId(data.user.id)

        const { data: statements } = await supabase
          .from('financial_statements')
          .select('company_name')
          .eq('user_id', data.user.id)

        const uniqueCompanies = [...new Set(statements?.map((s: any) => s.company_name) || [])] as string[]
        setCompanies(uniqueCompanies)
        if (uniqueCompanies.length > 0) setSelectedCompany(uniqueCompanies[0])
      } catch (err: any) {
        console.error('Error fetching companies:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [router])

  // Run CAMELS analysis — then immediately load any saved overrides (all periods)
  const runAnalysis = async (forceRefresh = false) => {
    if (!selectedCompany || !userId) return

    setAnalyzing(true)
    setError(null)
    if (forceRefresh) {
      setResult(null)
      setOverrides({})
    }

    try {
      const response = await fetch('/api/camels/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, company_name: selectedCompany, force_refresh: forceRefresh }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Analysis failed' }))
        throw new Error(errData.error || 'Analysis failed')
      }

      const data: AnalysisResponse = await response.json()
      setResult(data)

      // Load analyst overrides for all periods at once
      const ovResp = await fetch(
        `/api/camels/overrides?user_id=${encodeURIComponent(userId)}&company_name=${encodeURIComponent(selectedCompany)}`
      )
      if (ovResp.ok) {
        const ovData = await ovResp.json()
        setOverrides(ovData.overrides ?? {})
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  // Auto-load when company + user are ready
  useEffect(() => {
    if (selectedCompany && userId) {
      runAnalysis(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany, userId])

  // Save one override field for a specific period and update local state immediately
  const saveOverride = async (
    period: string,
    field: 'car_override' | 'npl_amount_override',
    value: number | null
  ) => {
    if (!result || !userId) return

    // Optimistic update
    setOverrides(prev => ({
      ...prev,
      [period]: { ...(prev[period] ?? { car_override: null, npl_amount_override: null }), [field]: value },
    }))

    await fetch('/api/camels/overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        company_name: result.company_name,
        period,
        field,
        value,
      }),
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    )
  }

  // ─── Build solvency rows — CAR editable for every period ────────────────────
  const solvencyRows = result
    ? result.ratio_tables.solvency.map((row, i) => {
        if (i === 0) {
          return {
            ...row,
            editable: true,
            overrideValues: result.periods.map(p => overrides[p]?.car_override ?? null),
            onSave: async (j: number, v: number | null) =>
              saveOverride(result.periods[j], 'car_override', v),
          }
        }
        return row
      })
    : []

  // ─── Derive NPL Ratio and Coverage Ratio per period from analyst NPL Amount ─
  // Use the balance sheet rows (which cover every period) for gross loans and LLP.
  const grossLoansRow = result?.financial_summary.balance_sheet.find(r => r.key === 'gross_loans')
  const llpRow = result?.financial_summary.balance_sheet.find(r => r.key === 'loan_loss_provisions')

  const derivedNplRatios: (number | null)[] = result
    ? result.periods.map((p, j) => {
        const nplAmt = overrides[p]?.npl_amount_override ?? null
        const gl = grossLoansRow?.values[j] ?? null
        return nplAmt != null && gl != null && gl !== 0 ? nplAmt / gl : null
      })
    : []

  const derivedCoverageRatios: (number | null)[] = result
    ? result.periods.map((p, j) => {
        const nplAmt = overrides[p]?.npl_amount_override ?? null
        const llp = llpRow?.values[j] ?? null
        return nplAmt != null && nplAmt !== 0 && llp != null ? Math.abs(llp) / nplAmt : null
      })
    : []

  // ─── Build asset quality rows ────────────────────────────────────────────────
  //   1. NPL Amount  — editable, analyst enters absolute value per period
  //   2. NPL Ratio   — derived (blue) where NPL Amount is set, computed otherwise
  //   3. Coverage    — derived (blue) where NPL Amount is set, computed otherwise
  const assetQualityRows = result
    ? [
        {
          label: 'NPL Amount',
          values: Array(result.periods.length).fill(null) as (number | null)[],
          format: 'number' as const,
          editable: true,
          overrideValues: result.periods.map(p => overrides[p]?.npl_amount_override ?? null),
          onSave: async (j: number, v: number | null) =>
            saveOverride(result.periods[j], 'npl_amount_override', v),
        },
        ...result.ratio_tables.asset_quality.map((row, i) => {
          if (i === 0) return { ...row, derivedValues: derivedNplRatios }
          if (i === 1) return { ...row, derivedValues: derivedCoverageRatios }
          return row
        }),
      ]
    : []

  const analysisColorMap: Record<string, string> = {
    capital: 'border-red-300',
    asset_quality: 'border-amber-300',
    management: 'border-blue-300',
    earnings: 'border-emerald-300',
    liquidity: 'border-purple-300',
    composite: 'border-stone-300',
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push('/dashboard')}
              className="border-stone-200"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-light text-stone-900">Analyse CAMELS</h1>
              <p className="text-sm text-stone-500 mt-0.5">
                Capital · Asset Quality · Management · Earnings · Liquidity
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <Select value={selectedCompany} onValueChange={v => { setSelectedCompany(v); setResult(null); setOverrides({}) }}>
              <SelectTrigger className="w-[340px] border-stone-200">
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {result && (
              <>
                <span className="text-xs text-stone-400">
                  Last run {new Date(result.last_run).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runAnalysis(true)}
                  disabled={analyzing}
                  className="border-stone-200 text-stone-600"
                >
                  {analyzing ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Running…</>
                  ) : (
                    <><Play className="w-3.5 h-3.5 mr-1.5" />Re-run</>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <p className="text-red-700 text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {!result && !analyzing && companies.length === 0 && (
          <Card className="border-stone-200 bg-white shadow-sm">
            <CardContent className="p-16 text-center">
              <BarChart3 className="w-12 h-12 text-stone-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-stone-900 mb-2">No financial statements yet</h3>
              <p className="text-sm text-stone-500 max-w-sm mx-auto">
                Upload an institution's financial statements first to run a CAMELS assessment.
              </p>
            </CardContent>
          </Card>
        )}

        {analyzing && !result && (
          <Card className="border-stone-200 bg-white shadow-sm">
            <CardContent className="p-16 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-amber-600 mx-auto mb-4" />
              <p className="text-sm text-stone-500">Loading analysis…</p>
            </CardContent>
          </Card>
        )}

        {result && (
          <>
            {/* Composite gauge */}
            <CompositeGauge
              rating={result.ratings.composite.composite_rating}
              average={result.ratings.composite.average}
              status={result.ratings.composite.status}
            />

            {/* Five score cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <ScoreCard label="Capital" letter="C" rating={result.ratings.capital.rating} status={result.ratings.capital.status} primaryRatio={{ label: 'Equity / Assets', value: result.ratings.capital.ratios.equity_assets ?? null, format: 'percent' }} color="red" />
              <ScoreCard label="Asset Quality" letter="A" rating={result.ratings.asset_quality.rating} status={result.ratings.asset_quality.status} primaryRatio={{ label: 'NPL Ratio', value: result.ratings.asset_quality.ratios.npl_ratio ?? null, format: 'percent' }} color="amber" />
              <ScoreCard label="Management" letter="M" rating={result.ratings.management.rating} status={result.ratings.management.status} primaryRatio={{ label: 'Cost-to-Income', value: result.ratings.management.ratios.cost_to_income ?? null, format: 'percent' }} color="blue" />
              <ScoreCard label="Earnings" letter="E" rating={result.ratings.earnings.rating} status={result.ratings.earnings.status} primaryRatio={{ label: 'ROAE', value: result.ratings.earnings.ratios.roae ?? null, format: 'percent' }} color="emerald" />
              <ScoreCard label="Liquidity" letter="L" rating={result.ratings.liquidity.rating} status={result.ratings.liquidity.status} primaryRatio={{ label: 'Liquid Assets / TA', value: result.ratings.liquidity.ratios.liquid_assets_total_assets ?? null, format: 'percent' }} color="purple" />
            </div>

            {/* Financial tables */}
            <RatioTable title="Balance Sheet" periodLabels={result.period_labels} showCagr
              rows={result.financial_summary.balance_sheet.map(r => ({ label: r.label, values: r.values, format: 'number' as const, bold: r.bold, cagr: r.cagr }))}
            />
            <RatioTable title="Income Statement" periodLabels={result.period_labels} showCagr
              rows={result.financial_summary.income_statement.map(r => ({ label: r.label, values: r.values, format: 'number' as const, bold: r.bold, cagr: r.cagr }))}
            />
            <RatioTable title="Growth Evolution" periodLabels={result.period_labels}
              rows={result.growth_evolution.map(r => ({ label: r.label, values: r.values, format: r.format }))}
            />

            {/* Ratio tables — CAR and NPL Amount editable for every period */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <RatioTable title="Solvency" periodLabels={result.period_labels} rows={solvencyRows} />
                <p className="mt-1.5 text-xs text-stone-400 px-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 mr-1 align-middle" />
                  CAR — click any value to enter the regulatory figure from the bank&apos;s disclosure.
                </p>
              </div>
              <div>
                <RatioTable title="Asset Quality" periodLabels={result.period_labels} rows={assetQualityRows} />
                <p className="mt-1.5 text-xs text-stone-400 px-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 mr-1 align-middle" />
                  Enter NPL Amount per period from the bank&apos;s footnotes — NPL Ratio and Coverage Ratio update automatically.
                </p>
              </div>
              <RatioTable title="Profitability" periodLabels={result.period_labels} rows={result.ratio_tables.profitability} />
              <RatioTable title="Liquidity" periodLabels={result.period_labels} rows={result.ratio_tables.liquidity} />
            </div>

            {/* Analysis text */}
            <Card className="border-stone-200 bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium text-stone-900">Detailed Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {Object.entries(result.analysis).map(([key, text]) => (
                  <div key={key} className={`border-l-2 ${analysisColorMap[key] ?? 'border-stone-200'} pl-4`}>
                    <div
                      className="text-sm text-stone-700 leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: text
                          .replace(/\*\*(.*?)\*\*/g, '<strong class="text-stone-900 text-[13px] block mb-1.5">$1</strong>')
                          .replace(/\n- /g, '<br/>• ')
                          .replace(/\n/g, '<br/>')
                      }}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
