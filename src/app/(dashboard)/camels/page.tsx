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
}

interface Overrides {
  car_override: number | null
  npl_ratio_override: number | null
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CAMELSPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [companies, setCompanies] = useState<string[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [result, setResult] = useState<AnalysisResponse | null>(null)
  const [overrides, setOverrides] = useState<Overrides>({ car_override: null, npl_ratio_override: null })
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

  // Run CAMELS analysis — then immediately load any saved overrides
  const runAnalysis = async () => {
    if (!selectedCompany || !userId) return

    setAnalyzing(true)
    setError(null)
    setResult(null)
    setOverrides({ car_override: null, npl_ratio_override: null })

    try {
      const response = await fetch('/api/camels/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, company_name: selectedCompany }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Analysis failed' }))
        throw new Error(errData.error || 'Analysis failed')
      }

      const data: AnalysisResponse = await response.json()
      setResult(data)

      // Load any analyst overrides saved previously for this company
      const latestPeriod = data.periods[data.periods.length - 1]
      const ovResp = await fetch(
        `/api/camels/overrides?user_id=${encodeURIComponent(userId)}&company_name=${encodeURIComponent(selectedCompany)}`
      )
      if (ovResp.ok) {
        const ovData = await ovResp.json()
        const periodOverrides = ovData.overrides?.[latestPeriod]
        if (periodOverrides) {
          setOverrides({
            car_override: periodOverrides.car_override ?? null,
            npl_ratio_override: periodOverrides.npl_ratio_override ?? null,
          })
        }
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  // Save one override field and update local state immediately
  const saveOverride = async (
    field: 'car_override' | 'npl_ratio_override',
    value: number | null
  ) => {
    if (!result || !userId) return
    const latestPeriod = result.periods[result.periods.length - 1]

    // Optimistic update
    setOverrides(prev => ({ ...prev, [field]: value }))

    await fetch('/api/camels/overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        company_name: result.company_name,
        period: latestPeriod,
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

  // Build solvency rows with CAR editable
  const solvencyRows = result
    ? result.ratio_tables.solvency.map((row, i) => {
        if (i === 0) {
          // CAR row — analyst-provided
          return {
            ...row,
            editable: true,
            overrideValue: overrides.car_override,
            onSave: (v: number | null) => saveOverride('car_override', v),
          }
        }
        return row
      })
    : []

  // Build asset quality rows with NPL Ratio editable
  const assetQualityRows = result
    ? result.ratio_tables.asset_quality.map((row, i) => {
        if (i === 0) {
          // NPL Ratio row — analyst-provided
          return {
            ...row,
            editable: true,
            overrideValue: overrides.npl_ratio_override,
            onSave: (v: number | null) => saveOverride('npl_ratio_override', v),
          }
        }
        return row
      })
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
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger className="w-[340px] border-stone-200">
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={runAnalysis}
              disabled={analyzing || !selectedCompany}
              className="bg-stone-900 hover:bg-stone-800"
            >
              {analyzing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Running…</>
              ) : (
                <><Play className="w-4 h-4 mr-2" />Run Analysis</>
              )}
            </Button>
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

        {!result && !analyzing && (
          <Card className="border-stone-200 bg-white shadow-sm">
            <CardContent className="p-16 text-center">
              <BarChart3 className="w-12 h-12 text-stone-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-stone-900 mb-2">Ready to analyse</h3>
              <p className="text-sm text-stone-500 max-w-sm mx-auto">
                Select a company above and click <strong>Run Analysis</strong> to generate the full CAMELS report.
              </p>
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

            {/* Ratio tables — CAR and NPL Ratio are editable */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <RatioTable title="Solvency" periodLabels={result.period_labels} rows={solvencyRows} />
                <p className="mt-1.5 text-xs text-stone-400 px-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 mr-1 align-middle" />
                  CAR — click the latest value to enter the regulatory figure from the bank's disclosure.
                </p>
              </div>
              <div>
                <RatioTable title="Asset Quality" periodLabels={result.period_labels} rows={assetQualityRows} />
                <p className="mt-1.5 text-xs text-stone-400 px-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 mr-1 align-middle" />
                  NPL Ratio — click the latest value to override with a figure from the bank's footnotes.
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
