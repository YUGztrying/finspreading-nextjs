// src/app/(dashboard)/export/page.tsx
'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2, Download, CheckCircle2, Circle } from 'lucide-react'
import ExportButton from '@/components/ExportButton'

type StatementType = 'actifs' | 'passifs' | 'compte_resultats' | 'hors_bilan'

const STATEMENT_META: Record<StatementType, { label: string; description: string; color: string }> = {
  actifs:            { label: 'Assets',          description: 'Balance sheet – assets side',      color: 'text-emerald-600' },
  passifs:           { label: 'Liabilities',      description: 'Balance sheet – liabilities side', color: 'text-blue-600'    },
  compte_resultats:  { label: 'P&L',              description: 'Income statement',                 color: 'text-purple-600'  },
  hors_bilan:        { label: 'Off-Balance Sheet', description: 'Off-balance sheet items',          color: 'text-orange-600'  },
}

interface CompanyMeta {
  type_institution: string
  statements: StatementType[]
  periods: string[]
  updated_at: string
}

function ExportPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState<string[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [meta, setMeta] = useState<CompanyMeta | null>(null)
  const [userId, setUserId] = useState<string>('')

  // Load user + company list
  useEffect(() => {
    const load = async () => {
      const supabase = createClient() as any
      const { data, error } = await supabase.auth.getUser()
      if (error || !data?.user) { router.push('/login'); return }

      setUserId(data.user.id)

      const { data: rows } = await supabase
        .from('financial_statements')
        .select('company_name')
        .eq('user_id', data.user.id)

      const unique = [...new Set((rows ?? []).map((r: any) => r.company_name))] as string[]
      setCompanies(unique)

      if (unique.length > 0) {
        const param = searchParams.get('company')
        setSelectedCompany((param && unique.includes(param)) ? param : unique[0])
      } else {
        setLoading(false)
      }
    }
    load()
  }, [router, searchParams])

  // Load metadata when company changes
  useEffect(() => {
    if (!selectedCompany || !userId) return

    const load = async () => {
      setLoading(true)
      const supabase = createClient() as any
      const { data: rows } = await supabase
        .from('financial_statements')
        .select('statement_type, type_institution, periods, updated_at')
        .eq('user_id', userId)
        .eq('company_name', selectedCompany)

      if (!rows || rows.length === 0) { setMeta(null); setLoading(false); return }

      const allPeriods = new Set<string>()
      rows.forEach((r: any) => r.periods?.forEach((p: string) => allPeriods.add(p)))

      setMeta({
        type_institution: rows[0].type_institution,
        statements: rows.map((r: any) => r.statement_type as StatementType),
        periods: [...allPeriods].sort(),
        updated_at: rows.reduce((latest: string, r: any) =>
          r.updated_at > latest ? r.updated_at : latest, rows[0].updated_at),
      })
      setLoading(false)
    }
    load()
  }, [selectedCompany, userId])

  const handleCompanyChange = (value: string) => {
    setSelectedCompany(value)
    router.replace(`/export?company=${encodeURIComponent(value)}`)
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Back + header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </button>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
            <Download className="w-4.5 h-4.5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-light text-stone-900">Export Complet</h1>
            <p className="text-sm text-stone-400">Download all spreads as an Excel workbook</p>
          </div>
        </div>
      </div>

      {/* Company selector */}
      {companies.length > 1 && (
        <div className="mb-6">
          <Select value={selectedCompany} onValueChange={handleCompanyChange}>
            <SelectTrigger className="w-full bg-white border-stone-200 text-stone-800">
              <SelectValue placeholder="Select institution" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
        </div>
      ) : !meta ? (
        <div className="text-center py-20 text-stone-400 text-sm">
          No statements found for this institution.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          {/* Company summary header */}
          <div className="px-6 py-5 border-b border-stone-100">
            <p className="text-base font-medium text-stone-900">{selectedCompany}</p>
            <p className="text-sm text-stone-400 mt-0.5 capitalize">
              {meta.type_institution === 'banque' ? 'Bank' : 'Microfinance'} ·{' '}
              {meta.periods.length} period{meta.periods.length !== 1 ? 's' : ''} ·{' '}
              Last updated {new Date(meta.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>

          {/* Periods */}
          <div className="px-6 py-4 border-b border-stone-100">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Periods covered</p>
            <div className="flex flex-wrap gap-2">
              {meta.periods.map((p) => (
                <span key={p} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-stone-100 text-stone-600 tabular-nums">
                  {p}
                </span>
              ))}
            </div>
          </div>

          {/* Statement checklist */}
          <div className="px-6 py-4 border-b border-stone-100">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-3">Sheets included</p>
            <ul className="space-y-2.5">
              {(Object.keys(STATEMENT_META) as StatementType[]).map((type) => {
                const present = meta.statements.includes(type)
                const info = STATEMENT_META[type]
                return (
                  <li key={type} className="flex items-center gap-3">
                    {present
                      ? <CheckCircle2 className={`w-4 h-4 shrink-0 ${info.color}`} />
                      : <Circle className="w-4 h-4 shrink-0 text-stone-200" />
                    }
                    <span className={`text-sm ${present ? 'text-stone-800' : 'text-stone-300'}`}>
                      {info.label}
                      <span className={`ml-1.5 text-xs ${present ? 'text-stone-400' : 'text-stone-200'}`}>
                        — {info.description}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Export action */}
          <div className="px-6 py-5">
            <ExportButton companyName={selectedCompany} userId={userId} />
            <p className="text-xs text-stone-400 mt-2">
              Exports as <span className="font-medium">.xlsx</span> with one sheet per statement type plus a metadata sheet.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ExportPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
      </div>
    }>
      <ExportPageContent />
    </Suspense>
  )
}
