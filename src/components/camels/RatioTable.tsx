// src/components/camels/RatioTable.tsx
'use client'

import { useState, useRef } from 'react'
import { Loader2 } from 'lucide-react'

export interface RatioTableRow {
  label: string
  values: (number | null)[]
  format: 'percent' | 'number' | 'multiple'
  bold?: boolean
  cagr?: number | null
  // Per-period inline override editing
  editable?: boolean
  overrideValues?: (number | null)[]  // parallel to values[], one override per period
  onSave?: (periodIndex: number, value: number | null) => Promise<void>
  // Per-period read-only derived values shown in blue (non-editable)
  derivedValues?: (number | null)[]   // parallel to values[], one derived value per period
}

interface RatioTableProps {
  title: string
  periodLabels: string[]
  rows: RatioTableRow[]
  showCagr?: boolean
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatCell(value: number | null, format: string): string {
  if (value == null) return '—'
  if (format === 'percent') return `${(value * 100).toFixed(1)}%`
  if (format === 'multiple') return `${value.toFixed(2)}x`
  const absVal = Math.abs(value)
  if (absVal >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (absVal >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (absVal >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(0)
}

function formatCagr(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${(value * 100).toFixed(1)}%`
}

// ─── Editable cell ───────────────────────────────────────────────────────────

function EditableCell({
  format,
  computedValue,
  overrideValue,
  onSave,
}: {
  format: 'percent' | 'number' | 'multiple'
  computedValue: number | null
  overrideValue: number | null | undefined
  onSave: (value: number | null) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isPercent = format === 'percent'
  const hasOverride = overrideValue != null
  const displayValue = hasOverride ? overrideValue : computedValue

  const startEdit = () => {
    const current = overrideValue ?? computedValue
    if (isPercent) {
      setDraft(current != null ? (current * 100).toFixed(2) : '')
    } else {
      setDraft(current != null ? current.toFixed(0) : '')
    }
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const save = async () => {
    const trimmed = draft.trim()
    let finalValue: number | null
    if (trimmed === '') {
      finalValue = null
    } else {
      const parsed = parseFloat(trimmed)
      if (isNaN(parsed)) {
        setEditing(false)
        return
      }
      finalValue = isPercent ? parsed / 100 : parsed
    }
    setSaving(true)
    setEditing(false)
    await onSave(finalValue)
    setSaving(false)
  }

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1">
        <input
          ref={inputRef}
          type="number"
          step={isPercent ? '0.01' : '1'}
          value={draft}
          autoFocus
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') setEditing(false)
          }}
          onBlur={save}
          className="w-20 text-right text-xs font-mono border-0 border-b border-blue-400 bg-transparent outline-none text-stone-900"
          placeholder={isPercent ? '0.00' : '0'}
        />
        {isPercent && <span className="text-xs text-stone-400">%</span>}
      </div>
    )
  }

  return (
    <div
      className="flex items-center justify-end gap-1.5 cursor-text group"
      onClick={startEdit}
      title={hasOverride ? 'Analyst value — click to edit' : 'Click to enter analyst value'}
    >
      {saving && <Loader2 className="w-3 h-3 animate-spin text-stone-400 flex-shrink-0" />}
      {hasOverride && !saving && (
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" title="Analyst value" />
      )}
      <span
        className={`font-mono tabular-nums transition-colors ${
          hasOverride
            ? 'text-blue-700 font-medium'
            : 'text-stone-400 group-hover:text-stone-600'
        } group-hover:border-b group-hover:border-dashed group-hover:border-stone-300`}
      >
        {displayValue != null ? formatCell(displayValue, format) : (
          <span className="text-xs">+ add</span>
        )}
      </span>
    </div>
  )
}

// ─── Table ───────────────────────────────────────────────────────────────────

export default function RatioTable({ title, periodLabels, rows, showCagr = false }: RatioTableProps) {
  return (
    <div className="border border-stone-200 rounded-xl bg-white overflow-hidden shadow-sm">
      <div className="px-5 py-3 bg-stone-800">
        <h3 className="font-medium text-white text-sm">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th className="text-left px-5 py-2.5 text-stone-400 font-medium text-xs uppercase tracking-wide">
                Metric
              </th>
              {periodLabels.map(p => (
                <th
                  key={p}
                  className="text-right px-4 py-2.5 text-stone-400 font-medium text-xs uppercase tracking-wide"
                >
                  {p}
                </th>
              ))}
              {showCagr && (
                <th className="text-right px-4 py-2.5 text-stone-400 font-medium text-xs uppercase tracking-wide">
                  CAGR
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={`${row.label}-${i}`}
                className={`border-b border-stone-100 last:border-b-0 ${
                  row.bold ? 'bg-stone-50' : 'bg-white'
                }`}
              >
                <td className={`px-5 py-2.5 ${row.bold ? 'font-semibold text-stone-900' : 'text-stone-600'}`}>
                  {row.label}
                </td>

                {row.values.map((v, j) => {
                  // Read-only derived value (blue dot, non-editable)
                  const derived = row.derivedValues?.[j]
                  if (derived != null) {
                    return (
                      <td key={j} className="text-right px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" title="Derived from analyst NPL Amount" />
                          <span className="font-mono tabular-nums text-blue-700 font-medium">
                            {formatCell(derived, row.format)}
                          </span>
                        </div>
                      </td>
                    )
                  }

                  // Editable cell
                  if (row.editable && row.onSave) {
                    const overrideValue = row.overrideValues?.[j] ?? null
                    return (
                      <td key={j} className="text-right px-4 py-2.5">
                        <EditableCell
                          format={row.format}
                          computedValue={v}
                          overrideValue={overrideValue}
                          onSave={value => row.onSave!(j, value)}
                        />
                      </td>
                    )
                  }

                  return (
                    <td
                      key={j}
                      className={`text-right px-4 py-2.5 font-mono tabular-nums ${
                        row.bold ? 'font-semibold text-stone-900' : 'text-stone-700'
                      }`}
                    >
                      {formatCell(v, row.format)}
                    </td>
                  )
                })}

                {showCagr && (
                  <td className={`text-right px-4 py-2.5 font-mono tabular-nums ${
                    row.bold ? 'font-semibold text-stone-900' : 'text-stone-700'
                  }`}>
                    {formatCagr(row.cagr)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
