import {
  aggregateIrm,
  averageBalance,
  annualizeFlow,
  type IrmInput,
} from '@/lib/irm/aggregate'
import type { LineItem } from '@/types/database.types'
import type { PeriodFxRate } from '@/lib/irm/fx'

// ─── Fixture: two periods, simplified BCEAO bank ───────────────────────────
function makeInput(overrides: Partial<IrmInput> = {}): IrmInput {
  const line = (poste: string, amounts: number[]): LineItem => ({
    poste,
    description: poste,
    amounts,
  })

  const actifs: LineItem[] = [
    line('ACTIF_01', [1000, 1200]), // Cash
    line('ACTIF_03', [500, 600]),   // Interbank
    line('ACTIF_02', [200, 250]),   // Govt securities
    line('ACTIF_04', [5000, 5500]), // Net loans
    line('ACTIF_08', [100, 120]),   // Other assets
    line('ACTIF_TOTAL', [6800, 7670]),
  ]
  const passifs: LineItem[] = [
    line('PASSIF_03', [5000, 5500]), // Deposits
    line('PASSIF_08', [200, 220]),   // Sub debt
    line('PASSIF_05', [100, 110]),   // Other liab
    line('PASSIF_10', [1000, 1000]), // Capital
    line('PASSIF_16', [500, 840]),   // Net result
    line('PASSIF_TOTAL', [6800, 7670]),
  ]
  const compte_resultats: LineItem[] = [
    line('CR_01', [400, 500]),  // Interest income
    line('CR_02', [-150, -180]), // Interest expense (stored negative)
    line('CR_04', [60, 80]),    // Fee income
    line('CR_10', [310, 400]),  // PNB
    line('CR_12', [-180, -200]), // Opex (stored negative)
    line('CR_14', [130, 200]),  // RBE
    line('CR_15', [-30, -40]),  // Cost of risk
    line('CR_16', [100, 160]),  // Op result
    line('CR_19', [-20, -30]),  // Tax
    line('CR_20', [80, 130]),   // Net profit
  ]

  const periods = [
    { key: '2022-12-31', type: 'FY' as const },
    { key: '2023-12-31', type: 'FY' as const },
  ]
  const fxRates: PeriodFxRate[] = [
    { period: '2022-12-31', fx_eop: 600, fx_avg: 595 },
    { period: '2023-12-31', fx_eop: 610, fx_avg: 605 },
  ]

  return {
    actifs,
    passifs,
    compte_resultats,
    periods,
    fxRates,
    ...overrides,
  }
}

describe('aggregateIrm', () => {
  it('sums multiple postes into a single IRM line (stock, USD)', () => {
    const result = aggregateIrm(makeInput())
    const cash = result.byId.cash_and_banks
    expect(cash).toBeDefined()
    // FY2022: (1000 + 500) / (600 * 1) = 2.5
    expect(cash.lcy[0]).toBe(1500)
    expect(cash.usd[0]).toBeCloseTo(2.5, 6)
    // FY2023: (1200 + 600) / (610 * 1) ≈ 2.9508
    expect(cash.usd[1]).toBeCloseTo(1800 / 610, 6)
  })

  it('uses fx_avg for income statement (flow) lines', () => {
    const result = aggregateIrm(makeInput())
    const nii = result.byId.net_interest_income
    // FY2022: (400 + (-150)) / 595 ≈ 0.42
    expect(nii.lcy[0]).toBe(250)
    expect(nii.usd[0]).toBeCloseTo(250 / 595, 6)
  })

  it('applies the unit divisor', () => {
    const input = makeInput()
    // Pretend source is in raw XOF units, divide by 1_000_000 for USD mn
    const scaled: IrmInput = {
      ...input,
      actifs: input.actifs.map((l) => ({
        ...l,
        amounts: l.amounts.map((a) => a * 1_000_000),
      })),
      unitDivisor: 1_000_000,
    }
    const result = aggregateIrm(scaled)
    // Cash FY2022 should still be 2.5 USD mn
    expect(result.byId.cash_and_banks.usd[0]).toBeCloseTo(2.5, 6)
  })

  it('returns null USD when the required FX side is missing', () => {
    const input = makeInput()
    input.fxRates = [
      { period: '2022-12-31', fx_eop: 600, fx_avg: null },
      { period: '2023-12-31', fx_eop: 610, fx_avg: 605 },
    ]
    const result = aggregateIrm(input)
    // NII FY2022 needs fx_avg, which is missing → null
    expect(result.byId.net_interest_income.usd[0]).toBeNull()
    // NII FY2023 works
    expect(result.byId.net_interest_income.usd[1]).not.toBeNull()
    // Cash FY2022 uses fx_eop, still works
    expect(result.byId.cash_and_banks.usd[0]).not.toBeNull()
  })

  it('returns null LCY when no source postes match', () => {
    const input = makeInput()
    input.actifs = input.actifs.filter((l) => l.poste !== 'ACTIF_01' && l.poste !== 'ACTIF_03')
    const result = aggregateIrm(input)
    expect(result.byId.cash_and_banks.lcy[0]).toBeNull()
    expect(result.byId.cash_and_banks.usd[0]).toBeNull()
  })

  it('produces a row for every defined IRM line', () => {
    const result = aggregateIrm(makeInput())
    expect(result.rows.length).toBeGreaterThan(10)
    expect(result.byId.total_assets).toBeDefined()
    expect(result.byId.net_profit).toBeDefined()
  })
})

describe('annualizeFlow', () => {
  it('doubles H1 values', () => {
    expect(
      annualizeFlow(100, { key: '2024-06-30', type: 'H1' })
    ).toBe(200)
  })

  it('leaves FY values unchanged', () => {
    expect(
      annualizeFlow(100, { key: '2023-12-31', type: 'FY' })
    ).toBe(100)
  })

  it('passes through nulls', () => {
    expect(annualizeFlow(null, { key: '2024-06-30', type: 'H1' })).toBeNull()
  })
})

describe('averageBalance', () => {
  it('averages opening and closing when both present', () => {
    const result = aggregateIrm(makeInput())
    const assets = result.byId.total_assets
    // periodIndex 1 → (usd[0] + usd[1]) / 2
    const avg = averageBalance(assets, 1)
    expect(avg.value).toBeCloseTo((assets.usd[0]! + assets.usd[1]!) / 2, 6)
    expect(avg.incompleteOpening).toBe(false)
  })

  it('falls back to closing and flags when opening is missing', () => {
    const result = aggregateIrm(makeInput())
    const assets = result.byId.total_assets
    const avg = averageBalance(assets, 0)
    expect(avg.value).toBe(assets.usd[0])
    expect(avg.incompleteOpening).toBe(true)
  })

  it('returns null when closing is missing', () => {
    const result = aggregateIrm(makeInput())
    const assets = result.byId.total_assets
    assets.usd[1] = null
    const avg = averageBalance(assets, 1)
    expect(avg.value).toBeNull()
  })
})
