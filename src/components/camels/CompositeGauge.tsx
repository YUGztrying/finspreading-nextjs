// src/components/camels/CompositeGauge.tsx
// Displays the composite CAMELS rating as a prominent visual gauge.

'use client'

interface CompositeGaugeProps {
  rating: number | null
  average: number | null
  status: string
}

const gaugeColors: Record<number, { bg: string; text: string; ring: string }> = {
  1: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-500' },
  2: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-400' },
  3: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-400' },
  4: { bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-500' },
  5: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-500' },
}

export default function CompositeGauge({ rating, average, status }: CompositeGaugeProps) {
  const colors = rating != null ? gaugeColors[rating] : { bg: 'bg-stone-50', text: 'text-stone-500', ring: 'ring-stone-300' }

  return (
    <div className={`${colors.bg} border border-stone-200 rounded-2xl p-8 text-center`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-4">
        Composite CAMELS Rating
      </p>

      <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full ring-4 ${colors.ring} bg-white shadow-sm mb-4`}>
        <span className={`text-4xl font-bold ${colors.text}`}>
          {rating ?? '—'}
        </span>
      </div>

      <p className={`text-lg font-semibold ${colors.text} mb-1`}>
        {status}
      </p>
      <p className="text-sm text-stone-500">
        Average score: {average != null ? average.toFixed(1) : 'N/A'} / 5
      </p>

      {/* Scale legend */}
      <div className="flex justify-center gap-2 mt-6">
        {[1, 2, 3, 4, 5].map(n => {
          const isActive = rating === n
          return (
            <div key={n} className="text-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                ${isActive
                  ? `${gaugeColors[n].ring.replace('ring-', 'bg-')} text-white shadow-md`
                  : 'bg-stone-100 text-stone-400'
                }`}>
                {n}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-stone-400 mt-1 px-1" style={{ maxWidth: 200, margin: '4px auto 0' }}>
        <span>Strong</span>
        <span>Weak</span>
      </div>
    </div>
  )
}
