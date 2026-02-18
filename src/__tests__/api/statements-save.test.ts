/**
 * Tests for POST /api/statements/save
 *
 * Strategy: mock saveFinancialStatement and normalizeFinancialLines so
 * we can test the route's validation and orchestration logic in isolation.
 */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/statements/save/route'

// ─── Mocks ───────────────────────────────────────────────────────────────────
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  })),
}))

const mockSaveFinancialStatement = jest.fn()
jest.mock('@/lib/statements/database', () => ({
  saveFinancialStatement: (...args: any[]) => mockSaveFinancialStatement(...args),
}))

const mockNormalize = jest.fn()
jest.mock('@/lib/normalization/normalize', () => ({
  normalizeFinancialLines: (...args: any[]) => mockNormalize(...args),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildRequest(body: unknown) {
  return new NextRequest('http://localhost/api/statements/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validStatementData = {
  company_name: 'Test MFI',
  statement_type: 'actifs',
  type_institution: 'microfinance',
  periods: ['2023-12-31'],
  line_items: [{ poste: 'MFA_CASH', description: 'Cash', amounts: [100_000] }],
  source_file: 'test.pdf',
}

const normalizeResult = {
  normalizedLines: validStatementData.line_items,
  unmappedLines: [],
  stats: { total: 1, mapped: 1, unmapped: 0, totals: 0, subtotals: 0 },
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('POST /api/statements/save', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockNormalize.mockReturnValue(normalizeResult)
    mockSaveFinancialStatement.mockResolvedValue({ success: true, statement_id: 'stmt-1' })
  })

  it('returns 400 when body is missing statementData', async () => {
    const req = buildRequest({ user_id: 'user-1' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/required/)
  })

  it('returns 400 when user_id is missing', async () => {
    const req = buildRequest({ data: validStatementData })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when company_name is missing', async () => {
    const req = buildRequest({
      data: { ...validStatementData, company_name: '' },
      user_id: 'user-1',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/company_name/)
  })

  it('returns 400 when statement_type is missing', async () => {
    const req = buildRequest({
      data: { ...validStatementData, statement_type: '' },
      user_id: 'user-1',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('saves successfully and returns statement_id and normalization stats', async () => {
    const req = buildRequest({ data: validStatementData, user_id: 'user-1' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.statement_id).toBe('stmt-1')
    expect(body.normalization_stats).toEqual(normalizeResult.stats)
    expect(body.unmapped_lines).toBe(0)
  })

  it('calls normalizeFinancialLines with the correct institution and statement type', async () => {
    const req = buildRequest({ data: validStatementData, user_id: 'user-1' })
    await POST(req)
    expect(mockNormalize).toHaveBeenCalledWith(
      validStatementData.line_items,
      expect.objectContaining({
        institutionType: 'microfinance',
        statementType: 'actifs',
      })
    )
  })

  it('defaults institutionType to "banque" when missing', async () => {
    const dataWithoutType = { ...validStatementData, type_institution: undefined }
    const req = buildRequest({ data: dataWithoutType, user_id: 'user-1' })
    await POST(req)
    expect(mockNormalize).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ institutionType: 'banque' })
    )
  })

  it('returns 500 when saveFinancialStatement returns success=false', async () => {
    mockSaveFinancialStatement.mockResolvedValue({ success: false, error: 'DB error' })
    const req = buildRequest({ data: validStatementData, user_id: 'user-1' })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/DB error/)
  })

  it('returns 500 when saveFinancialStatement throws', async () => {
    mockSaveFinancialStatement.mockRejectedValue(new Error('Unexpected failure'))
    const req = buildRequest({ data: validStatementData, user_id: 'user-1' })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })

  it('passes normalized lines (not raw lines) to saveFinancialStatement', async () => {
    const normalizedLine = { poste: 'MFA_CASH_NORMALIZED', description: 'Cash', amounts: [100_000] }
    mockNormalize.mockReturnValue({ ...normalizeResult, normalizedLines: [normalizedLine] })
    const req = buildRequest({ data: validStatementData, user_id: 'user-1' })
    await POST(req)
    const callArg = mockSaveFinancialStatement.mock.calls[0][0]
    expect(callArg.line_items).toEqual([normalizedLine])
  })
})
