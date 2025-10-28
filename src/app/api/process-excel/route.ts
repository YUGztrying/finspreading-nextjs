// src/app/api/process-excel/route.ts
// API Route to process Excel files
// Updated: Removed normalization (now done in save route automatically)

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { saveFinancialStatement } from '@/lib/statements/database'
import { LineItem } from '@/types/database.types'

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
    // Handle "CODE POSTE" with space
    if (c.includes("code") && c.includes("poste")) return "Code_Poste"
    if (c.includes("code poste")) return "Code_Poste"
    if (c === "code" || c === "n°" || c === "no") return "Code_Poste"
    
    // Microfinance-specific: ACTIF, PASSIF, CHARGES, PRODUITS columns are descriptions
    if (c === "actif" || c === "passif" || c === "charges" || c === "produits") return "Description"
    
    // Generic description detection
    if (c.includes("actif") || c.includes("passif") || c.includes("description") 
        || c.includes("produits") || c.includes("charges")) return "Description"
    
    // Amount columns
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
  
  // Microfinance: Charges and Produits are both part of compte_resultats
  if (name.includes('charges') || name.includes('charge')) return 'compte_resultats'
  if (name.includes('produits') || name.includes('produit')) return 'compte_resultats'
  
  // Generic patterns
  if (name.includes('cr_') || name.includes('resultat')) return 'compte_resultats'
  if (name.includes('identifiant') || name.includes('guide')) return 'metadata'
  
  return 'unknown'
}

// Convert cleaned table to LineItem format
function convertToLineItems(cleanedData: any[], institutionType: string = 'banque'): LineItem[] {
  return cleanedData.map(row => {
    // Extract amounts from row
    const amounts: number[] = []
    
    // 🔹 MICROFINANCE: Only use NET amount
    if (institutionType === 'microfinance') {
      // Priority: Montant_Net column
      if (row.Montant_Net !== undefined && row.Montant_Net !== null) {
        const value = row.Montant_Net
        amounts.push(typeof value === 'number' ? value : parseFloat(value) || 0)
      } else if (row.Net !== undefined && row.Net !== null) {
        const value = row.Net
        amounts.push(typeof value === 'number' ? value : parseFloat(value) || 0)
      } else {
        // Fallback: Find first numeric column that looks like a net amount
        for (const key in row) {
          if (key !== 'Code_Poste' && key !== 'Description' && !key.startsWith('Unnamed_')) {
            const colName = key.toLowerCase()
            if (colName.includes('net') || colName.includes('montant')) {
              const value = row[key]
              amounts.push(typeof value === 'number' ? value : parseFloat(value) || 0)
              break
            }
          }
        }
      }
      
      // If still no amount found, use last numeric column
      if (amounts.length === 0) {
        const keys = Object.keys(row)
        for (let i = keys.length - 1; i >= 0; i--) {
          const key = keys[i]
          if (key !== 'Code_Poste' && key !== 'Description' && !key.startsWith('Unnamed_')) {
            const value = row[key]
            if (typeof value === 'number' || !isNaN(parseFloat(value))) {
              amounts.push(typeof value === 'number' ? value : parseFloat(value) || 0)
              break
            }
          }
        }
      }
    } else {
      // 🔹 BANKS: Use all amount columns (original logic)
      const amountColumns = ['Montant_Net', 'Montant_Brut', 'Amort_Prov']
      
      for (const key of amountColumns) {
        if (row[key] !== undefined && row[key] !== null) {
          const value = row[key]
          if (typeof value === 'number') {
            amounts.push(value)
          } else if (value && !isNaN(parseFloat(value))) {
            amounts.push(parseFloat(value))
          } else {
            amounts.push(0)
          }
        }
      }
      
      // If no amounts found in standard columns, try all numeric columns
      if (amounts.length === 0) {
        for (const key in row) {
          if (key !== 'Code_Poste' && key !== 'Description' && !key.startsWith('Unnamed_')) {
            const value = row[key]
            if (typeof value === 'number') {
              amounts.push(value)
            } else if (value && !isNaN(parseFloat(value))) {
              amounts.push(parseFloat(value))
            }
          }
        }
      }
    }

    return {
      poste: row.Code_Poste || '',
      description: row.Description || '',
      amounts,
      is_subtotal: false,
      is_total: false,
      indent_level: 0,
      manual: false,
      flags: []
    }
  })
}

// Extract periods from headers (look for years or dates)
function extractPeriods(headers: string[]): string[] {
  const periods: string[] = []
  
  for (const header of headers) {
    // Try to find year (4 digits)
    const yearMatch = header.match(/\b(20\d{2})\b/)
    if (yearMatch) {
      periods.push(`${yearMatch[1]}-12-31`) // Assume December 31
    }
  }

  // If no periods found, return empty array
  return periods.length > 0 ? periods : []
}

export async function POST(request: NextRequest) {
  console.log('🚀 ===== PROCESS EXCEL ROUTE CALLED =====')
  
  try {
    const body = await request.json()
    const { file_url, institution_type = 'banque', user_id, company_name } = body

    console.log('📥 Request body:', { file_url, institution_type, user_id, company_name })

    if (!file_url) {
      console.log('❌ Missing file_url')
      return NextResponse.json(
        { error: 'file_url is required' },
        { status: 400 }
      )
    }

    if (!user_id) {
      console.log('❌ Missing user_id')
      return NextResponse.json(
        { error: 'user_id is required' },
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
    const savedStatements: string[] = []

    for (const sheetName of workbook.SheetNames) {
      console.log(`\n🔄 Processing sheet: ${sheetName}`)

      try {
        const worksheet = workbook.Sheets[sheetName]
        if (!worksheet) {
          console.log(`⚠️ Sheet ${sheetName} is empty or could not be read`)
          continue
        }

        // Extract raw data including all rows
        const rawDataFull = XLSX.utils.sheet_to_json(worksheet, { defval: null, header: 1 }) as any[][]

        console.log(`📋 Sheet ${sheetName}: ${rawDataFull.length} total rows detected`)

        if (!rawDataFull || rawDataFull.length === 0) {
          console.log(`⚠️ No data in sheet ${sheetName}`)
          continue
        }

        // 🔹 FIND THE HEADER ROW (look for "CODE POSTE" or similar)
        let headerRowIndex = -1
        for (let i = 0; i < Math.min(10, rawDataFull.length); i++) {
          const row = rawDataFull[i]
          if (row && row.length > 0) {
            const firstCell = String(row[0] || '').toUpperCase()
            if (firstCell.includes('CODE') && (firstCell.includes('POSTE') || firstCell === 'CODE POSTE')) {
              headerRowIndex = i
              console.log(`🎯 Found header row at index ${i}:`, row)
              break
            }
          }
        }

        if (headerRowIndex === -1) {
          console.log(`⚠️ No header row found in sheet ${sheetName}`)
          continue
        }

        // Extract headers and data rows
        const headers = rawDataFull[headerRowIndex].map((h: any, i: number) => 
          h && String(h).trim() !== 'END_COL' ? String(h).trim() : `Unnamed_${i}`
        )
        
        const dataRows = rawDataFull.slice(headerRowIndex + 1)

        console.log(`📝 Headers:`, headers)
        console.log(`📋 Data rows: ${dataRows.length}`)

        // Convert to object format
        const rawData = dataRows
          .filter(row => row && row.some((cell: any) => cell != null)) // Filter empty rows
          .map(row => {
            const obj: Record<string, any> = {}
            headers.forEach((header, i) => {
              obj[header] = row[i] != null ? row[i] : null
            })
            return obj
          })

        console.log(`📋 After filtering: ${rawData.length} data rows`)
        
        if (rawData.length === 0) {
          console.log(`⚠️ No valid data rows in sheet ${sheetName}`)
          continue
        }

        // Apply cleaning module
        const cleanedData = cleanTable(rawData)

        if (cleanedData.length > 0) {
            const candidateType = deduceCandidateStateType(sheetName)

            // Skip metadata sheets
            if (candidateType === 'metadata' || candidateType === 'unknown') {
              console.log(`⏭️  Skipping non-financial sheet: ${sheetName}`)
              continue
            }

            // Convert to LineItems
            const lineItems = convertToLineItems(cleanedData, institution_type)

            // 🔍 DEBUG: Log first few line items with amounts
            console.log(`🔍 Sample line items (first 3):`)
            lineItems.slice(0, 3).forEach((item, i) => {
              console.log(`  [${i}] ${item.poste} - ${item.description}: amounts=[${item.amounts.join(', ')}]`)
            })

            // Extract periods from headers
            const originalHeaders = Object.keys(rawData[0] || {})
            let periods = extractPeriods(originalHeaders)

            // 🔹 MICROFINANCE FIX: Single period financial statements
            // If no periods detected and institution is microfinance, create a default period
            if (periods.length === 0 && institution_type === 'microfinance') {
              console.log(`📅 No periods detected for microfinance, extracting date from filename`)
              
              // Extract date from filename (formats: DD-MM-YYYY, YYYY-MM-DD, DDMMYYYY)
              const datePatterns = [
                /(\d{2})[-_](\d{2})[-_](\d{4})/,  // DD-MM-YYYY or DD_MM_YYYY
                /(\d{4})[-_](\d{2})[-_](\d{2})/,  // YYYY-MM-DD or YYYY_MM-DD
                /(\d{2})(\d{2})(\d{4})/,          // DDMMYYYY
              ]

              let extractedDate = null
              const filename = decodeURIComponent(file_url.split('/').pop()?.split('?')[0] || '')
              
              for (const pattern of datePatterns) {
                const match = filename.match(pattern)
                if (match) {
                  // Convert to YYYY-MM-DD format
                  if (match[3] && match[3].length === 4) { // DD-MM-YYYY or DDMMYYYY
                    const day = match[1]
                    const month = match[2]
                    const year = match[3]
                    if (parseInt(month) >= 1 && parseInt(month) <= 12 &&
                        parseInt(day) >= 1 && parseInt(day) <= 31) {
                      extractedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
                    }
                  } else if (match[1] && match[1].length === 4) { // YYYY-MM-DD
                    const year = match[1]
                    const month = match[2]
                    const day = match[3]
                    if (parseInt(month) >= 1 && parseInt(month) <= 12 &&
                        parseInt(day) >= 1 && parseInt(day) <= 31) {
                      extractedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
                    }
                  }
                  if (extractedDate) break
                }
              }
              
              // Fallback to current date
              if (!extractedDate) {
                extractedDate = new Date().toISOString().split('T')[0]
                console.log(`⚠️ No date found in filename, using current date`)
              }
              
              console.log(`📅 Extracted date: ${extractedDate} from filename: ${filename}`)
              
              // Parse the date
              const [year, month, day] = extractedDate.split('-').map(Number)
              
              // Store period as simple date string for easier frontend handling
              periods = [extractedDate]  // Just "2024-12-31"
              
              console.log(`📅 Created default period: ${extractedDate}`)
            }

            if (periods.length === 0) {
              console.warn(`⚠️ No periods detected in sheet ${sheetName}, skipping`)
              continue
            }

            // Save to database (normalization will be applied automatically in save route)
            console.log(`💾 Saving to database...`)
            const saveResult = await saveFinancialStatement(
              {
                company_name: company_name || 'Unknown Company',
                type_institution: institution_type,
                statement_type: candidateType as any,
                periods,
                line_items: lineItems,
                source_file: file_url
              },
              user_id
            )

            if (saveResult.success) {
              console.log(`✅ Saved ${candidateType} successfully:`, saveResult.statement_id)
              savedStatements.push(saveResult.statement_id!)
            } else {
              console.error(`❌ Failed to save ${candidateType}:`, saveResult.error)
            }

            cleanedTables.push({
              sheet: sheetName,
              statement_type: candidateType,
              rows: lineItems.length,
              periods: periods.length,
              saved: saveResult.success,
              statement_id: saveResult.statement_id
            })
        } else {
          console.log(`⚠️ No data could be extracted from sheet ${sheetName}`)
        }

      } catch (sheetError) {
        console.error(`Error processing sheet ${sheetName}:`, sheetError)
      }
    }

    console.log(`\n🎯 FINAL RESULT: ${cleanedTables.length} statements processed, ${savedStatements.length} saved`)

    if (cleanedTables.length === 0) {
      throw new Error(
        `Aucun tableau structuré n'a pu être détecté. Le fichier pourrait être vide, ` +
        `corrompu, ou son format non pris en charge.`
      )
    }

    return NextResponse.json({
      success: true,
      cleaned_tables: cleanedTables,
      saved_statements: savedStatements,
      summary: {
        totalSheets: workbook.SheetNames.length,
        totalTables: cleanedTables.length,
        totalSaved: savedStatements.length,
        tablesByType: cleanedTables.reduce((acc, table) => {
          const type = table.statement_type
          acc[type] = (acc[type] || 0) + 1
          return acc
        }, {} as Record<string, number>)
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