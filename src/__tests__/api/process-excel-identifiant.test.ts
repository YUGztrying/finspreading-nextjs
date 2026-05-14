/**
 * Tests for parseIdentifiantSheet — the helper that pulls company name and
 * reporting period out of the IDENTIFIANT sheet of BCEAO "Etat 167" microfinance
 * reports. Direct unit tests on the pure function (no Next.js / Supabase mocks).
 */

import { parseIdentifiantSheet } from '@/app/api/process-excel/route'

describe('parseIdentifiantSheet', () => {
  it('extracts company name, period and agrement from a typical ACEP IDENTIFIANT sheet', () => {
    const rows = [
      ['LIBELLÉ', 'DONNÉES À REMPLIR', 'END_COL'],
      ['NOM SFD', 'ACEP CONSOLIDE', 'END_COL'],
      ["NUMÉRO D'AGRÉMENT", 'DK1-09-0011U', 'END_COL'],
      ['ANNÉE', '2026', 'END_COL'],
      ['TRIMESTRE', '1', 'END_COL'],
      ['MOIS', '3', 'END_COL'],
      ['VERSION', '19', 'END_COL'],
      ['END_ROW', '', ''],
    ]

    expect(parseIdentifiantSheet(rows)).toEqual({
      companyName: 'ACEP CONSOLIDE',
      agrementNumber: 'DK1-09-0011U',
      period: '2026-03-31',
    })
  })

  it('returns the last day of the reporting month (handles 28/29/30/31)', () => {
    const cases = [
      { month: 1, period: '2026-01-31' }, // 31 days
      { month: 2, period: '2026-02-28' }, // 28 days (non-leap)
      { month: 4, period: '2026-04-30' }, // 30 days
      { month: 12, period: '2026-12-31' },
    ]
    for (const { month, period } of cases) {
      expect(
        parseIdentifiantSheet([
          ['NOM SFD', 'X', ''],
          ['ANNÉE', '2026', ''],
          ['MOIS', String(month), ''],
        ]).period
      ).toBe(period)
    }
    // Feb 2024 is a leap year
    expect(
      parseIdentifiantSheet([
        ['ANNÉE', '2024', ''],
        ['MOIS', '2', ''],
      ]).period
    ).toBe('2024-02-29')
  })

  it('falls back to trimester when MOIS is missing', () => {
    expect(
      parseIdentifiantSheet([
        ['NOM SFD', 'TEST SFD', ''],
        ['ANNÉE', '2025', ''],
        ['TRIMESTRE', '2', ''],
      ])
    ).toEqual({
      companyName: 'TEST SFD',
      period: '2025-06-30',
    })
  })

  it('returns an empty object on bogus input', () => {
    expect(parseIdentifiantSheet([])).toEqual({})
    // @ts-expect-error testing runtime guard
    expect(parseIdentifiantSheet(null)).toEqual({})
    expect(
      parseIdentifiantSheet([
        ['HEADER', '', ''],
        ['RANDOM ROW', 'foo', ''],
      ])
    ).toEqual({})
  })

  it('rejects out-of-range year/month and discards them', () => {
    expect(
      parseIdentifiantSheet([
        ['NOM SFD', 'X', ''],
        ['ANNÉE', '1999', ''], // before 2000
        ['MOIS', '13', ''], // invalid
      ])
    ).toEqual({ companyName: 'X' }) // no period
  })

  it('matches labels regardless of case, accents and trailing whitespace', () => {
    expect(
      parseIdentifiantSheet([
        ['  nom sfd  ', '  ACEP  ', ''],
        ['annee', '2026', ''],
        ['mois', '6', ''],
      ])
    ).toEqual({
      companyName: 'ACEP',
      period: '2026-06-30',
    })
  })

  it('ignores empty values', () => {
    expect(
      parseIdentifiantSheet([
        ['NOM SFD', '', ''],
        ['ANNÉE', '2026', ''],
        ['MOIS', '3', ''],
      ])
    ).toEqual({
      period: '2026-03-31',
    })
  })
})
