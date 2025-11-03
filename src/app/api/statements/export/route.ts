import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'

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
      console.error('Error fetching statements:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!statements || statements.length === 0) {
      return NextResponse.json(
        { error: 'No statements found for this company' },
        { status: 404 }
      )
    }

    console.log(`✅ Found ${statements.length} statements to export`)

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'FinSpreading'
    workbook.created = new Date()

    // Statement type mapping to sheet names
    const sheetNames: Record<string, string> = {
      actifs: 'ACTIFS',
      passifs: 'PASSIFS',
      compte_resultats: 'COMPTE DE RESULTATS',
      hors_bilan: 'HORS BILAN'
    }

    // Create a sheet for each statement type
    for (const statement of statements) {
      const sheetName = sheetNames[statement.statement_type] || statement.statement_type.toUpperCase()
      const worksheet = workbook.addWorksheet(sheetName)

      // Sort periods chronologically
      const periods = [...statement.periods].sort()

      // Create headers
      const headers = ['Code Poste', 'Description', ...periods]
      worksheet.addRow(headers)

      // Style header row
      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD97706' } // Amber color
      }
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
      headerRow.height = 25

      // Add data rows
      for (const lineItem of statement.line_items) {
        const row = [
          lineItem.poste,
          lineItem.description,
          ...lineItem.amounts.map((amount: number) => amount || 0)
        ]
        worksheet.addRow(row)
      }

      // Auto-fit columns
      worksheet.columns.forEach((column, index) => {
        if (index === 0) {
          column.width = 15 // Code Poste
        } else if (index === 1) {
          column.width = 50 // Description
        } else {
          column.width = 20 // Amounts
        }
      })

      // Format number columns
      for (let i = 3; i <= headers.length; i++) {
        worksheet.getColumn(i).numFmt = '#,##0'
      }

      // Add borders to all cells
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD4D4D4' } },
            left: { style: 'thin', color: { argb: 'FFD4D4D4' } },
            bottom: { style: 'thin', color: { argb: 'FFD4D4D4' } },
            right: { style: 'thin', color: { argb: 'FFD4D4D4' } }
          }
        })
      })

      // Freeze header row
      worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]

      console.log(`✅ Created sheet: ${sheetName} with ${statement.line_items.length} rows`)
    }

    // Add metadata sheet
    const metaSheet = workbook.addWorksheet('METADATA')
    metaSheet.addRow(['Company Name', company_name])
    metaSheet.addRow(['Institution Type', statements[0].type_institution])
    metaSheet.addRow(['Export Date', new Date().toISOString()])
    metaSheet.addRow(['Number of Statements', statements.length])
    metaSheet.addRow(['Exported By', 'FinSpreading'])
    
    metaSheet.getColumn(1).width = 25
    metaSheet.getColumn(2).width = 50
    metaSheet.getColumn(1).font = { bold: true }

    console.log(`✅ Added metadata sheet`)

    // Generate Excel file buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // Create filename
    const sanitizedCompanyName = company_name.replace(/[^a-z0-9]/gi, '_')
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `${sanitizedCompanyName}_${timestamp}.xlsx`

    console.log(`✅ Export complete: ${filename}`)

    // Return file as download
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