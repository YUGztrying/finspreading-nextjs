// src/__tests__/lib/irp-income-statement-bank.test.ts
//
// Regression test for the income-statement sign bug found on BBGCI:
// expense lines (CR_02 interest expense, CR_05 fees expense, CR_09/CR_12
// other charges, CR_13 D&A, CR_15 cost of risk, CR_19 tax) are stored
// already-signed (negative, as printed on the BCEAO RESU_PUB statement).
// The calculated aggregates used sign '-' on them, double-negating. These
// assertions pin the corrected output to the actual published totals.

import { calculateAllLines } from '@/lib/irp/calculator'
import { incomeStatementStructureBank } from '@/lib/irp/structures'
import { LineItem } from '@/types/database.types'

// BBGCI BRIDGE BANK GROUP — Compte de résultat, two periods:
//   period 0 = Dec 2023 ("exercice N-1" on FY2423)
//   period 1 = Dec 2024 ("exercice N" on FY2423)
// Values copied verbatim from the published statement (signed as printed).
const lineItem = (poste: string, d2023: number, d2024: number): LineItem => ({
  poste,
  description: poste,
  amounts: [d2023, d2024],
  is_subtotal: false,
  is_total: false,
  indent_level: 0,
})

const bbgci: LineItem[] = [
  lineItem('CR_01', 46655, 54979),   // 1. Intérêts et produits assimilés
  lineItem('CR_02', -15546, -18768), // 2. Intérêts et charges assimilées
  lineItem('CR_03', 0, 0),           // 3. Revenus titres à revenu variable
  lineItem('CR_04', 23604, 23885),   // 4. Commissions (produits)
  lineItem('CR_05', -1401, -1893),   // 5. Commissions (charges)
  lineItem('CR_06', -3625, 206),     // 6. Gains/pertes négociation
  lineItem('CR_07', -272, 831),      // 7. Gains/pertes placement
  lineItem('CR_08', 480, 541),       // 8. Autres produits d'exploitation bancaire
  lineItem('CR_09', -523, -665),     // 9. Autres charges d'exploitation bancaire
  lineItem('CR_11', 0, 0),           // 11. Subventions d'investissement
  lineItem('CR_12', -19247, -21758), // 12. Charges générales d'exploitation
  lineItem('CR_13', -3631, -3052),   // 13. Dotations amortissements
  lineItem('CR_15', -2216, -6406),   // 15. Coût du risque
  lineItem('CR_17', 145, 261),       // 17. Gains/pertes actifs immobilisés
  lineItem('CR_19', -4653, -5369),   // 19. Impôts sur le bénéfice
]

describe('IRP bank income statement — sign handling (BBGCI regression)', () => {
  const rows = calculateAllLines(incomeStatementStructureBank, bbgci, 2)
  const dec2024 = (title: string) => rows.get(title)?.[1]
  const dec2023 = (title: string) => rows.get(title)?.[0]

  it('Total Interest Income / Expense pass through signed', () => {
    expect(dec2024('Total Interest Income')).toBe(54979)
    expect(dec2024('Total Interest Expense')).toBe(-18768)
  })

  it('Net Interest Income = income + (signed) expense, not minus', () => {
    // 54979 + (-18768) = 36211  (NOT 54979 - (-18768) = 73747)
    expect(dec2024('Net Interest Income')).toBe(36211)
    expect(dec2023('Net Interest Income')).toBe(46655 - 15546) // 31109
  })

  it('Net Fees & Commissions sums signed expense', () => {
    // 23885 + (-1893) = 21992  (NOT 25778)
    expect(dec2024('Net Fees & Commissions')).toBe(21992)
  })

  it('Produit Net Bancaire equivalent (Operating Profit before Provisions) = 34306', () => {
    // Matches line 14 RESULTAT BRUT D'EXPLOITATION on the PDF
    expect(dec2024('Operating Profit before Provision Expenses')).toBe(34306)
  })

  it('Operating Profit = 27900 (line 16 RESULTAT D EXPLOITATION)', () => {
    expect(dec2024('Operating Profit')).toBe(27900)
  })

  it('Pre-tax Profit = 28161 (line 18 RESULTAT AVANT IMPOT)', () => {
    expect(dec2024('Pre-tax Profit')).toBe(28161)
  })

  it('Net Income = 22792 (line 20 RESULTAT NET) — the headline fix', () => {
    // Was 33530 before the sign fix.
    expect(dec2024('Net Income')).toBe(22792)
    // And the prior year ties out too: 19770 on the PDF.
    expect(dec2023('Net Income')).toBe(19770)
  })
})
