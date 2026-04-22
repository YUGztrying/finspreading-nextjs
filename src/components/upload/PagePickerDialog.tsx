// src/components/upload/PagePickerDialog.tsx
// Page-picker UI for CAC reports and annual reports.
//
// User flow:
//   1. PDF uploaded to Supabase, we have a signedUrl
//   2. This dialog renders each page as a thumbnail via react-pdf
//   3. User assigns a statement type to each relevant page (Actifs / Passifs /
//      Hors-Bilan / Compte de Résultats / Ignore)
//   4. "Lancer l'extraction" calls /api/extract-from-pages, which splits the PDF
//      server-side, sends each sub-PDF to Claude, returns all extracted data
//   5. Parent component receives the response and handles saving

'use client'

import { useEffect, useMemo, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, FileText, Sparkles } from 'lucide-react'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Point pdf.js at a CDN-hosted worker matching the installed pdfjs-dist version.
// For v1 this is fine; if CSP becomes strict we'll self-host the worker from /public.
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`

export type StatementType = 'actifs' | 'passifs' | 'hors_bilan' | 'compte_resultats'
type Tag = StatementType | 'ignore'

const TAG_LABELS: Record<Tag, string> = {
  actifs: 'Actifs',
  passifs: 'Passifs',
  hors_bilan: 'Hors-Bilan',
  compte_resultats: 'Compte de Résultats',
  ignore: 'Ignorer',
}

const TAG_COLORS: Record<Tag, string> = {
  actifs: 'border-emerald-400 ring-emerald-200 bg-emerald-50',
  passifs: 'border-blue-400 ring-blue-200 bg-blue-50',
  hors_bilan: 'border-orange-400 ring-orange-200 bg-orange-50',
  compte_resultats: 'border-purple-400 ring-purple-200 bg-purple-50',
  ignore: 'border-stone-200 bg-white',
}

export interface ExtractFromPagesResult {
  company_name: string
  statements: Array<{
    statement_type: StatementType
    periods: string[]
    line_items: Array<{
      poste: string
      description: string
      amounts: number[]
      is_subtotal?: boolean
      is_total?: boolean
      indent_level?: number
    }>
  }>
}

interface PagePickerDialogProps {
  open: boolean
  fileUrl: string | null
  fileName: string
  institutionType: 'banque' | 'microfinance'
  onClose: () => void
  onExtracted: (result: ExtractFromPagesResult) => void
}

export default function PagePickerDialog({
  open,
  fileUrl,
  fileName,
  institutionType,
  onClose,
  onExtracted,
}: PagePickerDialogProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [tags, setTags] = useState<Record<number, Tag>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when dialog opens with a new file
  useEffect(() => {
    if (open) {
      setNumPages(0)
      setTags({})
      setLoading(false)
      setError(null)
    }
  }, [open, fileUrl])

  // Group tagged pages by statement type (sorted ascending within each type)
  const selections = useMemo(() => {
    const out: Partial<Record<StatementType, number[]>> = {}
    for (const [pageStr, tag] of Object.entries(tags)) {
      if (tag === 'ignore') continue
      const page = Number(pageStr)
      if (!out[tag]) out[tag] = []
      out[tag]!.push(page)
    }
    for (const type of Object.keys(out) as StatementType[]) {
      out[type]!.sort((a, b) => a - b)
    }
    return out
  }, [tags])

  const selectedTypeCount = (Object.keys(selections) as StatementType[]).length

  const summaryByType = (Object.entries(TAG_LABELS) as [Tag, string][])
    .filter(([t]) => t !== 'ignore')
    .map(([t, label]) => {
      const pages = selections[t as StatementType] ?? []
      return { type: t as StatementType, label, pages }
    })

  async function handleExtract() {
    if (!fileUrl) return
    if (selectedTypeCount === 0) {
      setError('Sélectionne au moins un type d\'état financier.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/extract-from-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_url: fileUrl,
          institution_type: institutionType,
          selections,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Extraction échouée')
      }

      const result = await response.json()
      if (!result.success || !result.data) {
        throw new Error('Réponse invalide du serveur')
      }

      onExtracted(result.data)
    } catch (err: any) {
      setError(err?.message || 'Une erreur est survenue pendant l\'extraction')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !loading) onClose() }}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b border-stone-100">
          <DialogTitle className="flex items-center gap-3 text-xl font-light text-stone-900">
            <FileText className="w-5 h-5 text-amber-600" />
            Sélection des pages — {fileName}
          </DialogTitle>
          <p className="text-sm text-stone-500 mt-1">
            Tague chaque page contenant un état financier. Les pages non taguées seront ignorées.
          </p>
        </DialogHeader>

        {/* Body: thumbnails grid (scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {fileUrl && (
            <Document
              file={fileUrl}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              onLoadError={(e) => setError(`Chargement du PDF échoué : ${e.message}`)}
              loading={
                <div className="flex items-center justify-center py-20 text-stone-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Chargement du PDF…
                </div>
              }
            >
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => {
                  const tag: Tag = tags[pageNumber] ?? 'ignore'
                  return (
                    <div
                      key={pageNumber}
                      className={`rounded-lg border-2 p-2 transition-all ${TAG_COLORS[tag]}`}
                    >
                      <div className="relative bg-white rounded overflow-hidden shadow-sm">
                        <Page
                          pageNumber={pageNumber}
                          width={160}
                          renderAnnotationLayer={false}
                          renderTextLayer={false}
                        />
                        <div className="absolute top-1 right-1 bg-stone-900/80 text-white text-[10px] px-1.5 py-0.5 rounded">
                          p.{pageNumber}
                        </div>
                      </div>
                      <Select
                        value={tag}
                        onValueChange={(v) => setTags((prev) => ({ ...prev, [pageNumber]: v as Tag }))}
                      >
                        <SelectTrigger className="h-7 text-xs mt-2 border-stone-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ignore">Ignorer</SelectItem>
                          <SelectItem value="actifs">Actifs</SelectItem>
                          <SelectItem value="passifs">Passifs</SelectItem>
                          <SelectItem value="compte_resultats">Compte de Résultats</SelectItem>
                          <SelectItem value="hors_bilan">Hors-Bilan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )
                })}
              </div>
            </Document>
          )}
        </div>

        {/* Footer: selection summary + extract button */}
        <DialogFooter className="border-t border-stone-100 p-6 pt-4 flex flex-col items-stretch gap-3 sm:flex-col sm:items-stretch">
          <div className="flex flex-wrap gap-2">
            {summaryByType.map(({ type, label, pages }) => (
              <div
                key={type}
                className={`text-xs px-2.5 py-1 rounded-md border ${
                  pages.length > 0
                    ? TAG_COLORS[type].replace('bg-', 'bg-').replace(/\s+/g, ' ')
                    : 'bg-stone-50 text-stone-400 border-stone-200'
                }`}
              >
                <span className="font-medium">{label}:</span>{' '}
                {pages.length > 0 ? `pages ${pages.join(', ')}` : '—'}
              </div>
            ))}
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button
              onClick={handleExtract}
              disabled={loading || selectedTypeCount === 0}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Extraction en cours…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Lancer l'extraction ({selectedTypeCount} type{selectedTypeCount > 1 ? 's' : ''})
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
