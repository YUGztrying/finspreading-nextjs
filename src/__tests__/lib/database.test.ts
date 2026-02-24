/**
 * Tests for src/lib/statements/database.ts
 *
 * We test mergeStatements indirectly through saveFinancialStatement,
 * and exercise the private helpers via their observable outputs.
 */

import { saveFinancialStatement, ProcessedData } from '@/lib/statements/database'

// ─── Mock Supabase service client ────────────────────────────────────────────
const mockInsert = jest.fn()
const mockUpdate = jest.fn()
const mockSelect = jest.fn()
const mockEq = jest.fn()
const mockLimit = jest.fn()
const mockSingle = jest.fn()

const selectChain = { eq: mockEq }
const eqChain = { eq: mockEq, limit: mockLimit, order: jest.fn().mockReturnValue({ eq: mockEq }) }

mockEq.mockReturnValue(eqChain)
mockLimit.mockReturnValue(eqChain)
mockSelect.mockReturnValue(selectChain)
mockInsert.mockReturnValue({ select: jest.fn().mockReturnValue({ single: mockSingle }) })
mockUpdate.mockReturnValue({ eq: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: mockSingle }) }) })

const mockFrom = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: jest.fn(() => ({ from: mockFrom })),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeProcessedData(overrides: Partial<ProcessedData> = {}): ProcessedData {
  return {
    company_name: 'Test Bank',
    type_institution: 'banque',
    statement_type: 'actifs',
    periods: ['2023-12-31'],
    line_items: [{ poste: 'ACTIF_CASH', description: 'Cash', amounts: [100_000], is_total: false, is_subtotal: false, indent_level: 0, flags: [] }],
    source_file: 'test.pdf',
    ...overrides,
  }
}

function setupFreshInsert() {
  // First call: select existing → empty
  mockFrom.mockImplementationOnce(() => ({
    select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }) }),
  }))
  // Second call: insert → success
  mockFrom.mockImplementationOnce(() => ({
    insert: () => ({
      select: () => ({
        single: () => Promise.resolve({ data: { id: 'new-stmt-id' }, error: null }),
      }),
    }),
  }))
}

function setupMergeUpdate(existingStatement: Record<string, any>) {
  // First call: select existing → returns one statement
  mockFrom.mockImplementationOnce(() => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          eq: () => ({
            limit: () => Promise.resolve({ data: [existingStatement], error: null }),
          }),
        }),
      }),
    }),
  }))
  // Second call: update → success
  mockFrom.mockImplementationOnce(() => ({
    update: () => ({
      eq: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: existingStatement.id }, error: null }),
        }),
      }),
    }),
  }))
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('saveFinancialStatement', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('when no existing statement exists (INSERT path)', () => {
    it('returns success=true with new statement_id', async () => {
      setupFreshInsert()
      const result = await saveFinancialStatement(makeProcessedData(), 'user-1')
      expect(result.success).toBe(true)
      expect(result.statement_id).toBe('new-stmt-id')
    })

    it('returns success=false on insert error', async () => {
      mockFrom.mockImplementationOnce(() => ({
        select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }) }),
      }))
      mockFrom.mockImplementationOnce(() => ({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'unique constraint violation' } }),
          }),
        }),
      }))
      const result = await saveFinancialStatement(makeProcessedData(), 'user-1')
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/unique constraint/)
    })
  })

  describe('when existing statement exists (MERGE + UPDATE path)', () => {
    const existingStatement = {
      id: 'existing-id',
      periods: ['2022-12-31'],
      line_items: [{ poste: 'ACTIF_CASH', description: 'Cash', amounts: [80_000], is_total: false, is_subtotal: false, indent_level: 0, flags: [] }],
      source_files: ['old.pdf'],
    }

    it('returns success=true with existing statement_id', async () => {
      setupMergeUpdate(existingStatement)
      const result = await saveFinancialStatement(makeProcessedData(), 'user-1')
      expect(result.success).toBe(true)
      expect(result.statement_id).toBe('existing-id')
    })

    it('returns success=false on update error', async () => {
      mockFrom.mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => Promise.resolve({ data: [existingStatement], error: null }),
              }),
            }),
          }),
        }),
      }))
      mockFrom.mockImplementationOnce(() => ({
        update: () => ({
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: null, error: { message: 'update failed' } }),
            }),
          }),
        }),
      }))
      const result = await saveFinancialStatement(makeProcessedData(), 'user-1')
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/update failed/)
    })

    it('merges periods from existing and incoming statements', async () => {
      // Existing has 2022, incoming has 2023 — merged should have both
      const capturedUpdates: any[] = []
      mockFrom.mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => Promise.resolve({ data: [existingStatement], error: null }),
              }),
            }),
          }),
        }),
      }))
      mockFrom.mockImplementationOnce(() => ({
        update: (payload: any) => {
          capturedUpdates.push(payload)
          return {
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { id: existingStatement.id }, error: null }),
              }),
            }),
          }
        },
      }))

      await saveFinancialStatement(makeProcessedData({ periods: ['2023-12-31'] }), 'user-1')

      expect(capturedUpdates[0].periods).toContain('2022-12-31')
      expect(capturedUpdates[0].periods).toContain('2023-12-31')
    })
  })

  describe('error handling', () => {
    it('returns success=false when DB fetch throws', async () => {
      mockFrom.mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => Promise.resolve({ data: null, error: { message: 'connection timeout' } }),
              }),
            }),
          }),
        }),
      }))
      const result = await saveFinancialStatement(makeProcessedData(), 'user-1')
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/connection timeout/)
    })
  })
})
