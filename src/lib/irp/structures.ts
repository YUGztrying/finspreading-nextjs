// src/lib/irp/structures.ts
// IRP Report Structures for Banks and Microfinance
// Based on IFC Investment Risk Platform standards

export interface IRPLineItem {
  title: string
  type?: 'header' | 'subheader' | 'finalTotal' | 'majorTotal'
  keywords?: string[]
  isSumOfCodes?: boolean
  isCalculated?: boolean
  components?: Array<string | { name: string; sign: '+' | '-' }>
  isSubtraction?: boolean
  defaultValue?: number
  isTotal?: boolean
}

// ========================================
// MICROFINANCE - BALANCE SHEET (ASSETS)
// ========================================
export const assetsStructureMicrofinance: IRPLineItem[] = [
  { title: 'ASSETS', type: 'header' },
  { title: 'Cash & Due from Banks (Non Interest Earning)', keywords: ['MFA_A11', 'MFA_A12', 'MFA_A3B'], isSumOfCodes: true },
  { title: 'Accounts Receivable', keywords: ['MFA_C40'], isSumOfCodes: true },
  { title: 'Cash & Accounts Receivable', isCalculated: true, components: ['Cash & Due from Banks (Non Interest Earning)', 'Accounts Receivable'] },

  { title: 'Earning Assets', type: 'subheader' },
  { title: 'Securities', type: 'subheader' },
  { title: 'Government Securities (Trading & AFS)', keywords: ['MFA_C10'], isSumOfCodes: true },
  { title: 'Government Securities (Held to Maturity)', keywords: [], isSumOfCodes: true },
  { title: 'Other Trading Securities', keywords: [], isSumOfCodes: true },
  { title: 'Original Mortgage Servicing Rights', keywords: [], isSumOfCodes: true },
  { title: 'Purchased Mortgage Servicing Rights', keywords: [], isSumOfCodes: true },
  { title: 'Loans or Acquired Portfolio - Held for Sale (UPB)', keywords: [], isSumOfCodes: true },
  { title: 'Corporate Debt Securities', keywords: ['MFA_D10'], isSumOfCodes: true },
  { title: 'Investments in Other Securities & Financial Instruments', keywords: ['MFA_C55', 'MFA_C6A'], isSumOfCodes: true },
  { title: 'Other Asset Backed Securities', keywords: [], isSumOfCodes: true },
  { title: 'Total Securities', isCalculated: true, components: [
    'Government Securities (Trading & AFS)', 'Government Securities (Held to Maturity)', 'Other Trading Securities',
    'Original Mortgage Servicing Rights', 'Purchased Mortgage Servicing Rights', 'Loans or Acquired Portfolio - Held for Sale (UPB)',
    'Corporate Debt Securities', 'Investments in Other Securities & Financial Instruments', 'Other Asset Backed Securities'
  ] },

  { title: 'Loan Portfolio', type: 'subheader' },
  { title: 'Loans', keywords: ['MFA_B01', 'MFA_D50', 'MFA_D60'], isSumOfCodes: true },
  { title: 'Mortgage Loans', keywords: [], isSumOfCodes: true },
  { title: 'DARP Receivables', keywords: [], isSumOfCodes: true },
  { title: 'Other Receivables', keywords: [], isSumOfCodes: true },
  { title: 'Gross Loans', isCalculated: true, components: ['Loans', 'Mortgage Loans', 'DARP Receivables', 'Other Receivables'] },
  { title: 'Less: Unearned Income', keywords: [], isSumOfCodes: true },
  { title: 'Less: Allowance for Loan Loss Reserve', keywords: ['MFA_D70'], isSumOfCodes: true },
  { title: 'Net Loans & Receivables', isCalculated: true, components: ['Gross Loans', 'Less: Unearned Income', 'Less: Allowance for Loan Loss Reserve'], isSubtraction: true },

  { title: 'Other Earning Assets', type: 'subheader' },
  { title: 'Interest Bearing Deposits', keywords: ['MFA_A2A', 'MFA_A60'], isSumOfCodes: true },
  { title: 'Other Earning Assets', keywords: ['MFA_A3A', 'MFA_A70'], isSumOfCodes: true },
  { title: 'Total Other Earning Assets', isCalculated: true, components: ['Interest Bearing Deposits', 'Other Earning Assets'] },

  { title: 'Total Earning Assets', isCalculated: true, components: ['Total Securities', 'Net Loans & Receivables', 'Total Other Earning Assets'] },

  { title: 'Other Assets', type: 'subheader' },
  { title: 'Carried Interest (DARP Only)', defaultValue: 0 },
  { title: 'Foreclosed Real Estate (OREO)', defaultValue: 0 },
  { title: 'Land', defaultValue: 0 },
  { title: 'Fixed Assets', keywords: ['MFA_D25', 'MFA_D36', 'MFA_D45', 'MFA_D47'], isSumOfCodes: true },
  { title: 'Less: Accumulated Depreciation', defaultValue: 0 },
  { title: 'Net Fixed Assets', defaultValue: 0 },
  { title: 'Goodwill - Net', defaultValue: 0 },
  { title: 'Intangible Assets - Net', keywords: ['MFA_D24', 'MFA_D31', 'MFA_D41', 'MFA_D46'], isSumOfCodes: true },
  { title: 'Current Tax Assets', defaultValue: 0 },
  { title: 'Deferred Tax Assets', defaultValue: 0 },
  { title: 'Investments in Subsidiaries/Affiliates', keywords: ['MFA_D1A'], isSumOfCodes: true },
  { title: 'Other Non Earning Assets', keywords: ['MFA_C30', 'MFA_D1S'], isSumOfCodes: true },
  { title: 'Total Other Assets', isCalculated: true, components: [
    'Carried Interest (DARP Only)', 'Foreclosed Real Estate (OREO)', 'Land', 'Fixed Assets', 'Less: Accumulated Depreciation',
    'Net Fixed Assets', 'Goodwill - Net', 'Intangible Assets - Net', 'Current Tax Assets', 'Deferred Tax Assets',
    'Investments in Subsidiaries/Affiliates', 'Other Non Earning Assets'
  ]},

  { title: 'Total Assets', type: 'finalTotal', isCalculated: true, components: ['Cash & Accounts Receivable', 'Total Earning Assets', 'Total Other Assets'] },
]

// ========================================
// MICROFINANCE - BALANCE SHEET (LIABILITIES)
// ========================================
export const liabilitiesStructureMicrofinance: IRPLineItem[] = [
  { title: 'Liabilities', type: 'header' },
  { title: 'Current Liabilities', type: 'subheader' },
  { title: 'Deposits', type: 'subheader' },
  { title: 'Savings Deposits - Interest Bearing', keywords: ['MFP_G2A'], isSumOfCodes: true },
  { title: 'Time Deposits - Interest Bearing', keywords: ['MFP_G15', 'MFP_G30', 'MFP_G60', 'MFP_G70'], isSumOfCodes: true },
  { title: 'Other Deposits - Non Interest Bearing', keywords: ['MFP_G10'], isSumOfCodes: true },
  { title: 'Total Deposits', isCalculated: true, components: ['Savings Deposits - Interest Bearing', 'Time Deposits - Interest Bearing', 'Other Deposits - Non Interest Bearing'] },

  { title: 'Short Term Loans', type: 'subheader' },
  { title: 'Short Term Loans Payable - Bank', keywords: ['MFP_F1A', 'MFP_F3E', 'MFP_F50', 'MFP_F2A'], isSumOfCodes: true },
  { title: 'Short Term Loans Payable - Other', keywords: [], isSumOfCodes: true },
  { title: 'Other Short Term Debt', keywords: ['MFP_L32', 'MFP_L33'], isSumOfCodes: true },
  { title: 'Current Portion - Long Term Debt', keywords: [], isSumOfCodes: true },
  { title: 'Commercial Paper Outstanding', keywords: [], isSumOfCodes: true },
  { title: 'Short Term Non-Commercial Borrowing (MFI only)', keywords: [], isSumOfCodes: true },
  { title: 'Total Short Term Loans', isCalculated: true, components: [
    'Short Term Loans Payable - Bank', 'Short Term Loans Payable - Other', 'Other Short Term Debt',
    'Current Portion - Long Term Debt', 'Commercial Paper Outstanding', 'Short Term Non-Commercial Borrowing (MFI only)'
  ] },

  { title: 'Other Current Liabilities', type: 'subheader' },
  { title: 'Accounts Payable/Trade Payable', keywords: [], isSumOfCodes: true },
  { title: 'Other Accounts Payable', keywords: ['MFP_H40', 'MFP_H6A'], isSumOfCodes: true },
  { title: 'Income Taxes Payable', keywords: [], isSumOfCodes: true },
  { title: 'Deferred Income Taxes', keywords: [], isSumOfCodes: true },
  { title: 'Accrued Liabilities', keywords: ['MFP_F60'], isSumOfCodes: true },
  { title: 'Other Taxes Payable', keywords: [], isSumOfCodes: true },
  { title: 'Other Accrued and Deferred Liabilities', keywords: ['MFP_G90', 'MFP_H10', 'MFP_L43'], isSumOfCodes: true },
  { title: 'Other Current Liabilities', keywords: [], isSumOfCodes: true },
  { title: 'Total Other Current Liabilities', isCalculated: true, components: [
    'Accounts Payable/Trade Payable', 'Other Accounts Payable', 'Income Taxes Payable', 'Deferred Income Taxes',
    'Accrued Liabilities', 'Other Taxes Payable', 'Other Accrued and Deferred Liabilities', 'Other Current Liabilities'
  ] },

  { title: 'Total Current Liabilities', isCalculated: true, components: ['Total Deposits', 'Total Short Term Loans', 'Total Other Current Liabilities'] },

  { title: 'Non-Current Liabilities', type: 'subheader' },
  { title: 'Long Term Debt - Bank', keywords: ['MFP_F3F'], isSumOfCodes: true },
  { title: 'Long Term Debt - IFC', keywords: [], isSumOfCodes: true },
  { title: 'Other Long Term Debt', keywords: [], isSumOfCodes: true },
  { title: 'Other Lines of Credit', keywords: [], isSumOfCodes: true },
  { title: 'Subordinated Debt', keywords: ['MFP_L41'], isSumOfCodes: true },
  { title: 'Warehouse or Other Collateralized Lines of Credit', keywords: [], isSumOfCodes: true },
  { title: 'Mortgage Backed Bonds', keywords: [], isSumOfCodes: true },
  { title: 'Long Term Non-Commercial Borrowing (MFI Only)', keywords: [], isSumOfCodes: true },
  { title: 'Total Non-Current Liabilities', isCalculated: true, components: [
    'Long Term Debt - Bank', 'Long Term Debt - IFC', 'Other Long Term Debt', 'Other Lines of Credit',
    'Subordinated Debt', 'Warehouse or Other Collateralized Lines of Credit', 'Mortgage Backed Bonds',
    'Long Term Non-Commercial Borrowing (MFI Only)'
  ] },

  { title: 'Total Liabilities', isCalculated: true, components: ['Total Current Liabilities', 'Total Non-Current Liabilities'] },

  { title: 'Equity', type: 'subheader' },
  { title: 'Common Shares', keywords: ['MFP_L60'], isSumOfCodes: true },
  { title: 'Paid-in Capital', keywords: ['MFP_L50'], isSumOfCodes: true },
  { title: 'Retained Earnings', keywords: ['MFP_L70', 'MFP_L75', 'MFP_L80'], isSumOfCodes: true },
  { title: 'Reserves', keywords: ['MFP_L55'], isSumOfCodes: true },
  { title: 'Donated Equity (MFI only)', keywords: [], isSumOfCodes: true },
  { title: 'Preferred Shares Equity', keywords: [], isSumOfCodes: true },
  { title: 'Other Common Equity', keywords: [], isSumOfCodes: true },
  { title: 'Less: Treasury Stock (-)', keywords: [], isSumOfCodes: true },
  { title: 'Other Comprehensive Income', keywords: [], isSumOfCodes: true },
  { title: 'Treasury Stock', keywords: [], isSumOfCodes: true },
  { title: 'Minority Interest', keywords: [], isSumOfCodes: true },
  { title: 'Total Common Equity', isCalculated: true, components: [
    'Common Shares', 'Paid in Capital', 'Retained Earnings', 'Reserves', 'Fixed Assets Revaluation Reserves',
    'Donated Equity (MFI only)', 'Preferred Shares Equity', 'Other Common Equity', 'Less: Treasury Stock (-)'
  ]},
  { title: 'Minority Interest', type: 'subheader' },
  { title: 'Non-Controlling Interest', keywords: [], isSumOfCodes: true },

  { title: 'Other Comprehensive Income', type: 'subheader' },
  { title: 'Securities Revaluation Reserves', keywords: [], isSumOfCodes: true },
  { title: 'Foreign Exchange Revaluation Reserves', keywords: [], isSumOfCodes: true },
  { title: 'Fixed Asset Revaluations', keywords: [], isSumOfCodes: true },
  { title: 'Other Accumulated OCI', keywords: [], isSumOfCodes: true },
  { title: 'Total OCI', isCalculated: true, components: ['Securities Revaluation Reserves', 'Foreign Exchange Revaluation Reserves', 'Fixed Asset Revaluations', 'Other Accumulated OCI'] },

  { title: 'TOTAL EQUITY', isCalculated: true, components: ['Total Common Equity', 'Non-Controlling Interest', 'Total OCI'] },

  { title: 'Total Liabilities & EQUITY', type: 'finalTotal', isCalculated: true, components: ['Total Liabilities', 'TOTAL EQUITY'] },
];

// ========================================
// MICROFINANCE - INCOME STATEMENT
// ========================================
export const incomeStatementStructureMicrofinance: IRPLineItem[] = [
  { title: 'INCOME STATEMENT', type: 'header' },
  { title: 'Statement Date', type: 'subheader' },

  // Total Interest Income
  { title: 'Total Interest Income', type: 'subheader' },
  { title: 'Loan Interest Income', keywords: ['MFP_V3B'], isSumOfCodes: true },
  { title: 'Other Interest Income', keywords: ['MFP_V2Q', 'MFP_V3R', 'MFP_V2a', 'MFP_V1A', 'MFP_V1L'], isSumOfCodes: true },
  { title: 'Total Interest Income', keywords: [], isCalculated: true, components: [{name: 'Loan Interest Income', sign: '+'}, {name: 'Other Interest Income', sign: '+' }], type: 'majorTotal' },

  // Total Interest Expenses
  { title: 'Interest on Deposits', keywords: ['MFC_R1L', 'MFC_R3C'], isSumOfCodes: true },
  { title: 'Interest Expense', keywords: ['MFC_R2A', 'MFC_R5Y'], isSumOfCodes: true },
  { title: 'Total Interest Expenses', keywords: [], isCalculated: true, components: [{name: 'Interest on Deposits', sign: '+'}, {name: 'Interest Expense', sign: '+' }], type: 'majorTotal' },

  // Net Interest Margin
  { title: 'Net Interest Margin', keywords: [], isCalculated: true, components: [{name: 'Total Interest Income', sign: '+'}, {name: 'Total Interest Expenses', sign: '-' }], type: 'majorTotal' },

  // Non-Interest Income
  { title: 'Other Fees - Net', keywords: ['MFP_V2T', 'MFP_V3X', '-MFC_R2Z', '-MFC_R3T'], isSumOfCodes: true },
  { title: 'Total Fee Income', keywords: [], isCalculated: true, components: [{name: 'Other Fees - Net', sign: '+'}] },

  { title: 'Investment Income (Other than Interest)', keywords: []},
  { title: 'Total Investment Income', keywords: [], isCalculated: true, components: [{name: 'Investment Income (Other than Interest)', sign: '+'}] },

  { title: 'Other Income', keywords: ['MFP_W4A', 'MFP_V7D', 'MFP_V8A'], isSumOfCodes: true },
  { title: 'Total Other Income', keywords: [], isCalculated: true, components: [{name: 'Other Income', sign: '+'}] },

  { title: 'Total Operating Income', keywords: [], isCalculated: true, components: [{name: 'Net Interest Margin', sign: '+'}, {name: 'Total Fee Income', sign: '+'}, {name: 'Total Investment Income', sign: '+'}, {name: 'Total Other Income', sign: '+' }], type: 'majorTotal' },

  // Operating Expenses
  { title: 'Personnel Expenses', keywords: ['MFC_S02'], isSumOfCodes: true },
  { title: 'Sales, General & Administrative Expenses', keywords: ['MFC_S2A'], isSumOfCodes: true },
  { title: 'Depreciation & Amortization Expense', keywords: ['MFC_T53', 'MFC_T54', 'MFC_T55'], isSumOfCodes: true },
  { title: 'All Other Expenses', keywords: ['MFC_S1A', 'MFC_Z27'], isSumOfCodes: true, keywordsDescription: ['ACHAT ET VARIATION DE STOCK'] },
  { title: 'Total Operating Expenses', isCalculated: true, components: [
      {name: 'Personnel Expenses', sign: '+'}, {name: 'Sales, General & Administrative Expenses', sign: '+'},
      {name: 'Depreciation & Amortization Expense', sign: '+'}, {name: 'All Other Expenses', sign: '+'}
  ], type: 'majorTotal' },

  { title: 'Operating Profit before Provision Expenses', isCalculated: true, components: [{name: 'Total Operating Income', sign: '+'}, {name: 'Total Operating Expenses', sign: '-' }], type: 'majorTotal' },

  { title: 'Net Provision Expenses on Loan Portfolio', keywords: ['MFC_T6B', '-MFP_X6B'], isSumOfCodes: true },

  { title: 'Net Profit From Operations', isCalculated: true, components: [{name: 'Operating Profit before Provision Expenses', sign: '+'}, {name: 'Net Provision Expenses on Loan Portfolio', sign: '-' }], type: 'majorTotal' },

  // Non Operating Income/Expense
  { title: 'Non Operating Income/Expense', type: 'subheader' },
  { title: 'Non Recurring Income', keywords: [], isSumOfCodes: true },
  { title: 'Non Recurring Expense', keywords: ['MFC_T80', 'MFC_T81'], isSumOfCodes: true },
  { title: 'Other Non-Operating Income & (Expenses)', keywords: ['MFP_X80', 'MFP_X81', 'MFP_X51'], isSumOfCodes: true },

  { title: 'Profit Before Taxes', isCalculated: true, components: [{name: 'Net Profit From Operations', sign: '+'}, {name: 'Non Recurring Income', sign: '+'}, {name: 'Non Recurring Expense', sign: '-'}, {name: 'Other Non-Operating Income & (Expenses)', sign: '+' }], type: 'majorTotal' },

  { title: 'Income Taxes', keywords: ['MFC_T82'], isSumOfCodes: true },

  { title: 'Net Income', isCalculated: true, components: [{name: 'Profit Before Taxes', sign: '+'}, {name: 'Income Taxes', sign: '-' }], type: 'finalTotal' },

  { title: 'Net Income Attributable to Non Controlling Interests', keywords: [] },
  { title: 'Net Income Attributable to Parent Shareholders', isCalculated: true, components: [{name: 'Net Income', sign: '+'}, {name: 'Net Income Attributable to Non Controlling Interests', sign: '-' }], type: 'finalTotal' },

  { title: 'OTHER COMPREHENSIVE INCOME', type: 'header' },
  { title: 'Change in Value of AFS Investments', keywords: [] },
  { title: 'Revaluation of Fixed Assets', keywords: [] },
  { title: 'Currency Translation Differences', keywords: [] },
  { title: 'Remaining OCI Gains(Losses)', keywords: [] },
  { title: 'Other Comprehensive Income', isCalculated: true, components: [{name: 'Change in Value of AFS Investments', sign: '+'}, {name: 'Revaluation of Fixed Assets', sign: '+'}, {name: 'Currency Translation Differences', sign: '+'}, {name: 'Remaining OCI Gains(Losses)', sign: '+'}] },
  { title: 'Total Comprehensive Income', isCalculated: true, components: [{name: 'Net Income Attributable to Parent Shareholders', sign: '+'}, {name: 'Other Comprehensive Income', sign: '+' }], type: 'finalTotal' },
  { title: 'TCI Attributable to Non Controlling Interests', keywords: [] },
  { title: 'TCI Attributable to Parent Shareholders', isCalculated: true, components: [{name: 'Total Comprehensive Income', sign: '+'}, {name: 'TCI Attributable to Non Controlling Interests', sign: '-' }], type: 'finalTotal' }
];

// ========================================
// BANK - INCOME STATEMENT
// ========================================
export const incomeStatementStructureBank: IRPLineItem[] = [
  { title: 'INCOME STATEMENT', type: 'header' },

  { title: 'REVENUS ET CHARGES D\'INTERETS', type: 'subheader' },
  { title: 'Interest Income on Loans & Advances', keywords: [] },
  { title: 'Interest Income on Securities', keywords: [] },
  { title: 'Other Interest Income', keywords: ['CR_01'] },
  { title: 'Total Interest Income', isCalculated: true, components: [
    { name: 'Interest Income on Loans & Advances', sign: '+' },
    { name: 'Interest Income on Securities', sign: '+' },
    { name: 'Other Interest Income', sign: '+' }
  ]},

  { title: 'Interest Expense on Deposits', keywords: [] },
  { title: 'Interest Expense on Borrowings', keywords: [] },
  { title: 'Other Interest Expense', keywords: ['CR_02'] },
  { title: 'Total Interest Expense', isCalculated: true, components: [
    { name: 'Interest Expense on Deposits', sign: '+' },
    { name: 'Interest Expense on Borrowings', sign: '+' },
    { name: 'Other Interest Expense', sign: '+' }
  ]},
  
  { title: 'Net Interest Income', isCalculated: true, components: [
    { name: 'Total Interest Income', sign: '+' },
    { name: 'Total Interest Expense', sign: '-' }
  ]},

  { title: 'REVENUS HORS INTERETS (NON-INTEREST INCOME)', type: 'subheader' },
  { title: 'Net Gains(Losses) from Securities - Trading', keywords: ['CR_06'] },
  { title: 'Net Gains(Losses) from FX Trading', keywords: [] },
  { title: 'Net Gains(Losses) from Derivatives - Trading', keywords: [] },
  { title: 'Net Gains(Losses) from Other Trading', keywords: [] },
  { title: 'Net Trading Income', isCalculated: true, components: [
    { name: 'Net Gains(Losses) from Securities - Trading', sign: '+' },
    { name: 'Net Gains(Losses) from FX Trading', sign: '+' },
    { name: 'Net Gains(Losses) from Derivatives - Trading', sign: '+' },
    { name: 'Net Gains(Losses) from Other Trading', sign: '+' }
  ]},

  { title: 'Realized Gains(Losses) on Assets, Liabilities at Fair Value', keywords: ['CR_07'] },
  { title: 'Realized Gains(Losses) on Hedges at Fair Value', keywords: [] },
  { title: 'Net Gains(Losses) on Assets, Liab. & Hedges at Fair Value', isCalculated: true, components: [
    { name: 'Realized Gains(Losses) on Assets, Liabilities at Fair Value', sign: '+' },
    { name: 'Realized Gains(Losses) on Hedges at Fair Value', sign: '+' }
  ]},

  { title: 'Other Investment Income', keywords: [] },
  { title: 'Net Insurance Income', keywords: [] },
  { title: 'Fees and Commissions Income', keywords: ['CR_04'] },
  { title: 'Less: Fees and Commissions Expense (-)', keywords: ['CR_05'] },
  { title: 'Net Fees & Commissions', isCalculated: true, components: [
    { name: 'Fees and Commissions Income', sign: '+' },
    { name: 'Less: Fees and Commissions Expense (-)', sign: '-' }
  ]},

  { title: 'Profit (Loss) from Op. Investments Accounted under Equity Method', keywords: [] },
  { title: 'Dividend Income', keywords: ['CR_03'] },
  { title: 'Other Operating Income', keywords: ['CR_08', 'CR_11'], isSumOfCodes: true },
  { title: 'Other Non-Interest Income', isCalculated: true, components: [
    { name: 'Profit (Loss) from Op. Investments Accounted under Equity Method', sign: '+' },
    { name: 'Dividend Income', sign: '+' },
    { name: 'Other Operating Income', sign: '+' }
  ]},
  
  { title: 'Non-Interest Income', isCalculated: true, components: [
    { name: 'Net Trading Income', sign: '+' },
    { name: 'Net Gains(Losses) on Assets, Liab. & Hedges at Fair Value', sign: '+' },
    { name: 'Net Fees & Commissions', sign: '+' },
    { name: 'Other Non-Interest Income', sign: '+' }
  ]},
  
  { title: 'CHARGES HORS INTERETS (NON-INTEREST EXPENSES)', type: 'subheader' },
  { title: 'Personnel Expenses', keywords: [] },
  { title: 'Operating Premises Expense', keywords: [] },
  { title: 'Depreciation & Amortization Expense', keywords: ['CR_13'] },
  { title: 'Impairment Charges on Non Credit Related Items', keywords: [] },
  { title: 'FX Translation Losses (Gains)', keywords: [] },
  { title: 'Other Operating Expenses', keywords: ['CR_09', 'CR_12'], isSumOfCodes: true },
  { title: 'Non-Interest Expenses', isCalculated: true, components: [
    { name: 'Personnel Expenses', sign: '+' },
    { name: 'Operating Premises Expense', sign: '+' },
    { name: 'Depreciation & Amortization Expense', sign: '+' },
    { name: 'Impairment Charges on Non Credit Related Items', sign: '+' },
    { name: 'FX Translation Losses (Gains)', sign: '+' },
    { name: 'Other Operating Expenses', sign: '+' }
  ]},
  
  { title: 'Operating Profit before Provision Expenses', isCalculated: true, components: [
    { name: 'Net Interest Income', sign: '+' },
    { name: 'Non-Interest Income', sign: '+' },
    { name: 'Non-Interest Expenses', sign: '-' }
  ]},

  { title: 'PROVISIONS ET RESULTAT', type: 'subheader' },
  { title: 'Loan Loss Provisions - Gross', keywords: ['CR_15'] },
  { title: 'Securities and Other Credit Impairment Charges - Gross', keywords: [] },
  { title: 'Less: Recoveries (-)', keywords: [] },
  { title: 'Provision Expenses', isCalculated: true, components: [
    { name: 'Loan Loss Provisions - Gross', sign: '+' },
    { name: 'Securities and Other Credit Impairment Charges - Gross', sign: '+' },
    { name: 'Less: Recoveries (-)', sign: '-' }
  ]},

  { title: 'Operating Profit', isCalculated: true, components: [
    { name: 'Operating Profit before Provision Expenses', sign: '+' },
    { name: 'Provision Expenses', sign: '-' }
  ]},

  { title: 'P/L from Non Op. Invest. Accounted under Equity Method', keywords: [] },
  { title: 'Non Recurring Income', keywords: [] },
  { title: 'Non Recurring Expense', keywords: [] },
  { title: 'Other Non-operating Income & (Expenses)', keywords: ['CR_17'] },

  { title: 'Pre-tax Profit', isCalculated: true, components: [
    { name: 'Operating Profit', sign: '+' },
    { name: 'P/L from Non Op. Invest. Accounted under Equity Method', sign: '+' },
    { name: 'Non Recurring Income', sign: '+' },
    { name: 'Non Recurring Expense', sign: '+' },
    { name: 'Other Non-operating Income & (Expenses)', sign: '+' }
  ]},
  
  { title: 'Tax expense', keywords: ['CR_19'] },
  { title: 'Profit(Loss) from Discontinued Operations', keywords: [] },

  { title: 'Net Income', type: 'finalTotal', isCalculated: true, components: [
    { name: 'Pre-tax Profit', sign: '+' },
    { name: 'Tax expense', sign: '-' },
    { name: 'Profit(Loss) from Discontinued Operations', sign: '+' }
  ]},
]