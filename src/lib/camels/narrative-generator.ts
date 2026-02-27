// src/lib/camels/narrative-generator.ts
// Layer 2: Claude AI narrative generation for CAMELS analysis.
// Calls the Anthropic API to produce rich, analyst-quality commentary.
// Falls back gracefully if ANTHROPIC_API_KEY is not set.

import Anthropic from '@anthropic-ai/sdk'
import { CAMELSRatios, ComponentRating, CompositeRating, FinancialData, SummaryRow, RatioTableRow } from './types'

// ─── Types ──────────────────────────────────────────────────────────────────

interface NarrativeInput {
  companyName: string
  institutionType: string
  periods: string[]
  periodLabels: string[]
  /** Per-period financial data */
  periodData: Array<{ period: string; label: string; data: FinancialData }>
  /** Per-period ratios */
  periodRatios: Array<{ period: string; label: string; ratios: CAMELSRatios }>
  /** Latest-period ratings */
  ratings: {
    capital: ComponentRating
    asset_quality: ComponentRating
    management: ComponentRating
    earnings: ComponentRating
    liquidity: ComponentRating
    composite: CompositeRating
  }
  financialSummary?: {
    balance_sheet: SummaryRow[]
    income_statement: SummaryRow[]
  }
}

interface NarrativeResult {
  capital: string
  asset_quality: string
  management: string
  earnings: string
  liquidity: string
  composite: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtPct(value: number | null): string {
  if (value == null) return 'N/A'
  return `${(value * 100).toFixed(2)}%`
}

function fmtNum(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(0)
}

function cagr(first: number, last: number, periods: number): string {
  if (first <= 0 || last <= 0 || periods <= 1) return 'N/A'
  const rate = Math.pow(last / first, 1 / (periods - 1)) - 1
  return `${(rate * 100).toFixed(1)}%`
}

// ─── Data Block Builder ─────────────────────────────────────────────────────

function buildDataBlock(input: NarrativeInput): string {
  const lines: string[] = []

  lines.push(`Institution: ${input.companyName}`)
  lines.push(`Type: ${input.institutionType}`)
  lines.push(`Periods: ${input.periodLabels.join(', ')}`)
  lines.push('')

  // Balance sheet across periods
  lines.push('=== BALANCE SHEET ===')
  const bsKeys = ['total_assets', 'cash_and_equivalents', 'liquid_assets', 'investment_securities',
    'gross_loans', 'net_loans', 'fixed_assets', 'total_deposits', 'short_term_borrowings',
    'long_term_debt', 'subordinated_debt', 'total_liabilities', 'total_equity'] as const

  for (const key of bsKeys) {
    const vals = input.periodData.map(p => p.data[key] ?? 0)
    const formatted = vals.map(v => fmtNum(v))
    const cagrStr = vals.length >= 2 ? cagr(vals[0], vals[vals.length - 1], vals.length) : 'N/A'
    lines.push(`  ${key}: ${input.periodLabels.map((l, i) => `${l}=${formatted[i]}`).join(', ')} | CAGR: ${cagrStr}`)
  }
  lines.push('')

  // Income statement across periods
  lines.push('=== INCOME STATEMENT ===')
  const isKeys = ['interest_income', 'interest_expenses', 'net_interest_income', 'non_interest_income',
    'operating_income', 'operating_expenses', 'depreciation', 'provision_expenses',
    'net_income', 'taxes'] as const

  for (const key of isKeys) {
    const vals = input.periodData.map(p => p.data[key] ?? 0)
    const formatted = vals.map(v => fmtNum(v))
    const cagrStr = vals.length >= 2 ? cagr(Math.abs(vals[0]), Math.abs(vals[vals.length - 1]), vals.length) : 'N/A'
    lines.push(`  ${key}: ${input.periodLabels.map((l, i) => `${l}=${formatted[i]}`).join(', ')} | CAGR: ${cagrStr}`)
  }
  lines.push('')

  // Key ratios across periods
  lines.push('=== KEY RATIOS ===')
  const ratioKeys = ['equity_assets', 'debt_assets', 'npl_ratio', 'coverage_ratio',
    'cost_of_risk_avg_assets', 'cost_to_income', 'roaa', 'roae',
    'net_interest_margin', 'liquid_assets_total_assets', 'gross_loans_deposits'] as const

  for (const key of ratioKeys) {
    const vals = input.periodRatios.map(p => p.ratios[key as keyof CAMELSRatios])
    lines.push(`  ${key}: ${input.periodLabels.map((l, i) => `${l}=${fmtPct(vals[i])}`).join(', ')}`)
  }
  lines.push('')

  // Latest ratings
  lines.push('=== LATEST RATINGS ===')
  lines.push(`  Capital: ${input.ratings.capital.rating} (${input.ratings.capital.status})`)
  lines.push(`  Asset Quality: ${input.ratings.asset_quality.rating} (${input.ratings.asset_quality.status})`)
  lines.push(`  Management: ${input.ratings.management.rating} (${input.ratings.management.status})`)
  lines.push(`  Earnings: ${input.ratings.earnings.rating} (${input.ratings.earnings.status})`)
  lines.push(`  Liquidity: ${input.ratings.liquidity.rating} (${input.ratings.liquidity.status})`)
  lines.push(`  Composite: ${input.ratings.composite.composite_rating} (${input.ratings.composite.status}), Average: ${input.ratings.composite.average}`)

  return lines.join('\n')
}

// ─── Prompt Builder ─────────────────────────────────────────────────────────

function buildPrompt(dataBlock: string): string {
  return `You are a senior credit analyst writing the financial analysis section of a CAMELS assessment for a regulatory submission or credit committee.

Below is the institution's financial data across all available periods.

${dataBlock}

─── STRUCTURE ───────────────────────────────────────────────────────────────
Use EXACTLY these section headers (verbatim, on their own line):

**Capitalization (Rating: [status])**
**Asset Quality (Rating: [status])**
**Management (Rating: [status])**
**Earnings (Rating: [status])**
**Liquidity (Rating: [status])**
**Composite (Rating: [status])**

Replace [status] with the actual rating status from the data above (e.g., "Satisfactory", "Strong").

─── CONTENT REQUIREMENTS PER SECTION ───────────────────────────────────────
**Capitalization** — address all of the following in order:
1. Regulatory CAR: state the value, whether it satisfies the applicable minimum, and characterize the trend (rising / declining / stable).
2. Equity to assets: compare across periods; explain whether the movement is driven by asset growth or equity accumulation.
3. Buffer above minimum: quantify headroom in percentage points; flag if thin or eroding.
4. Evolution of Tier II / subordinated debt: note material changes and their effect on total capital composition.
5. Notable changes in shareholders' equity: identify the mechanism — retained earnings, capital injection, losses, or FX impact.

**Asset Quality** — address all of the following in order:
1. Asset structure: break down loans vs. investment securities as a share of total assets; state the strategic or structural implication.
2. NPL ratio & trend: state values across all available periods; characterize direction and pace of change.
3. Coverage ratio: state values; assess whether provisioning is adequate relative to NPL exposure.
4. Stage migration: comment on whether deterioration is concentrated or broadly distributed across the portfolio.
5. Concentration risk: identify any sectoral, geographic, or counterparty concentration implied by the data.

**Management** — address:
1. Cost-to-income ratio trend and what is driving it (expense growth vs. revenue dynamics).
2. Expense discipline relative to operating income growth across periods.

**Earnings** — address all of the following in order:
1. Trend & sustainability: characterize net income trajectory; distinguish one-off items from structural drivers.
2. Key drivers: identify what is driving NII, non-interest income, and provisioning charges.
3. Volatility: assess whether earnings are stable, cyclically exposed, or structurally compressed.

**Liquidity** — address all of the following in order:
1. Funding structure: break down deposits vs. borrowings vs. other liabilities; note reliance on any single source.
2. Deposit base stability: assess whether deposits are growing, stable, or declining.
3. Wholesale reliance: quantify market funding as a share of total liabilities; flag structural dependency.
4. Maturity profile: infer short- vs. long-term funding balance from loan-to-deposit ratio and borrowing composition.

**Composite** — synthesize all five components in 2–3 sentences. Reference the composite rating and the two or three dominant risk factors.

─── WRITING DISCIPLINE ──────────────────────────────────────────────────────
REQUIRED — use active analytical verbs:
driven by · supported by · mitigated by · underpinned by · constrained by · offset by · concentrated in · fully reliant on · structurally exposed to

FORBIDDEN:
- "This is good / bad because…"
- "The bank is strong / healthy / well-positioned."
- Narrative storytelling or historical background paragraphs.
- Any claim without a number or structural mechanism behind it.

Every metric must answer: Is this stable? Improving? Structurally weak? Cyclical?

Write 3–5 concise bullet points per section (except Management: 2 bullets; Composite: prose). Start each bullet with a lowercase verb or the metric name. Do not use any introductory preamble — begin directly with the first section header.`
}

// ─── Section Parser ─────────────────────────────────────────────────────────

const SECTION_PATTERNS: Array<{ key: keyof NarrativeResult; pattern: RegExp }> = [
  { key: 'capital', pattern: /\*\*Capitalization\s*\(Rating:.*?\)\*\*/i },
  { key: 'asset_quality', pattern: /\*\*Asset Quality\s*\(Rating:.*?\)\*\*/i },
  { key: 'management', pattern: /\*\*Management\s*\(Rating:.*?\)\*\*/i },
  { key: 'earnings', pattern: /\*\*Earnings\s*\(Rating:.*?\)\*\*/i },
  { key: 'liquidity', pattern: /\*\*Liquidity\s*\(Rating:.*?\)\*\*/i },
  { key: 'composite', pattern: /\*\*Composite\s*\(Rating:.*?\)\*\*/i },
]

function parseNarrativeSections(text: string): NarrativeResult | null {
  const result: Partial<NarrativeResult> = {}

  // Find each section's start position
  const sectionPositions: Array<{ key: keyof NarrativeResult; start: number; headerEnd: number }> = []

  for (const { key, pattern } of SECTION_PATTERNS) {
    const match = text.match(pattern)
    if (match && match.index != null) {
      sectionPositions.push({
        key,
        start: match.index,
        headerEnd: match.index + match[0].length,
      })
    }
  }

  // Sort by position
  sectionPositions.sort((a, b) => a.start - b.start)

  // Extract text between sections
  for (let i = 0; i < sectionPositions.length; i++) {
    const current = sectionPositions[i]
    const nextStart = i + 1 < sectionPositions.length ? sectionPositions[i + 1].start : text.length
    // Include the header in the content
    const sectionText = text.slice(current.start, nextStart).trim()
    result[current.key] = sectionText
  }

  // Check we got all sections
  const requiredKeys: Array<keyof NarrativeResult> = ['capital', 'asset_quality', 'management', 'earnings', 'liquidity', 'composite']
  const hasAll = requiredKeys.every(k => result[k] && result[k]!.length > 50)

  if (!hasAll) {
    return null
  }

  return result as NarrativeResult
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate a rich AI narrative for CAMELS analysis using Claude.
 * Returns null if ANTHROPIC_API_KEY is not set or if the API call fails,
 * allowing the caller to fall back to deterministic paragraphs.
 */
export async function generateNarrative(input: NarrativeInput): Promise<NarrativeResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return null
  }

  try {
    const anthropic = new Anthropic({ apiKey })
    const dataBlock = buildDataBlock(input)
    const prompt = buildPrompt(dataBlock)

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    // Extract text from response
    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')

    if (!responseText) {
      return null
    }

    const parsed = parseNarrativeSections(responseText)
    return parsed
  } catch (error: any) {
    return null
  }
}
