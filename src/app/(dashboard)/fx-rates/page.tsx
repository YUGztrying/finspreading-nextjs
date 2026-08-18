// src/app/(dashboard)/fx-rates/page.tsx
// Analyst-facing editor for per-period FX rates used by the IRM layer.
// Rates are looked up in the internal IFC FX library and entered manually.
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Loader2, Save, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import {
  checkFxCompleteness,
  validateFxRates,
  type PeriodFxRate,
} from '@/lib/irm/fx'

interface Draft {
  period: string
  fx_eop: string
  fx_avg: string
  source: string
  notes: string
}

function toDraft(r: Partial<PeriodFxRate> & { period: string }): Draft {
  return {
    period: r.period,
    fx_eop: r.fx_eop == null ? '' : String(r.fx_eop),
    fx_avg: r.fx_avg == null ? '' : String(r.fx_avg),
    source: r.source ?? '',
    notes: r.notes ?? '',
  }
}

function parseNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  // Accept comma as decimal separator, strip spaces
  const normalized = trimmed.replace(/\s/g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : NaN
}

function draftToRate(d: Draft): PeriodFxRate {
  const eop = parseNumber(d.fx_eop)
  const avg = parseNumber(d.fx_avg)
  return {
    period: d.period,
    fx_eop: eop === null ? null : eop,
    fx_avg: avg === null ? null : avg,
    source: d.source.trim() || null,
    notes: d.notes.trim() || null,
  }
}

export default function FxRatesPage() {
  const router = useRouter()

  const [userId, setUserId] = useState('')
  const [companies, setCompanies] = useState<string[]>([])
  const [selectedCompany, setSelectedCompany] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [periods, setPeriods] = useState<string[]>([])

  // Load user + companies
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
        .select('company_name')
        .eq('user_id', data.user.id)

      const unique = [
        ...new Set((rows ?? []).map((r: any) => r.company_name)),
      ] as string[]
      setCompanies(unique)
      if (unique.length > 0) setSelectedCompany(unique[0])
      else setLoading(false)
    }
    load()
  }, [router])

  // Load periods + existing FX rates when company changes
  useEffect(() => {
    if (!selectedCompany || !userId) return
    const load = async () => {
      setLoading(true)
      try {
        const supabase = createClient() as any
        const { data: rows } = await supabase
          .from('financial_statements')
          .select('periods')
          .eq('user_id', userId)
          .eq('company_name', selectedCompany)

        const periodSet = new Set<string>()
        for (const row of rows ?? []) {
          for (const p of row.periods ?? []) periodSet.add(p)
        }
        const sortedPeriods = [...periodSet].sort()
        setPeriods(sortedPeriods)

        const res = await fetch(
          `/api/fx-rates?user_id=${encodeURIComponent(
            userId
          )}&company_name=${encodeURIComponent(selectedCompany)}`
        )
        const body = await res.json()
        const existing: PeriodFxRate[] = body.rates ?? []
        const map = new Map(existing.map((r) => [r.period, r]))

        const newDrafts = sortedPeriods.map((p) =>
          toDraft(map.get(p) ?? { period: p, fx_eop: null, fx_avg: null })
        )
        // Also include any saved rates that reference periods no longer
        // present in the statements, so the analyst can still see/remove them.
        for (const r of existing) {
          if (!sortedPeriods.includes(r.period)) newDrafts.push(toDraft(r))
        }
        setDrafts(newDrafts)
      } catch (err: any) {
        toast.error(`Failed to load FX rates: ${err.message ?? err}`)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [selectedCompany, userId])

  const updateDraft = (index: number, patch: Partial<Draft>) => {
    setDrafts((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }

  const parsedRates = useMemo(() => drafts.map(draftToRate), [drafts])

  const completeness = useMemo(
    () => checkFxCompleteness(periods, parsedRates),
    [periods, parsedRates]
  )

  // Surface parse errors (e.g. typed "abc" in a rate cell)
  const parseErrors = useMemo(() => {
    const errs: string[] = []
    drafts.forEach((d) => {
      if (d.fx_eop.trim() && Number.isNaN(parseNumber(d.fx_eop) as number)) {
        errs.push(`${d.period}: EOP rate is not a number`)
      }
      if (d.fx_avg.trim() && Number.isNaN(parseNumber(d.fx_avg) as number)) {
        errs.push(`${d.period}: Avg rate is not a number`)
      }
    })
    return errs
  }, [drafts])

  const handleSave = async () => {
    if (parseErrors.length > 0) {
      toast.error(parseErrors[0])
      return
    }
    const validation = validateFxRates(parsedRates)
    if (!validation.valid) {
      toast.error(validation.issues[0].message)
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/fx-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          company_name: selectedCompany,
          rates: parsedRates,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to save')
      toast.success(`Saved ${body.count} FX rate entries`)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save FX rates')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded hover:bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold">FX Rates (IRM)</h1>
          <p className="text-sm text-muted-foreground">
            Enter end-of-period (balance sheet) and average (P&amp;L) rates
            from the IFC FX library. Both are required per period before the
            IRM view can render.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Company</label>
        <Select value={selectedCompany} onValueChange={setSelectedCompany}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Select a company" />
          </SelectTrigger>
          <SelectContent>
            {companies.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : drafts.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No periods found for this company. Upload a financial statement
          first.
        </div>
      ) : (
        <>
          <div
            className={`flex items-center gap-2 rounded border p-3 text-sm ${
              completeness.complete
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-amber-300 bg-amber-50 text-amber-800'
            }`}
          >
            {completeness.complete ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                All periods have both EOP and average rates. IRM view is
                ready.
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" />
                Incomplete:{' '}
                {completeness.missingEop.length > 0 && (
                  <span>
                    missing EOP for {completeness.missingEop.join(', ')}
                    {completeness.missingAvg.length > 0 && '; '}
                  </span>
                )}
                {completeness.missingAvg.length > 0 && (
                  <span>missing Avg for {completeness.missingAvg.join(', ')}</span>
                )}
              </>
            )}
          </div>

          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Period</th>
                  <th className="px-3 py-2 text-left">FX EOP (stock)</th>
                  <th className="px-3 py-2 text-left">FX Avg (flow)</th>
                  <th className="px-3 py-2 text-left">Source</th>
                  <th className="px-3 py-2 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((d, i) => (
                  <tr key={d.period + i} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{d.period}</td>
                    <td className="px-3 py-2">
                      <input
                        className="w-32 rounded border px-2 py-1"
                        value={d.fx_eop}
                        onChange={(e) =>
                          updateDraft(i, { fx_eop: e.target.value })
                        }
                        placeholder="e.g. 610.50"
                        inputMode="decimal"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-32 rounded border px-2 py-1"
                        value={d.fx_avg}
                        onChange={(e) =>
                          updateDraft(i, { fx_avg: e.target.value })
                        }
                        placeholder="e.g. 605.20"
                        inputMode="decimal"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-56 rounded border px-2 py-1"
                        value={d.source}
                        onChange={(e) =>
                          updateDraft(i, { source: e.target.value })
                        }
                        placeholder="IFC FX library, …"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-56 rounded border px-2 py-1"
                        value={d.notes}
                        onChange={(e) =>
                          updateDraft(i, { notes: e.target.value })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save FX rates
            </button>
            {parseErrors.length > 0 && (
              <span className="text-sm text-red-600">{parseErrors[0]}</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
