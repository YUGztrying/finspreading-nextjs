// src/app/(dashboard)/analyse-irm/page.tsx
// IRM (Investment Risk Memo) view — USD-normalized balance sheet, income
// statement, and DuPont-decomposed ratios, built from the analyst-entered
// FX rates. Read-only.
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, AlertTriangle, ExternalLink } from 'lucide-react'

interface IrmRow {
  id: string
  label: string
  label_fr: string
  section: 'balance_sheet' | 'income_statement'
  mode: 'stock' | 'flow'
  isSubtotal: boolean
  usd: Array<number | null>
  lcy: Array<number | null>
}

interface RatioRow {
  id: string
  label: string
  label_fr: string
  group: string
  format: 'percent' | 'ratio' | 'multiple'
  values: Array<number | null>
  flags: Array<string[] | null>
}

interface IrmPayload {
  company_name: string
  periods: { key: string; label?: string; type?: string }[]
  rows: IrmRow[]
  ratios: RatioRow[]
  fxCompleteness: {
    complete: boolean
    missingEop: string[]
    missingAvg: string[]
    missingPeriods: string[]
  }
}

function formatUsd(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  const abs = Math.abs(v)
  if (abs >= 1000) return v.toFixed(0)
  if (abs >= 10) return v.toFixed(1)
  return v.toFixed(2)
}

function formatRatio(v: number | null | undefined, format: string): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  if (format === 'percent') return (v * 100).toFixed(2) + '%'
  if (format === 'multiple') return v.toFixed(2) + 'x'
  return v.toFixed(3)
}

export default function AnalyseIrmPage() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [companies, setCompanies] = useState<string[]>([])
  const [selectedCompany, setSelectedCompany] = useState('')
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState<IrmPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient() as any
      const { data, error } = await supabase.auth.getUser()
      if (error || !data?.user) {
        router.push('/login')
        return
      }
      setUserId(data.user.id)

      const { data: rows } = await supabase
        .from('financial_statements')
        .select('company_name, type_institution')
        .eq('user_id', data.user.id)
        .eq('type_institution', 'banque')

      const unique = [
        ...new Set((rows ?? []).map((r: any) => r.company_name)),
      ] as string[]
      setCompanies(unique)
      if (unique.length > 0) setSelectedCompany(unique[0])
      else setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    if (!selectedCompany || !userId) return
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/irm?user_id=${encodeURIComponent(
            userId
          )}&company_name=${encodeURIComponent(selectedCompany)}`
        )
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'Failed to load IRM data')
        setPayload(body)
      } catch (err: any) {
        setError(err.message ?? 'Failed to load IRM data')
        setPayload(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [selectedCompany, userId])

  const bsRows = useMemo(
    () => payload?.rows.filter((r) => r.section === 'balance_sheet') ?? [],
    [payload]
  )
  const isRows = useMemo(
    () => payload?.rows.filter((r) => r.section === 'income_statement') ?? [],
    [payload]
  )

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">IRM Analysis (USD mn)</h1>
        <p className="text-sm text-muted-foreground">
          USD-normalized balance sheet, income statement, and DuPont ratios.
          Uses analyst-entered FX rates from the IFC FX library.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Company</label>
        <Select value={selectedCompany} onValueChange={setSelectedCompany}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Select a bank" />
          </SelectTrigger>
          <SelectContent>
            {companies.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Link
          href={`/fx-rates`}
          className="ml-auto inline-flex items-center gap-1 text-sm text-amber-700 hover:underline"
        >
          Edit FX rates <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      )}

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {payload && !loading && (
        <>
          {!payload.fxCompleteness.complete && (
            <div className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              <div>
                <strong>FX rates incomplete.</strong> USD values will show "—"
                for periods missing rates.
                {payload.fxCompleteness.missingEop.length > 0 && (
                  <div>
                    Missing EOP:{' '}
                    {payload.fxCompleteness.missingEop.join(', ')}
                  </div>
                )}
                {payload.fxCompleteness.missingAvg.length > 0 && (
                  <div>
                    Missing Avg:{' '}
                    {payload.fxCompleteness.missingAvg.join(', ')}
                  </div>
                )}
                <Link
                  href="/fx-rates"
                  className="text-amber-700 underline"
                >
                  Enter rates →
                </Link>
              </div>
            </div>
          )}

          {/* Balance sheet */}
          <Section title="Balance Sheet (USD mn)">
            <IrmTable periods={payload.periods} rows={bsRows} />
          </Section>

          {/* Income statement */}
          <Section title="Income Statement (USD mn)">
            <IrmTable periods={payload.periods} rows={isRows} />
          </Section>

          {/* Ratios */}
          <Section title="Ratios">
            <RatioTable periods={payload.periods} rows={payload.ratios} />
          </Section>
        </>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="overflow-x-auto rounded border">{children}</div>
    </section>
  )
}

function IrmTable({
  periods,
  rows,
}: {
  periods: { key: string; label?: string }[]
  rows: IrmRow[]
}) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-muted">
        <tr>
          <th className="px-3 py-2 text-left">Line</th>
          {periods.map((p) => (
            <th key={p.key} className="px-3 py-2 text-right">
              {p.label || p.key}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            className={`border-t ${
              row.isSubtotal ? 'bg-stone-50 font-semibold' : ''
            }`}
          >
            <td className="px-3 py-1.5">{row.label}</td>
            {row.usd.map((v, i) => (
              <td key={i} className="px-3 py-1.5 text-right font-mono">
                {formatUsd(v)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RatioTable({
  periods,
  rows,
}: {
  periods: { key: string; label?: string }[]
  rows: RatioRow[]
}) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-muted">
        <tr>
          <th className="px-3 py-2 text-left">Ratio</th>
          {periods.map((p) => (
            <th key={p.key} className="px-3 py-2 text-right">
              {p.label || p.key}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const isDerived = ['roaa', 'roae', 'leverage'].includes(row.id)
          return (
            <tr
              key={row.id}
              className={`border-t ${isDerived ? 'bg-amber-50 font-semibold' : ''}`}
            >
              <td className="px-3 py-1.5">{row.label}</td>
              {row.values.map((v, i) => (
                <td
                  key={i}
                  className="px-3 py-1.5 text-right font-mono"
                  title={row.flags[i]?.join(', ') || ''}
                >
                  {formatRatio(v, row.format)}
                  {row.flags[i] && row.flags[i]!.length > 0 && (
                    <span className="ml-1 text-amber-600" title="incomplete opening balance">
                      *
                    </span>
                  )}
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
