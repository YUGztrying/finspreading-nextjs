import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'
import {
  assetsStructureMicrofinance,
  liabilitiesStructureMicrofinance,
  assetsStructureBank,
  liabilitiesStructureBank,
  incomeStatementStructureMicrofinance,
  incomeStatementStructureBank,
} from '@/lib/irp/structures'
import { calculateAllLines } from '@/lib/irp/calculator'
import { extractFinancialData, getAllPeriods } from '@/lib/camels/field-mapper'
import { runFullAnalysis } from '@/lib/camels/calculator'
import { LineItem } from '@/types/database.types'

// ─── colours ─────────────────────────────────────────────────────────────────
const C = {
  amber:      'FFD97706',
  white:      'FFFFFFFF',
  blue:       'FF2563EB',
  purple:     'FF9333EA',
  stone100:   'FFF5F5F4',
  stone200:   'FFE7E5E4',
  amberLight: 'FFFEF3C7',
  red:        'FFEF4444',
  emerald:    'FF10B981',
  sky:        'FF0EA5E9',
  orange:     'FFF97316',
  grey:       'FF6B7280',
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function styleHeader(row: ExcelJS.Row, bgColor: string) {
  row.font = { bold: true, color: { argb: C.white } }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
  row.alignment = { vertical: 'middle', horizontal: 'left' }
  row.height = 22
}

function styleSubheader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: C.blue } }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }
  row.height = 18
}

function styleTotal(row: ExcelJS.Row) {
  row.font = { bold: true }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.amberLight } }
}

function fmtPeriod(p: string) {
  const d = new Date(p)
  return `FY${String(d.getFullYear()).slice(-2)}`
}

// ─── Colour for CAMELS rating ─────────────────────────────────────────────────
function ratingColor(r: number | null): string {
  if (r == null) return C.grey
  if (r <= 1.5) return C.emerald
  if (r <= 2.5) return 'FF84CC16' // lime
  if (r <= 3.5) return C.amber
  if (r <= 4.5) return C.orange
  return C.red
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { company_name, user_id } = await request.json()

    if (!company_name || !user_id) {
      return NextResponse.json(
        { error: 'company_name and user_id are required' },
        { status: 400 }
      )
    }

    console.log(`📊 Exporting statements for company: ${company_name}`)

    const supabase = createServiceClient() as any

    // Fetch all statements for this company
    const { data: statements, error } = await supabase
      .from('financial_statements')
      .select('*')
      .eq('user_id', user_id)
      .eq('company_name', company_name)
      .order('statement_type', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!statements || statements.length === 0) {
      return NextResponse.json(
        { error: 'No statements found for this company' },
        { status: 404 }
      )
    }

    console.log(`✅ Found ${statements.length} statements`)

    const institutionType: string = statements[0].type_institution ?? 'microfinance'
    const isBank = institutionType === 'banque'

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'FinSpreading'
    workbook.created = new Date()

    // ─────────────────────────────────────────────────────────────────────────
    // 1. RAW STATEMENT SHEETS
    // ─────────────────────────────────────────────────────────────────────────
    const sheetNames: Record<string, string> = {
      actifs: 'ACTIFS',
      passifs: 'PASSIFS',
      compte_resultats: 'COMPTE DE RESULTATS',
      hors_bilan: 'HORS BILAN',
    }

    for (const statement of statements) {
      const sheetName = sheetNames[statement.statement_type] || statement.statement_type.toUpperCase()
      const worksheet = workbook.addWorksheet(sheetName)
      const periods = [...statement.periods].sort()

      const headers = ['Code Poste', 'Description', ...periods]
      worksheet.addRow(headers)

      const headerRow = worksheet.getRow(1)
      styleHeader(headerRow, C.amber)

      for (const lineItem of statement.line_items) {
        worksheet.addRow([
          lineItem.poste,
          lineItem.description,
          ...lineItem.amounts.map((a: number) => a || 0),
        ])
      }

      worksheet.columns.forEach((col, i) => {
        col.width = i === 0 ? 15 : i === 1 ? 50 : 20
      })
      for (let i = 3; i <= headers.length; i++) {
        worksheet.getColumn(i).numFmt = '#,##0'
      }
      worksheet.eachRow(row => {
        row.eachCell(cell => {
          cell.border = {
            top:    { style: 'thin', color: { argb: C.stone200 } },
            left:   { style: 'thin', color: { argb: C.stone200 } },
            bottom: { style: 'thin', color: { argb: C.stone200 } },
            right:  { style: 'thin', color: { argb: C.stone200 } },
          }
        })
      })
      worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
      console.log(`✅ Sheet: ${sheetName}`)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. IRP REPORT SHEET
    // ─────────────────────────────────────────────────────────────────────────
    const actifs  = statements.find((s: any) => s.statement_type === 'actifs')
    const passifs = statements.find((s: any) => s.statement_type === 'passifs')
    const cr      = statements.find((s: any) => s.statement_type === 'compte_resultats')

    // Collect all unique periods sorted
    const allPeriodsSet = new Set<string>()
    for (const s of statements) s.periods?.forEach((p: string) => allPeriodsSet.add(p))
    const allPeriods = [...allPeriodsSet].sort()

    const assetsStructure      = isBank ? assetsStructureBank       : assetsStructureMicrofinance
    const liabilitiesStructure = isBank ? liabilitiesStructureBank  : liabilitiesStructureMicrofinance
    const incomeStructure      = isBank ? incomeStatementStructureBank : incomeStatementStructureMicrofinance

    const calcAssets      = calculateAllLines(assetsStructure,      actifs?.line_items  || [], allPeriods.length)
    const calcLiabilities = calculateAllLines(liabilitiesStructure, passifs?.line_items || [], allPeriods.length)
    const calcIncome      = calculateAllLines(incomeStructure,      cr?.line_items      || [], allPeriods.length)

    const irpSheet = workbook.addWorksheet('IRP REPORT')

    // Title row
    const irpTitle = irpSheet.addRow([`IRP REPORT — ${institutionType.toUpperCase()} FORMAT`])
    styleHeader(irpTitle, C.blue)
    irpSheet.mergeCells(`A1:${String.fromCharCode(65 + allPeriods.length)}1`)
    irpTitle.height = 28
    irpTitle.font = { bold: true, size: 13, color: { argb: C.white } }

    irpSheet.addRow([`Company: ${company_name}`, ...allPeriods.map(fmtPeriod)])
    irpSheet.getRow(2).font = { bold: true }
    irpSheet.addRow([])

    const periodHeader = ['Description', ...allPeriods.map(p => {
      const d = new Date(p)
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    })]

    // Helper to write an IRP section
    function writeIRPSection(
      structure: typeof assetsStructure,
      calcMap: Map<string, number[]>,
      sectionLabel: string,
      headerBg: string
    ) {
      // Section title
      const secRow = irpSheet.addRow([sectionLabel])
      styleHeader(secRow, headerBg)
      irpSheet.mergeCells(`A${secRow.number}:${String.fromCharCode(65 + allPeriods.length)}${secRow.number}`)
      secRow.height = 22

      // Column header
      const colHead = irpSheet.addRow(periodHeader)
      styleHeader(colHead, C.amber)

      for (const item of structure) {
        if (item.type === 'header') {
          const r = irpSheet.addRow([item.title])
          styleHeader(r, C.blue)
          irpSheet.mergeCells(`A${r.number}:${String.fromCharCode(65 + allPeriods.length)}${r.number}`)
          continue
        }
        if (item.type === 'subheader') {
          const r = irpSheet.addRow([item.title])
          styleSubheader(r)
          irpSheet.mergeCells(`A${r.number}:${String.fromCharCode(65 + allPeriods.length)}${r.number}`)
          continue
        }
        const vals = calcMap.get(item.title) || Array(allPeriods.length).fill(0)
        const r = irpSheet.addRow([item.title, ...vals.map(v => Math.round(v))])
        if (item.isTotal || item.type === 'finalTotal' || item.type === 'majorTotal') {
          styleTotal(r)
        }
      }
      irpSheet.addRow([])
    }

    writeIRPSection(assetsStructure,      calcAssets,      '=== ASSETS ===',              C.blue)
    writeIRPSection(liabilitiesStructure, calcLiabilities, '=== LIABILITIES & EQUITY ===', C.blue)
    if (cr) {
      writeIRPSection(incomeStructure, calcIncome, '=== INCOME STATEMENT ===', C.purple)
    }

    // Column widths
    irpSheet.getColumn(1).width = 52
    for (let i = 2; i <= allPeriods.length + 1; i++) {
      irpSheet.getColumn(i).width = 18
      irpSheet.getColumn(i).numFmt = '#,##0'
      irpSheet.getColumn(i).alignment = { horizontal: 'right' }
    }
    irpSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }]
    console.log('✅ Sheet: IRP REPORT')

    // ─────────────────────────────────────────────────────────────────────────
    // 3. CAMELS SHEET
    // ─────────────────────────────────────────────────────────────────────────
    const stmtsByType: Record<string, { line_items: LineItem[]; periods: string[] }> = {}
    for (const stmt of statements) {
      stmtsByType[stmt.statement_type] = {
        line_items: stmt.line_items as LineItem[],
        periods: stmt.periods as string[],
      }
    }

    const camPeriods = getAllPeriods(stmtsByType)

    if (camPeriods.length > 0) {
      const camSheet = workbook.addWorksheet('CAMELS')

      const camResults: Array<{
        period: string
        data: ReturnType<typeof extractFinancialData>
        analysis: ReturnType<typeof runFullAnalysis>
      }> = []

      let prevData: ReturnType<typeof extractFinancialData> | null = null
      for (const p of camPeriods) {
        const data = extractFinancialData(stmtsByType, p, institutionType as 'banque' | 'microfinance')
        const analysis = runFullAnalysis(data, prevData)
        camResults.push({ period: p, data, analysis })
        prevData = data
      }

      const camLabels = camPeriods.map(fmtPeriod)

      // ── Title ──
      const ct = camSheet.addRow([`CAMELS ANALYSIS — ${company_name}`])
      styleHeader(ct, C.blue)
      camSheet.mergeCells(`A1:${String.fromCharCode(65 + camPeriods.length)}1`)
      ct.height = 28
      ct.font = { bold: true, size: 13, color: { argb: C.white } }
      camSheet.addRow(['Institution type:', institutionType])
      camSheet.addRow([])

      // ── Composite + component ratings ──
      const ratingsTitle = camSheet.addRow(['CAMELS RATINGS'])
      styleHeader(ratingsTitle, C.amber)
      camSheet.mergeCells(`A${ratingsTitle.number}:${String.fromCharCode(65 + camPeriods.length)}${ratingsTitle.number}`)

      const colHdr = camSheet.addRow(['Component', ...camLabels, 'Latest'])
      styleHeader(colHdr, C.stone100)
      colHdr.font = { bold: true, color: { argb: '44403C' } }

      const ratingComponents: Array<{ label: string; key: string; bold?: boolean }> = [
        { label: 'Capital (C)',       key: 'capital'       },
        { label: 'Asset Quality (A)', key: 'asset_quality' },
        { label: 'Management (M)',    key: 'management'    },
        { label: 'Earnings (E)',      key: 'earnings'      },
        { label: 'Liquidity (L)',     key: 'liquidity'     },
        { label: 'COMPOSITE',         key: 'composite',    bold: true },
      ]

      for (const comp of ratingComponents) {
        const vals = camResults.map(r => {
          const rat = r.analysis.ratings[comp.key]
          return (rat as any)?.rating ?? (rat as any)?.composite_rating ?? null
        })
        const latestVal = vals[vals.length - 1]
        const r = camSheet.addRow([comp.label, ...vals, latestVal])
        if (comp.bold) styleTotal(r)

        // Colour each rating cell
        vals.forEach((v, i) => {
          const cell = r.getCell(i + 2)
          if (v != null) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ratingColor(v) } }
            cell.font = { bold: true, color: { argb: C.white } }
          }
          cell.alignment = { horizontal: 'center' }
        })
        const lc = r.getCell(vals.length + 2)
        if (latestVal != null) {
          lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ratingColor(latestVal) } }
          lc.font = { bold: true, color: { argb: C.white } }
        }
        lc.alignment = { horizontal: 'center' }
      }
      camSheet.addRow([])

      // ── Key ratios ──
      const ratioGroups = [
        {
          title: 'SOLVENCY',
          color: C.red,
          rows: [
            { label: 'Equity / Assets',  key: 'equity_assets',   fmt: 'pct' },
            { label: 'Debt / Assets',    key: 'debt_assets',     fmt: 'pct' },
          ],
        },
        {
          title: 'ASSET QUALITY',
          color: C.amber,
          rows: [
            { label: 'NPL Ratio',        key: 'npl_ratio',        fmt: 'pct' },
            { label: 'Coverage Ratio',   key: 'coverage_ratio',   fmt: 'pct' },
          ],
        },
        {
          title: 'PROFITABILITY',
          color: C.emerald,
          rows: [
            { label: 'ROAA',                  key: 'roaa',            fmt: 'pct' },
            { label: 'ROAE',                  key: 'roae',            fmt: 'pct' },
            { label: 'Net Interest Margin',   key: 'net_interest_margin', fmt: 'pct' },
            { label: 'Cost-to-Income',        key: 'cost_to_income',  fmt: 'pct' },
          ],
        },
        {
          title: 'LIQUIDITY',
          color: C.sky,
          rows: [
            { label: 'Gross Loans / Deposits',         key: 'gross_loans_deposits',          fmt: 'pct' },
            { label: 'Liquid Assets / Total Assets',   key: 'liquid_assets_total_assets',    fmt: 'pct' },
          ],
        },
      ]

      for (const group of ratioGroups) {
        const gt = camSheet.addRow([group.title])
        styleHeader(gt, group.color)
        camSheet.mergeCells(`A${gt.number}:${String.fromCharCode(65 + camPeriods.length + 1)}${gt.number}`)

        const gh = camSheet.addRow(['Ratio', ...camLabels])
        styleHeader(gh, C.stone100)
        gh.font = { bold: true, color: { argb: '44403C' } }

        for (const row of group.rows) {
          const vals = camResults.map(r => r.analysis.ratios[row.key as keyof typeof r.analysis.ratios] ?? null)
          const r = camSheet.addRow([row.label, ...vals])
          // Format as percentage
          for (let i = 2; i <= camPeriods.length + 1; i++) {
            camSheet.getRow(r.number).getCell(i).numFmt = '0.0%'
          }
        }
        camSheet.addRow([])
      }

      // ── Financial summary ──
      const fsTitle = camSheet.addRow(['FINANCIAL SUMMARY'])
      styleHeader(fsTitle, C.blue)
      camSheet.mergeCells(`A${fsTitle.number}:${String.fromCharCode(65 + camPeriods.length + 1)}${fsTitle.number}`)

      const bsTitle = camSheet.addRow(['Balance Sheet', ...camLabels])
      styleHeader(bsTitle, C.stone100)
      bsTitle.font = { bold: true, color: { argb: '44403C' } }

      const bsKeys = [
        { label: 'Total Assets',          key: 'total_assets',          bold: true  },
        { label: 'Gross Loans',           key: 'gross_loans',           bold: false },
        { label: 'Customer Deposits',     key: 'total_deposits',        bold: false },
        { label: "Shareholders' Equity",  key: 'total_equity',          bold: true  },
        { label: 'Loan Loss Provisions',  key: 'loan_loss_provisions',  bold: false },
      ]
      for (const k of bsKeys) {
        const vals = camResults.map(r => r.data[k.key as keyof typeof r.data] ?? 0)
        const r = camSheet.addRow([k.label, ...vals])
        if (k.bold) styleTotal(r)
        for (let i = 2; i <= camPeriods.length + 1; i++) {
          camSheet.getRow(r.number).getCell(i).numFmt = '#,##0'
        }
      }
      camSheet.addRow([])

      const isTitle = camSheet.addRow(['Income Statement', ...camLabels])
      styleHeader(isTitle, C.stone100)
      isTitle.font = { bold: true, color: { argb: '44403C' } }

      const isKeys = [
        { label: 'Net Interest Income', key: 'net_interest_income', bold: false },
        { label: 'Non-Interest Income', key: 'non_interest_income', bold: false },
        { label: 'Operating Expenses',  key: 'operating_expenses',  bold: false },
        { label: 'Cost of Risk',        key: 'provision_expenses',  bold: false },
        { label: 'Net Profit',          key: 'net_income',          bold: true  },
      ]
      for (const k of isKeys) {
        const vals = camResults.map(r => r.data[k.key as keyof typeof r.data] ?? 0)
        const r = camSheet.addRow([k.label, ...vals])
        if (k.bold) styleTotal(r)
        for (let i = 2; i <= camPeriods.length + 1; i++) {
          camSheet.getRow(r.number).getCell(i).numFmt = '#,##0'
        }
      }

      // Column widths
      camSheet.getColumn(1).width = 38
      for (let i = 2; i <= camPeriods.length + 2; i++) {
        camSheet.getColumn(i).width = 14
        camSheet.getColumn(i).alignment = { horizontal: 'right' }
      }
      camSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }]
      console.log('✅ Sheet: CAMELS')
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. METADATA
    // ─────────────────────────────────────────────────────────────────────────
    const metaSheet = workbook.addWorksheet('METADATA')
    metaSheet.addRow(['Company Name',          company_name])
    metaSheet.addRow(['Institution Type',      institutionType])
    metaSheet.addRow(['Export Date',           new Date().toISOString()])
    metaSheet.addRow(['Number of Statements',  statements.length])
    metaSheet.addRow(['Sheets',                'Raw Spreads · IRP Report · CAMELS · Metadata'])
    metaSheet.addRow(['Exported By',           'FinSpreading'])
    metaSheet.getColumn(1).width = 25
    metaSheet.getColumn(2).width = 55
    metaSheet.getColumn(1).font = { bold: true }

    // ─────────────────────────────────────────────────────────────────────────
    // Generate file
    // ─────────────────────────────────────────────────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer()
    const sanitizedName = company_name.replace(/[^a-z0-9]/gi, '_')
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `${sanitizedName}_${timestamp}.xlsx`

    console.log(`✅ Export complete: ${filename}`)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
