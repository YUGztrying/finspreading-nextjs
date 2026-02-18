import {
  validateFinancialRows,
  createLineKey,
  validatePeriods,
  checkBalance,
  FinancialRow,
} from '@/lib/statements/validate'

// ─────────────────────────────────────────────
// validateFinancialRows
// ─────────────────────────────────────────────
describe('validateFinancialRows', () => {
  it('normalises a well-formed row without adding flags', () => {
    const rows: FinancialRow[] = [
      {
        poste: 'ACTIF_001',
        description: 'Cash and equivalents',
        net_amount: 1000,
        is_total: false,
        is_subtotal: false,
        indent_level: 0,
      },
    ]
    const { cleanedRows } = validateFinancialRows(rows)
    expect(cleanedRows).toHaveLength(1)
    expect(cleanedRows[0].flags).toEqual([])
    expect(cleanedRows[0].net_amount).toBe(1000)
  })

  it('converts amount strings with spaces and comma-decimal separators', () => {
    const rows = [{ net_amount: '1 234,56' }]
    const { cleanedRows } = validateFinancialRows(rows)
    expect(cleanedRows[0].net_amount).toBeCloseTo(1234.56, 2)
  })

  it('converts parenthesised amounts to negative numbers', () => {
    const rows = [{ net_amount: '(500)' }]
    const { cleanedRows } = validateFinancialRows(rows)
    expect(cleanedRows[0].net_amount).toBe(-500)
  })

  it('replaces non-numeric amount strings with 0 and adds invalid_amount flag', () => {
    const rows = [{ net_amount: 'N/A' }]
    const { cleanedRows } = validateFinancialRows(rows)
    expect(cleanedRows[0].net_amount).toBe(0)
    expect(cleanedRows[0].flags).toContain('invalid_amount')
  })

  it('flags a description that is purely numeric', () => {
    const rows = [{ description: '12345' }]
    const { cleanedRows } = validateFinancialRows(rows)
    expect(cleanedRows[0].flags).toContain('invalid_description')
  })

  it('flags an empty description', () => {
    const rows = [{ description: '' }]
    const { cleanedRows } = validateFinancialRows(rows)
    expect(cleanedRows[0].flags).toContain('empty_description')
  })

  it('flags a missing description field', () => {
    const rows = [{}]
    const { cleanedRows } = validateFinancialRows(rows)
    expect(cleanedRows[0].description).toBe('')
    expect(cleanedRows[0].flags).toContain('empty_description')
  })

  it('defaults is_total, is_subtotal, indent_level when missing', () => {
    const rows = [{}]
    const { cleanedRows } = validateFinancialRows(rows)
    expect(cleanedRows[0].is_total).toBe(false)
    expect(cleanedRows[0].is_subtotal).toBe(false)
    expect(cleanedRows[0].indent_level).toBe(0)
  })

  it('preserves valid boolean is_total flag', () => {
    const rows = [{ is_total: true }]
    const { cleanedRows } = validateFinancialRows(rows)
    expect(cleanedRows[0].is_total).toBe(true)
  })

  it('handles an empty array without throwing', () => {
    const { cleanedRows } = validateFinancialRows([])
    expect(cleanedRows).toEqual([])
  })

  it('processes all amount fields: brut_amount and amort_prov_amount', () => {
    const rows = [{ brut_amount: '2000', amort_prov_amount: '(300)' }]
    const { cleanedRows } = validateFinancialRows(rows)
    expect(cleanedRows[0].brut_amount).toBe(2000)
    expect(cleanedRows[0].amort_prov_amount).toBe(-300)
  })

  it('cleans poste by trimming whitespace', () => {
    const rows = [{ poste: '  ACTIF_001  ' }]
    const { cleanedRows } = validateFinancialRows(rows)
    expect(cleanedRows[0].poste).toBe('ACTIF_001')
  })
})

// ─────────────────────────────────────────────
// createLineKey
// ─────────────────────────────────────────────
describe('createLineKey', () => {
  it('creates a key in the format institution_statement_poste', () => {
    const key = createLineKey({ poste: 'CASH' }, 'banque', 'actifs')
    expect(key).toBe('banque_actifs_CASH')
  })

  it('strips MFA_ prefix from microfinance actifs keys', () => {
    const key = createLineKey({ poste: 'MFA_CASH' }, 'microfinance', 'actifs')
    expect(key).toBe('microfinance_actifs_CASH')
  })

  it('strips MFP_ prefix from microfinance passifs keys', () => {
    const key = createLineKey({ poste: 'MFP_TOTAL' }, 'microfinance', 'passifs')
    expect(key).toBe('microfinance_passifs_TOTAL')
  })

  it('strips ACTIF_ prefix from bank actifs keys', () => {
    const key = createLineKey({ poste: 'ACTIF_LOANS' }, 'banque', 'actifs')
    expect(key).toBe('banque_actifs_LOANS')
  })

  it('strips CR_ prefix from compte_resultats keys', () => {
    const key = createLineKey({ poste: 'CR_REVENUE' }, 'banque', 'compte_resultats')
    expect(key).toBe('banque_compte_resultats_REVENUE')
  })

  it('handles missing poste gracefully', () => {
    const key = createLineKey({}, 'banque', 'actifs')
    expect(key).toBe('banque_actifs_')
  })

  it('does not strip a non-matching prefix', () => {
    const key = createLineKey({ poste: 'CUSTOM_LINE' }, 'banque', 'actifs')
    expect(key).toBe('banque_actifs_CUSTOM_LINE')
  })
})

// ─────────────────────────────────────────────
// validatePeriods
// ─────────────────────────────────────────────
describe('validatePeriods', () => {
  it('filters out invalid date strings', () => {
    const result = validatePeriods(['2023-12-31', 'not-a-date', '2024-06-30'])
    expect(result).toEqual(['2023-12-31', '2024-06-30'])
  })

  it('sorts periods in ascending chronological order', () => {
    const result = validatePeriods(['2024-12-31', '2022-12-31', '2023-12-31'])
    expect(result).toEqual(['2022-12-31', '2023-12-31', '2024-12-31'])
  })

  it('filters out null and empty strings', () => {
    const result = validatePeriods(['', '2024-01-01', null as any])
    expect(result).toEqual(['2024-01-01'])
  })

  it('returns empty array when all periods are invalid', () => {
    const result = validatePeriods(['bad', 'invalid'])
    expect(result).toEqual([])
  })

  it('returns single valid period unchanged', () => {
    const result = validatePeriods(['2023-06-30'])
    expect(result).toEqual(['2023-06-30'])
  })

  it('handles duplicate periods by keeping them (dedup is not the job of this function)', () => {
    const result = validatePeriods(['2023-12-31', '2023-12-31'])
    expect(result).toHaveLength(2)
  })
})

// ─────────────────────────────────────────────
// checkBalance
// ─────────────────────────────────────────────
describe('checkBalance', () => {
  const makeActif = (amount: number): FinancialRow => ({
    poste: 'ACTIF_TOTAL',
    amounts: [amount],
  } as any)

  const makePassif = (amount: number): FinancialRow => ({
    poste: 'PASSIF_TOTAL',
    amounts: [amount],
  } as any)

  it('returns balanced=true when actifs equal passifs exactly', () => {
    const result = checkBalance([makeActif(1_000_000)], [makePassif(1_000_000)], 0)
    expect(result.balanced).toBe(true)
    expect(result.difference).toBe(0)
  })

  it('returns balanced=true when difference is within 1% tolerance', () => {
    // 1% of 1,000,000 = 10,000 — a difference of 5,000 should be OK
    const result = checkBalance([makeActif(1_000_000)], [makePassif(995_000)], 0)
    expect(result.balanced).toBe(true)
  })

  it('returns balanced=false when difference exceeds 1% tolerance', () => {
    // difference of 20,000 > 1% of 1,000,000
    const result = checkBalance([makeActif(1_000_000)], [makePassif(980_000)], 0)
    expect(result.balanced).toBe(false)
    expect(result.difference).toBeGreaterThan(10_000)
  })

  it('returns balanced=false when ACTIF_TOTAL line is missing', () => {
    const result = checkBalance([{ poste: 'ACTIF_OTHER', amounts: [100] } as any], [makePassif(100)], 0)
    expect(result.balanced).toBe(false)
    expect(result.difference).toBe(0)
  })

  it('returns balanced=false when PASSIF_TOTAL line is missing', () => {
    const result = checkBalance([makeActif(100)], [{ poste: 'PASSIF_OTHER', amounts: [100] } as any], 0)
    expect(result.balanced).toBe(false)
  })

  it('uses the correct period index', () => {
    const actif: FinancialRow = { poste: 'ACTIF_TOTAL', amounts: [500_000, 1_000_000] } as any
    const passif: FinancialRow = { poste: 'PASSIF_TOTAL', amounts: [500_000, 1_000_000] } as any
    // Period 0 is balanced, period 1 is also balanced
    expect(checkBalance([actif], [passif], 0).balanced).toBe(true)
    expect(checkBalance([actif], [passif], 1).balanced).toBe(true)
  })

  it('treats missing amounts as 0', () => {
    const actif: FinancialRow = { poste: 'ACTIF_TOTAL', amounts: [] } as any
    const passif: FinancialRow = { poste: 'PASSIF_TOTAL', amounts: [] } as any
    const result = checkBalance([actif], [passif], 0)
    // both are 0, difference is 0, tolerance of 0*0.01 = 0, so 0 <= 0 → balanced
    expect(result.balanced).toBe(true)
  })
})
