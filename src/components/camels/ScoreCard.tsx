// src/components/camels/ScoreCard.tsx
// Displays a single CAMELS component rating with its key ratio.

'use client'

interface ScoreCardProps {
  label: string
  letter: string
  rating: number | null
  status: string
  primaryRatio: { label: string; value: number | null; format: 'percent' | 'multiple' }
  color: string // tailwind color class like "red" | "amber" | "blue" | "emerald" | "purple"
}

const ratingColors: Record<number, string> = {
  1: 'bg-emerald-500',
  2: 'bg-emerald-400',
  3: 'bg-amber-400',
  4: 'bg-orange-500',
  5: 'bg-red-500',
}

const ratingBorders: Record<number, string> = {
  1: 'border-emerald-200',
  2: 'border-emerald-100',
  3: 'border-amber-100',
  4: 'border-orange-100',
  5: 'border-red-100',
}

function formatValue(value: number | null, format: 'percent' | 'multiple'): string {
  if (value == null) return 'N/A'
  if (format === 'percent') return `${(value * 100).toFixed(1)}%`
  return value.toFixed(2)
}

export default function ScoreCard({ label, letter, rating, status, primaryRatio, color }: ScoreCardProps) {
  const bgColor = rating != null ? ratingColors[rating] : 'bg-stone-300'
  const borderColor = rating != null ? ratingBorders[rating] : 'border-stone-200'

  return (
    <div className={`border ${borderColor} rounded-xl bg-white p-5 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider text-${color}-600 mb-1`}>
            {label}
          </p>
          <p className="text-sm text-stone-500">{status}</p>
        </div>
        <div className={`${bgColor} w-12 h-12 rounded-lg flex items-center justify-center shadow-sm`}>
          <span className="text-white font-bold text-lg">
            {rating ?? '—'}
          </span>
        </div>
      </div>

      <div className="border-t border-stone-100 pt-3 mt-3">
        <div className="flex justify-between items-center">
          <span className="text-xs text-stone-500">{primaryRatio.label}</span>
          <span className="text-sm font-semibold text-stone-900">
            {formatValue(primaryRatio.value, primaryRatio.format)}
          </span>
        </div>
      </div>

      <div className="mt-2 text-xs text-stone-400">
        {letter} component
      </div>
    </div>
  )
}
