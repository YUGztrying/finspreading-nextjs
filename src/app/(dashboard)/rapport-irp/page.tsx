// src/app/(dashboard)/rapport-irp/page.tsx
'use client'

import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2, FileText, RefreshCw } from 'lucide-react'
import IRPBalanceSheet from '@/components/irp/IRPBalanceSheet'
import IRPIncomeStatement from '@/components/irp/IRPIncomeStatement'
import IRPSummary from '@/components/irp/IRPSummary'
import PeriodAlignmentDialog from '@/components/camels/PeriodAlignmentDialog'
import {
  detectPeriodAlignment,
  generateAlignedMappings,
  reindexLineItems,
} from '@/lib/camels/period-alignment'
import type { PeriodMapping, PeriodAlignmentInfo } from '@/types/database.types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface FinancialStatement {
  id: string
  company_name: string
  type_institution: string
  statement_type: string
  periods: string[]
  line_items: any[]
  created_at: string
  updated_at: string
}

interface IRPData {
  company_name: string
  type_institution: string
  periods: string[]
  period_labels?: string[]
  actifs: FinancialStatement | null
  passifs: FinancialStatement | null
  compte_resultats: FinancialStatement | null
  last_modified: string
}

// ─── Helper — build IRPData from confirmed period mappings ────────────────────

function buildIrpDataFromMappings(
  actifs: FinancialStatement | null,
  passifs: FinancialStatement | null,
  cr: FinancialStatement | null,
  mappings: PeriodMapping[],
  companyName: string,
  typeInstitution: string
): IRPData {
  const bsTarget = mappings.map(m => m.bs_period)
  const isTarget = mappings.map(m => m.is_period)

  return {
    company_name: companyName,
    type_institution: typeInstitution,
    periods: mappings.map(m => m.bs_period ?? m.is_period ?? ''),
    period_labels: mappings.map(m => m.label),
    actifs: actifs
      ? { ...actifs, line_items: reindexLineItems(actifs.line_items, actifs.periods, bsTarget) }
      : null,
    passifs: passifs
      ? { ...passifs, line_items: reindexLineItems(passifs.line_items, passifs.periods, bsTarget) }
      : null,
    compte_resultats: cr
      ? { ...cr, line_items: reindexLineItems(cr.line_items, cr.periods, isTarget) }
      : null,
    last_modified: new Date().toISOString(),
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function IRPReportPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [companies, setCompanies] = useState<string[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [irpData, setIrpData] = useState<IRPData | null>(null)
  const [userId, setUserId] = useState<string>('')

  // Period alignment
  const [alignmentInfo, setAlignmentInfo] = useState<PeriodAlignmentInfo | null>(null)
  const [showAlignmentDialog, setShowAlignmentDialog] = useState(false)
  const [confirmedMappings, setConfirmedMappings] = useState<PeriodMapping[] | null>(null)

  // Raw statements kept in refs so dialog confirm can reindex without a re-fetch
  const rawActifsRef = useRef<FinancialStatement | null>(null)
  const rawPassifsRef = useRef<FinancialStatement | null>(null)
  const rawCrRef = useRef<FinancialStatement | null>(null)
  const typeInstitutionRef = useRef<string>('microfinance')

  const balanceSheetRef = useRef<any>(null)
  const incomeStatementRef = useRef<any>(null)

  // ── Fetch user and companies on mount ────────────────────────────────────
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

        const user = data.user
        setUserId(user.id)

        const { data: statements, error } = await supabase
          .from('financial_statements')
          .select('company_name')
          .eq('user_id', user.id)

        if (error) throw error

        const uniqueCompanies = [...new Set(
          statements?.map((s: any) => s.company_name) || []
        )] as string[]

        setCompanies(uniqueCompanies)
        if (uniqueCompanies.length > 0) {
          const paramCompany = searchParams.get('company')
          const initial = (paramCompany && uniqueCompanies.includes(paramCompany))
            ? paramCompany
            : uniqueCompanies[0]
          setSelectedCompany(initial)
        }
      } catch (error: any) {
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  // ── Fetch statements + detect alignment ──────────────────────────────────
  const loadIrpData = useCallback(async (company: string, uid: string) => {
    try {
      setLoading(true)
      const supabase = createClient() as any

      const { data: statements, error } = await supabase
        .from('financial_statements')
        .select('*')
        .eq('user_id', uid)
        .eq('company_name', company)

      if (error) throw error

      const actifs: FinancialStatement | null =
        statements?.find((s: any) => s.statement_type === 'actifs') ?? null
      const passifs: FinancialStatement | null =
        statements?.find((s: any) => s.statement_type === 'passifs') ?? null
      const cr: FinancialStatement | null =
        statements?.find((s: any) => s.statement_type === 'compte_resultats') ?? null
      const typeInst = actifs?.type_institution ?? passifs?.type_institution ?? 'microfinance'

      // Keep raw refs so dialog confirm can reindex without re-fetching
      rawActifsRef.current = actifs
      rawPassifsRef.current = passifs
      rawCrRef.current = cr
      typeInstitutionRef.current = typeInst

      // Build lightweight stmt map for alignment detection
      const stmtsByType: Record<string, { periods: string[] }> = {}
      if (actifs) stmtsByType.actifs = { periods: actifs.periods }
      if (passifs) stmtsByType.passifs = { periods: passifs.periods }
      if (cr) stmtsByType.compte_resultats = { periods: cr.periods }

      const info = detectPeriodAlignment(stmtsByType)
      setAlignmentInfo(info)

      if (info.aligned) {
        // Happy path — all periods match, no dialog needed
        const allPeriods = [...new Set([
          ...(actifs?.periods ?? []),
          ...(passifs?.periods ?? []),
          ...(cr?.periods ?? []),
        ])].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

        const trivialMappings = generateAlignedMappings(allPeriods)
        setConfirmedMappings(trivialMappings)
        setIrpData(buildIrpDataFromMappings(actifs, passifs, cr, trivialMappings, company, typeInst))
        setLoading(false)
        return
      }

      // Not aligned — check for previously saved mappings
      const saved = await fetch(
        `/api/period-mappings?user_id=${encodeURIComponent(uid)}&company_name=${encodeURIComponent(company)}`
      )
      if (saved.ok) {
        const { mappings } = await saved.json()
        if (mappings && mappings.length > 0) {
          setConfirmedMappings(mappings)
          setIrpData(buildIrpDataFromMappings(actifs, passifs, cr, mappings, company, typeInst))
          setLoading(false)
          return
        }
      }

      // No saved mappings — show dialog (page stays blank until confirmed)
      setLoading(false)
      setShowAlignmentDialog(true)
    } catch (error: any) {
      setLoading(false)
    }
  }, [])

  // Trigger load when company + user are ready
  useEffect(() => {
    if (selectedCompany && userId) {
      setIrpData(null)
      setConfirmedMappings(null)
      setAlignmentInfo(null)
      loadIrpData(selectedCompany, userId)
    }
  }, [selectedCompany, userId, loadIrpData])

  // ── Dialog confirmation ───────────────────────────────────────────────────
  const handleAlignmentConfirm = (mappings: PeriodMapping[]) => {
    setShowAlignmentDialog(false)
    setConfirmedMappings(mappings)

    // Persist for next time
    fetch('/api/period-mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, company_name: selectedCompany, mappings }),
    }).catch(console.error)

    setIrpData(buildIrpDataFromMappings(
      rawActifsRef.current,
      rawPassifsRef.current,
      rawCrRef.current,
      mappings,
      selectedCompany,
      typeInstitutionRef.current,
    ))
  }

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!irpData) return
    setExporting(true)

    try {
      const balanceSheetData = balanceSheetRef.current?.getCalculatedData?.() || null
      const incomeStatementData = incomeStatementRef.current?.getCalculatedData?.() || null

      const response = await fetch('/api/statements/irp-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: irpData.company_name,
          institution_type: irpData.type_institution,
          // Pass labels as period headers for the export
          periods: irpData.period_labels ?? irpData.periods,
          balance_sheet: balanceSheetData,
          income_statement: incomeStatementData,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Export failed' }))
        throw new Error(errorData.error || 'Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const sanitizedName = irpData.company_name.replace(/[^a-z0-9]/gi, '_') || 'company'
      a.download = `IRP_${sanitizedName}_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      alert('Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setExporting(false)
    }
  }

  if (loading && !irpData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Period alignment dialog — shared with CAMELS */}
      {alignmentInfo && (
        <PeriodAlignmentDialog
          open={showAlignmentDialog}
          onClose={() => setShowAlignmentDialog(false)}
          alignmentInfo={alignmentInfo}
          onConfirm={handleAlignmentConfirm}
        />
      )}

      <header className="border-b border-stone-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
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
                  IRP REPORT - {(irpData?.type_institution ?? 'microfinance').toUpperCase()}
                </h1>
                <p className="text-sm text-stone-600 mt-1">
                  Standardized Financial Statement Mapping
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Show edit alignment button when a non-trivial mapping is active */}
              {confirmedMappings && alignmentInfo && !alignmentInfo.aligned && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAlignmentDialog(true)}
                  className="text-xs text-amber-600 hover:text-amber-700"
                >
                  Edit period alignment
                </Button>
              )}
              <Button
                onClick={() => loadIrpData(selectedCompany, userId)}
                variant="outline"
                size="sm"
                disabled={loading}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button
                onClick={handleExport}
                disabled={exporting || !irpData}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Export en cours...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Export CSV
                  </>
                )}
              </Button>
            </div>
          </div>

          {companies.length > 0 && (
            <div className="flex items-center gap-3">
              <Select
                value={selectedCompany}
                onValueChange={v => {
                  setSelectedCompany(v)
                  setIrpData(null)
                  setConfirmedMappings(null)
                  setAlignmentInfo(null)
                }}
              >
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
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {irpData ? (
          <>
            <IRPSummary data={irpData} />
            <IRPBalanceSheet ref={balanceSheetRef} data={irpData} />
            {irpData.compte_resultats && (
              <IRPIncomeStatement ref={incomeStatementRef} data={irpData} />
            )}
          </>
        ) : (
          <Card className="border-stone-200 bg-white shadow-sm">
            <CardContent className="p-12 text-center">
              <FileText className="w-16 h-16 text-stone-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-stone-900 mb-3">
                Aucun rapport IRP disponible
              </h3>
              <p className="text-stone-600">
                Sélectionnez une société pour voir son rapport IRP
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}

export default function IRPReportPage() {
  return <Suspense fallback={null}><IRPReportPageContent /></Suspense>
}
