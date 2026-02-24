import { calculateAllRatios, runFullAnalysis } from '@/lib/camels/calculator'
import { FinancialData } from '@/lib/camels/types'

// Minimal factory for a well-capitalised, profitable bank
function makeStatement(overrides: Partial<FinancialData> = {}): FinancialData {
  return {
    total_assets: 1_000_000_000,
    total_equity: 120_000_000,    // 12% equity/assets → rating 1
    gross_loans: 600_000_000,
    net_loans: 580_000_000,
    total_deposits: 700_000_000,
    total_liabilities: 880_000_000,
    cash_and_equivalents: 50_000_000,
    liquid_assets: 100_000_000,
    investment_securities: 200_000_000,
    fixed_assets: 30_000_000,
    short_term_borrowings: 80_000_000,
    long_term_debt: 100_000_000,
    subordinated_debt: 0,
    interest_income: 80_000_000,
    interest_expenses: 30_000_000,
    net_interest_income: 50_000_000,
    non_interest_income: 10_000_000,
    operating_income: 60_000_000,
    operating_expenses: 25_000_000,
    depreciation: 5_000_000,
    provision_expenses: 8_000_000,
    net_income: 22_000_000,
    taxes: 5_000_000,
    npls: 18_000_000,
    loan_loss_provisions: 15_000_000,
    ...overrides,
  }
}

// ─── calculateAllRatios ──────────────────────────────────────────────────────

describe('calculateAllRatios', () => {
  it('computes equity/assets correctly', () => {
    const ratios = calculateAllRatios(makeStatement())
    expect(ratios.equity_assets).toBeCloseTo(0.12, 2) // 120M / 1B
  })

  it('computes debt/assets correctly', () => {
    const ratios = calculateAllRatios(makeStatement())
    // (80M + 100M) / 1B = 0.18
    expect(ratios.debt_assets).toBeCloseTo(0.18, 2)
  })

  it('computes NPL ratio correctly', () => {
    const ratios = calculateAllRatios(makeStatement())
    // 18M / 600M = 0.03
    expect(ratios.npl_ratio).toBeCloseTo(0.03, 3)
  })

  it('computes coverage ratio correctly', () => {
    const ratios = calculateAllRatios(makeStatement())
    // |15M| / 18M = 0.833
    expect(ratios.coverage_ratio).toBeCloseTo(0.833, 2)
  })

  it('computes cost-to-income correctly', () => {
    const ratios = calculateAllRatios(makeStatement())
    // |25M| / 60M = 0.4167
    expect(ratios.cost_to_income).toBeCloseTo(0.4167, 3)
  })

  it('computes ROAE correctly without previous period (uses current equity as denominator)', () => {
    const ratios = calculateAllRatios(makeStatement())
    // 22M / 120M = 0.1833
    expect(ratios.roae).toBeCloseTo(0.1833, 3)
  })

  it('computes ROAE using average equity when previous period is provided', () => {
    const prev = makeStatement({ total_equity: 100_000_000 })
    const curr = makeStatement({ total_equity: 120_000_000 })
    const ratios = calculateAllRatios(curr, prev)
    // avg equity = (120M + 100M) / 2 = 110M → ROAE = 22M / 110M = 0.2
    expect(ratios.roae).toBeCloseTo(0.2, 3)
  })

  it('computes ROAA correctly', () => {
    const ratios = calculateAllRatios(makeStatement())
    // 22M / 1B = 0.022
    expect(ratios.roaa).toBeCloseTo(0.022, 3)
  })

  it('computes liquid assets / total assets correctly', () => {
    const ratios = calculateAllRatios(makeStatement())
    // (50M + 100M + 200M) / 1B = 0.35
    expect(ratios.liquid_assets_total_assets).toBeCloseTo(0.35, 2)
  })

  it('computes gross loans / deposits correctly', () => {
    const ratios = calculateAllRatios(makeStatement())
    // 600M / 700M = 0.857
    expect(ratios.gross_loans_deposits).toBeCloseTo(0.857, 2)
  })

  it('returns null for ratios when denominator is zero', () => {
    const ratios = calculateAllRatios(makeStatement({ total_assets: 0 }))
    expect(ratios.equity_assets).toBeNull()
    expect(ratios.liquid_assets_total_assets).toBeNull()
  })

  it('returns null for NPL ratio when gross loans is zero', () => {
    const ratios = calculateAllRatios(makeStatement({ gross_loans: 0 }))
    expect(ratios.npl_ratio).toBeNull()
  })
})

// ─── runFullAnalysis ─────────────────────────────────────────────────────────

describe('runFullAnalysis', () => {
  it('returns ratings for all 5 components plus composite', () => {
    const result = runFullAnalysis(makeStatement())
    expect(result.ratings.capital).toBeDefined()
    expect(result.ratings.asset_quality).toBeDefined()
    expect(result.ratings.management).toBeDefined()
    expect(result.ratings.earnings).toBeDefined()
    expect(result.ratings.liquidity).toBeDefined()
    expect(result.ratings.composite).toBeDefined()
  })

  it('generates analysis text for all components', () => {
    const result = runFullAnalysis(makeStatement())
    expect(result.analysis.capital).toContain('Capital Adequacy')
    expect(result.analysis.asset_quality).toContain('Asset Quality')
    expect(result.analysis.management).toContain('Management')
    expect(result.analysis.earnings).toContain('Earnings')
    expect(result.analysis.liquidity).toContain('Liquidity')
    expect(result.analysis.composite).toContain('Composite')
  })

  describe('scoring thresholds', () => {
    it('rates equity/assets >= 12% as rating 1 (Strong)', () => {
      const result = runFullAnalysis(makeStatement({ total_equity: 120_000_000 }))
      expect(result.ratings.capital.rating).toBe(1)
      expect(result.ratings.capital.status).toBe('Strong')
    })

    it('rates equity/assets >= 9% but < 12% as rating 2 (Satisfactory)', () => {
      const result = runFullAnalysis(makeStatement({ total_equity: 95_000_000 }))
      expect(result.ratings.capital.rating).toBe(2)
    })

    it('rates equity/assets >= 6% but < 9% as rating 3 (Fair)', () => {
      const result = runFullAnalysis(makeStatement({ total_equity: 70_000_000 }))
      expect(result.ratings.capital.rating).toBe(3)
    })

    it('rates equity/assets >= 4% but < 6% as rating 4 (Marginal)', () => {
      const result = runFullAnalysis(makeStatement({ total_equity: 45_000_000 }))
      expect(result.ratings.capital.rating).toBe(4)
    })

    it('rates equity/assets < 4% as rating 5 (Unsatisfactory)', () => {
      const result = runFullAnalysis(makeStatement({ total_equity: 30_000_000 }))
      expect(result.ratings.capital.rating).toBe(5)
    })

    it('rates NPL ratio < 2% as rating 1 (Strong)', () => {
      const result = runFullAnalysis(makeStatement({ npls: 10_000_000 }))
      // 10M / 600M = 1.67% < 2%
      expect(result.ratings.asset_quality.rating).toBe(1)
    })

    it('rates NPL ratio >= 12% as rating 5 (Unsatisfactory)', () => {
      const result = runFullAnalysis(makeStatement({ npls: 80_000_000 }))
      // 80M / 600M = 13.3% >= 12%
      expect(result.ratings.asset_quality.rating).toBe(5)
    })

    it('rates cost-to-income < 40% as rating 1 (Strong)', () => {
      const result = runFullAnalysis(makeStatement({ operating_expenses: 20_000_000 }))
      // 20M / 60M = 33% < 40%
      expect(result.ratings.management.rating).toBe(1)
    })

    it('rates ROAE >= 15% as rating 1 (Strong)', () => {
      const result = runFullAnalysis(makeStatement({ net_income: 22_000_000, total_equity: 120_000_000 }))
      // 22M / 120M = 18.3% >= 15%
      expect(result.ratings.earnings.rating).toBe(1)
    })

    it('rates liquid assets/TA >= 35% as rating 1 (Strong)', () => {
      const result = runFullAnalysis(makeStatement())
      // (50M + 100M + 200M) / 1B = 35%
      expect(result.ratings.liquidity.rating).toBe(1)
    })
  })

  describe('composite rating', () => {
    it('computes composite as rounded average of available ratings', () => {
      const result = runFullAnalysis(makeStatement())
      const ratings = [
        result.ratings.capital.rating,
        result.ratings.asset_quality.rating,
        result.ratings.management.rating,
        result.ratings.earnings.rating,
        result.ratings.liquidity.rating,
      ].filter((r): r is number => r != null)

      const expectedAvg = ratings.reduce((s, v) => s + v, 0) / ratings.length
      expect(result.ratings.composite.composite_rating).toBe(Math.round(expectedAvg))
    })

    it('returns null composite when all ratios are null', () => {
      const result = runFullAnalysis(makeStatement({
        total_assets: 0,
        gross_loans: 0,
        operating_income: 0,
        total_equity: 0,
      }))
      expect(result.ratings.composite.composite_rating).toBeNull()
    })
  })

  describe('missing data handling', () => {
    it('returns rating=null with "Insufficient data" for components with null primary ratio', () => {
      const result = runFullAnalysis(makeStatement({ gross_loans: 0 }))
      expect(result.ratings.asset_quality.rating).toBeNull()
      expect(result.ratings.asset_quality.status).toBe('Insufficient data')
    })

    it('excludes null-rated components from composite average', () => {
      const result = runFullAnalysis(makeStatement({ gross_loans: 0 }))
      // asset_quality is null → composite from 4 components, not 5
      const nonNullRatings = [
        result.ratings.capital.rating,
        result.ratings.management.rating,
        result.ratings.earnings.rating,
        result.ratings.liquidity.rating,
      ].filter((r): r is number => r != null)

      if (nonNullRatings.length > 0) {
        const expectedAvg = nonNullRatings.reduce((s, v) => s + v, 0) / nonNullRatings.length
        expect(result.ratings.composite.composite_rating).toBe(Math.round(expectedAvg))
      }
    })
  })
})
