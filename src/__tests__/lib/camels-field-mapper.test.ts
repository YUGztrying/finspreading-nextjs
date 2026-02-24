import { extractFinancialData, getAllPeriods } from '@/lib/camels/field-mapper'
import { LineItem } from '@/types/database.types'

function makeLine(poste: string, amounts: number[]): LineItem {
  return {
    poste,
    description: poste,
    amounts,
    is_total: false,
    is_subtotal: false,
    indent_level: 0,
    flags: [],
  }
}

// ─── Bank mapping ────────────────────────────────────────────────────────────

describe('extractFinancialData — bank', () => {
  const statements = {
    actifs: {
      periods: ['2022-12-31', '2023-12-31'],
      line_items: [
        makeLine('ACTIF_TOTAL', [900_000, 1_000_000]),
        makeLine('ACTIF_01', [40_000, 50_000]),
        makeLine('ACTIF_03', [80_000, 100_000]),
        makeLine('ACTIF_02', [100_000, 120_000]),
        makeLine('ACTIF_05', [50_000, 60_000]),
        makeLine('ACTIF_06', [10_000, 20_000]),
        makeLine('ACTIF_04', [500_000, 600_000]),
        makeLine('ACTIF_14', [20_000, 30_000]),
      ],
    },
    passifs: {
      periods: ['2022-12-31', '2023-12-31'],
      line_items: [
        makeLine('PASSIF_03', [600_000, 700_000]),
        makeLine('PASSIF_01', [50_000, 60_000]),
        makeLine('PASSIF_02', [10_000, 20_000]),
        makeLine('PASSIF_04', [80_000, 100_000]),
        makeLine('PASSIF_08', [5_000, 0]),
        makeLine('PASSIF_10', [40_000, 50_000]),
        makeLine('PASSIF_11', [10_000, 10_000]),
        makeLine('PASSIF_12', [5_000, 5_000]),
        makeLine('PASSIF_14', [5_000, 5_000]),
        makeLine('PASSIF_15', [20_000, 30_000]),
        makeLine('PASSIF_16', [10_000, 20_000]),
      ],
    },
    compte_resultats: {
      periods: ['2022-12-31', '2023-12-31'],
      line_items: [
        makeLine('CR_01', [70_000, 80_000]),
        makeLine('CR_02', [25_000, 30_000]),
        makeLine('CR_04', [8_000, 10_000]),
        makeLine('CR_12', [20_000, 25_000]),
        makeLine('CR_13', [4_000, 5_000]),
        makeLine('CR_15', [6_000, 8_000]),
        makeLine('CR_20', [18_000, 22_000]),
      ],
    },
  }

  it('extracts total_assets from ACTIF_TOTAL for the correct period', () => {
    const data = extractFinancialData(statements, '2023-12-31', 'banque')
    expect(data.total_assets).toBe(1_000_000)
  })

  it('extracts total_assets from first period', () => {
    const data = extractFinancialData(statements, '2022-12-31', 'banque')
    expect(data.total_assets).toBe(900_000)
  })

  it('sums investment_securities from ACTIF_02 + ACTIF_05 + ACTIF_06', () => {
    const data = extractFinancialData(statements, '2023-12-31', 'banque')
    expect(data.investment_securities).toBe(120_000 + 60_000 + 20_000)
  })

  it('extracts interest_income from CR_01', () => {
    const data = extractFinancialData(statements, '2023-12-31', 'banque')
    expect(data.interest_income).toBe(80_000)
  })

  it('sums total_equity from multiple PASSIF postes', () => {
    const data = extractFinancialData(statements, '2023-12-31', 'banque')
    // 50k + 10k + 5k + 5k + 30k + 20k = 120k
    expect(data.total_equity).toBe(120_000)
  })

  it('sums short_term_borrowings from PASSIF_01 + PASSIF_02', () => {
    const data = extractFinancialData(statements, '2023-12-31', 'banque')
    expect(data.short_term_borrowings).toBe(80_000)
  })

  it('computes net_interest_income as interest_income - |interest_expenses|', () => {
    const data = extractFinancialData(statements, '2023-12-31', 'banque')
    expect(data.net_interest_income).toBe(80_000 - 30_000)
  })

  it('computes total_liabilities = total_assets - total_equity', () => {
    const data = extractFinancialData(statements, '2023-12-31', 'banque')
    expect(data.total_liabilities).toBe(1_000_000 - 120_000)
  })

  it('returns 0 for missing poste codes', () => {
    const sparseStatements = {
      actifs: { periods: ['2023-12-31'], line_items: [makeLine('ACTIF_TOTAL', [500_000])] },
    }
    const data = extractFinancialData(sparseStatements, '2023-12-31', 'banque')
    expect(data.total_assets).toBe(500_000)
    expect(data.gross_loans).toBe(0) // ACTIF_04 not present
    expect(data.interest_income).toBe(0) // no income statement
  })
})

// ─── Microfinance mapping ────────────────────────────────────────────────────

describe('extractFinancialData — microfinance', () => {
  const statements = {
    actifs: {
      periods: ['2023-12-31'],
      line_items: [
        makeLine('MFA_TOTAL_ACTIF', [500_000]),
        makeLine('MFA_A10', [10_000]),
        makeLine('MFA_A11', [5_000]),
        makeLine('MFA_A12', [3_000]),
        makeLine('MFA_B2D', [100_000]),
        makeLine('MFA_B30', [80_000]),
        makeLine('MFA_B40', [50_000]),
        makeLine('MFA_B70', [5_000]),
        makeLine('MFA_B71', [3_000]),
        makeLine('MFA_B72', [1_000]),
        makeLine('MFA_B73', [500]),
      ],
    },
    passifs: {
      periods: ['2023-12-31'],
      line_items: [
        makeLine('MFP_G2A', [100_000]),
        makeLine('MFP_G15', [50_000]),
        makeLine('MFP_G30', [20_000]),
        makeLine('MFP_G60', [10_000]),
        makeLine('MFP_G70', [5_000]),
        makeLine('MFP_L50', [30_000]),
        makeLine('MFP_L55', [5_000]),
        makeLine('MFP_L60', [10_000]),
        makeLine('MFP_L70', [5_000]),
        makeLine('MFP_L75', [3_000]),
        makeLine('MFP_L80', [7_000]),
      ],
    },
    compte_resultats: {
      periods: ['2023-12-31'],
      line_items: [
        makeLine('MFP_V3B', [40_000]),
        makeLine('MFC_R1L', [8_000]),
        makeLine('MFC_R2A', [2_000]),
        makeLine('MFC_R3C', [1_000]),
        makeLine('MFC_R5Y', [500]),
        makeLine('MFC_S02', [12_000]),
        makeLine('MFC_T6B', [4_000]),
        makeLine('MFC_T82', [2_000]),
      ],
    },
  }

  it('extracts total_assets from MFA_TOTAL_ACTIF', () => {
    const data = extractFinancialData(statements, '2023-12-31', 'microfinance')
    expect(data.total_assets).toBe(500_000)
  })

  it('sums cash from MFA_A10 + MFA_A11 + MFA_A12', () => {
    const data = extractFinancialData(statements, '2023-12-31', 'microfinance')
    expect(data.cash_and_equivalents).toBe(18_000)
  })

  it('sums gross_loans from MFA_B2D + MFA_B30 + MFA_B40', () => {
    const data = extractFinancialData(statements, '2023-12-31', 'microfinance')
    expect(data.gross_loans).toBe(230_000)
  })

  it('sums NPLs from MFA_B70-B73', () => {
    const data = extractFinancialData(statements, '2023-12-31', 'microfinance')
    expect(data.npls).toBe(9_500)
  })

  it('sums total_deposits from MFP_G postes', () => {
    const data = extractFinancialData(statements, '2023-12-31', 'microfinance')
    expect(data.total_deposits).toBe(185_000)
  })

  it('sums total_equity from MFP_L postes', () => {
    const data = extractFinancialData(statements, '2023-12-31', 'microfinance')
    expect(data.total_equity).toBe(60_000)
  })

  it('sums interest_expenses from MFC_R postes', () => {
    const data = extractFinancialData(statements, '2023-12-31', 'microfinance')
    expect(data.interest_expenses).toBe(11_500)
  })
})

// ─── getAllPeriods ────────────────────────────────────────────────────────────

describe('getAllPeriods', () => {
  it('returns union of all periods sorted chronologically', () => {
    const statements = {
      actifs: { periods: ['2023-12-31', '2022-12-31'] },
      passifs: { periods: ['2021-12-31', '2023-12-31'] },
    }
    expect(getAllPeriods(statements)).toEqual(['2021-12-31', '2022-12-31', '2023-12-31'])
  })

  it('deduplicates periods across statement types', () => {
    const statements = {
      actifs: { periods: ['2023-12-31'] },
      passifs: { periods: ['2023-12-31'] },
    }
    expect(getAllPeriods(statements)).toEqual(['2023-12-31'])
  })

  it('returns empty array when no periods exist', () => {
    expect(getAllPeriods({})).toEqual([])
  })
})
