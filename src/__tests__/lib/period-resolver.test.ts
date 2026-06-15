// src/__tests__/lib/period-resolver.test.ts
import {
  parseClosingDate,
  parseRelativeOffset,
  isAbsoluteDate,
  resolveRelativePeriods,
  normalizeClosingDate,
} from '@/lib/normalization/period-resolver'

describe('normalizeClosingDate', () => {
  it('canonicalizes assorted formats to YYYY-MM-DD', () => {
    expect(normalizeClosingDate('31/12/2024')).toBe('2024-12-31')
    expect(normalizeClosingDate('2024-12-31')).toBe('2024-12-31')
    expect(normalizeClosingDate('31|12|2024')).toBe('2024-12-31')
  })

  it('returns null for unparseable / empty', () => {
    expect(normalizeClosingDate('')).toBeNull()
    expect(normalizeClosingDate(null)).toBeNull()
    expect(normalizeClosingDate('exercice N')).toBeNull()
  })
})

describe('parseClosingDate', () => {
  it('accepts ISO YYYY-MM-DD', () => {
    expect(parseClosingDate('2023-12-31')?.getUTCFullYear()).toBe(2023)
  })

  it('accepts French DD/MM/YYYY', () => {
    expect(parseClosingDate('31/12/2023')?.getUTCFullYear()).toBe(2023)
    expect(parseClosingDate('31/12/2023')?.getUTCMonth()).toBe(11) // 0-indexed Dec
    expect(parseClosingDate('31/12/2023')?.getUTCDate()).toBe(31)
  })

  it('accepts DD-MM-YYYY and DD.MM.YYYY', () => {
    expect(parseClosingDate('31-12-2023')?.getUTCFullYear()).toBe(2023)
    expect(parseClosingDate('31.12.2023')?.getUTCFullYear()).toBe(2023)
  })

  it('accepts BCEAO checkered "31|12|2023"', () => {
    expect(parseClosingDate('31|12|2023')?.getUTCFullYear()).toBe(2023)
    expect(parseClosingDate('31 | 12 | 2023')?.getUTCFullYear()).toBe(2023)
  })

  it('rejects nonsense and empty input', () => {
    expect(parseClosingDate(null)).toBeNull()
    expect(parseClosingDate(undefined)).toBeNull()
    expect(parseClosingDate('')).toBeNull()
    expect(parseClosingDate('exercice N')).toBeNull()
    expect(parseClosingDate('foo bar')).toBeNull()
  })

  it('rejects out-of-range month / day', () => {
    expect(parseClosingDate('2023-13-01')).toBeNull()
    expect(parseClosingDate('2023-02-30')).toBeNull()
    expect(parseClosingDate('99/12/2023')).toBeNull()
  })
})

describe('parseRelativeOffset', () => {
  it('returns 0 for bare "N"', () => {
    expect(parseRelativeOffset('N')).toBe(0)
    expect(parseRelativeOffset('n')).toBe(0)
    expect(parseRelativeOffset('  N  ')).toBe(0)
  })

  it('returns -1 for "N-1" with assorted whitespace', () => {
    expect(parseRelativeOffset('N-1')).toBe(-1)
    expect(parseRelativeOffset('N - 1')).toBe(-1)
    expect(parseRelativeOffset('N -1')).toBe(-1)
  })

  it('returns -2 for "N-2"', () => {
    expect(parseRelativeOffset('N-2')).toBe(-2)
  })

  it('returns +1 for "N+1"', () => {
    expect(parseRelativeOffset('N+1')).toBe(1)
  })

  it('accepts French prefixes (exercice, année, période)', () => {
    expect(parseRelativeOffset('exercice N')).toBe(0)
    expect(parseRelativeOffset('Exercice N-1')).toBe(-1)
    expect(parseRelativeOffset('année N')).toBe(0)
    expect(parseRelativeOffset('annee N-1')).toBe(-1)
    expect(parseRelativeOffset('période N')).toBe(0)
    expect(parseRelativeOffset('periode N-1')).toBe(-1)
  })

  it('accepts English prefixes (year, exercise, fy)', () => {
    expect(parseRelativeOffset('year N')).toBe(0)
    expect(parseRelativeOffset('FY N-1')).toBe(-1)
    expect(parseRelativeOffset('exercise N+1')).toBe(1)
  })

  it('returns null for non-relative labels', () => {
    expect(parseRelativeOffset('2023-12-31')).toBeNull()
    expect(parseRelativeOffset('31/12/2023')).toBeNull()
    expect(parseRelativeOffset('Décembre 2023')).toBeNull()
    expect(parseRelativeOffset('')).toBeNull()
    expect(parseRelativeOffset('foo')).toBeNull()
    expect(parseRelativeOffset('Total')).toBeNull()
  })

  it('does not match labels that just happen to contain "n"', () => {
    expect(parseRelativeOffset('Nov 2023')).toBeNull()
    expect(parseRelativeOffset('Net')).toBeNull()
  })
})

describe('isAbsoluteDate', () => {
  it('recognizes absolute dates', () => {
    expect(isAbsoluteDate('2023-12-31')).toBe(true)
    expect(isAbsoluteDate('31/12/2023')).toBe(true)
  })

  it('rejects relative labels', () => {
    expect(isAbsoluteDate('exercice N-1')).toBe(false)
    expect(isAbsoluteDate('N')).toBe(false)
  })
})

describe('resolveRelativePeriods — happy path', () => {
  it('rewrites relative labels using closing date', () => {
    const r = resolveRelativePeriods(['exercice N-1', 'exercice N'], '2023-12-31')
    expect(r.resolved).toEqual(['2022-12-31', '2023-12-31'])
    expect(r.closingDateNormalized).toBe('2023-12-31')
    expect(r.changed).toBe(true)
    expect(r.hasUnresolved).toBe(false)
  })

  it('preserves existing absolute dates (and normalizes their format)', () => {
    const r = resolveRelativePeriods(['31/12/2022', '31/12/2023'], '2023-12-31')
    expect(r.resolved).toEqual(['2022-12-31', '2023-12-31'])
    expect(r.changed).toBe(true) // changed because format changed
    expect(r.hasUnresolved).toBe(false)
  })

  it('handles mixed relative + absolute', () => {
    const r = resolveRelativePeriods(['exercice N-1', '2023-12-31'], '2023-12-31')
    expect(r.resolved).toEqual(['2022-12-31', '2023-12-31'])
    expect(r.hasUnresolved).toBe(false)
  })

  it('reproduces the BBGCI FY2423 scenario from the logs', () => {
    // Real log line:
    //   actifs ← Claude periods=["exercice N-1","exercice N"] (FY2423, date=2024-12-31)
    // Expected after fix:
    //   periods → ["2023-12-31", "2024-12-31"]
    const r = resolveRelativePeriods(['exercice N-1', 'exercice N'], '2024-12-31')
    expect(r.resolved).toEqual(['2023-12-31', '2024-12-31'])
    expect(r.hasUnresolved).toBe(false)
  })

  it('uses 12-31 as the day even for relative labels', () => {
    const r = resolveRelativePeriods(['N-1'], '2023-06-30')
    // Day comes from the rule "fiscal year end", not the closing date itself.
    // For BCEAO bilan we always want YYYY-12-31; keep this invariant explicit.
    expect(r.resolved).toEqual(['2022-12-31'])
  })

  it('supports multi-year N-2 ranges', () => {
    const r = resolveRelativePeriods(['N-2', 'N-1', 'N'], '2024-12-31')
    expect(r.resolved).toEqual(['2022-12-31', '2023-12-31', '2024-12-31'])
  })
})

describe('resolveRelativePeriods — fallback paths', () => {
  it('keeps relative labels and flags unresolved when closing date is missing', () => {
    const r = resolveRelativePeriods(['exercice N-1', 'exercice N'], null)
    expect(r.resolved).toEqual(['exercice N-1', 'exercice N'])
    expect(r.closingDateNormalized).toBeNull()
    expect(r.hasUnresolved).toBe(true)
  })

  it('keeps relative labels when closing date is unparseable', () => {
    const r = resolveRelativePeriods(['exercice N-1', 'exercice N'], 'unknown')
    expect(r.resolved).toEqual(['exercice N-1', 'exercice N'])
    expect(r.hasUnresolved).toBe(true)
  })

  it('keeps unrecognized labels verbatim and flags hasUnresolved', () => {
    const r = resolveRelativePeriods(['Décembre 2023', 'exercice N'], '2023-12-31')
    expect(r.resolved[0]).toBe('Décembre 2023')
    expect(r.resolved[1]).toBe('2023-12-31')
    expect(r.hasUnresolved).toBe(true)
  })

  it('changed=false when nothing needed rewriting', () => {
    const r = resolveRelativePeriods(['2022-12-31', '2023-12-31'], '2023-12-31')
    expect(r.changed).toBe(false)
    expect(r.hasUnresolved).toBe(false)
  })

  it('handles empty periods array', () => {
    const r = resolveRelativePeriods([], '2023-12-31')
    expect(r.resolved).toEqual([])
    expect(r.changed).toBe(false)
    expect(r.hasUnresolved).toBe(false)
  })
})

describe('resolveRelativePeriods — merge integrity (regression for the BBGCI bug)', () => {
  it('produces stable string keys so DB merges work across two PDFs', () => {
    // PDF #1 FY2322 → closingDate "2023-12-31", periods ["exercice N-1","exercice N"]
    const a = resolveRelativePeriods(['exercice N-1', 'exercice N'], '2023-12-31')
    // PDF #2 FY2423 → closingDate "2024-12-31", periods ["exercice N-1","exercice N"]
    const b = resolveRelativePeriods(['exercice N-1', 'exercice N'], '2024-12-31')

    // After resolution, the OVERLAP year ("2023-12-31") must be byte-identical
    // so the database merge sees it as the same key.
    expect(a.resolved).toEqual(['2022-12-31', '2023-12-31'])
    expect(b.resolved).toEqual(['2023-12-31', '2024-12-31'])

    // The union (what mergeStatements would produce) is exactly 3 periods.
    const union = Array.from(new Set([...a.resolved, ...b.resolved])).sort()
    expect(union).toEqual(['2022-12-31', '2023-12-31', '2024-12-31'])
  })
})
