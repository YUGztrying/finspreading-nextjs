// src/app/api/extract-from-pages/route.ts
// Extract financial statements from a PDF using user-selected page ranges.
// For CAC reports, annual reports, and other multi-section documents where
// only specific pages contain the BS/IS/HB tables.
//
// Flow:
//   1. User uploads full PDF (via existing upload flow)
//   2. User tags pages per statement type in the page-picker UI
//   3. Frontend calls this endpoint with selections
//   4. Backend splits the PDF per statement type using pdf-lib, sends each
//      sub-PDF to Claude with a type-specific prompt, returns a normalized
//      response shaped like /api/extract-data for drop-in compatibility.
//
// Auth-gated via requireUser() — costs money per call.

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { PDFDocument } from 'pdf-lib'
import { requireUser } from '@/lib/auth/require-user'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

type StatementType = 'actifs' | 'passifs' | 'hors_bilan' | 'compte_resultats'
const STATEMENT_TYPES: StatementType[] = ['actifs', 'passifs', 'hors_bilan', 'compte_resultats']

type InstitutionType = 'banque' | 'microfinance'

interface RequestBody {
  file_url: string
  institution_type?: InstitutionType
  selections: Partial<Record<StatementType, number[]>>
}

interface LineItem {
  poste: string
  description: string
  amounts: number[]
  is_subtotal?: boolean
  is_total?: boolean
  indent_level?: number
}

interface ExtractedStatement {
  statement_type: StatementType
  periods: string[]
  line_items: LineItem[]
}

function statementLabel(type: StatementType): string {
  switch (type) {
    case 'actifs': return 'BILAN - ACTIF'
    case 'passifs': return 'BILAN - PASSIF'
    case 'hors_bilan': return 'HORS BILAN'
    case 'compte_resultats': return 'COMPTE DE RÉSULTAT'
  }
}

function buildPrompt(type: StatementType, institutionType: InstitutionType): string {
  const label = statementLabel(type)
  const context = institutionType === 'banque' ? 'bancaires' : 'de microfinance'

  return `Tu es un expert comptable spécialisé dans l'analyse d'états financiers ${context} (format BCEAO/OHADA).

Ce PDF contient UNIQUEMENT le tableau "${label}" d'une institution financière. Extrais TOUTES les lignes du tableau.

INSTRUCTIONS:
1. Identifie le nom de l'institution (cherche en en-tête de page ou dans une cellule)
2. Identifie les périodes/exercices présentés (dans l'en-tête des colonnes numériques)
3. Pour CHAQUE ligne du tableau, extrais:
   - Le code POSTE (souvent un numéro 1-20 ou un code alphanumérique comme RBA_0010, MFA_A11)
   - La description exacte (libellé en français)
   - Les montants pour chaque période (en nombres, pas en string; utilise 0 si vide ou "-")
   - is_subtotal: true si la ligne est un sous-total (souvent en italique ou indenté)
   - is_total: true pour la ligne TOTAL finale
   - indent_level: 0 pour les lignes principales, 1 pour les sous-éléments indentés

FORMAT DE SORTIE (JSON strict, AUCUN texte additionnel):
{
  "company_name": "Nom de l'institution",
  "periods": ["2023-12-31", "2024-12-31"],
  "line_items": [
    {
      "poste": "1",
      "description": "CAISSE, BANQUE CENTRALE, CCP",
      "amounts": [48030, 118185],
      "is_subtotal": false,
      "is_total": false,
      "indent_level": 0
    }
  ]
}

RÈGLES CRITIQUES:
- Les montants DOIVENT être des nombres purs (pas de virgules, pas d'espaces, pas de "FCFA")
- Les périodes au format YYYY-MM-DD (utilise 12-31 si seule l'année est visible)
- Garde l'ordre des lignes du PDF
- Inclus TOUS les totaux et sous-totaux avec les flags appropriés
- Si un montant est "-" ou vide, utilise 0
- N'invente AUCUNE ligne; extrais uniquement ce qui est visible dans le PDF

Réponds UNIQUEMENT avec le JSON, sans markdown.`
}

interface ClaudeExtractionResult {
  company_name: string
  periods: string[]
  line_items: LineItem[]
}

async function extractOneStatement(
  subPdfBase64: string,
  type: StatementType,
  institutionType: InstitutionType
): Promise<ClaudeExtractionResult> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: subPdfBase64,
            },
          },
          {
            type: 'text',
            text: buildPrompt(type, institutionType),
          },
        ],
      },
    ],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error(`No text response from Claude for ${type}`)
  }

  let jsonStr = textBlock.text.trim()
  // Strip markdown code fences if Claude wrapped the response
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  }

  const parsed = JSON.parse(jsonStr)
  if (!parsed.company_name || !Array.isArray(parsed.line_items) || !Array.isArray(parsed.periods)) {
    throw new Error(`Invalid JSON structure from Claude for ${type}`)
  }

  return parsed as ClaudeExtractionResult
}

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.user) return auth.response

  try {
    const body = (await request.json()) as RequestBody
    const { file_url, institution_type = 'banque', selections } = body

    if (!file_url) {
      return NextResponse.json({ error: 'file_url is required' }, { status: 400 })
    }

    if (!selections || typeof selections !== 'object') {
      return NextResponse.json(
        { error: 'selections object is required' },
        { status: 400 }
      )
    }

    // Validate + normalize selections: keep only recognized types with non-empty page arrays
    const validSelections: Record<string, number[]> = {}
    for (const type of STATEMENT_TYPES) {
      const pages = selections[type]
      if (Array.isArray(pages) && pages.length > 0 && pages.every((p) => Number.isInteger(p) && p > 0)) {
        // Sort + dedupe
        validSelections[type] = Array.from(new Set(pages)).sort((a, b) => a - b)
      }
    }

    if (Object.keys(validSelections).length === 0) {
      return NextResponse.json(
        { error: 'At least one statement type must have valid pages selected' },
        { status: 400 }
      )
    }

    // Download the source PDF once
    const pdfResponse = await fetch(file_url)
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch source PDF: ${pdfResponse.statusText}`)
    }
    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer())
    const sourceDoc = await PDFDocument.load(pdfBytes)
    const totalPages = sourceDoc.getPageCount()

    // Validate page numbers are within range
    for (const [type, pages] of Object.entries(validSelections)) {
      const oob = pages.filter((p) => p > totalPages)
      if (oob.length > 0) {
        return NextResponse.json(
          { error: `Pages ${oob.join(',')} for ${type} exceed document length (${totalPages} pages)` },
          { status: 400 }
        )
      }
    }

    // Extract in parallel per statement type
    const extractionPromises = Object.entries(validSelections).map(
      async ([type, pages]): Promise<ExtractedStatement & { company_name: string }> => {
        // Build sub-PDF containing only the selected pages
        const subDoc = await PDFDocument.create()
        const pageIndices = pages.map((p) => p - 1) // 1-indexed → 0-indexed
        const copiedPages = await subDoc.copyPages(sourceDoc, pageIndices)
        copiedPages.forEach((p) => subDoc.addPage(p))
        const subBytes = await subDoc.save()
        const subBase64 = Buffer.from(subBytes).toString('base64')

        const result = await extractOneStatement(subBase64, type as StatementType, institution_type)

        return {
          statement_type: type as StatementType,
          periods: result.periods,
          line_items: result.line_items,
          company_name: result.company_name,
        }
      }
    )

    const results = await Promise.all(extractionPromises)

    // Use the most common company_name across extractions (majority vote, ties broken by first)
    const nameVotes: Record<string, number> = {}
    for (const r of results) {
      if (r.company_name) {
        nameVotes[r.company_name] = (nameVotes[r.company_name] || 0) + 1
      }
    }
    const companyName =
      Object.entries(nameVotes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown Company'

    // Shape response like /api/extract-data so the existing save flow just works
    return NextResponse.json({
      success: true,
      data: {
        company_name: companyName,
        statements: results.map(({ statement_type, periods, line_items }) => ({
          statement_type,
          periods,
          line_items,
        })),
      },
      summary: {
        company: companyName,
        total_statements: results.length,
        statements: results.map((r) => ({
          type: r.statement_type,
          lines: r.line_items.length,
          periods: r.periods.length,
          source_pages: validSelections[r.statement_type],
        })),
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || 'Extraction from pages failed',
        details: 'An error occurred during page-based extraction',
      },
      { status: 500 }
    )
  }
}
