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

export default function CAMELSPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [companies, setCompanies] = useState<string[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [result, setResult] = useState<AnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch user and companies
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

        // Get companies that have financial statements
        const { data: statements } = await supabase
          .from('financial_statements')
          .select('company_name')
          .eq('user_id', data.user.id)

        const uniqueCompanies = [...new Set(statements?.map((s: any) => s.company_name) || [])] as string[]
        setCompanies(uniqueCompanies)

        if (uniqueCompanies.length > 0) {
          setSelectedCompany(uniqueCompanies[0])
        }
      } catch (err: any) {
        console.error('Error fetching companies:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  // Run CAMELS analysis
  const runAnalysis = async () => {
    if (!selectedCompany || !userId) return

    setAnalyzing(true)
    setError(null)
    setResult(null)

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

      const data = await response.json()
      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
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
                <h1 className="text-2xl font-light text-stone-900">
                  Analyse CAMELS
                </h1>
                <p className="text-sm text-stone-600 mt-1">
                  Capital, Asset Quality, Management, Earnings, Liquidity
                </p>
              </div>
            </div>
          </div>

          {/* Company selector + run button */}
          <div className="flex items-center gap-3 mt-4">
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger className="w-[400px] border-stone-200">
                <SelectValue placeholder="Sélectionner une société" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company} value={company}>
                    {company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={runAnalysis}
              disabled={analyzing || !selectedCompany}
              className="bg-red-600 hover:bg-red-700"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Lancer l'analyse
                </>
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
            <CardContent className="p-12 text-center">
              <BarChart3 className="w-16 h-16 text-stone-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-stone-900 mb-3">
                Prêt pour l'analyse
              </h3>
              <p className="text-stone-600">
                Sélectionnez une société et cliquez sur "Lancer l'analyse" pour générer
                le rapport CAMELS complet.
              </p>
            </CardContent>
          </Card>
        )}

        {result && (
          <>
            {/* Composite Rating */}
            <CompositeGauge
              rating={result.ratings.composite.composite_rating}
              average={result.ratings.composite.average}
              status={result.ratings.composite.status}
            />

            {/* Component Score Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <ScoreCard
                label="Capital"
                letter="C"
                rating={result.ratings.capital.rating}
                status={result.ratings.capital.status}
                primaryRatio={{ label: 'Equity / Assets', value: result.ratings.capital.ratios.equity_assets ?? null, format: 'percent' }}
                color="red"
              />
              <ScoreCard
                label="Asset Quality"
                letter="A"
                rating={result.ratings.asset_quality.rating}
                status={result.ratings.asset_quality.status}
                primaryRatio={{ label: 'NPL Ratio', value: result.ratings.asset_quality.ratios.npl_ratio ?? null, format: 'percent' }}
                color="amber"
              />
              <ScoreCard
                label="Management"
                letter="M"
                rating={result.ratings.management.rating}
                status={result.ratings.management.status}
                primaryRatio={{ label: 'Cost-to-Income', value: result.ratings.management.ratios.cost_to_income ?? null, format: 'percent' }}
                color="blue"
              />
              <ScoreCard
                label="Earnings"
                letter="E"
                rating={result.ratings.earnings.rating}
                status={result.ratings.earnings.status}
                primaryRatio={{ label: 'ROAE', value: result.ratings.earnings.ratios.roae ?? null, format: 'percent' }}
                color="emerald"
              />
              <ScoreCard
                label="Liquidity"
                letter="L"
                rating={result.ratings.liquidity.rating}
                status={result.ratings.liquidity.status}
                primaryRatio={{ label: 'Liquid Assets / TA', value: result.ratings.liquidity.ratios.liquid_assets_total_assets ?? null, format: 'percent' }}
                color="purple"
              />
            </div>

            {/* Balance Sheet */}
            <RatioTable
              title="Balance Sheet"
              periodLabels={result.period_labels}
              showCagr
              rows={result.financial_summary.balance_sheet.map(r => ({
                label: r.label,
                values: r.values,
                format: 'number' as const,
                bold: r.bold,
                cagr: r.cagr,
              }))}
            />

            {/* Income Statement */}
            <RatioTable
              title="Income Statement"
              periodLabels={result.period_labels}
              showCagr
              rows={result.financial_summary.income_statement.map(r => ({
                label: r.label,
                values: r.values,
                format: 'number' as const,
                bold: r.bold,
                cagr: r.cagr,
              }))}
            />

            {/* Growth Evolution */}
            <RatioTable
              title="Growth Evolution"
              periodLabels={result.period_labels}
              rows={result.growth_evolution.map(r => ({
                label: r.label,
                values: r.values,
                format: r.format,
              }))}
            />

            {/* Ratio Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RatioTable
                title="Solvency"
                periodLabels={result.period_labels}
                rows={result.ratio_tables.solvency}
              />
              <RatioTable
                title="Asset Quality"
                periodLabels={result.period_labels}
                rows={result.ratio_tables.asset_quality}
              />
              <RatioTable
                title="Profitability"
                periodLabels={result.period_labels}
                rows={result.ratio_tables.profitability}
              />
              <RatioTable
                title="Liquidity"
                periodLabels={result.period_labels}
                rows={result.ratio_tables.liquidity}
              />
            </div>

            {/* Analysis Text */}
            <Card className="border-stone-200 bg-white">
              <CardHeader>
                <CardTitle className="text-lg font-medium text-stone-900">
                  Detailed Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.entries(result.analysis).map(([key, text]) => {
                  const colorMap: Record<string, string> = {
                    capital: 'border-red-300',
                    asset_quality: 'border-amber-300',
                    management: 'border-blue-300',
                    earnings: 'border-emerald-300',
                    liquidity: 'border-purple-300',
                    composite: 'border-stone-400',
                  }
                  return (
                    <div key={key} className={`border-l-3 ${colorMap[key] || 'border-stone-200'} pl-4`}>
                      <div
                        className="text-sm text-stone-700 leading-relaxed prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: text
                            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-stone-900 text-base block mb-2">$1</strong>')
                            .replace(/\n- /g, '<br/>• ')
                            .replace(/\n/g, '<br/>')
                        }}
                      />
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
