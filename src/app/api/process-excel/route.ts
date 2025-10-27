// src/app/api/process-excel/route.ts
// API Route to process Excel files
// Note: Route is protected by middleware, so user is always authenticated

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

// --- CLEANING MODULE (ported from Base44) ---

function normalizeHeaders(columns: any[]): string[] {
  return columns.map((col, i) => {
    if (!col || String(col).toUpperCase().includes("EMPTY") || String(col) === "END_COL") {
      return `Unnamed_${i}`
    }

    let c = String(col).trim().toLowerCase()

    // PRIORITY: Identify NET column for spreading
    if (c.includes("net") && !c.includes("internet") && !c.includes("network")) {
      return "Montant_Net"
    }

    // Map common headers to standardized names
    if (c.includes("code") && c.includes("poste")) return "Code_Poste"
    if (c === "code" || c === "n°" || c === "no") return "Code_Poste"
    if (c.includes("actif") || c.includes("passif") || c.includes("description") 
        || c.includes("produits") || c.includes("charges")) return "Description"
    if (c.includes("brut")) return "Montant_Brut"
    if (c.includes("amort") || c.includes("prov")) return "Amort_Prov"

    return col // Return original if no mapping found
  })
}

function sanitizeRow(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  
  for (const key in row) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      let value = row[key]

      if (key === "Code_Poste") {
        out[key] = value != null ? String(value).trim() : ""
      } else if (key === "Description") {
        let str = value != null ? String(value).trim() : ""
        // Don't allow a "description" that only contains numbers, dots, commas, etc.
        if (/^[\d.,\s()-]+$/.test(str) && str.length > 0) {
          out[key] = ""
        } else {
          out[key] = str
        }
      } else {
        out[key] = value
      }
    }
  }
  return out
}

function cleanTable(rawTable: any[]): any[] {
  if (!rawTable || rawTable.length === 0) return []

  const originalHeaders = Object.keys(rawTable[0] || {})
  const normalizedHeaders = normalizeHeaders(originalHeaders)

  const headerMap = new Map<string, string>()
  originalHeaders.forEach((originalH, idx) => {
    headerMap.set(originalH, normalizedHeaders[idx])
  })

  return rawTable.map(rawRow => {
    let normalizedRow: Record<string, any> = {}
    for (const originalKey in rawRow) {
      if (Object.prototype.hasOwnProperty.call(rawRow, originalKey)) {
        const normalizedKey = headerMap.get(originalKey)
        if (normalizedKey) {
          normalizedRow[normalizedKey] = rawRow[originalKey]
        }
      }
    }
    return sanitizeRow(normalizedRow)
  })
}

// Deduce statement type based on sheet name
function deduceCandidateStateType(sheetName: string): string {
  const name = sheetName.toLowerCase()
  if (name.includes('actif')) return 'actifs'
  if (name.includes('passif')) return 'passifs'
  if (name.includes('hors') && name.includes('bilan')) return 'hors_bilan'
  if (name.includes('cr_') || name.includes('produit') || name.includes('charge') || name.includes('resultat')) {
    return 'compte_resultats'
  }
  if (name.includes('identifiant') || name.includes('guide')) return 'metadata'
  return 'unknown'
}

// --- END CLEANING MODULE ---

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { file_url } = body

    if (!file_url) {
      return NextResponse.json(
        { error: 'file_url is required' },
        { status: 400 }
      )
    }

    console.log('📊 Processing Excel file:', file_url)

    // Fetch file from URL
    const response = await fetch(file_url)
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'buffer' })

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('No sheets found in the Excel file')
    }

    const cleanedTables: any[] = []

    for (const sheetName of workbook.SheetNames) {
      console.log(`\n🔄 Processing sheet: ${sheetName}`)

      try {
        const worksheet = workbook.Sheets[sheetName]
        if (!worksheet) {
          console.log(`⚠️ Sheet ${sheetName} is empty or could not be read`)
          continue
        }

        // Extract raw data
        const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: null })

        if (rawData && rawData.length > 0) {
          // Apply cleaning module
          const cleanedData = cleanTable(rawData)

          if (cleanedData.length > 0) {
            const candidateType = deduceCandidateStateType(sheetName)

            // VALIDATION: Ensure there's a Montant_Net column for financial statements
            const hasNetColumn = Object.keys(cleanedData[0]).includes('Montant_Net')
            
            if (['actifs', 'passifs', 'compte_resultats', 'hors_bilan'].includes(candidateType) && !hasNetColumn) {
              console.warn(
                `⚠️ WARNING: No NET column detected for sheet "${sheetName}" (type: ${candidateType})`
              )
            }

            cleanedTables.push({
              sheet: sheetName,
              rows: cleanedData,
              meta: {
                raw_sheet_name: sheetName,
                candidate_state_type: candidateType,
                row_count: cleanedData.length,
                column_count: Object.keys(cleanedData[0]).length,
                has_net_column: hasNetColumn
              }
            })
            
            console.log(
              `✅ Cleaned table for ${sheetName}: ${cleanedData.length} rows. ` +
              `Type: ${candidateType}. NET column: ${hasNetColumn ? 'Detected' : 'Not Detected'}`
            )
          }
        } else {
          console.log(`⚠️ No data could be extracted from sheet ${sheetName}`)
        }

      } catch (sheetError) {
        console.error(`Error processing sheet ${sheetName}:`, sheetError)
      }
    }

    console.log(`\n🎯 FINAL RESULT: ${cleanedTables.length} cleaned tables detected`)

    if (cleanedTables.length === 0) {
      throw new Error(
        `Aucun tableau structuré n'a pu être détecté. Le fichier pourrait être vide, ` +
        `corrompu, ou son format non pris en charge.`
      )
    }

    return NextResponse.json({
      success: true,
      cleaned_tables: cleanedTables,
      summary: {
        totalSheets: workbook.SheetNames.length,
        totalTables: cleanedTables.length,
        tablesByType: cleanedTables.reduce((acc, table) => {
          const type = table.meta.candidate_state_type
          acc[type] = (acc[type] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        netColumnDetection: `${cleanedTables.filter(t => t.meta.has_net_column).length} ` +
          `sur ${cleanedTables.length} tables ont une colonne "Montant_Net" détectée.`
      }
    })

  } catch (error: any) {
    console.error('❌ Excel processing error:', error)
    return NextResponse.json(
      {
        error: error.message,
        details: `Error occurred while processing Excel file.`
      },
      { status: 500 }
    )
  }
}