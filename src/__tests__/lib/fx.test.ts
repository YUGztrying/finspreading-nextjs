import {
  validateFxRate,
  validateFxRates,
  checkFxCompleteness,
  buildFxMap,
  convertToUsd,
  type PeriodFxRate,
} from '@/lib/irm/fx'

describe('validateFxRate', () => {
  it('accepts a fully populated, positive-rate entry', () => {
    const result = validateFxRate({
      period: '2023-12-31',
      fx_eop: 600,
      fx_avg: 590,
      source: 'IFC FX library, 2023',
    })
    expect(result.valid).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('accepts a draft entry with null rates', () => {
    const result = validateFxRate({
      period: '2023-12-31',
      fx_eop: null,
      fx_avg: null,
    })
    expect(result.valid).toBe(true)
  })

  it('rejects missing period', () => {
    const result = validateFxRate({ period: '', fx_eop: 600, fx_avg: 590 })
    expect(result.valid).toBe(false)
    expect(result.issues[0].field).toBe('period')
  })

  it('rejects zero and negative rates', () => {
    expect(
      validateFxRate({ period: '2023', fx_eop: 0, fx_avg: 590 }).valid
    ).toBe(false)
    expect(
      validateFxRate({ period: '2023', fx_eop: 600, fx_avg: -1 }).valid
    ).toBe(false)
  })

  it('rejects non-finite rates', () => {
    const result = validateFxRate({
      period: '2023',
      fx_eop: Number.NaN,
      fx_avg: Number.POSITIVE_INFINITY,
    })
    expect(result.valid).toBe(false)
    expect(result.issues).toHaveLength(2)
  })

  it('flags non-number rate values', () => {
    const result = validateFxRate({
      period: '2023',
      // @ts-expect-error — deliberately wrong type
      fx_eop: '600',
      fx_avg: 590,
    })
    expect(result.valid).toBe(false)
    expect(result.issues[0].field).toBe('fx_eop')
  })
})

describe('validateFxRates', () => {
  it('accepts a well-formed batch', () => {
    const result = validateFxRates([
      { period: '2022-12-31', fx_eop: 600, fx_avg: 595 },
      { period: '2023-12-31', fx_eop: 610, fx_avg: 605 },
    ])
    expect(result.valid).toBe(true)
  })

  it('flags duplicate period keys', () => {
    const result = validateFxRates([
      { period: '2023-12-31', fx_eop: 600, fx_avg: 595 },
      { period: '2023-12-31', fx_eop: 610, fx_avg: 605 },
    ])
    expect(result.valid).toBe(false)
    expect(
      result.issues.some((i) => i.message.includes('Duplicate'))
    ).toBe(true)
  })

  it('aggregates issues across entries', () => {
    const result = validateFxRates([
      { period: '', fx_eop: 600, fx_avg: 595 },
      { period: '2023', fx_eop: -1, fx_avg: 0 },
    ])
    expect(result.valid).toBe(false)
    expect(result.issues.length).toBeGreaterThanOrEqual(3)
  })
})

describe('checkFxCompleteness', () => {
  const rates: PeriodFxRate[] = [
    { period: '2022-12-31', fx_eop: 600, fx_avg: 595 },
    { period: '2023-12-31', fx_eop: 610, fx_avg: null },
  ]

  it('is complete when every expected period has both rates populated', () => {
    const result = checkFxCompleteness(['2022-12-31'], rates)
    expect(result.complete).toBe(true)
    expect(result.missingPeriods).toEqual([])
    expect(result.missingEop).toEqual([])
    expect(result.missingAvg).toEqual([])
  })

  it('reports periods with a missing avg rate', () => {
    const result = checkFxCompleteness(['2023-12-31'], rates)
    expect(result.complete).toBe(false)
    expect(result.missingAvg).toEqual(['2023-12-31'])
    expect(result.missingEop).toEqual([])
  })

  it('reports periods entirely absent from the rate set', () => {
    const result = checkFxCompleteness(['2024-12-31'], rates)
    expect(result.complete).toBe(false)
    expect(result.missingPeriods).toEqual(['2024-12-31'])
    expect(result.missingEop).toEqual(['2024-12-31'])
    expect(result.missingAvg).toEqual(['2024-12-31'])
  })

  it('treats zero and negative rates as missing', () => {
    const result = checkFxCompleteness(['2022-12-31'], [
      { period: '2022-12-31', fx_eop: 0, fx_avg: -5 },
    ])
    expect(result.complete).toBe(false)
    expect(result.missingEop).toEqual(['2022-12-31'])
    expect(result.missingAvg).toEqual(['2022-12-31'])
  })

  it('is trivially complete when no periods are expected', () => {
    expect(checkFxCompleteness([], rates).complete).toBe(true)
  })
})

describe('buildFxMap', () => {
  it('keys entries by period', () => {
    const map = buildFxMap([
      { period: '2022-12-31', fx_eop: 600, fx_avg: 595 },
      { period: '2023-12-31', fx_eop: 610, fx_avg: 605 },
    ])
    expect(map.size).toBe(2)
    expect(map.get('2023-12-31')?.fx_eop).toBe(610)
  })

  it('skips entries with a blank period', () => {
    const map = buildFxMap([
      { period: '', fx_eop: 600, fx_avg: 595 },
      { period: '2023-12-31', fx_eop: 610, fx_avg: 605 },
    ])
    expect(map.size).toBe(1)
  })
})

describe('convertToUsd', () => {
  const rate: PeriodFxRate = {
    period: '2023-12-31',
    fx_eop: 600,
    fx_avg: 590,
  }

  it('uses fx_eop for stock items', () => {
    expect(convertToUsd(1_200_000, rate, 'stock')).toBeCloseTo(2000, 6)
  })

  it('uses fx_avg for flow items', () => {
    expect(convertToUsd(1_180_000, rate, 'flow')).toBeCloseTo(2000, 6)
  })

  it('applies the unit divisor', () => {
    // Report values in millions → divisor 1,000,000
    expect(convertToUsd(1_200_000_000_000, rate, 'stock', 1_000_000)).toBeCloseTo(
      2000,
      6
    )
  })

  it('returns null when the rate is missing', () => {
    expect(convertToUsd(1000, null, 'stock')).toBeNull()
    expect(convertToUsd(1000, undefined, 'flow')).toBeNull()
  })

  it('returns null when the required side of the rate is missing', () => {
    const partial: PeriodFxRate = {
      period: '2023-12-31',
      fx_eop: 600,
      fx_avg: null,
    }
    expect(convertToUsd(1000, partial, 'flow')).toBeNull()
    expect(convertToUsd(1000, partial, 'stock')).not.toBeNull()
  })

  it('returns null for non-finite values or bad divisors', () => {
    expect(convertToUsd(Number.NaN, rate, 'stock')).toBeNull()
    expect(convertToUsd(1000, rate, 'stock', 0)).toBeNull()
    expect(convertToUsd(1000, rate, 'stock', -1)).toBeNull()
  })
})
