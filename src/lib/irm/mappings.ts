// src/lib/irm/mappings.ts
// IRM (Investment Risk Memo) line definitions for WAEMU banks.
// Each IRM line aggregates one or more normalized poste codes from the
// bank's Actifs / Passifs / Compte de Résultats statements.
//
// Pattern mirrors the BNDA Mali IRM workbook:
//   - Balance sheet lines use the `stock` FX rule (fx_eop)
//   - Income statement lines use the `flow` FX rule (fx_avg)
// All source codes must exist in src/lib/normalization/banks/.

export type IrmMode = 'stock' | 'flow'
export type IrmSection = 'balance_sheet' | 'income_statement'

export interface IrmLineDef {
  /** Stable identifier, used by ratios to reference aggregated values. */
  id: string
  /** English label shown in the IRM view. */
  label: string
  /** French label (used by the CAMELS/IRP French-first convention). */
  label_fr: string
  section: IrmSection
  /** Determines which FX rate is applied: EOP for stocks, Avg for flows. */
  mode: IrmMode
  /** Normalized poste codes whose `amounts[i]` are summed into this line. */
  postes: string[]
  /** Flip the sign (useful for charge lines that are stored as negatives). */
  negate?: boolean
  /** If true, treat this as a section subtotal in the rendered table. */
  isSubtotal?: boolean
}

// ─── Balance sheet (USD mn) ────────────────────────────────────────────────
export const BANK_IRM_BALANCE_SHEET: IrmLineDef[] = [
  {
    id: 'cash_and_banks',
    label: 'Cash & deposits with banks',
    label_fr: 'Caisse & dépôts interbancaires',
    section: 'balance_sheet',
    mode: 'stock',
    postes: ['ACTIF_01', 'ACTIF_03'],
  },
  {
    id: 'investment_securities',
    label: 'Investment securities',
    label_fr: 'Titres de placement',
    section: 'balance_sheet',
    mode: 'stock',
    postes: ['ACTIF_02', 'ACTIF_05', 'ACTIF_10', 'ACTIF_11'],
  },
  {
    id: 'net_loans',
    label: 'Net loans to customers',
    label_fr: 'Créances nettes sur la clientèle',
    section: 'balance_sheet',
    mode: 'stock',
    postes: ['ACTIF_04'],
  },
  {
    id: 'other_assets',
    label: 'Other assets',
    label_fr: 'Autres actifs',
    section: 'balance_sheet',
    mode: 'stock',
    postes: [
      'ACTIF_06',
      'ACTIF_07',
      'ACTIF_08',
      'ACTIF_09',
      'ACTIF_12',
      'ACTIF_13',
      'ACTIF_14',
    ],
  },
  {
    id: 'total_assets',
    label: 'Total assets',
    label_fr: 'Total actif',
    section: 'balance_sheet',
    mode: 'stock',
    postes: ['ACTIF_TOTAL'],
    isSubtotal: true,
  },
  {
    id: 'deposits',
    label: 'Customer & interbank deposits',
    label_fr: 'Dépôts clientèle & interbancaires',
    section: 'balance_sheet',
    mode: 'stock',
    postes: ['PASSIF_01', 'PASSIF_02', 'PASSIF_03'],
  },
  {
    id: 'borrowings',
    label: 'Borrowings & subordinated debt',
    label_fr: 'Emprunts & dettes subordonnées',
    section: 'balance_sheet',
    mode: 'stock',
    postes: ['PASSIF_04', 'PASSIF_08'],
  },
  {
    id: 'other_liabilities',
    label: 'Other liabilities',
    label_fr: 'Autres passifs',
    section: 'balance_sheet',
    mode: 'stock',
    postes: ['PASSIF_05', 'PASSIF_06', 'PASSIF_07'],
  },
  {
    id: 'shareholders_equity',
    label: "Shareholders' equity",
    label_fr: 'Fonds propres',
    section: 'balance_sheet',
    mode: 'stock',
    postes: [
      'PASSIF_09',
      'PASSIF_10',
      'PASSIF_11',
      'PASSIF_12',
      'PASSIF_13',
      'PASSIF_14',
      'PASSIF_15',
      'PASSIF_16',
    ],
  },
  {
    id: 'total_liabilities_equity',
    label: 'Total liabilities & equity',
    label_fr: 'Total passif',
    section: 'balance_sheet',
    mode: 'stock',
    postes: ['PASSIF_TOTAL'],
    isSubtotal: true,
  },
]

// ─── Income statement (USD mn) ──────────────────────────────────────────────
export const BANK_IRM_INCOME_STATEMENT: IrmLineDef[] = [
  {
    id: 'net_interest_income',
    label: 'Net interest income',
    label_fr: "Marge nette d'intérêts",
    section: 'income_statement',
    mode: 'flow',
    // CR_02 (interest expense) is stored as a negative number in the
    // source statements, so a plain sum gives the net correctly.
    postes: ['CR_01', 'CR_02'],
  },
  {
    id: 'non_interest_income',
    label: 'Non-interest income',
    label_fr: "Produits non d'intérêts",
    section: 'income_statement',
    mode: 'flow',
    postes: ['CR_03', 'CR_04', 'CR_05', 'CR_06', 'CR_07', 'CR_08', 'CR_09'],
  },
  {
    id: 'operating_income',
    label: 'Operating income (PNB)',
    label_fr: 'Produit net bancaire',
    section: 'income_statement',
    mode: 'flow',
    postes: ['CR_10'],
    isSubtotal: true,
  },
  {
    id: 'operating_expenses',
    label: 'Operating expenses',
    label_fr: "Charges d'exploitation",
    section: 'income_statement',
    mode: 'flow',
    postes: ['CR_12', 'CR_13'],
  },
  {
    id: 'pre_provision_profit',
    label: 'Pre-provision profit (RBE)',
    label_fr: "Résultat brut d'exploitation",
    section: 'income_statement',
    mode: 'flow',
    postes: ['CR_14'],
    isSubtotal: true,
  },
  {
    id: 'cost_of_risk',
    label: 'Cost of risk',
    label_fr: 'Coût du risque',
    section: 'income_statement',
    mode: 'flow',
    postes: ['CR_15'],
  },
  {
    id: 'operating_result',
    label: 'Operating result',
    label_fr: "Résultat d'exploitation",
    section: 'income_statement',
    mode: 'flow',
    postes: ['CR_16'],
    isSubtotal: true,
  },
  {
    id: 'tax',
    label: 'Income tax',
    label_fr: 'Impôt sur les bénéfices',
    section: 'income_statement',
    mode: 'flow',
    postes: ['CR_19'],
  },
  {
    id: 'net_profit',
    label: 'Net profit',
    label_fr: 'Résultat net',
    section: 'income_statement',
    mode: 'flow',
    postes: ['CR_20'],
    isSubtotal: true,
  },
]

export const BANK_IRM_LINES: IrmLineDef[] = [
  ...BANK_IRM_BALANCE_SHEET,
  ...BANK_IRM_INCOME_STATEMENT,
]
