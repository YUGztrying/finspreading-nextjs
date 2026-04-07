import { aggregateIrm, type IrmInput } from '@/lib/irm/aggregate'
import { computeRatios, BANK_RATIOS } from '@/lib/irm/ratios'
import type { LineItem } from '@/types/database.types'
import type { PeriodFxRate } from '@/lib/irm/fx'

function line(poste: string, amounts: number[]): LineItem {
  return { poste, description: poste, amounts }
}

function makeInput(periodTypes: Array<'FY' | 'H1'> = ['FY', 'FY']): IrmInput {
  const actifs: LineItem[] = [
    line('ACTIF_01', [1000, 1200]),
    line('ACTIF_03', [500, 600]),
    line('ACTIF_04', [5000, 5500]),
    line('ACTIF_TOTAL', [6500, 7300]),
  ]
  const passifs: LineItem[] = [
    line('PASSIF_03', [5000, 5500]),
    line('PASSIF_10', [1000, 1000]),
    line('PASSIF_16', [500, 800]),
    line('PASSIF_TOTAL', [6500, 7300]),
  ]
  const compte_resultats: LineItem[] = [
    line('CR_01', [400, 500]),
    line('CR_02', [-150, -180]),
    line('CR_10', [310, 400]),
    line('CR_12', [-180, -200]),
    line('CR_15', [-30, -40]),
    line('CR_19', [-20, -30]),
    line('CR_20', [80, 130]),
  ]
  const periods = [
    { key: '2022-12-31', type: periodTypes[0] },
    { key: '2023-12-31', type: periodTypes[1] },
  ]
  const fxRates: PeriodFxRate[] = [
    { period: '2022-12-31', fx_eop: 600, fx_avg: 595 },
    { period: '2023-12-31', fx_eop: 610, fx_avg: 605 },
  ]
  return { actifs, passifs, compte_resultats, periods, fxRates }
}

describe('computeRatios', () => {
  it('emits a row for every configured ratio plus derived', () => {
    const result = computeRatios(aggregateIrm(makeInput()))
    const ids = result.rows.map((r) => r.id)
    for (const def of BANK_RATIOS) {
      expect(ids).toContain(def.id)
    }
    expect(ids).toContain('roaa')
    expect(ids).toContain('roae')
    expect(ids).toContain('leverage')
  })

  it('flags incomplete opening balance in the first period', () => {
    const result = computeRatios(aggregateIrm(makeInput()))
    const nii = result.rows.find((r) => r.id === 'nii_avg_assets')!
    expect(nii.flags[0]).toContain('incomplete_opening_balance')
    expect(nii.flags[1]).toBeNull()
  })

  it('ROAA equals the sum of its DuPont components', () => {
    const result = computeRatios(aggregateIrm(makeInput()))
    const idx = 1
    const components = [
      'nii_avg_assets',
      'non_int_income_avg_assets',
      'opex_avg_assets',
      'provisions_avg_assets',
      'tax_avg_assets',
    ]
    const expected = components.reduce((acc, id) => {
      const row = result.rows.find((r) => r.id === id)!
      return acc + (row.values[idx] ?? 0)
    }, 0)
    const roaa = result.rows.find((r) => r.id === 'roaa')!.values[idx]
    expect(roaa).toBeCloseTo(expected, 9)
  })

  it('ROAE equals ROAA × leverage', () => {
    const result = computeRatios(aggregateIrm(makeInput()))
    const idx = 1
    const roaa = result.rows.find((r) => r.id === 'roaa')!.values[idx]!
    const lev = result.rows.find((r) => r.id === 'leverage')!.values[idx]!
    const roae = result.rows.find((r) => r.id === 'roae')!.values[idx]!
    expect(roae).toBeCloseTo(roaa * lev, 9)
  })

  it('negates cost_to_income so opex / income is expressed as a positive', () => {
    const result = computeRatios(aggregateIrm(makeInput()))
    const cti = result.rows.find((r) => r.id === 'cost_to_income')!
    // opex is stored negative, so without negate the ratio would be negative
    expect(cti.values[1]).toBeGreaterThan(0)
  })

  it('annualizes H1 flows when computing ratios', () => {
    const fyResult = computeRatios(aggregateIrm(makeInput(['FY', 'FY'])))
    const h1Result = computeRatios(aggregateIrm(makeInput(['FY', 'H1'])))
    const fyNii = fyResult.rows.find((r) => r.id === 'nii_avg_assets')!.values[1]!
    const h1Nii = h1Result.rows.find((r) => r.id === 'nii_avg_assets')!.values[1]!
    // Second period is H1 → numerator doubled → ratio doubled
    expect(h1Nii).toBeCloseTo(fyNii * 2, 9)
  })

  it('returns null when the denominator is zero or missing', () => {
    const input = makeInput()
    // Wipe equity → leverage denominator becomes 0/null
    input.passifs = input.passifs.filter(
      (l) =>
        !['PASSIF_10', 'PASSIF_16', 'PASSIF_09', 'PASSIF_11', 'PASSIF_12', 'PASSIF_13', 'PASSIF_14', 'PASSIF_15'].includes(
          l.poste
        )
    )
    const result = computeRatios(aggregateIrm(input))
    const lev = result.rows.find((r) => r.id === 'leverage')!
    expect(lev.values[1]).toBeNull()
    const roae = result.rows.find((r) => r.id === 'roae')!
    expect(roae.values[1]).toBeNull()
  })

  it('loans/deposits uses closing balances (no averaging)', () => {
    const result = computeRatios(aggregateIrm(makeInput()))
    const ltd = result.rows.find((r) => r.id === 'loans_to_deposits')!
    // ACTIF_04 / PASSIF_03, same FX → stays as LCY ratio
    // period 0: 5000/5000 = 1, period 1: 5500/5500 = 1
    expect(ltd.values[0]).toBeCloseTo(1, 9)
    expect(ltd.values[1]).toBeCloseTo(1, 9)
    expect(ltd.flags[0]).toBeNull()
  })
})
