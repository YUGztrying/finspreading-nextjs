/**
 * Tests for GET /api/statements/list
 *
 * Strategy: mock createServiceClient so no real DB calls happen.
 */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/statements/list/route'

// ─── Mock Supabase service client ────────────────────────────────────────────
// queryChain is a "thenable" builder that resolves when awaited.
// This lets the route do conditional .eq() calls AFTER .order() without breaking.
let _pendingResult: { data: any[] | null; error: any } = { data: [], error: null }

const mockEq = jest.fn()
const mockOrder = jest.fn()
const mockSelect = jest.fn()

const queryChain: any = {
  select: mockSelect,
  eq: mockEq,
  order: mockOrder,
  then(onFulfilled: (v: any) => any, onRejected?: (e: any) => any) {
    return Promise.resolve(_pendingResult).then(onFulfilled, onRejected)
  },
}
mockSelect.mockReturnValue(queryChain)
mockEq.mockReturnValue(queryChain)
mockOrder.mockReturnValue(queryChain)

const mockFrom = jest.fn().mockReturnValue(queryChain)

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: jest.fn(() => ({ from: mockFrom })),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/api/statements/list')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url)
}

function resolveChain(data: any[] | null, error: any = null) {
  _pendingResult = { data, error }
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('GET /api/statements/list', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    _pendingResult = { data: [], error: null }
    mockSelect.mockReturnValue(queryChain)
    mockEq.mockReturnValue(queryChain)
    mockOrder.mockReturnValue(queryChain)
  })

  it('returns 400 when user_id is missing', async () => {
    const req = buildRequest({})
    const res = await GET(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/user_id/)
  })

  it('returns statements and companies on success', async () => {
    resolveChain([
      { id: '1', company_name: 'Acme Bank', statement_type: 'actifs' },
      { id: '2', company_name: 'Acme Bank', statement_type: 'passifs' },
    ])

    const req = buildRequest({ user_id: 'user-123' })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.statements).toHaveLength(2)
    expect(body.companies).toEqual(['Acme Bank'])
    expect(body.count).toBe(2)
  })

  it('returns an empty list when no statements found', async () => {
    resolveChain([])
    const req = buildRequest({ user_id: 'user-123' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.statements).toEqual([])
    expect(body.count).toBe(0)
  })

  it('applies company_name filter when provided', async () => {
    resolveChain([])
    const req = buildRequest({ user_id: 'user-123', company_name: 'Acme Bank' })
    await GET(req)
    // .eq should have been called with 'company_name'
    const eqCalls = mockEq.mock.calls
    expect(eqCalls.some(([col]: [string]) => col === 'company_name')).toBe(true)
  })

  it('applies statement_type filter when provided', async () => {
    resolveChain([])
    const req = buildRequest({ user_id: 'user-123', statement_type: 'actifs' })
    await GET(req)
    const eqCalls = mockEq.mock.calls
    expect(eqCalls.some(([col]: [string]) => col === 'statement_type')).toBe(true)
  })

  it('returns 500 when database query fails', async () => {
    resolveChain(null, { message: 'DB unavailable' })
    const req = buildRequest({ user_id: 'user-123' })
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/DB unavailable/)
  })

  it('returns unique companies across multiple statements', async () => {
    resolveChain([
      { id: '1', company_name: 'Bank A', statement_type: 'actifs' },
      { id: '2', company_name: 'Bank B', statement_type: 'actifs' },
      { id: '3', company_name: 'Bank A', statement_type: 'passifs' },
    ])
    const req = buildRequest({ user_id: 'user-123' })
    const res = await GET(req)
    const body = await res.json()
    expect(body.companies).toHaveLength(2)
    expect(body.companies).toContain('Bank A')
    expect(body.companies).toContain('Bank B')
  })
})
