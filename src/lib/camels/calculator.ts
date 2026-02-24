// src/lib/camels/calculator.ts
// Port of camels_calculator.py — pure functions, no mutation, no side effects.
// Computes CAMELS ratios, ratings, and analysis text from FinancialData.

import { FinancialData, CAMELSRatios, ComponentRating, CompositeRating, CAMELSAnalysisResult } from './types'

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeDivide(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null
  return numerator / denominator
}

function get(data: FinancialData, key: string, fallback = 0): number {
  return data[key] ?? fallback
}

function avg(current: number, previous: number | null): number {
  if (previous == null || previous === 0) return current
  return (current + previous) / 2
}

function pct(value: number | null): string {
  if (value == null) return 'N/A'
  return `${(value * 100).toFixed(1)}%`
}

// ─── Ratio Calculations ─────────────────────────────────────────────────────

export function calculateAllRatios(
  statement: FinancialData,
  prevStatement: FinancialData | null = null
): CAMELSRatios {
  const totalAssets = get(statement, 'total_assets')
  const totalEquity = get(statement, 'total_equity')
  const grossLoans = get(statement, 'gross_loans')
  const npls = get(statement, 'npls')
  const loanLossProvisions = Math.abs(get(statement, 'loan_loss_provisions'))
  const netIncome = get(statement, 'net_income')
  const operatingIncome = get(statement, 'operating_income')
  const operatingExpenses = Math.abs(get(statement, 'operating_expenses'))
  const provisionExpenses = Math.abs(get(statement, 'provision_expenses'))
  const netInterestIncome = get(statement, 'net_interest_income')
  const totalDeposits = get(statement, 'total_deposits')

  // Liquid assets = cash + interbank deposits + investment securities
  const liquidAssets =
    get(statement, 'cash_and_equivalents') +
    get(statement, 'liquid_assets') +
    get(statement, 'investment_securities')

  // Average assets/equity for returns
  const avgTotalAssets = avg(totalAssets, prevStatement ? get(prevStatement, 'total_assets') : null)
  const avgTotalEquity = avg(totalEquity, prevStatement ? get(prevStatement, 'total_equity') : null)

  // Short + long term debt for debt/assets
  const totalDebt =
    get(statement, 'short_term_borrowings') + get(statement, 'long_term_debt')

  return {
    // Capital
    equity_assets: safeDivide(totalEquity, totalAssets),
    debt_assets: safeDivide(totalDebt, totalAssets),
    // Asset quality
    npl_ratio: safeDivide(npls, grossLoans),
    coverage_ratio: safeDivide(loanLossProvisions, npls),
    cost_of_risk_avg_assets: safeDivide(provisionExpenses, avgTotalAssets),
    // Management
    cost_to_income: safeDivide(operatingExpenses, operatingIncome),
    // Earnings
    roaa: safeDivide(netIncome, avgTotalAssets),
    roae: safeDivide(netIncome, avgTotalEquity),
    net_interest_margin: safeDivide(netInterestIncome, avgTotalAssets),
    // Liquidity
    liquid_assets_total_assets: safeDivide(liquidAssets, totalAssets),
    gross_loans_deposits: safeDivide(grossLoans, totalDeposits),
  }
}

// ─── Scoring Thresholds ─────────────────────────────────────────────────────

interface ThresholdEntry {
  thresholds: number[]
  ascending: boolean // true = higher is better
}

const THRESHOLDS: Record<string, ThresholdEntry> = {
  equity_assets:             { thresholds: [0.04, 0.06, 0.09, 0.12], ascending: true },
  npl_ratio:                 { thresholds: [0.02, 0.05, 0.08, 0.12], ascending: false },
  cost_to_income:            { thresholds: [0.40, 0.55, 0.70, 0.85], ascending: false },
  roae:                      { thresholds: [0.00, 0.05, 0.10, 0.15], ascending: true },
  liquid_assets_total_assets:{ thresholds: [0.10, 0.15, 0.25, 0.35], ascending: true },
}

const RATING_LABELS = ['Unsatisfactory', 'Marginal', 'Fair', 'Satisfactory', 'Strong']

function scoreRatio(value: number | null, key: string): { rating: number | null; status: string } {
  if (value == null) return { rating: null, status: 'Insufficient data' }

  const entry = THRESHOLDS[key]
  if (!entry) return { rating: null, status: 'No threshold defined' }

  const { thresholds, ascending } = entry

  if (ascending) {
    // Higher is better: >= threshold[3] → 1, >= threshold[2] → 2, etc.
    if (value >= thresholds[3]) return { rating: 1, status: RATING_LABELS[4] }
    if (value >= thresholds[2]) return { rating: 2, status: RATING_LABELS[3] }
    if (value >= thresholds[1]) return { rating: 3, status: RATING_LABELS[2] }
    if (value >= thresholds[0]) return { rating: 4, status: RATING_LABELS[1] }
    return { rating: 5, status: RATING_LABELS[0] }
  } else {
    // Lower is better: < threshold[0] → 1, < threshold[1] → 2, etc.
    if (value < thresholds[0]) return { rating: 1, status: RATING_LABELS[4] }
    if (value < thresholds[1]) return { rating: 2, status: RATING_LABELS[3] }
    if (value < thresholds[2]) return { rating: 3, status: RATING_LABELS[2] }
    if (value < thresholds[3]) return { rating: 4, status: RATING_LABELS[1] }
    return { rating: 5, status: RATING_LABELS[0] }
  }
}

// ─── Component Ratings ──────────────────────────────────────────────────────

function rateCapital(ratios: CAMELSRatios): ComponentRating {
  const primary = scoreRatio(ratios.equity_assets, 'equity_assets')
  return {
    ...primary,
    ratios: {
      equity_assets: ratios.equity_assets,
      debt_assets: ratios.debt_assets,
    },
  }
}

function rateAssetQuality(ratios: CAMELSRatios): ComponentRating {
  const primary = scoreRatio(ratios.npl_ratio, 'npl_ratio')
  return {
    ...primary,
    ratios: {
      npl_ratio: ratios.npl_ratio,
      coverage_ratio: ratios.coverage_ratio,
      cost_of_risk_avg_assets: ratios.cost_of_risk_avg_assets,
    },
  }
}

function rateManagement(ratios: CAMELSRatios): ComponentRating {
  const primary = scoreRatio(ratios.cost_to_income, 'cost_to_income')
  return {
    ...primary,
    ratios: {
      cost_to_income: ratios.cost_to_income,
    },
  }
}

function rateEarnings(ratios: CAMELSRatios): ComponentRating {
  const primary = scoreRatio(ratios.roae, 'roae')
  return {
    ...primary,
    ratios: {
      roaa: ratios.roaa,
      roae: ratios.roae,
      net_interest_margin: ratios.net_interest_margin,
    },
  }
}

function rateLiquidity(ratios: CAMELSRatios): ComponentRating {
  const primary = scoreRatio(ratios.liquid_assets_total_assets, 'liquid_assets_total_assets')
  return {
    ...primary,
    ratios: {
      liquid_assets_total_assets: ratios.liquid_assets_total_assets,
      gross_loans_deposits: ratios.gross_loans_deposits,
    },
  }
}

function computeComposite(ratings: Record<string, ComponentRating>): CompositeRating {
  const validRatings = Object.values(ratings)
    .map(r => r.rating)
    .filter((r): r is number => r != null)

  if (validRatings.length === 0) {
    return { composite_rating: null, average: null, status: 'Insufficient data' }
  }

  const average = validRatings.reduce((s, v) => s + v, 0) / validRatings.length
  const composite = Math.round(average)

  return {
    composite_rating: composite,
    average: Math.round(average * 10) / 10,
    status: RATING_LABELS[Math.max(0, 5 - composite)] ?? 'Unknown',
  }
}

// ─── Analysis Text Generation ───────────────────────────────────────────────
// Port of camels_calculator.py generate_analysis_paragraphs() — deterministic
// paragraphs using if/else logic on ratio values. No API key needed.

function pct2(value: number | null): string {
  if (value == null) return 'N/A'
  return `${(value * 100).toFixed(2)}%`
}

function generateCapitalParagraph(
  ratios: CAMELSRatios,
  rating: ComponentRating
): string {
  const eqAssets = ratios.equity_assets
  const debtAssets = ratios.debt_assets

  let header = `**Capital Adequacy — Rating: ${rating.rating ?? 'N/A'} (${rating.status})**. `

  if (eqAssets == null) {
    return header + 'Insufficient data to assess capital adequacy.'
  }

  // Equity/Assets commentary
  let capitalDesc: string
  if (eqAssets >= 0.10) {
    capitalDesc = `The institution reports an Equity-to-Assets ratio of ${pct2(eqAssets)}, indicating a well-capitalized position that provides a comfortable buffer against potential losses. This level of capitalization exceeds typical regulatory minimums and suggests the institution can absorb moderate shocks without threatening solvency.`
  } else if (eqAssets >= 0.06) {
    capitalDesc = `The institution reports an Equity-to-Assets ratio of ${pct2(eqAssets)}, reflecting an adequate capital base, though limited headroom exists above regulatory thresholds. While sufficient for normal operating conditions, the institution may face constraints in absorbing unexpected losses or funding rapid growth.`
  } else {
    capitalDesc = `The institution reports an Equity-to-Assets ratio of ${pct2(eqAssets)}, pointing to thin capitalization and vulnerability to adverse shocks. At this level, the institution has very limited capacity to absorb losses, and any deterioration in asset quality could quickly erode the equity cushion.`
  }

  // Debt/Assets commentary
  let debtDesc = ''
  if (debtAssets != null) {
    if (debtAssets >= 0.30) {
      debtDesc = ` The Debt-to-Assets ratio stands at ${pct2(debtAssets)}, indicating high leverage that amplifies both returns and risks. Elevated reliance on borrowed funds increases fixed interest obligations and may constrain financial flexibility.`
    } else {
      debtDesc = ` The Debt-to-Assets ratio stands at ${pct2(debtAssets)}, reflecting moderate leverage and a balanced funding structure. This level of borrowing appears manageable relative to the asset base.`
    }
  }

  return header + capitalDesc + debtDesc
}

function generateAssetQualityParagraph(
  ratios: CAMELSRatios,
  rating: ComponentRating
): string {
  const nplRatio = ratios.npl_ratio
  const coverageRatio = ratios.coverage_ratio
  const costOfRisk = ratios.cost_of_risk_avg_assets

  let header = `**Asset Quality — Rating: ${rating.rating ?? 'N/A'} (${rating.status})**. `

  if (nplRatio == null) {
    return header + 'Insufficient data to assess asset quality.'
  }

  // NPL ratio commentary
  let nplDesc: string
  if (nplRatio < 0.05) {
    nplDesc = `The NPL ratio of ${pct2(nplRatio)} indicates strong asset quality, with non-performing exposures well contained relative to the loan portfolio. This suggests effective credit risk management and prudent underwriting standards.`
  } else if (nplRatio < 0.10) {
    nplDesc = `The NPL ratio of ${pct2(nplRatio)} reflects moderate asset quality concerns. While not immediately alarming, this level of non-performing loans warrants close monitoring and may signal emerging stress in certain lending segments.`
  } else {
    nplDesc = `The NPL ratio of ${pct2(nplRatio)} signals significant asset quality deterioration. A double-digit NPL ratio represents a material drag on earnings and capital, and typically reflects systemic weaknesses in credit origination, monitoring, or recovery processes.`
  }

  // Coverage ratio commentary
  let coverageDesc = ''
  if (coverageRatio != null) {
    if (coverageRatio >= 1.0) {
      coverageDesc = ` The coverage ratio of ${pct2(coverageRatio)} indicates that loan loss provisions fully cover non-performing loans, providing a strong buffer against potential write-offs.`
    } else {
      coverageDesc = ` The coverage ratio of ${pct2(coverageRatio)} falls below 100%, meaning provisions do not fully cover non-performing loans. This exposes the institution to losses in the event of borrower default beyond what has been provisioned.`
    }
  }

  // Cost of risk commentary
  let costDesc = ''
  if (costOfRisk != null) {
    if (costOfRisk >= 0.02) {
      costDesc = ` The cost of risk at ${pct2(costOfRisk)} of average assets represents elevated provisioning expense, which weighs on profitability and reflects ongoing credit quality pressures.`
    } else {
      costDesc = ` The cost of risk at ${pct2(costOfRisk)} of average assets remains contained, suggesting manageable provisioning needs relative to the asset base.`
    }
  }

  return header + nplDesc + coverageDesc + costDesc
}

function generateManagementParagraph(
  ratios: CAMELSRatios,
  rating: ComponentRating
): string {
  const cti = ratios.cost_to_income

  let header = `**Management Efficiency — Rating: ${rating.rating ?? 'N/A'} (${rating.status})**. `

  if (cti == null) {
    return header + 'Insufficient data to assess management efficiency.'
  }

  let mgtDesc: string
  if (cti < 0.50) {
    mgtDesc = `The Cost-to-Income ratio of ${pct2(cti)} reflects excellent operational efficiency, with the institution converting a high share of revenue into profit. This indicates disciplined cost management, effective use of technology, and a scalable operating model.`
  } else if (cti < 0.70) {
    mgtDesc = `The Cost-to-Income ratio of ${pct2(cti)} indicates acceptable operational efficiency, broadly in line with industry norms. There may be opportunities to optimize processes, renegotiate vendor contracts, or leverage technology to improve the ratio further.`
  } else {
    mgtDesc = `The Cost-to-Income ratio of ${pct2(cti)} points to significant inefficiency in operations. A large share of revenue is consumed by administrative, personnel, or other overhead costs, leaving limited margin for absorbing credit losses or generating returns for shareholders.`
  }

  return header + mgtDesc
}

function generateEarningsParagraph(
  ratios: CAMELSRatios,
  rating: ComponentRating,
  data: FinancialData | null
): string {
  const roae = ratios.roae
  const roaa = ratios.roaa
  const nim = ratios.net_interest_margin

  let header = `**Earnings — Rating: ${rating.rating ?? 'N/A'} (${rating.status})**. `

  if (roae == null) {
    return header + 'Insufficient data to assess earnings performance.'
  }

  // ROAE commentary
  let earningsDesc: string
  if (roae >= 0.15) {
    earningsDesc = `Return on Average Equity of ${pct2(roae)} demonstrates strong profitability, indicating the institution generates attractive returns for its shareholders. This level of profitability provides a healthy internal capital generation capacity and supports sustainable growth.`
  } else if (roae >= 0.05) {
    earningsDesc = `Return on Average Equity of ${pct2(roae)} indicates moderate profitability. While the institution is generating positive returns, there may be room to improve either revenue generation or cost efficiency to achieve stronger risk-adjusted performance.`
  } else {
    earningsDesc = `Return on Average Equity of ${pct2(roae)} signals weak profitability that may not adequately compensate shareholders for the risks they bear. Low earnings limit the institution's ability to build capital organically and may require external capital infusion to sustain operations and growth.`
  }

  // ROAA and NIM supplementary
  let supplementary = ''
  if (roaa != null) {
    supplementary += ` Return on Average Assets stands at ${pct2(roaa)}.`
  }
  if (nim != null) {
    if (nim >= 0.04) {
      supplementary += ` The Net Interest Margin of ${pct2(nim)} is healthy, suggesting effective management of the interest rate spread between earning assets and funding costs.`
    } else if (nim >= 0.02) {
      supplementary += ` The Net Interest Margin of ${pct2(nim)} is adequate but compressed, potentially reflecting competitive pricing pressures or a shift in the asset/liability mix.`
    } else {
      supplementary += ` The Net Interest Margin of ${pct2(nim)} is narrow, indicating tight spreads that leave limited room for provisioning and overhead expenses. This may reflect intense price competition or heavy reliance on lower-yielding assets.`
    }
  }

  // Income structure breakdown if data available
  let structureDesc = ''
  if (data) {
    const totalAssets = data.total_assets || 0
    if (totalAssets > 0) {
      const niiPct = data.net_interest_income / totalAssets
      const nonIiPct = (data.non_interest_income || 0) / totalAssets
      const opexPct = Math.abs(data.operating_expenses || 0) / totalAssets
      const taxPct = Math.abs(data.taxes || 0) / totalAssets

      const parts: string[] = []
      parts.push(`net interest income at ${pct2(niiPct)} of total assets`)
      if (nonIiPct > 0.001) {
        parts.push(`non-interest income at ${pct2(nonIiPct)}`)
      }
      parts.push(`operating expenses at ${pct2(opexPct)}`)
      if (taxPct > 0.001) {
        parts.push(`taxes at ${pct2(taxPct)}`)
      }

      structureDesc = ` The income structure shows ${parts.join(', ')}.`
    }
  }

  return header + earningsDesc + supplementary + structureDesc
}

function generateLiquidityParagraph(
  ratios: CAMELSRatios,
  rating: ComponentRating
): string {
  const liqRatio = ratios.liquid_assets_total_assets
  const ltd = ratios.gross_loans_deposits

  let header = `**Liquidity — Rating: ${rating.rating ?? 'N/A'} (${rating.status})**. `

  if (liqRatio == null) {
    return header + 'Insufficient data to assess liquidity.'
  }

  // Liquid assets / TA commentary
  let liqDesc: string
  if (liqRatio >= 0.30) {
    liqDesc = `Liquid assets represent ${pct2(liqRatio)} of total assets, indicating a strong liquidity position with substantial buffers to meet short-term obligations and unexpected withdrawal demands. This level of liquidity provides significant resilience against funding stress scenarios.`
  } else if (liqRatio >= 0.15) {
    liqDesc = `Liquid assets represent ${pct2(liqRatio)} of total assets, reflecting an adequate liquidity position. The institution maintains reasonable buffers for normal operating conditions, though a sudden spike in withdrawal demands could strain available resources.`
  } else {
    liqDesc = `Liquid assets represent ${pct2(liqRatio)} of total assets, indicating a tight liquidity position. Low liquid asset holdings may leave the institution vulnerable to funding disruptions, particularly during periods of market stress or depositor anxiety.`
  }

  // Loans-to-deposits commentary
  let ltdDesc = ''
  if (ltd != null) {
    if (ltd >= 1.0) {
      ltdDesc = ` The Gross Loans-to-Deposits ratio of ${pct2(ltd)} exceeds 100%, meaning the loan portfolio surpasses the deposit base. This indicates reliance on wholesale or borrowed funding to finance lending activities, which may carry higher cost and refinancing risk.`
    } else if (ltd >= 0.75) {
      ltdDesc = ` The Gross Loans-to-Deposits ratio of ${pct2(ltd)} indicates active but measured lending relative to the deposit base, reflecting a balanced approach to asset deployment.`
    } else {
      ltdDesc = ` The Gross Loans-to-Deposits ratio of ${pct2(ltd)} suggests conservative lending relative to available deposits, with significant capacity to expand the loan book if credit opportunities arise.`
    }
  }

  return header + liqDesc + ltdDesc
}

function generateCompositeParagraph(
  composite: CompositeRating,
  ratings: Record<string, ComponentRating>
): string {
  const validCount = Object.values(ratings).filter(r => r.rating != null).length
  const cr = composite.composite_rating

  let header = `**Composite CAMELS Rating: ${cr ?? 'N/A'} (${composite.status})**. `
  let desc: string

  if (cr == null) {
    return header + `Based on ${validCount} of 5 components. Insufficient data for a composite assessment.`
  }

  if (cr <= 2) {
    desc = `The institution is fundamentally sound with an average score of ${composite.average}. Every significant component has been evaluated, and no material weaknesses were identified. The institution demonstrates overall financial health and is well positioned to withstand adverse economic conditions.`
  } else if (cr === 3) {
    desc = `With an average score of ${composite.average}, the institution shows acceptable overall performance but exhibits some areas requiring attention. While not immediately threatening viability, certain components reflect weaknesses that, if left unaddressed, could lead to deterioration over time. Management should prioritize remediation in lower-rated areas.`
  } else if (cr === 4) {
    desc = `The composite rating of ${cr} (average: ${composite.average}) indicates material weaknesses across multiple dimensions. The institution faces meaningful risks that could threaten its financial condition if corrective actions are not taken promptly. Supervisory attention and a credible remediation plan are warranted.`
  } else {
    desc = `The composite rating of ${cr} (average: ${composite.average}) signals a critically weak institution with severe deficiencies. The probability of failure is elevated, and immediate supervisory intervention may be necessary. Fundamental restructuring of operations, capital, and/or risk management practices is urgently required.`
  }

  return header + `Based on ${validCount} of 5 components. ` + desc
}

export function generateAnalysis(
  ratios: CAMELSRatios,
  ratings: Record<string, ComponentRating>,
  composite: CompositeRating,
  data: FinancialData | null = null
): CAMELSAnalysisResult['analysis'] {
  return {
    capital: generateCapitalParagraph(ratios, ratings.capital),
    asset_quality: generateAssetQualityParagraph(ratios, ratings.asset_quality),
    management: generateManagementParagraph(ratios, ratings.management),
    earnings: generateEarningsParagraph(ratios, ratings.earnings, data),
    liquidity: generateLiquidityParagraph(ratios, ratings.liquidity),
    composite: generateCompositeParagraph(composite, ratings),
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Run a full CAMELS analysis on a single period's financial data.
 */
export function runFullAnalysis(
  statement: FinancialData,
  prevStatement: FinancialData | null = null
): CAMELSAnalysisResult {
  const ratios = calculateAllRatios(statement, prevStatement)

  const componentRatings = {
    capital: rateCapital(ratios),
    asset_quality: rateAssetQuality(ratios),
    management: rateManagement(ratios),
    earnings: rateEarnings(ratios),
    liquidity: rateLiquidity(ratios),
  }

  const composite = computeComposite(componentRatings)
  const analysis = generateAnalysis(ratios, componentRatings, composite, statement)

  return {
    ratios,
    ratings: {
      ...componentRatings,
      composite,
    },
    analysis,
  }
}
