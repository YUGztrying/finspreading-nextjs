// src/app/api/statements/irp-export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

export async function POST(request: NextRequest) {
  try {
    const { company_name, institution_type, periods, balance_sheet, income_statement } = await request.json()


    // Create workbook
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'FinSpreading - IRP Report'
    workbook.created = new Date()

    // Create single sheet
    const sheet = workbook.addWorksheet('IRP Report')

    const formatType = institution_type === 'bank' ? 'BANQUE' : 'MICROFINANCE'
    let currentRow = 1

    // ========================================
    // HEADER SECTION
    // ========================================
    sheet.getCell(`A${currentRow}`).value = `IRP REPORT - ${formatType} FORMAT`
    sheet.getCell(`A${currentRow}`).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
    sheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
    currentRow++

    sheet.getCell(`A${currentRow}`).value = `Company: ${company_name}`
    sheet.getCell(`A${currentRow}`).font = { bold: true }
    currentRow++

    sheet.getCell(`A${currentRow}`).value = `Generated: ${new Date().toLocaleString('en-US')}`
    sheet.getCell(`A${currentRow}`).font = { italic: true, size: 10 }
    currentRow += 2

    // ========================================
    // REPORTING PERIODS
    // ========================================
    sheet.getCell(`A${currentRow}`).value = 'REPORTING PERIODS:'
    sheet.getCell(`A${currentRow}`).font = { bold: true }
    currentRow++

    const periodRow = ['']
    for (const period of periods) {
      const date = new Date(period)
      periodRow.push(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }))
    }
    sheet.getRow(currentRow).values = periodRow
    currentRow += 2

    // ========================================
    // BALANCE SHEET - ASSETS
    // ========================================
    sheet.getCell(`A${currentRow}`).value = '=== ASSETS ==='
    sheet.getCell(`A${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
    sheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
    currentRow++

    // Column headers
    const headerRow = ['Description', ...periods.map((p: string) => {
      const date = new Date(p)
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    })]
    sheet.getRow(currentRow).values = headerRow
    sheet.getRow(currentRow).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet.getRow(currentRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } }
    currentRow++

    // Assets data
    if (balance_sheet?.assets) {
      for (const row of balance_sheet.assets) {
        const rowData = [row.title, ...row.values.map((v: number) => Math.round(v))]
        sheet.getRow(currentRow).values = rowData
        
        if (row.title.includes('Total')) {
          sheet.getRow(currentRow).font = { bold: true }
          sheet.getRow(currentRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
        }
        currentRow++
      }
    }
    currentRow++

    // ========================================
    // BALANCE SHEET - LIABILITIES
    // ========================================
    sheet.getCell(`A${currentRow}`).value = '=== LIABILITIES & EQUITY ==='
    sheet.getCell(`A${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
    sheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
    currentRow++

    // Column headers
    sheet.getRow(currentRow).values = headerRow
    sheet.getRow(currentRow).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet.getRow(currentRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } }
    currentRow++

    // Liabilities data
    if (balance_sheet?.liabilities) {
      for (const row of balance_sheet.liabilities) {
        const rowData = [row.title, ...row.values.map((v: number) => Math.round(v))]
        sheet.getRow(currentRow).values = rowData
        
        if (row.title.includes('Total') || row.title.includes('Equity')) {
          sheet.getRow(currentRow).font = { bold: true }
          sheet.getRow(currentRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
        }
        currentRow++
      }
    }
    currentRow++

    // ========================================
    // INCOME STATEMENT
    // ========================================
    if (income_statement && income_statement.length > 0) {
      sheet.getCell(`A${currentRow}`).value = '=== INCOME STATEMENT ==='
      sheet.getCell(`A${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
      sheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9333EA' } }
      currentRow++

      // Column headers
      sheet.getRow(currentRow).values = headerRow
      sheet.getRow(currentRow).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      sheet.getRow(currentRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } }
      currentRow++

      // Income data
      for (const row of income_statement) {
        const rowData = [row.title, ...row.values.map((v: number) => Math.round(v))]
        sheet.getRow(currentRow).values = rowData
        
        if (row.title.includes('Total') || row.title.includes('Income') || row.title.includes('Profit')) {
          sheet.getRow(currentRow).font = { bold: true }
          sheet.getRow(currentRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
        }
        currentRow++
      }
    }

    // ========================================
    // FORMAT COLUMNS
    // ========================================
    sheet.getColumn(1).width = 50
    for (let i = 2; i <= periods.length + 1; i++) {
      sheet.getColumn(i).width = 18
      sheet.getColumn(i).numFmt = '#,##0'
      sheet.getColumn(i).alignment = { horizontal: 'right' }
    }

    // Generate Excel file buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // Create filename
    const sanitizedCompanyName = company_name.replace(/[^a-z0-9]/gi, '_')
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `IRP_${sanitizedCompanyName}_${timestamp}.xlsx`


    // Return Excel file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    )
  }
}