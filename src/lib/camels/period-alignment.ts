// src/lib/camels/period-alignment.ts
// Detects whether BS and IS periods are aligned and suggests mappings.

import type { PeriodMapping, PeriodAlignmentInfo } from '@/types/database.types'

type StmtPeriods = Record<string, { periods: string[] }>

const STMT_TYPES = ['actifs', 'passifs', 'compte_resultats', 'hors_bilan'] as const

/**
 * Format an ISO date to a readable label.
 * "2024-06-30" → "Jun 2024", "2023-12-31" → "Dec 2023"
 */
function periodLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

/**
 * Find the closest date in `candidates` that is within `maxDaysApart` of `target`.
 * Returns null if nothing is close enough.
 */
function findClosestPeriod(
  target: string,
  candidates: string[],
  maxDaysApart = 45
): string | null {
  if (candidates.length === 0) return null

  const tMs = new Date(target).getTime()
  let best: string | null = null
  let bestDist = Infinity

  for (const c of candidates) {
    const dist = Math.abs(new Date(c).getTime() - tMs)
    if (dist < bestDist) {
      bestDist = dist
      best = c
    }
  }

  const maxMs = maxDaysApart * 24 * 60 * 60 * 1000
  return best && bestDist <= maxMs ? best : null
}

/**
 * Check whether all non-empty statement types share exactly the same period array.
 * Returns alignment info with auto-suggested mappings.
 */
export function detectPeriodAlignment(statements: StmtPeriods): PeriodAlignmentInfo {
  const available = {
    actifs: statements.actifs?.periods ?? [],
    passifs: statements.passifs?.periods ?? [],
    compte_resultats: statements.compte_resultats?.periods ?? [],
    hors_bilan: statements.hors_bilan?.periods ?? [],
  }

  // Collect all non-empty period arrays
  const nonEmpty = Object.values(available).filter(a => a.length > 0)

  // Check if all non-empty arrays are identical
  const aligned =
    nonEmpty.length <= 1 ||
    nonEmpty.every(
      arr =>
        arr.length === nonEmpty[0].length &&
        arr.every((p, i) => p === nonEmpty[0][i])
    )

  // Build suggested mappings
  const suggested = buildSuggestedMappings(available)

  return { aligned, available, suggested }
}

/**
 * Build a suggested set of period mappings by:
 * 1. Collecting all unique periods across all statement types
 * 2. For each, finding the best match in each statement type
 *    - Exact match first, then closest within 45 days
 */
function buildSuggestedMappings(available: PeriodAlignmentInfo['available']): PeriodMapping[] {
  // BS periods = union of actifs + passifs (they almost always match)
  const bsPeriods = [...new Set([...available.actifs, ...available.passifs])].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  )
  const isPeriods = [...available.compte_resultats].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  )
  const hbPeriods = [...available.hors_bilan].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  )

  // Union of all unique period dates
  const allPeriods = [...new Set([...bsPeriods, ...isPeriods, ...hbPeriods])].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  )

  // For each date, find the best match in each statement type category
  const mappings: PeriodMapping[] = allPeriods.map(p => {
    const bsExact = bsPeriods.includes(p) ? p : null
    const isExact = isPeriods.includes(p) ? p : null
    const hbExact = hbPeriods.includes(p) ? p : null

    return {
      label: periodLabel(p),
      bs_period: bsExact ?? findClosestPeriod(p, bsPeriods),
      is_period: isExact ?? findClosestPeriod(p, isPeriods),
      hb_period: hbExact ?? findClosestPeriod(p, hbPeriods),
    }
  })

  // Deduplicate: if two mappings ended up with the exact same (bs, is, hb) combo,
  // keep only one (the later one, since the union is sorted chronologically).
  const seen = new Set<string>()
  const deduped: PeriodMapping[] = []
  for (const m of mappings) {
    const key = `${m.bs_period}|${m.is_period}|${m.hb_period}`
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(m)
    }
  }

  return deduped
}

/**
 * Generate trivial 1:1 mappings when all statement types share periods.
 * Used as the default when periods are perfectly aligned (skip the dialog).
 */
export function generateAlignedMappings(periods: string[]): PeriodMapping[] {
  return periods.map(p => ({
    label: periodLabel(p),
    bs_period: p,
    is_period: p,
    hb_period: p,
  }))
}
