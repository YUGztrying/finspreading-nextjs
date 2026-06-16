// src/lib/normalization/period-resolver.ts
// Resolve relative period labels (e.g. "exercice N-1", "N", "N+1") into real
// YYYY-MM-DD dates using the statement's closing date.
//
// Why this exists:
//   BCEAO bank and SFD balance sheets often label comparative columns as
//   "exercice N-1 / exercice N" rather than explicit years. Asking Claude to
//   deduce the absolute year from the printed "Date d'arrêté" field worked
//   non-deterministically — sometimes it resolved to "2023-12-31", other
//   times it returned the literal "exercice N-1" string. Literal labels then
//   leaked into the database `periods` array and broke merges across multiple
//   uploads of the same company (one PDF's "2022-12-31" would never equal
//   another PDF's "exercice N-1", so the merge created phantom columns).
//
//   The fix splits the responsibility: Claude is asked only to read the
//   printed closing-date AND return whatever the column headers actually
//   show. The server then converts relative labels deterministically here.

export interface PeriodResolution {
  /** Periods after resolution (same order as input). */
  resolved: string[]
  /** Closing date parsed and re-formatted YYYY-MM-DD. Null if unparseable. */
  closingDateNormalized: string | null
  /** True if at least one period was rewritten by the resolver. */
  changed: boolean
  /** True if at least one period in `resolved` still looks like a relative literal. */
  hasUnresolved: boolean
}

/**
 * Parse a free-form closing date string into a Date. Accepts:
 *   - ISO: 2023-12-31
 *   - French: 31/12/2023, 31-12-2023, 31.12.2023
 *   - "31|12|2023" (the BCEAO checkered-box form spat out by some extractors)
 * Returns null when nothing parses confidently.
 */
export function parseClosingDate(input: string | null | undefined): Date | null {
  if (!input) return null
  const s = String(input).trim()
  if (!s) return null

  // ISO YYYY-MM-DD or YYYY/MM/DD
  const iso = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (iso) {
    const [, y, m, d] = iso
    return safeDate(+y, +m, +d)
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const fr = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (fr) {
    const [, d, m, y] = fr
    return safeDate(+y, +m, +d)
  }

  // BCEAO checkered form: "31|12|2023" or "31 | 12 | 2023" or "31  12  2023"
  const boxed = s.match(/^(\d{1,2})\s*[|\s]\s*(\d{1,2})\s*[|\s]\s*(\d{4})$/)
  if (boxed) {
    const [, d, m, y] = boxed
    return safeDate(+y, +m, +d)
  }

  // Don't fall back to `new Date(s)` — its engine-dependent behavior on
  // strings like "exercice N-1" or "Nov 2023" can produce silently wrong
  // dates. Stricter is safer; unrecognized strings stay unresolved.
  return null
}

function safeDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  // Build via UTC components so we don't drift by timezone when formatting.
  const dt = new Date(Date.UTC(year, month - 1, day))
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1) return null
  return dt
}

function formatDate(dt: Date): string {
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Parse + canonicalize a closing date to YYYY-MM-DD, or null if unparseable.
 * Convenience wrapper used by callers that just need the normalized string
 * (e.g. cross-statement closing-date consensus voting).
 */
export function normalizeClosingDate(input: string | null | undefined): string | null {
  const dt = parseClosingDate(input)
  return dt ? formatDate(dt) : null
}

/**
 * Detect relative-year labels like "N", "N-1", "exercice N-1", "année N",
 * "Période N+1", "FY N-2". Returns the year offset (0 for "N", -1 for "N-1",
 * +1 for "N+1") or null if not a relative label.
 *
 * The regex is intentionally permissive on the prefix (exercice/année/period/
 * période/year/exercise/fy/empty) and on whitespace, but strict on the "N"
 * shape so we don't accidentally rewrite a real date label.
 */
export function parseRelativeOffset(label: string): number | null {
  const s = String(label || '').trim()
  if (!s) return null
  // Optional prefix word + N + optional [+-]<digits>
  const m = s.match(
    /^(?:(?:exercice|année|annee|periode|période|year|exercise|fy)\s+)?n(?:\s*([+-])\s*(\d+))?\s*$/i
  )
  if (!m) return null
  const sign = m[1]
  const n = m[2]
  if (!sign || !n) return 0
  const offset = parseInt(n, 10)
  if (isNaN(offset)) return 0
  return sign === '-' ? -offset : offset
}

/**
 * Check whether a string already looks like a fully qualified YYYY-MM-DD or
 * a parseable date we shouldn't touch.
 */
export function isAbsoluteDate(label: string): boolean {
  return parseClosingDate(label) !== null
}

/**
 * Resolve a periods array using the closing date.
 *
 * Behavior:
 *   - Each period that looks like a relative label ("N-1", "exercice N", …)
 *     is rewritten to `<closing year + offset>-12-31`.
 *   - Each period that already parses as a real date is normalized to
 *     YYYY-MM-DD.
 *   - Anything else is kept verbatim and flagged via `hasUnresolved` so the
 *     UI can warn the analyst.
 *   - When the closing date itself doesn't parse, relative labels are kept
 *     as-is (we don't guess the year). hasUnresolved will be true in that case.
 */
export function resolveRelativePeriods(
  periods: string[],
  closingDate: string | null | undefined
): PeriodResolution {
  const parsed = parseClosingDate(closingDate)
  const closingDateNormalized = parsed ? formatDate(parsed) : null
  const baseYear = parsed?.getUTCFullYear() ?? null

  let changed = false
  let hasUnresolved = false

  const resolved = periods.map((raw) => {
    const s = String(raw || '').trim()
    if (!s) {
      hasUnresolved = true
      return s
    }

    // Already absolute? normalize to canonical YYYY-MM-DD.
    const abs = parseClosingDate(s)
    if (abs) {
      const normalized = formatDate(abs)
      if (normalized !== s) changed = true
      return normalized
    }

    // Relative? rewrite using base year.
    const offset = parseRelativeOffset(s)
    if (offset !== null && baseYear !== null) {
      changed = true
      return `${baseYear + offset}-12-31`
    }

    // Couldn't resolve.
    hasUnresolved = true
    return s
  })

  return { resolved, closingDateNormalized, changed, hasUnresolved }
}
