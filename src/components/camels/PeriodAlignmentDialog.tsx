'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, X } from 'lucide-react'
import type { PeriodMapping, PeriodAlignmentInfo } from '@/types/database.types'

const NONE = '__none__'

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Props {
  open: boolean
  onClose: () => void
  alignmentInfo: PeriodAlignmentInfo
  onConfirm: (mappings: PeriodMapping[]) => void
}

export default function PeriodAlignmentDialog({ open, onClose, alignmentInfo, onConfirm }: Props) {
  const [mappings, setMappings] = useState<PeriodMapping[]>(alignmentInfo.suggested)

  const bsPeriods = [...new Set([...alignmentInfo.available.actifs, ...alignmentInfo.available.passifs])].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  )
  const isPeriods = [...alignmentInfo.available.compte_resultats].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  )
  const hbPeriods = [...alignmentInfo.available.hors_bilan].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  )

  const updateMapping = (idx: number, field: keyof PeriodMapping, value: string | null) => {
    setMappings(prev =>
      prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m))
    )
  }

  const removeRow = (idx: number) => {
    setMappings(prev => prev.filter((_, i) => i !== idx))
  }

  const handleConfirm = () => {
    // Filter out rows where all three are null (empty rows)
    const valid = mappings.filter(m => m.bs_period || m.is_period || m.hb_period)
    if (valid.length === 0) return
    onConfirm(valid)
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-stone-900">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Period Alignment Required
          </DialogTitle>
          <DialogDescription className="text-stone-500">
            Your balance sheet and income statement have different period dates.
            Confirm which periods should be paired for each analysis column.
          </DialogDescription>
        </DialogHeader>

        {/* Period summary */}
        <div className="text-xs text-stone-500 space-y-1 border border-stone-100 rounded-md p-3 bg-stone-50">
          {bsPeriods.length > 0 && (
            <div><span className="font-medium text-stone-700">Balance Sheet:</span> {bsPeriods.map(fmtDate).join(', ')}</div>
          )}
          {isPeriods.length > 0 && (
            <div><span className="font-medium text-stone-700">Income Statement:</span> {isPeriods.map(fmtDate).join(', ')}</div>
          )}
          {hbPeriods.length > 0 && (
            <div><span className="font-medium text-stone-700">Off-Balance Sheet:</span> {hbPeriods.map(fmtDate).join(', ')}</div>
          )}
        </div>

        {/* Mapping table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left py-2 px-1 text-stone-600 font-medium">Label</th>
                <th className="text-left py-2 px-1 text-stone-600 font-medium">Balance Sheet</th>
                <th className="text-left py-2 px-1 text-stone-600 font-medium">Income Stmt</th>
                {hbPeriods.length > 0 && (
                  <th className="text-left py-2 px-1 text-stone-600 font-medium">Off-BS</th>
                )}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {mappings.map((m, idx) => (
                <tr key={idx} className="border-b border-stone-100">
                  {/* Label — editable */}
                  <td className="py-1.5 px-1">
                    <input
                      className="w-full rounded border border-stone-200 px-2 py-1 text-sm text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-300"
                      value={m.label}
                      onChange={e => updateMapping(idx, 'label', e.target.value)}
                    />
                  </td>

                  {/* BS period */}
                  <td className="py-1.5 px-1">
                    <PeriodSelect
                      value={m.bs_period}
                      options={bsPeriods}
                      onChange={v => updateMapping(idx, 'bs_period', v)}
                    />
                  </td>

                  {/* IS period */}
                  <td className="py-1.5 px-1">
                    <PeriodSelect
                      value={m.is_period}
                      options={isPeriods}
                      onChange={v => updateMapping(idx, 'is_period', v)}
                    />
                  </td>

                  {/* HB period (only if they have off-balance-sheet data) */}
                  {hbPeriods.length > 0 && (
                    <td className="py-1.5 px-1">
                      <PeriodSelect
                        value={m.hb_period}
                        options={hbPeriods}
                        onChange={v => updateMapping(idx, 'hb_period', v)}
                      />
                    </td>
                  )}

                  {/* Remove */}
                  <td className="py-1.5 px-1">
                    {mappings.length > 1 && (
                      <button
                        onClick={() => removeRow(idx)}
                        className="text-stone-400 hover:text-red-500 transition-colors p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="border-stone-200">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={mappings.filter(m => m.bs_period || m.is_period || m.hb_period).length === 0}
            className="bg-amber-600 text-white hover:bg-amber-700"
          >
            Confirm &amp; Analyze
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Small period dropdown reused for each cell. */
function PeriodSelect({
  value,
  options,
  onChange,
}: {
  value: string | null
  options: string[]
  onChange: (v: string | null) => void
}) {
  return (
    <Select
      value={value ?? NONE}
      onValueChange={v => onChange(v === NONE ? null : v)}
    >
      <SelectTrigger className="h-8 text-xs border-stone-200">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>
          <span className="text-stone-400">None</span>
        </SelectItem>
        {options.map(p => (
          <SelectItem key={p} value={p}>
            {fmtDate(p)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
