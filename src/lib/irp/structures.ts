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
    'Common Shares', 'Paid-in Capital', 'Retained Earnings', 'Reserves',
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

  { title: 'Total Interest Income', type: 'subheader' },
  { title: 'Loan Interest Income', keywords: ['MFP_V3B'], isSumOfCodes: true },
  { title: 'Other Interest Income', keywords: ['MFP_V2Q', 'MFP_V3R', 'MFP_V2a', 'MFP_V1A', 'MFP_V1L'], isSumOfCodes: true },
  { title: 'Total Interest Income', keywords: [], isCalculated: true, components: [{name: 'Loan Interest Income', sign: '+'}, {name: 'Other Interest Income', sign: '+' }], type: 'majorTotal' },

  { title: 'Interest on Deposits', keywords: ['MFC_R1L', 'MFC_R3C'], isSumOfCodes: true },
  { title: 'Interest Expense', keywords: ['MFC_R2A', 'MFC_R5Y'], isSumOfCodes: true },
  { title: 'Total Interest Expenses', keywords: [], isCalculated: true, components: [{name: 'Interest on Deposits', sign: '+'}, {name: 'Interest Expense', sign: '+' }], type: 'majorTotal' },

  { title: 'Net Interest Margin', keywords: [], isCalculated: true, components: [{name: 'Total Interest Income', sign: '+'}, {name: 'Total Interest Expenses', sign: '-' }], type: 'majorTotal' },

  { title: 'Other Fees - Net', keywords: ['MFP_V2T', 'MFP_V3X', '-MFC_R2Z', '-MFC_R3T'], isSumOfCodes: true },
  { title: 'Total Fee Income', keywords: [], isCalculated: true, components: [{name: 'Other Fees - Net', sign: '+'}] },

  { title: 'Investment Income (Other than Interest)', keywords: []},
  { title: 'Total Investment Income', keywords: [], isCalculated: true, components: [{name: 'Investment Income (Other than Interest)', sign: '+'}] },

  { title: 'Other Income', keywords: ['MFP_W4A', 'MFP_V7D', 'MFP_V8A'], isSumOfCodes: true },
  { title: 'Total Other Income', keywords: [], isCalculated: true, components: [{name: 'Other Income', sign: '+'}] },

  { title: 'Total Operating Income', keywords: [], isCalculated: true, components: [{name: 'Net Interest Margin', sign: '+'}, {name: 'Total Fee Income', sign: '+'}, {name: 'Total Investment Income', sign: '+'}, {name: 'Total Other Income', sign: '+' }], type: 'majorTotal' },

  { title: 'Personnel Expenses', keywords: ['MFC_S02'], isSumOfCodes: true },
  { title: 'Sales, General & Administrative Expenses', keywords: ['MFC_S2A'], isSumOfCodes: true },
  { title: 'Depreciation & Amortization Expense', keywords: ['MFC_T53', 'MFC_T54', 'MFC_T55'], isSumOfCodes: true },
  { title: 'All Other Expenses', keywords: ['MFC_S1A', 'MFC_Z27'], isSumOfCodes: true },
  { title: 'Total Operating Expenses', isCalculated: true, components: [
      {name: 'Personnel Expenses', sign: '+'}, {name: 'Sales, General & Administrative Expenses', sign: '+'},
      {name: 'Depreciation & Amortization Expense', sign: '+'}, {name: 'All Other Expenses', sign: '+'}
  ], type: 'majorTotal' },

  { title: 'Operating Profit before Provision Expenses', isCalculated: true, components: [{name: 'Total Operating Income', sign: '+'}, {name: 'Total Operating Expenses', sign: '-' }], type: 'majorTotal' },

  { title: 'Net Provision Expenses on Loan Portfolio', keywords: ['MFC_T6B', '-MFP_X6B'], isSumOfCodes: true },

  { title: 'Net Profit From Operations', isCalculated: true, components: [{name: 'Operating Profit before Provision Expenses', sign: '+'}, {name: 'Net Provision Expenses on Loan Portfolio', sign: '-' }], type: 'majorTotal' },

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

export const assetsStructureBank: IRPLineItem[] = [
  { title: 'ASSETS', type: 'header' },
  { title: 'EARNING ASSETS', type: 'header' },
  { title: 'Loan Portfolio', type: 'subheader' },
  { title: 'Corporate & Commercial Loans and Leases', keywords: [] },
  { title: 'Retail Loans and Leases (incl. Residential Mortgage)', keywords: [] },
  { title: 'Loans and Leases to Banks', keywords: [] },
  { title: 'Loans and Leases to Governments', keywords: [] },
  { title: 'Other Loans and Leases', keywords: ['ACTIF_04'] },
  { title: 'Gross Loans', isCalculated: true, components: [
    { name: 'Corporate & Commercial Loans and Leases', sign: '+' },
    { name: 'Retail Loans and Leases (incl. Residential Mortgage)', sign: '+' },
    { name: 'Loans and Leases to Banks', sign: '+' },
    { name: 'Loans and Leases to Governments', sign: '+' },
    { name: 'Other Loans and Leases', sign: '+' }
  ]},
  { title: 'Less: Unearned Income (-)', keywords: [] },
  { title: 'Less: Reserves for Impaired Loans (NPLs) (-)', keywords: [] },
  { title: 'Net Loans', isCalculated: true, components: [
    { name: 'Gross Loans', sign: '+' },
    { name: 'Less: Unearned Income (-)', sign: '-' },
    { name: 'Less: Reserves for Impaired Loans (NPLs) (-)', sign: '-' }
  ]},
  
  { title: 'Securities & Derivatives', type: 'subheader' },
  { title: 'Treasury Bills - Trading', keywords: [] },
  { title: 'Government Bonds - Trading', keywords: [] },
  { title: 'Corporate Bonds - Trading', keywords: [] },
  { title: 'Bonds Issued by Fis - Trading', keywords: [] },
  { title: 'Other Debt Securities - Trading', keywords: [] },
  { title: 'Debt Securities -Trading', isCalculated: true, components: [
    { name: 'Treasury Bills - Trading', sign: '+' },
    { name: 'Government Bonds - Trading', sign: '+' },
    { name: 'Corporate Bonds - Trading', sign: '+' },
    { name: 'Bonds Issued by Fis - Trading', sign: '+' },
    { name: 'Other Debt Securities - Trading', sign: '+' }
  ]},
  { title: 'Equities - Trading', keywords: [] },
  { title: 'Less: Reserves for Impaired Trading Securities (-)', keywords: [] },
  { title: 'Total Trading Securities (at Fair Value through Income statement)', isCalculated: true, components: [
    { name: 'Debt Securities -Trading', sign: '+' },
    { name: 'Equities - Trading', sign: '+' },
    { name: 'Less: Reserves for Impaired Trading Securities (-)', sign: '-' }
  ]},
  
  { title: 'Treasury Bills - AFS', keywords: [] },
  { title: 'Government Bonds - AFS', keywords: ['ACTIF_02'] },
  { title: 'Corporate Bonds - AFS', keywords: [] },
  { title: 'Bonds Issued by Fis - AFS', keywords: [] },
  { title: 'Other Debt Securities - AFS', keywords: ['ACTIF_05'] },
  { title: 'Debt Securities - AFS', isCalculated: true, components: [
    { name: 'Treasury Bills - AFS', sign: '+' },
    { name: 'Government Bonds - AFS', sign: '+' },
    { name: 'Corporate Bonds - AFS', sign: '+' },
    { name: 'Bonds Issued by Fis - AFS', sign: '+' },
    { name: 'Other Debt Securities - AFS', sign: '+' }
  ]},
  { title: 'Equities - AFS', keywords: ['ACTIF_06'] },
  { title: 'Less: Reserves for Impaired AFS Securities (-)', keywords: [] },
  { title: 'Total Available for Sale (AFS) Securities', isCalculated: true, components: [
    { name: 'Debt Securities - AFS', sign: '+' },
    { name: 'Equities - AFS', sign: '+' },
    { name: 'Less: Reserves for Impaired AFS Securities (-)', sign: '-' }
  ]},
  
  { title: 'Government Bonds -HTM', keywords: [] },
  { title: 'Corporate Bonds - HTM', keywords: [] },
  { title: 'Bonds issued by Fis - HTM', keywords: [] },
  { title: 'Other Debt Securities - HTM', keywords: [] },
  { title: 'Debt Securities - HTM', isCalculated: true, components: [
    { name: 'Government Bonds -HTM', sign: '+' },
    { name: 'Corporate Bonds - HTM', sign: '+' },
    { name: 'Bonds issued by Fis - HTM', sign: '+' },
    { name: 'Other Debt Securities - HTM', sign: '+' }
  ]},
  { title: 'Equities - HTM', keywords: [] },
  { title: 'Less: Reserves for Impaired HTM Securities (-)', keywords: [] },
  { title: 'Total Held to Maturity (HTM) Securities', isCalculated: true, components: [
    { name: 'Debt Securities - HTM', sign: '+' },
    { name: 'Equities - HTM', sign: '+' },
    { name: 'Less: Reserves for Impaired HTM Securities (-)', sign: '-' }
  ]},
  
  { title: 'Repurchase & Sale Agreements (Reverse Repos)', keywords: [] },
  { title: 'Total Securities', isCalculated: true, components: [
    { name: 'Total Trading Securities (at Fair Value through Income statement)', sign: '+' },
    { name: 'Total Available for Sale (AFS) Securities', sign: '+' },
    { name: 'Total Held to Maturity (HTM) Securities', sign: '+' }
  ]},
  
  { title: 'Trading Derivatives', keywords: [] },
  { title: 'ALM Derivatives', keywords: [] },
  { title: 'Less: Reserves for Impaired Derivatives (-)', keywords: [] },
  { title: 'Total Derivatives', isCalculated: true, components: [
    { name: 'Trading Derivatives', sign: '+' },
    { name: 'ALM Derivatives', sign: '+' },
    { name: 'Less: Reserves for Impaired Derivatives (-)', sign: '-' }
  ]},
  { title: 'Total Securities & Derivatives', isCalculated: true, components: [
    { name: 'Total Securities', sign: '+' },
    { name: 'Total Derivatives', sign: '+' }
  ]},
  
  { title: 'Other Earning Assets', type: 'subheader' },
  { title: 'Interest Bearing Deposits with Banks', keywords: ['ACTIF_03'] },
  { title: 'Investments in Property', keywords: [] },
  { title: 'Investments in Subsidiaries (Equity Method)', keywords: [] },
  { title: 'Investments in Affiliates & Joint Ventures (Equity Method)', keywords: ['ACTIF_07', 'ACTIF_10', 'ACTIF_11'], isSumOfCodes: true },
  { title: 'Insurance Assets', keywords: [] },
  { title: 'Other Earning Assets', keywords: [] },
  { title: 'Less: Allowances for Impairment (-)', keywords: [] },
  { title: 'Total Other Earning Assets', isCalculated: true, components: [
    { name: 'Interest Bearing Deposits with Banks', sign: '+' },
    { name: 'Investments in Property', sign: '+' },
    { name: 'Investments in Subsidiaries (Equity Method)', sign: '+' },
    { name: 'Investments in Affiliates & Joint Ventures (Equity Method)', sign: '+' },
    { name: 'Insurance Assets', sign: '+' },
    { name: 'Other Earning Assets', sign: '+' },
    { name: 'Less: Allowances for Impairment (-)', sign: '-' }
  ]},
  { title: 'Total Earning Assets', isCalculated: true, components: [
    { name: 'Net Loans', sign: '+' },
    { name: 'Total Securities & Derivatives', sign: '+' },
    { name: 'Total Other Earning Assets', sign: '+' }
  ]},
  
  { title: 'NON EARNING ASSETS', type: 'header' },
  { title: 'Cash and Due From Banks', keywords: ['ACTIF_01'] },
  { title: 'Foreclosed Real Estate (OREO)', keywords: [] },
  { title: 'Net Fixed Assets', keywords: ['ACTIF_14'] },
  { title: 'Net Goodwill', keywords: [] },
  { title: 'Net Other Intangibles', keywords: ['ACTIF_13'] },
  { title: 'Current Tax Assets', keywords: [] },
  { title: 'Deferred Tax Assets', keywords: [] },
  { title: 'Discontinued Operations', keywords: [] },
  { title: 'Accrued Interest Receivable', keywords: [] },
  { title: 'Investments in Subsidiaries (Historical Cost)', keywords: [] },
  { title: 'Investments in Affiliates & Joint Ventures (Historical Cost)', keywords: [] },
  { title: 'Other Assets', keywords: ['ACTIF_08', 'ACTIF_09'], isSumOfCodes: true },
  { title: 'Less: Allowances for Impairment of Other Assets (-)', keywords: [] },
  { title: 'Total Non Earning Assets', isCalculated: true, components: [
    { name: 'Cash and Due From Banks', sign: '+' },
    { name: 'Foreclosed Real Estate (OREO)', sign: '+' },
    { name: 'Net Fixed Assets', sign: '+' },
    { name: 'Net Goodwill', sign: '+' },
    { name: 'Net Other Intangibles', sign: '+' },
    { name: 'Current Tax Assets', sign: '+' },
    { name: 'Deferred Tax Assets', sign: '+' },
    { name: 'Discontinued Operations', sign: '+' },
    { name: 'Accrued Interest Receivable', sign: '+' },
    { name: 'Investments in Subsidiaries (Historical Cost)', sign: '+' },
    { name: 'Investments in Affiliates & Joint Ventures (Historical Cost)', sign: '+' },
    { name: 'Other Assets', sign: '+' },
    { name: 'Less: Allowances for Impairment of Other Assets (-)', sign: '-' }
  ]},

  { title: 'TOTAL ASSETS', keywords: ['ACTIF_TOTAL'], type: 'finalTotal', isCalculated: true, components: [
    { name: 'Total Earning Assets', sign: '+' },
    { name: 'Total Non Earning Assets', sign: '+' }
  ]},
];

export const liabilitiesStructureBank: IRPLineItem[] = [
  { title: 'LIABILITIES', type: 'header' },
  { title: 'INTEREST BEARING LIABILITIES', type: 'header' },
  { title: 'Deposits and Short-Term Funding', type: 'subheader' },
  { title: 'Deposits - Current', keywords: [] },
  { title: 'Deposits - Savings', keywords: [] },
  { title: 'Deposits - Term', keywords: [] },
  { title: 'Deposits - Other', keywords: ['PASSIF_03'] },
  { title: 'Total Deposits', isCalculated: true, components: [
    { name: 'Deposits - Current', sign: '+' },
    { name: 'Deposits - Savings', sign: '+' },
    { name: 'Deposits - Term', sign: '+' },
    { name: 'Deposits - Other', sign: '+' }
  ]},
  { title: 'Sale & Repurchase Agreements (Repos)', keywords: [] },
  { title: 'Short-term Borrowings', keywords: ['PASSIF_01', 'PASSIF_02'], isSumOfCodes: true },
  { title: 'Short Term Wholesale Funding', isCalculated: true, components: [
    { name: 'Sale & Repurchase Agreements (Repos)', sign: '+' },
    { name: 'Short-term Borrowings', sign: '+' }
  ]},
  { title: 'TOTAL DEPOSITS and SHORT-TERM FUNDING', isCalculated: true, components: [
    { name: 'Total Deposits', sign: '+' },
    { name: 'Short Term Wholesale Funding', sign: '+' }
  ]},
  
  { title: 'Long-Term Debt', type: 'subheader' },
  { title: 'Domestic Bonds', keywords: [] },
  { title: 'International Bonds', keywords: [] },
  { title: 'Other Funding', keywords: ['PASSIF_04'] },
  { title: 'Total Senior Debt', isCalculated: true, components: [
    { name: 'Domestic Bonds', sign: '+' },
    { name: 'International Bonds', sign: '+' },
    { name: 'Other Funding', sign: '+' }
  ]},
  { title: 'Subordinated Debt (Non Tier II)', keywords: ['PASSIF_08'] },
  { title: 'Other Subordinated & Structurally Subordinated Debt', keywords: [] },
  { title: 'Total Subordinated Debt', isCalculated: true, components: [
    { name: 'Subordinated Debt (Non Tier II)', sign: '+' },
    { name: 'Other Subordinated & Structurally Subordinated Debt', sign: '+' }
  ]},
  { title: 'TOTAL LONG-TERM DEBT', isCalculated: true, components: [
    { name: 'Total Senior Debt', sign: '+' },
    { name: 'Total Subordinated Debt', sign: '+' }
  ]},
  { title: 'Total Funding', isCalculated: true, components: [
    { name: 'TOTAL DEPOSITS and SHORT-TERM FUNDING', sign: '+' },
    { name: 'TOTAL LONG-TERM DEBT', sign: '+' }
  ]},
  
  { title: 'Trading Derivatives', keywords: [] },
  { title: 'ALM Derivatives', keywords: [] },
  { title: 'Derivatives Liabilities', isCalculated: true, components: [
    { name: 'Trading Derivatives', sign: '+' },
    { name: 'ALM Derivatives', sign: '+' }
  ]},
  
  { title: 'Short Sold Positions Debt', keywords: [] },
  { title: 'Short Sold Positions Equity', keywords: [] },
  { title: 'Other Trading Liabilities', keywords: [] },
  { title: 'Trading Liabilities', isCalculated: true, components: [
    { name: 'Short Sold Positions Debt', sign: '+' },
    { name: 'Short Sold Positions Equity', sign: '+' },
    { name: 'Other Trading Liabilities', sign: '+' }
  ]},
  { title: 'Total Interest Bearing Liabilities', isCalculated: true, components: [
    { name: 'Total Funding', sign: '+' },
    { name: 'Derivatives Liabilities', sign: '+' },
    { name: 'Trading Liabilities', sign: '+' }
  ]},
  
  { title: 'NON-INTEREST BEARING LIABILITIES', type: 'header' },
  { title: 'Fair Value Portion of Debt', keywords: [] },
  { title: 'Reserves for Pensions and Other', keywords: ['PASSIF_07'] },
  { title: 'Current Tax Liabilities', keywords: [] },
  { title: 'Deferred Tax Liabilities', keywords: [] },
  { title: 'Other Deferred Liabilities', keywords: [] },
  { title: 'Insurance Liabilities', keywords: [] },
  { title: 'Accrued Interest Payable', keywords: [] },
  { title: 'Provisions', keywords: [] },
  { title: 'Other Liabilities', keywords: ['PASSIF_05', 'PASSIF_06'], isSumOfCodes: true },
  { title: 'Total Non Interest Bearing Liabilities', isCalculated: true, components: [
    { name: 'Fair Value Portion of Debt', sign: '+' },
    { name: 'Reserves for Pensions and Other', sign: '+' },
    { name: 'Current Tax Liabilities', sign: '+' },
    { name: 'Deferred Tax Liabilities', sign: '+' },
    { name: 'Other Deferred Liabilities', sign: '+' },
    { name: 'Insurance Liabilities', sign: '+' },
    { name: 'Accrued Interest Payable', sign: '+' },
    { name: 'Provisions', sign: '+' },
    { name: 'Other Liabilities', sign: '+' }
  ]},
  
  { title: 'HYBRID CAPITAL', type: 'header' },
  { title: 'Preferred Shares and Hybrid Capital - Debt', keywords: [] },
  { title: 'Preferred Shares and Hybrid Capital - Equity', keywords: [] },
  { title: 'Total Hybrid Capital', isCalculated: true, components: [
    { name: 'Preferred Shares and Hybrid Capital - Debt', sign: '+' },
    { name: 'Preferred Shares and Hybrid Capital - Equity', sign: '+' }
  ]},
  
  { title: 'TOTAL LIABILITIES', isCalculated: true, components: [
    { name: 'Total Interest Bearing Liabilities', sign: '+' },
    { name: 'Total Non Interest Bearing Liabilities', sign: '+' },
    { name: 'Total Hybrid Capital', sign: '+' }
  ], type: 'finalTotal' },
  
  { title: 'EQUITY', type: 'header' },
  { title: 'Common Equity', type: 'subheader' },
  { title: 'Common Shares and Paid-in Capital', keywords: ['PASSIF_10'] },
  { title: 'Retained Earnings', keywords: ['PASSIF_15', 'PASSIF_16'], isSumOfCodes: true },
  { title: 'Reserves', keywords: ['PASSIF_12', 'PASSIF_14'], isSumOfCodes: true },
  { title: 'Fixed Assets Revaluation Reserves', keywords: [] },
  { title: 'Treasury Stock (-)', keywords: [] },
  { title: 'Other Common Equity', keywords: ['PASSIF_11'] },
  { title: 'Total Common Equity', isCalculated: true, components: [
    { name: 'Common Shares and Paid-in Capital', sign: '+' },
    { name: 'Retained Earnings', sign: '+' },
    { name: 'Reserves', sign: '+' },
    { name: 'Fixed Assets Revaluation Reserves', sign: '+' },
    { name: 'Treasury Stock (-)', sign: '-' },
    { name: 'Other Common Equity', sign: '+' }
  ]},

  { title: 'Minority Interest', type: 'subheader' },
  { title: 'Non-controlling Interest', keywords: [] },

  { title: 'Other Comprehensive Income (OCI)', type: 'subheader' },
  { title: 'Securities Revaluation Reserves', keywords: [] },
  { title: 'Foreign Exchange Revaluation Reserves', keywords: [] },
  { title: 'Fixed Asset Revaluations', keywords: [] },
  { title: 'Other Accumulated OCI', keywords: ['PASSIF_13'] },
  { title: 'TOTAL EQUITY', isCalculated: true, components: [
    { name: 'Total Common Equity', sign: '+' },
    { name: 'Non-controlling Interest', sign: '+' },
    { name: 'Securities Revaluation Reserves', sign: '+' },
    { name: 'Foreign Exchange Revaluation Reserves', sign: '+' },
    { name: 'Fixed Asset Revaluations', sign: '+' },
    { name: 'Other Accumulated OCI', sign: '+' }
  ]},

  { title: 'TOTAL LIABILITIES & EQUITY', keywords: ['PASSIF_TOTAL'], type: 'finalTotal', isCalculated: true, components: [
    { name: 'TOTAL LIABILITIES', sign: '+' },
    { name: 'TOTAL EQUITY', sign: '+' }
  ]},
];

export const incomeStatementStructureBank: IRPLineItem[] = [
 { title: 'INCOME STATEMENT', type: 'header' },
 { title: 'Statement Date', type: 'subheader' },

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
    // Expense codes (CR_02) are stored already-signed (negative, as printed
    // on the BCEAO RESU_PUB statement). Sum signed values — do NOT subtract,
    // which would double-negate. Same principle for every expense below.
    { name: 'Total Interest Expense', sign: '+' }
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
    // CR_05 stored negative → sum, don't subtract.
    { name: 'Less: Fees and Commissions Expense (-)', sign: '+' }
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
    // Non-Interest Expenses is a signed subtotal (negative) → sum.
    { name: 'Non-Interest Expenses', sign: '+' }
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
    // Provision Expenses (CR_15) stored negative → sum.
    { name: 'Provision Expenses', sign: '+' }
  ]},

  { title: 'P/L from Non Op. Invest. Accounted under Equity Method', keywords: [] },
  { title: 'Non Recurring Income', keywords: [] },
  { title: 'Non Recurring Expense', keywords: [] },
  { title: 'Other Non-operating Income & (Expenses)', keywords: ['CR_17'] },

  { title: 'Pre-tax Profit', isCalculated: true, components: [
    { name: 'Operating Profit', sign: '+' },
    { name: 'P/L from Non Op. Invest. Accounted under Equity Method', sign: '+' },
    { name: 'Non Recurring Income', sign: '+' },
    { name: 'Non Recurring Expense', sign: '-' },
    { name: 'Other Non-operating Income & (Expenses)', sign: '+' }
  ]},
  { title: 'Tax expense', keywords: ['CR_19'] },
  { title: 'Profit(Loss) from Discontinued Operations', keywords: [] },

  { title: 'Net Income', type: 'finalTotal', isCalculated: true, components: [
    { name: 'Pre-tax Profit', sign: '+' },
    // Tax expense (CR_19) stored negative → sum.
    { name: 'Tax expense', sign: '+' },
    { name: 'Profit(Loss) from Discontinued Operations', sign: '+' }
  ]},
];