/**
 * Tests for POST /api/statements/irp-report
 * (the IRP Excel export endpoint)
 *
 * Strategy: mock ExcelJS so we don't generate real files.
 * Test that the route validates input, builds correct sheet sections,
 * and returns an xlsx response.
 */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/statements/irp-report/route'

// ─── Mock auth guard ──────────────────────────────────────────────────────────
jest.mock('@/lib/auth/require-user', () => ({
  requireUser: jest.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'analyst@ifc.org' },
    supabase: {},
    response: null,
  }),
}))

// ─── Mock ExcelJS ─────────────────────────────────────────────────────────────
const mockWriteBuffer = jest.fn().mockResolvedValue(Buffer.from('fake-excel-content'))
const mockAddWorksheet = jest.fn().mockReturnValue({
  getCell: jest.fn().mockReturnValue({ value: null, font: {}, fill: {}, alignment: {} }),
  getRow: jest.fn().mockReturnValue({ values: [], font: {}, fill: {} }),
  getColumn: jest.fn().mockReturnValue({ width: 0, numFmt: '', alignment: {} }),
})

jest.mock('exceljs', () => ({
  Workbook: jest.fn().mockImplementation(() => ({
    creator: '',
    created: null,
    addWorksheet: mockAddWorksheet,
    xlsx: { writeBuffer: mockWriteBuffer },
  })),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildRequest(body: unknown) {
  return new NextRequest('http://localhost/api/statements/irp-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validPayload = {
  company_name: 'Test MFI',
  institution_type: 'microfinance',
  periods: ['2022-12-31', '2023-12-31'],
  balance_sheet: {
    assets: [
      { title: 'Cash', values: [100_000, 120_000] },
      { title: 'Total Assets', values: [500_000, 600_000] },
    ],
    liabilities: [
      { title: 'Deposits', values: [300_000, 350_000] },
      { title: 'Total Equity', values: [200_000, 250_000] },
    ],
  },
  income_statement: [
    { title: 'Interest Income', values: [80_000, 90_000] },
    { title: 'Total Income', values: [80_000, 90_000] },
  ],
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('POST /api/statements/irp-report', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockWriteBuffer.mockResolvedValue(Buffer.from('fake-excel-content'))
    mockAddWorksheet.mockReturnValue({
      getCell: jest.fn().mockReturnValue({ value: null, font: {}, fill: {}, alignment: {} }),
      getRow: jest.fn().mockReturnValue({ values: [], font: {}, fill: {} }),
      getColumn: jest.fn().mockReturnValue({ width: 0, numFmt: '', alignment: {} }),
    })
  })

  it('returns xlsx response with correct Content-Type', async () => {
    const req = buildRequest(validPayload)
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
  })

  it('returns Content-Disposition attachment header with company name', async () => {
    const req = buildRequest(validPayload)
    const res = await POST(req)
    const disposition = res.headers.get('Content-Disposition') ?? ''
    expect(disposition).toContain('attachment')
    expect(disposition).toContain('Test_MFI')
    expect(disposition).toContain('.xlsx')
  })

  it('sanitises company name in filename (replaces non-alphanumeric chars)', async () => {
    const req = buildRequest({ ...validPayload, company_name: 'Banque & Finance SA!' })
    const res = await POST(req)
    const disposition = res.headers.get('Content-Disposition') ?? ''
    // Should not contain '&' or '!'
    expect(disposition).not.toMatch(/[&!]/)
    expect(disposition).toContain('.xlsx')
  })

  it('creates a worksheet named "IRP Report"', async () => {
    const req = buildRequest(validPayload)
    await POST(req)
    expect(mockAddWorksheet).toHaveBeenCalledWith('IRP Report')
  })

  it('handles missing balance_sheet gracefully (no crash)', async () => {
    const payload = { ...validPayload, balance_sheet: null }
    const req = buildRequest(payload)
    const res = await POST(req)
    // Should still succeed — sections are guarded with if checks
    expect(res.status).toBe(200)
  })

  it('handles missing income_statement gracefully', async () => {
    const payload = { ...validPayload, income_statement: null }
    const req = buildRequest(payload)
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('handles empty income_statement array gracefully', async () => {
    const payload = { ...validPayload, income_statement: [] }
    const req = buildRequest(payload)
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('returns 500 when ExcelJS writeBuffer throws', async () => {
    mockWriteBuffer.mockRejectedValueOnce(new Error('ExcelJS failure'))
    const req = buildRequest(validPayload)
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/ExcelJS failure/)
  })

  it('includes current date in the filename', async () => {
    const req = buildRequest(validPayload)
    const res = await POST(req)
    const disposition = res.headers.get('Content-Disposition') ?? ''
    const today = new Date().toISOString().split('T')[0]
    expect(disposition).toContain(today)
  })

  it('calls xlsx.writeBuffer to produce the file buffer', async () => {
    const req = buildRequest(validPayload)
    await POST(req)
    expect(mockWriteBuffer).toHaveBeenCalledTimes(1)
  })
})
