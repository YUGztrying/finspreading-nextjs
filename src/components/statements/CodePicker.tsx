// src/components/statements/CodePicker.tsx
'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, AlertTriangle, Check, X } from 'lucide-react'
import {
  MF_CATALOG,
  getCatalogEntry,
  getCatalogForSection,
  isUndefinedPoste,
  type CatalogEntry,
  type CatalogSection,
} from '@/lib/normalization/microfinance/catalog'

interface CodePickerProps {
  /** Current full key stored in line.poste (e.g. "MFA_A10", "MFA_UNDEFINED_xxx") */
  value: string
  /** Original description of the row — used to display hint text */
  description?: string
  /** Section the row belongs to — drives the default filter */
  statementType?: 'actifs' | 'passifs' | 'hors_bilan' | 'compte_resultats' | string
  onChange: (newKey: string) => void
  disabled?: boolean
}

function normalizeForSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export default function CodePicker({
  value,
  description,
  statementType,
  onChange,
  disabled = false,
}: CodePickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showAllSections, setShowAllSections] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const currentEntry = getCatalogEntry(value)
  const isUnassigned = isUndefinedPoste(value)

  const filteredEntries = useMemo(() => {
    const pool = showAllSections
      ? MF_CATALOG
      : getCatalogForSection(statementType as CatalogSection | undefined)
    const q = normalizeForSearch(search.trim())
    if (!q) return pool
    return pool.filter((e) => {
      const haystack = normalizeForSearch(
        `${e.fullKey} ${e.rawCode} ${e.label} ${e.groupTitle}`
      )
      return haystack.includes(q)
    })
  }, [search, showAllSections, statementType])

  // Group entries by their `groupTitle` for display
  const grouped = useMemo(() => {
    const map = new Map<string, CatalogEntry[]>()
    for (const e of filteredEntries) {
      const arr = map.get(e.groupTitle) ?? []
      arr.push(e)
      map.set(e.groupTitle, arr)
    }
    return Array.from(map.entries())
  }, [filteredEntries])

  // Reset search & focus when dialog opens
  useEffect(() => {
    if (open) {
      setSearch('')
      setShowAllSections(false)
      // small delay to let the dialog animation finish before focusing
      const t = setTimeout(() => searchInputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open])

  const handleSelect = (entry: CatalogEntry) => {
    onChange(entry.fullKey)
    setOpen(false)
  }

  const handleClear = () => {
    onChange('')
    setOpen(false)
  }

  // Trigger button rendering
  const triggerLabel = currentEntry
    ? `${currentEntry.fullKey} — ${currentEntry.label}`
    : isUnassigned
      ? 'Code à assigner'
      : value // unrecognized but non-empty: show raw

  const triggerClasses = isUnassigned
    ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
    : currentEntry
      ? 'border-stone-200 bg-white text-stone-900 hover:bg-stone-50'
      : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`group flex items-center gap-2 w-full text-left px-2 py-1.5 rounded border text-sm font-mono min-w-[120px] max-w-[260px] truncate transition-colors ${triggerClasses} disabled:opacity-50 disabled:cursor-not-allowed`}
          title={triggerLabel}
        >
          {isUnassigned && <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />}
          <span className="truncate">{triggerLabel}</span>
        </button>
      </DialogTrigger>

      <DialogContent
        className="max-w-2xl sm:max-w-2xl w-[95vw] max-h-[85vh] flex flex-col p-0 gap-0"
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-stone-200">
          <DialogTitle className="text-lg">Assigner un code SYSCOA-IMF</DialogTitle>
          <DialogDescription className="text-xs text-stone-500">
            Recherchez par code (ex. <code>A10</code>) ou par libellé (ex. <code>caisse</code>).
            {description && (
              <span className="block mt-1">
                Ligne à classer : <span className="font-medium text-stone-700">« {description} »</span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Search bar */}
        <div className="px-6 py-3 border-b border-stone-100 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un code ou un libellé…"
              className="pl-9 h-9"
            />
          </div>
          {statementType && (
            <label className="flex items-center gap-2 text-xs text-stone-600 whitespace-nowrap cursor-pointer">
              <input
                type="checkbox"
                checked={showAllSections}
                onChange={(e) => setShowAllSections(e.target.checked)}
                className="rounded border-stone-300"
              />
              Voir tous les états
            </label>
          )}
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto px-2 py-2 min-h-[300px]">
          {grouped.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-stone-500">
              Aucun code ne correspond à « {search} ».
              {!showAllSections && statementType && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setShowAllSections(true)}
                    className="text-amber-700 hover:text-amber-800 underline"
                  >
                    Élargir la recherche à tous les états
                  </button>
                </div>
              )}
            </div>
          ) : (
            grouped.map(([groupTitle, entries]) => (
              <div key={groupTitle} className="mb-3">
                <div className="px-4 py-1.5 text-xs font-medium text-stone-500 uppercase tracking-wide bg-stone-50 sticky top-0">
                  {groupTitle}
                </div>
                <ul className="divide-y divide-stone-100">
                  {entries.map((e) => {
                    const isSelected = e.fullKey === value
                    return (
                      <li key={e.fullKey}>
                        <button
                          type="button"
                          onClick={() => handleSelect(e)}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-amber-50 transition-colors ${
                            isSelected ? 'bg-amber-50' : ''
                          }`}
                        >
                          <span className="font-mono text-xs text-stone-700 bg-stone-100 px-2 py-0.5 rounded border border-stone-200 min-w-[88px] text-center">
                            {e.fullKey}
                          </span>
                          <span className="text-sm text-stone-900 flex-1">
                            {e.label}
                          </span>
                          {isSelected && (
                            <Check className="w-4 h-4 text-amber-700 flex-shrink-0" />
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="text-xs text-stone-500">
            {filteredEntries.length} code{filteredEntries.length !== 1 ? 's' : ''} affiché{filteredEntries.length !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-2">
            {!isUnassigned && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Effacer le code
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
