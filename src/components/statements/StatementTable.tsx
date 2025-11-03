// src/components/statements/StatementTable.tsx
'use client'

import { useState, useEffect } from 'react'
import { LineItem } from '@/types/database.types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Trash2, Plus, Save } from 'lucide-react'

interface StatementTableProps {
  periods: string[]
  lineItems: LineItem[]
  onSave: (lineItems: LineItem[]) => void
  readOnly?: boolean
  // optional: pass the statement type so we can adapt layout for compte_resultats
  statementType?: 'actifs' | 'passifs' | 'hors_bilan' | 'compte_resultats' | string
}

export default function StatementTable({
  periods,
  lineItems: initialLineItems,
  onSave,
  readOnly = false,
  statementType
}: StatementTableProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>(initialLineItems)
  const [hasChanges, setHasChanges] = useState(false)
  useEffect(() => {
  setLineItems(initialLineItems)
  setHasChanges(false)
}, [initialLineItems])
  const isIncomeStatement = statementType === 'compte_resultats'

  const updateAmount = (lineIndex: number, periodIndex: number, value: string) => {
    const newLineItems = [...lineItems]
    const numValue = parseFloat(value) || 0
    if (!newLineItems[lineIndex].amounts) newLineItems[lineIndex].amounts = periods.map(() => 0)
    newLineItems[lineIndex].amounts[periodIndex] = numValue
    setLineItems(newLineItems)
    setHasChanges(true)
  }

  const updateDescription = (lineIndex: number, value: string) => {
    const newLineItems = [...lineItems]
    newLineItems[lineIndex].description = value
    setLineItems(newLineItems)
    setHasChanges(true)
  }

  const updatePoste = (lineIndex: number, value: string) => {
    const newLineItems = [...lineItems]
    newLineItems[lineIndex].poste = value
    setLineItems(newLineItems)
    setHasChanges(true)
  }

  const removeLine = (lineIndex: number) => {
    const newLineItems = lineItems.filter((_, i) => i !== lineIndex)
    setLineItems(newLineItems)
    setHasChanges(true)
  }

  const addLine = () => {
    const newLine: LineItem = {
      poste: '',
      description: '',
      amounts: periods.map(() => 0),
      is_subtotal: false,
      is_total: false,
      indent_level: 0,
      manual: true,
      flags: []
    }
    setLineItems([...lineItems, newLine])
    setHasChanges(true)
  }

  const handleSave = () => {
    onSave(lineItems)
    setHasChanges(false)
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatPeriod = (period: string) => {
    const date = new Date(period)
    return isNaN(date.getTime()) ? period : date.getFullYear().toString()
  }

  return (
    <div className="space-y-4">
      {/* Header with save button */}
      {!readOnly && hasChanges && (
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Enregistrer les modifications
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="border border-stone-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          {/* Use table-auto so columns can grow to fit content, keep horizontal scroll if needed */}
          <table className="w-full table-auto">
            <thead className="bg-stone-100 border-b border-stone-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-stone-700 w-44">
                  Code Poste
                </th>
                {/* Make description flexible and large so full text is visible */}
                <th className="px-4 py-3 text-left text-sm font-medium text-stone-700 w-full min-w-[360px] lg:min-w-[520px]">
                  Description
                </th>
                {periods.map((period, idx) => (
                  <th
                    key={idx}
                    className={
                      `px-4 py-3 text-right text-sm font-medium text-stone-700 ` +
                      (isIncomeStatement
                        ? 'min-w-[180px] md:min-w-[220px] lg:min-w-[260px]'
                        : 'min-w-[140px] md:min-w-[160px] lg:min-w-[200px]')
                    }
                  >
                    {formatPeriod(period)}
                  </th>
                ))}
                {!readOnly && (
                  <th className="px-4 py-3 w-16"></th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {lineItems.map((line, lineIdx) => (
                <tr
                  key={lineIdx}
                  className={`
                    ${line.is_total ? 'bg-amber-50 font-semibold' : ''}
                    ${line.is_subtotal ? 'bg-stone-50 font-medium' : ''}
                    ${line.manual ? 'bg-blue-50' : ''}
                    hover:bg-stone-50 transition-colors
                  `}
                  style={{
                    paddingLeft: `${(line.indent_level || 0) * 1}rem`
                  }}
                >
                  <td className="px-4 py-2 align-top">
                    {readOnly ? (
                      <span className="text-sm text-stone-900 font-mono">{line.poste}</span>
                    ) : (
                      <Input
                        value={line.poste}
                        onChange={(e) => updatePoste(lineIdx, e.target.value)}
                        className="text-sm h-8 border-stone-200 font-mono min-w-[120px]"
                      />
                    )}
                  </td>
                  <td className="px-4 py-2 align-top">
                    {readOnly ? (
                      <span className="text-sm text-stone-900 block whitespace-normal">{line.description}</span>
                    ) : (
                      <Input
                        value={line.description}
                        onChange={(e) => updateDescription(lineIdx, e.target.value)}
                        className="text-sm h-8 border-stone-200 w-full min-w-[360px] lg:min-w-[520px]"
                      />
                    )}
                  </td>

                  {/* Render amount cells aligned to periods (ensures column count matches header) */}
                  {periods.map((_, periodIdx) => {
                    const amount = line.amounts?.[periodIdx] ?? 0
                    return (
                      <td key={periodIdx} className="px-4 py-2 text-right align-top">
                        {readOnly ? (
                          <span className="text-sm text-stone-900 font-mono tabular-nums">
                            {formatAmount(amount)}
                          </span>
                        ) : (
                          <Input
                            type="number"
                            value={String(amount)}
                            onChange={(e) => updateAmount(lineIdx, periodIdx, e.target.value)}
                            className={
                              `text-sm h-8 text-right border-stone-200 font-mono tabular-nums ` +
                              (isIncomeStatement
                                ? 'min-w-[180px] md:min-w-[220px] lg:min-w-[260px]'
                                : 'min-w-[140px] md:min-w-[160px] lg:min-w-[200px]')
                            }
                          />
                        )}
                      </td>
                    )
                  })}

                  {!readOnly && (
                    <td className="px-4 py-2 align-top">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLine(lineIdx)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add line button */}
      {!readOnly && (
        <Button
          onClick={addLine}
          variant="outline"
          className="w-full border-dashed border-2 border-stone-300 hover:border-amber-500 hover:bg-amber-50"
        >
          <Plus className="w-4 h-4 mr-2" />
          Ajouter une ligne
        </Button>
      )}

      {/* Legend */}
      <div className="flex gap-6 text-xs text-stone-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-amber-50 border border-stone-200 rounded"></div>
          <span>Total</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-stone-50 border border-stone-200 rounded"></div>
          <span>Sous-total</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-50 border border-stone-200 rounded"></div>
          <span>Ajouté manuellement</span>
        </div>
      </div>
    </div>
  )
}