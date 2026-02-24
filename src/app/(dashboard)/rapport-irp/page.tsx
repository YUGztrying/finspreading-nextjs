// src/app/(dashboard)/rapport-irp/page.tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { ArrowLeft, Loader2, FileText, RefreshCw } from 'lucide-react'
import IRPBalanceSheet from '@/components/irp/IRPBalanceSheet'
import IRPIncomeStatement from '@/components/irp/IRPIncomeStatement'
import IRPSummary from '@/components/irp/IRPSummary'

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
  actifs: FinancialStatement | null
  passifs: FinancialStatement | null
  compte_resultats: FinancialStatement | null
  last_modified: string
}

export default function IRPReportPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [companies, setCompanies] = useState<string[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [irpData, setIrpData] = useState<IRPData | null>(null)
  const [userId, setUserId] = useState<string>('')

  const balanceSheetRef = useRef<any>(null)
  const incomeStatementRef = useRef<any>(null)

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

        const user = data.user
        setUserId(user.id)

        // Get all companies
        const { data: statements, error } = await supabase
          .from('financial_statements')
          .select('company_name')
          .eq('user_id', user.id)

        if (error) throw error

        const uniqueCompanies = [...new Set(statements?.map((s: any) => s.company_name) || [])] as string[]

        setCompanies(uniqueCompanies)
        if (uniqueCompanies.length > 0) {
          const paramCompany = searchParams.get('company')
          const initial = (paramCompany && uniqueCompanies.includes(paramCompany)) ? paramCompany : uniqueCompanies[0]
          setSelectedCompany(initial)
        }
      } catch (error: any) {
        console.error('Error fetching companies:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  // Fetch IRP data when company changes
  useEffect(() => {
    if (!selectedCompany || !userId) return

    const fetchIRPData = async () => {
      try {
        setLoading(true)
        const supabase = createClient() as any
        const { data: statements, error } = await supabase
          .from('financial_statements')
          .select('*')
          .eq('user_id', userId)
          .eq('company_name', selectedCompany)

        if (error) throw error

        const actifs = statements?.find((s: any) => s.statement_type === 'actifs')
        const passifs = statements?.find((s: any) => s.statement_type === 'passifs')
        const cr = statements?.find((s: any) => s.statement_type === 'compte_resultats')

        // Get all unique periods
        const allPeriods = new Set<string>()
        actifs?.periods?.forEach((p: string) => allPeriods.add(p))
        passifs?.periods?.forEach((p: string) => allPeriods.add(p))
        cr?.periods?.forEach((p: string) => allPeriods.add(p))

        // Sort periods by date
        const periods = Array.from(allPeriods).sort((a, b) => 
          new Date(a).getTime() - new Date(b).getTime()
        )

        setIrpData({
          company_name: selectedCompany,
          type_institution: actifs?.type_institution || passifs?.type_institution || 'microfinance',
          periods,
          actifs: actifs || null,
          passifs: passifs || null,
          compte_resultats: cr || null,
          last_modified: new Date().toISOString()
        })
      } catch (error: any) {
        console.error('Error fetching IRP data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchIRPData()
  }, [selectedCompany, userId])

  // Export to Excel
  const handleExport = async () => {
    if (!irpData) return

    setExporting(true)

    try {
      // Get calculated data from components (safe calls)
      const balanceSheetData = balanceSheetRef.current?.getCalculatedData?.() || null
      const incomeStatementData = incomeStatementRef.current?.getCalculatedData?.() || null

      const response = await fetch('/api/statements/irp-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: irpData.company_name,
          institution_type: irpData.type_institution,
          periods: irpData.periods,
          balance_sheet: balanceSheetData,
          income_statement: incomeStatementData
        })
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

      console.log('✅ Export successful')
    } catch (error) {
      console.error('❌ Export error:', error)
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
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                size="sm"
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
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {irpData ? (
          <>
            {/* Summary Section */}
            <IRPSummary data={irpData} />

            {/* Balance Sheet Section */}
            <IRPBalanceSheet
              ref={balanceSheetRef}
              data={irpData}
            />

            {/* Income Statement Section */}
            {irpData.compte_resultats && (
              <IRPIncomeStatement
                ref={incomeStatementRef}
                data={irpData}
              />
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