// src/components/camels/RatioTable.tsx
// Displays a table of ratios across multiple periods.

'use client'

interface RatioTableProps {
  title: string
  periodLabels: string[]
  rows: Array<{
    label: string
    values: (number | null)[]
    format: 'percent' | 'number' | 'multiple'
  }>
}

function formatCell(value: number | null, format: string): string {
  if (value == null) return '—'
  if (format === 'percent') return `${(value * 100).toFixed(1)}%`
  if (format === 'multiple') return `${value.toFixed(2)}x`
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return value.toFixed(0)
}

export default function RatioTable({ title, periodLabels, rows }: RatioTableProps) {
  return (
    <div className="border border-stone-200 rounded-xl bg-white overflow-hidden">
      <div className="px-5 py-3 bg-stone-50 border-b border-stone-200">
        <h3 className="font-medium text-stone-900 text-sm">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100">
              <th className="text-left px-5 py-2.5 text-stone-500 font-medium">Metric</th>
              {periodLabels.map(p => (
                <th key={p} className="text-right px-4 py-2.5 text-stone-500 font-medium">{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'}>
                <td className="px-5 py-2.5 text-stone-700">{row.label}</td>
                {row.values.map((v, j) => (
                  <td key={j} className="text-right px-4 py-2.5 font-mono text-stone-900">
                    {formatCell(v, row.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
