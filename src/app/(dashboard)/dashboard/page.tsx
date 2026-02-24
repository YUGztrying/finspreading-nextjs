// src/app/(dashboard)/dashboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Upload,
  ArrowRight,
  FileSpreadsheet,
  BarChart3,
  ClipboardList,
  Building2,
  Loader2,
  Plus,
} from 'lucide-react'

type StatementType = 'actifs' | 'passifs' | 'compte_resultats' | 'hors_bilan'

type GroupedAnalysis = {
  company_name: string
  type_institution: 'banque' | 'microfinance'
  statements: StatementType[]
  periods: string[]
  updated_at: string
}

const STATEMENT_LABELS: Record<StatementType, { label: string; color: string }> = {
  actifs: { label: 'Assets', color: 'bg-emerald-100 text-emerald-700' },
  passifs: { label: 'Liabilities', color: 'bg-blue-100 text-blue-700' },
  compte_resultats: { label: 'P&L', color: 'bg-purple-100 text-purple-700' },
  hors_bilan: { label: 'Off-B/S', color: 'bg-orange-100 text-orange-700' },
}

const ONBOARDING_STEPS = [
  {
    icon: Upload,
    title: 'Upload financial statements',
    description: 'Import PDF or Excel files from the institution.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Review & validate spreads',
    description: 'Inspect the normalized balance sheet and income statement.',
  },
  {
    icon: BarChart3,
    title: 'Generate IRP report & CAMELS',
    description: 'Run standardized reporting and financial health scoring.',
  },
]

function groupStatements(statements: any[]): GroupedAnalysis[] {
  const map = new Map<string, GroupedAnalysis>()

  for (const s of statements) {
    const key = s.company_name
    if (!map.has(key)) {
      map.set(key, {
        company_name: s.company_name,
        type_institution: s.type_institution,
        statements: [],
        periods: s.periods ?? [],
        updated_at: s.updated_at,
      })
    }
    const entry = map.get(key)!
    if (!entry.statements.includes(s.statement_type)) {
      entry.statements.push(s.statement_type)
    }
    if (s.updated_at > entry.updated_at) {
      entry.updated_at = s.updated_at
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-6">
        <ClipboardList className="w-8 h-8 text-amber-600" />
      </div>

      <h2 className="text-2xl font-light text-stone-900 mb-2">
        Start your first analysis
      </h2>
      <p className="text-stone-500 text-sm max-w-sm mb-10">
        Upload a bank or microfinance institution's financial statements to
        generate spreads, an IRP report, and a CAMELS assessment.
      </p>

      {/* Steps */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-10 w-full max-w-2xl">
        {ONBOARDING_STEPS.map((step, i) => (
          <div key={i} className="flex sm:flex-col items-start sm:items-center gap-3 sm:gap-2 flex-1 text-left sm:text-center">
            <div className="shrink-0 w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center">
              <step.icon className="w-4 h-4 text-stone-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-800">{step.title}</p>
              <p className="text-xs text-stone-400 mt-0.5">{step.description}</p>
            </div>
            {i < ONBOARDING_STEPS.length - 1 && (
              <ArrowRight className="hidden sm:block w-4 h-4 text-stone-300 shrink-0 self-center -mr-2 -ml-2 mt-[-28px]" />
            )}
          </div>
        ))}
      </div>

      <Button
        onClick={onStart}
        className="bg-amber-600 hover:bg-amber-700 text-white px-6 h-10 text-sm"
      >
        <Upload className="w-4 h-4 mr-2" />
        Upload Documents
      </Button>
    </div>
  )
}

// ─── Workbench ───────────────────────────────────────────────────────────────

function Workbench({
  analyses,
  onNew,
}: {
  analyses: GroupedAnalysis[]
  onNew: () => void
}) {
  const router = useRouter()

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-light text-stone-900">Analyses</h2>
          <p className="text-sm text-stone-400 mt-0.5">
            {analyses.length} institution{analyses.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          onClick={onNew}
          className="bg-amber-600 hover:bg-amber-700 text-white h-9 px-4 text-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Analysis
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50">
              <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                Institution
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                Type
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                Statements
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">
                Last updated
              </th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {analyses.map((a) => (
              <tr
                key={a.company_name}
                className="hover:bg-stone-50 transition-colors"
              >
                {/* Institution */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                      <Building2 className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <span className="font-medium text-stone-900 leading-none">
                      {a.company_name}
                    </span>
                  </div>
                </td>

                {/* Type */}
                <td className="px-5 py-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-stone-100 text-stone-600 capitalize">
                    {a.type_institution === 'banque' ? 'Bank' : 'Microfinance'}
                  </span>
                </td>

                {/* Statement badges */}
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      ['actifs', 'passifs', 'compte_resultats', 'hors_bilan'] as StatementType[]
                    ).map((type) => {
                      const present = a.statements.includes(type)
                      const meta = STATEMENT_LABELS[type]
                      return (
                        <span
                          key={type}
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium transition-opacity ${
                            present ? meta.color : 'bg-stone-100 text-stone-300'
                          }`}
                        >
                          {meta.label}
                        </span>
                      )
                    })}
                  </div>
                </td>

                {/* Date */}
                <td className="px-5 py-4 text-stone-400 tabular-nums">
                  {formatDate(a.updated_at)}
                </td>

                {/* Actions */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/rapport-irp')}
                      className="h-7 px-3 text-xs border-stone-200 text-stone-600 hover:text-stone-900"
                    >
                      IRP
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/camels')}
                      className="h-7 px-3 text-xs border-stone-200 text-stone-600 hover:text-stone-900"
                    >
                      CAMELS
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [analyses, setAnalyses] = useState<GroupedAnalysis[]>([])

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('financial_statements')
        .select('company_name, type_institution, statement_type, periods, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      setAnalyses(groupStatements(data ?? []))
      setLoading(false)
    }

    load()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
      </div>
    )
  }

  const goToUpload = () => router.push('/upload')

  return (
    <div className="min-h-screen bg-stone-50">
      <main className="max-w-5xl mx-auto px-6 py-10">
        {analyses.length === 0 ? (
          <EmptyState onStart={goToUpload} />
        ) : (
          <Workbench analyses={analyses} onNew={goToUpload} />
        )}
      </main>
    </div>
  )
}
