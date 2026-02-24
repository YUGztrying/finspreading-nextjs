// src/components/camels/RatioTable.tsx
// Displays a table of ratios / financial values across multiple periods.
// Supports CAGR column, bold rows, and growth-rate coloring.

'use client'

interface RatioTableRow {
  label: string
  values: (number | null)[]
  format: 'percent' | 'number' | 'multiple'
  bold?: boolean
  cagr?: number | null
}

interface RatioTableProps {
  title: string
  periodLabels: string[]
  rows: RatioTableRow[]
  showCagr?: boolean
}

function formatCell(value: number | null, format: string): string {
  if (value == null) return '\u2014'
  if (format === 'percent') return `${(value * 100).toFixed(1)}%`
  if (format === 'multiple') return `${value.toFixed(2)}x`
  // Number formatting with M/K suffix
  const absVal = Math.abs(value)
  if (absVal >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (absVal >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (absVal >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(0)
}

function formatCagr(value: number | null | undefined): string {
  if (value == null) return '\u2014'
  return `${(value * 100).toFixed(1)}%`
}

export default function RatioTable({ title, periodLabels, rows, showCagr = false }: RatioTableProps) {
  return (
    <div className="border border-stone-200 rounded-xl bg-white overflow-hidden shadow-sm">
      <div className="px-5 py-3 bg-stone-800 border-b border-stone-700">
        <h3 className="font-medium text-white text-sm">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th className="text-left px-5 py-2.5 text-stone-500 font-medium text-xs uppercase tracking-wide">Metric</th>
              {periodLabels.map(p => (
                <th key={p} className="text-right px-4 py-2.5 text-stone-500 font-medium text-xs uppercase tracking-wide">{p}</th>
              ))}
              {showCagr && (
                <th className="text-right px-4 py-2.5 text-stone-500 font-medium text-xs uppercase tracking-wide">CAGR</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={`${row.label}-${i}`}
                className={`border-b border-stone-100 last:border-b-0 ${
                  row.bold ? 'bg-stone-50' : i % 2 === 0 ? 'bg-white' : 'bg-stone-50/30'
                }`}
              >
                <td className={`px-5 py-2.5 ${row.bold ? 'font-semibold text-stone-900' : 'text-stone-600'}`}>
                  {row.label}
                </td>
                {row.values.map((v, j) => (
                  <td
                    key={j}
                    className={`text-right px-4 py-2.5 font-mono tabular-nums ${
                      row.bold ? 'font-semibold text-stone-900' : 'text-stone-700'
                    }`}
                  >
                    {formatCell(v, row.format)}
                  </td>
                ))}
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
