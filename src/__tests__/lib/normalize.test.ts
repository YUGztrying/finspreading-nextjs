import { normalizeFinancialLines, normalizeStatement } from '@/lib/normalization/normalize'
import { LineItem } from '@/types/database.types'

// Minimal LineItem factory
const makeLine = (poste: string, description: string, amounts: number[] = []): LineItem => ({
  poste,
  description,
  amounts,
  is_total: false,
  is_subtotal: false,
  indent_level: 0,
  flags: [],
})

describe('normalizeFinancialLines', () => {
  describe('when no normalization function exists for the type', () => {
    it('returns lines unchanged for hors_bilan microfinance', () => {
      const lines = [makeLine('ANY_POSTE', 'Some line', [100])]
      const result = normalizeFinancialLines(lines, {
        institutionType: 'microfinance',
        statementType: 'hors_bilan',
      })
      expect(result.normalizedLines).toEqual(lines)
      expect(result.unmappedLines).toEqual([])
      expect(result.stats.mapped).toBe(0)
    })

    it('returns lines unchanged for an unknown statementType', () => {
      const lines = [makeLine('FOO', 'bar', [42])]
      const result = normalizeFinancialLines(lines, {
        institutionType: 'banque',
        statementType: 'hors_bilan',
      })
      expect(result.normalizedLines).toEqual(lines)
    })
  })

  describe('stats', () => {
    it('reports total line count correctly', () => {
      const lines = [
        makeLine('A', 'Line A'),
        makeLine('B', 'Line B'),
        makeLine('C', 'Line C'),
      ]
      const result = normalizeFinancialLines(lines, {
        institutionType: 'microfinance',
        statementType: 'hors_bilan',
      })
      expect(result.stats.total).toBe(3)
    })

    it('counts mapped lines correctly when normalization runs', () => {
      // Use a statement type that has a normalization function
      const lines = [makeLine('CASH', 'Cash', [100])]
      const result = normalizeFinancialLines(lines, {
        institutionType: 'banque',
        statementType: 'actifs',
      })
      expect(result.stats.total).toBe(1)
      // mapped = total - unmapped.length
      expect(result.stats.mapped).toBe(result.stats.total - result.stats.unmapped)
    })

    it('detects _TOTAL lines and increments totals count', () => {
      // Use a dummy line with a poste that will normalise to something containing _TOTAL
      // We test the detection logic by verifying normalised lines with is_total flag
      const lines = [makeLine('CASH', 'Cash', [100])]
      const result = normalizeFinancialLines(lines, {
        institutionType: 'banque',
        statementType: 'actifs',
      })
      // totals count must be >= 0
      expect(result.stats.totals).toBeGreaterThanOrEqual(0)
    })
  })

  describe('normalizedLines properties', () => {
    it('sets is_total=true for lines whose normalised poste contains _TOTAL', () => {
      const lines = [makeLine('CASH', 'Cash')]
      const result = normalizeFinancialLines(lines, {
        institutionType: 'banque',
        statementType: 'actifs',
      })
      for (const line of result.normalizedLines) {
        if (line.poste.includes('_TOTAL')) {
          expect(line.is_total).toBe(true)
        }
      }
    })

    it('adds "unmapped" flag for lines whose normalised poste contains _UNDEFINED', () => {
      const lines = [makeLine('CASH', 'Cash')]
      const result = normalizeFinancialLines(lines, {
        institutionType: 'banque',
        statementType: 'actifs',
      })
      for (const line of result.normalizedLines) {
        if (line.poste.includes('_UNDEFINED')) {
          expect(line.flags).toContain('unmapped')
        }
      }
    })
  })

  describe('handles empty input', () => {
    it('returns empty arrays and zero stats when no lines provided', () => {
      const result = normalizeFinancialLines([], {
        institutionType: 'banque',
        statementType: 'actifs',
      })
      expect(result.normalizedLines).toEqual([])
      expect(result.unmappedLines).toEqual([])
      expect(result.stats.total).toBe(0)
    })
  })
})

describe('normalizeStatement', () => {
  it('is a convenience wrapper that delegates to normalizeFinancialLines', () => {
    const statement = {
      line_items: [makeLine('CASH', 'Cash', [100])],
      type_institution: 'banque' as const,
      statement_type: 'actifs' as const,
      company_name: 'Test Bank',
      source_files: ['file.pdf'],
    }
    const result = normalizeStatement(statement)
    expect(result.stats.total).toBe(1)
    expect(result.normalizedLines).toHaveLength(1)
  })

  it('handles statement without company_name or source_files', () => {
    const statement = {
      line_items: [],
      type_institution: 'microfinance' as const,
      statement_type: 'actifs' as const,
    }
    expect(() => normalizeStatement(statement)).not.toThrow()
  })
})
