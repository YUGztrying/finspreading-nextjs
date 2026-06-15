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
import { resolveRelativePeriods } from '@/lib/normalization/period-resolver'

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

  // Hors-Bilan has a distinctive two-section layout (Engagements donnés +
  // Engagements reçus). Giving Claude that hint up-front prevents it from
  // returning a nested/alternative structure.
  const typeSpecificHint =
    type === 'hors_bilan'
      ? `\nATTENTION — Format Hors-Bilan spécifique:
Ce tableau contient typiquement DEUX sous-sections:
  - ENGAGEMENTS DONNÉS (postes 1 à ~3: financement, garantie, titres)
  - ENGAGEMENTS REÇUS (postes 4 à ~6: mêmes catégories en réception)
Mets les DEUX sous-sections dans le MÊME tableau "line_items" dans l'ordre.
Pour les en-têtes "ENGAGEMENTS DONNÉS" / "ENGAGEMENTS REÇUS" eux-mêmes, ajoute une ligne avec is_subtotal: true, amounts: [0, 0].`
      : ''

  return `Tu es un expert comptable spécialisé dans l'analyse d'états financiers ${context} (format BCEAO/OHADA).

Ce PDF contient le tableau "${label}" d'une institution financière. La page peut contenir
plusieurs tableaux côte à côte (par exemple ACTIF + PASSIF sur la même page de bilan microfinance, ou
COMPTE DE RÉSULTAT + HORS-BILAN). Dans ce cas, extrais UNIQUEMENT la section "${label}" et ignore
strictement les autres sections présentes. Extrais TOUTES les lignes de cette section.${typeSpecificHint}

INSTRUCTIONS:
1. Identifie le nom de l'institution (cherche en en-tête de page ou dans une cellule)
2. **PÉRIODES — règle critique** :
   a. Cherche la "Date d'arrêté" (ou "Date d'arreté", "Date de clôture", "Closing date") imprimée
      sur la page et renvoie-la dans le champ "closing_date" au format YYYY-MM-DD. Si elle est en
      DD/MM/YYYY ou en case à damier "31|12|2023", convertis. Si tu ne la trouves pas avec
      certitude, renvoie "".
   b. Pour le champ "periods" : si les colonnes affichent des dates explicites (ex. "31/12/2022",
      "2022-12-31", "Décembre 2022"), renvoie-les converties en YYYY-MM-DD.
      Si elles affichent des libellés RELATIFS ("exercice N", "exercice N-1", "N", "N-1",
      "Année N", "FY N-1", etc.), renvoie EXACTEMENT ces libellés tels quels — le serveur les
      résoudra à partir de "closing_date".
   c. NE DEVINE JAMAIS l'année si elle n'est pas explicitement écrite. Pas de "N → 2023" mental.
      Soit absolu (date imprimée), soit relatif (libellé brut). Pas d'interpolation.
3. Pour CHAQUE ligne du tableau, extrais:
   - Le code POSTE: soit le code alphanumérique exact visible dans le PDF (ex. RBA_0010, A01, A10, B2D, F1A, L20), soit le numéro de poste si c'est tout ce que le tableau affiche (1, 2, 3…). Si AUCUN code n'est lisible, utilise "" — n'invente JAMAIS un code et ne réutilise PAS un code d'une autre ligne.
   - La description exacte (libellé en français), telle qu'elle est imprimée. Si la ligne est mal scannée ou floue, conserve le texte tel que tu le lis sans le "corriger" pour qu'il ressemble à un poste connu — la normalisation downstream préfère un libellé fidèle (même imparfait) à un code inventé.
   - Les montants pour chaque période (en nombres, pas en string; utilise 0 si vide ou "-")
   - is_subtotal: true si la ligne est un sous-total ou un en-tête de section
   - is_total: true pour la ligne TOTAL finale
   - indent_level: 0 pour les lignes principales, 1 pour les sous-éléments indentés

FORMAT DE SORTIE (JSON strict, AUCUN texte additionnel, AUCUN markdown):
{
  "company_name": "Nom de l'institution",
  "closing_date": "2023-12-31",
  "periods": ["exercice N-1", "exercice N"],
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
- Garde l'ordre des lignes du PDF
- Inclus TOUS les totaux et sous-totaux avec les flags appropriés
- Si un montant est "-" ou vide, utilise 0
- N'invente AUCUNE ligne; extrais uniquement ce qui est visible dans le PDF
- Les champs "company_name", "closing_date", "periods", et "line_items" sont OBLIGATOIRES dans la réponse

Réponds UNIQUEMENT avec le JSON.`
}

interface ClaudeExtractionResult {
  company_name: string
  /** Raw "Date d'arrêté" reported by Claude, e.g. "2023-12-31" or "" if missing. */
  closing_date: string
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

  const rawResponse = textBlock.text
  let jsonStr = rawResponse.trim()

  // Strip markdown code fences if Claude wrapped the response
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  }

  // Fallback: look for the first {...} block if Claude added narrative around it
  if (!jsonStr.startsWith('{')) {
    const firstBrace = jsonStr.indexOf('{')
    const lastBrace = jsonStr.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1)
    }
  }

  let parsed: any
  try {
    parsed = JSON.parse(jsonStr)
  } catch (parseErr: any) {
    console.error(`[extract-from-pages] JSON parse failed for ${type}:`, parseErr.message)
    console.error(`[extract-from-pages] Raw response for ${type} (first 500 chars):`, rawResponse.slice(0, 500))
    throw new Error(`Claude returned un-parseable JSON for ${type}. Raw response starts with: ${rawResponse.slice(0, 120)}…`)
  }

  // Lenient validation: line_items is the one hard requirement. Missing
  // company_name or periods are recoverable (analyst can edit later).
  const lineItems = Array.isArray(parsed.line_items) ? parsed.line_items : null
  if (!lineItems) {
    console.error(`[extract-from-pages] Missing line_items for ${type}. Keys:`, Object.keys(parsed))
    console.error(`[extract-from-pages] Raw response for ${type} (first 500 chars):`, rawResponse.slice(0, 500))
    throw new Error(`Claude response for ${type} has no line_items array. Keys returned: ${Object.keys(parsed).join(', ')}`)
  }

  return {
    company_name: typeof parsed.company_name === 'string' && parsed.company_name.trim() ? parsed.company_name : '',
    closing_date: typeof parsed.closing_date === 'string' ? parsed.closing_date.trim() : '',
    periods: Array.isArray(parsed.periods) ? parsed.periods.map((p: unknown) => String(p)) : [],
    line_items: lineItems,
  }
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

    // Per-upload tag so all log lines for a single extraction can be grepped
    // together in Vercel even when several runs are interleaved.
    const traceId = Math.random().toString(36).slice(2, 10)
    console.info(
      `[extract-from-pages][${traceId}] start institution=${institution_type} ` +
        `pages_total=${totalPages} selections=` +
        JSON.stringify(validSelections)
    )

    // Extract in parallel per statement type — partial success tolerated
    const extractionPromises = Object.entries(validSelections).map(
      async ([type, pages]): Promise<ExtractedStatement & { company_name: string }> => {
        // Build sub-PDF containing only the selected pages
        const subDoc = await PDFDocument.create()
        const pageIndices = pages.map((p) => p - 1) // 1-indexed → 0-indexed
        const copiedPages = await subDoc.copyPages(sourceDoc, pageIndices)
        copiedPages.forEach((p) => subDoc.addPage(p))
        const subBytes = await subDoc.save()
        const subBase64 = Buffer.from(subBytes).toString('base64')

        const subSizeKB = Math.round(subBytes.byteLength / 1024)
        console.info(
          `[extract-from-pages][${traceId}] ${type} → sub-PDF ` +
            `pages=[${pages.join(',')}] size=${subSizeKB}KB`
        )

        const t0 = Date.now()
        const result = await extractOneStatement(subBase64, type as StatementType, institution_type)
        const elapsedMs = Date.now() - t0

        // Resolve any relative period labels ("exercice N-1", "N", …) using
        // the closing date Claude read off the form. This eliminates the class
        // of bugs where the same column reads as a literal label on one
        // extraction and as a real date on another, then fails to merge.
        const resolution = resolveRelativePeriods(result.periods, result.closing_date)

        console.info(
          `[extract-from-pages][${traceId}] ${type} ← Claude ` +
            `lines=${result.line_items.length} ` +
            `closing_date="${result.closing_date}" ` +
            `periods_raw=${JSON.stringify(result.periods)} ` +
            `periods_resolved=${JSON.stringify(resolution.resolved)} ` +
            `unresolved=${resolution.hasUnresolved} ` +
            `company="${result.company_name}" ` +
            `elapsed=${elapsedMs}ms`
        )

        return {
          statement_type: type as StatementType,
          periods: resolution.resolved,
          line_items: result.line_items,
          company_name: result.company_name,
        }
      }
    )

    const settled = await Promise.allSettled(extractionPromises)
    const results: Array<ExtractedStatement & { company_name: string }> = []
    const failures: Array<{ statement_type: string; error: string }> = []

    for (let i = 0; i < settled.length; i++) {
      const type = Object.keys(validSelections)[i]
      const outcome = settled[i]
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value)
      } else {
        const errMsg = outcome.reason?.message ?? String(outcome.reason)
        console.error(`[extract-from-pages][${traceId}] ${type} FAILED: ${errMsg}`)
        failures.push({
          statement_type: type,
          error: errMsg,
        })
      }
    }

    console.info(
      `[extract-from-pages][${traceId}] done ok=${results.length} failed=${failures.length}`
    )

    // If everything failed, surface as 500 with full detail
    if (results.length === 0) {
      return NextResponse.json(
        {
          error: 'All extractions failed',
          failures,
        },
        { status: 500 }
      )
    }

    // Use the most common company_name across successful extractions
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
      warnings: failures.length > 0 ? failures : undefined,
      summary: {
        company: companyName,
        total_statements: results.length,
        failed_statements: failures.length,
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
