// src/__tests__/lib/microfinance-catalog.test.ts
import {
  MF_CATALOG,
  BANK_CATALOG,
  CATALOG,
  getCatalogEntry,
  getCatalogForSection,
  isUndefinedPoste,
  chartLabel,
} from '@/lib/normalization/microfinance/catalog'

describe('catalog', () => {
  // ─── MF (Référentiel SFD BCEAO) ────────────────────────────────────────────
  describe('MF_CATALOG (Référentiel SFD BCEAO, microfinance)', () => {
    it('contains entries for actif / passif / compte_resultats', () => {
      const sections = new Set(MF_CATALOG.map((e) => e.section))
      expect(sections.has('actif')).toBe(true)
      expect(sections.has('passif')).toBe(true)
      expect(sections.has('compte_resultats')).toBe(true)
    })

    it('has every entry well-formed (fullKey, rawCode, label, single-letter group)', () => {
      for (const e of MF_CATALOG) {
        expect(e.fullKey).toMatch(/^MF[ACPO]B?_[A-Za-z0-9_]+$/)
        expect(e.rawCode.length).toBeGreaterThan(0)
        expect(e.label.length).toBeGreaterThan(0)
        expect(e.group.length).toBe(1)
        expect(e.groupTitle.length).toBeGreaterThan(0)
        expect(e.institutionType).toBe('microfinance')
      }
    })

    it('exposes the canonical TOTAL keys', () => {
      const totalActif = MF_CATALOG.find((e) => e.fullKey === 'MFA_TOTAL_ACTIF')
      const totalPassif = MF_CATALOG.find((e) => e.fullKey === 'MFP_TOTAL_PASSIF')
      expect(totalActif?.label).toBe('TOTAL ACTIF')
      expect(totalPassif?.label).toBe('TOTAL PASSIF')
    })
  })

  // ─── BANK (PCB BCEAO) ──────────────────────────────────────────────────────
  describe('BANK_CATALOG (PCB BCEAO, banque)', () => {
    it('contains 15 actifs (01-14 + TOTAL), 17 passifs (01-16 + TOTAL), 20 CR lines', () => {
      const actifs = BANK_CATALOG.filter((e) => e.section === 'actif')
      const passifs = BANK_CATALOG.filter((e) => e.section === 'passif')
      const cr = BANK_CATALOG.filter((e) => e.section === 'compte_resultats')
      expect(actifs.length).toBe(15)
      expect(passifs.length).toBe(17)
      expect(cr.length).toBe(20)
    })

    it('has every entry well-formed', () => {
      for (const e of BANK_CATALOG) {
        expect(e.fullKey).toMatch(/^(ACTIF|PASSIF|CR)_[A-Z0-9-]+$/)
        expect(e.rawCode.length).toBeGreaterThan(0)
        expect(e.label.length).toBeGreaterThan(0)
        expect(e.group.length).toBeGreaterThan(0)
        expect(e.groupTitle.length).toBeGreaterThan(0)
        expect(e.institutionType).toBe('banque')
      }
    })

    it('exposes canonical bank labels for key codes', () => {
      const expected: Array<[string, string]> = [
        ['ACTIF_01', 'Caisse, Banque Centrale, CCP'],
        ['ACTIF_04', 'Créances clientèle'],
        ['PASSIF_03', 'Dettes clientèle'],
        ['PASSIF_10', 'Capital souscrit versé'],
        ['CR_10', 'Produit Net Bancaire (PNB)'],
        ['CR_20', 'Résultat net'],
      ]
      for (const [key, label] of expected) {
        const entry = BANK_CATALOG.find((e) => e.fullKey === key)
        expect(entry?.label).toBe(label)
      }
    })

    it('exposes canonical TOTAL keys for banks', () => {
      const totalActif = BANK_CATALOG.find((e) => e.fullKey === 'ACTIF_TOTAL')
      const totalPassif = BANK_CATALOG.find((e) => e.fullKey === 'PASSIF_TOTAL')
      expect(totalActif?.label).toBe('TOTAL ACTIF')
      expect(totalPassif?.label).toBe('TOTAL PASSIF')
    })
  })

  // ─── COMBINED CATALOG ──────────────────────────────────────────────────────
  describe('CATALOG (combined)', () => {
    it('is the union of MF and bank catalogs', () => {
      expect(CATALOG.length).toBe(MF_CATALOG.length + BANK_CATALOG.length)
    })

    it('has no duplicate fullKey across MF and bank', () => {
      const seen = new Set<string>()
      const dupes: string[] = []
      for (const e of CATALOG) {
        if (seen.has(e.fullKey)) dupes.push(e.fullKey)
        seen.add(e.fullKey)
      }
      expect(dupes).toEqual([])
    })
  })

  // ─── LOOKUP ────────────────────────────────────────────────────────────────
  describe('getCatalogEntry', () => {
    it('returns the entry for a known microfinance full key', () => {
      const e = getCatalogEntry('MFA_A10')
      expect(e?.label).toBe('Valeurs en caisse')
      expect(e?.section).toBe('actif')
      expect(e?.institutionType).toBe('microfinance')
    })

    it('returns the entry for a known bank full key', () => {
      const e = getCatalogEntry('ACTIF_04')
      expect(e?.label).toBe('Créances clientèle')
      expect(e?.section).toBe('actif')
      expect(e?.institutionType).toBe('banque')
    })

    it('returns null for unknown keys', () => {
      expect(getCatalogEntry('MFA_UNDEFINED_xxx')).toBeNull()
      expect(getCatalogEntry('ACTIF_UNDEFINED')).toBeNull()
      expect(getCatalogEntry('GARBAGE')).toBeNull()
      expect(getCatalogEntry('')).toBeNull()
      expect(getCatalogEntry(null)).toBeNull()
      expect(getCatalogEntry(undefined)).toBeNull()
    })

    it('trims whitespace before lookup', () => {
      expect(getCatalogEntry('  MFA_A10  ')?.fullKey).toBe('MFA_A10')
      expect(getCatalogEntry('  ACTIF_04  ')?.fullKey).toBe('ACTIF_04')
    })
  })

  // ─── SECTION + INSTITUTION FILTER ──────────────────────────────────────────
  describe('getCatalogForSection', () => {
    it('filters by section only (no institution) → mixes both', () => {
      const actifs = getCatalogForSection('actif')
      const institutions = new Set(actifs.map((e) => e.institutionType))
      expect(institutions.has('microfinance')).toBe(true)
      expect(institutions.has('banque')).toBe(true)
    })

    it('filters by section + microfinance → only MFA_*', () => {
      const actifs = getCatalogForSection('actif', 'microfinance')
      expect(actifs.length).toBeGreaterThan(50)
      expect(actifs.every((e) => e.section === 'actif' && e.institutionType === 'microfinance')).toBe(true)
      expect(actifs.every((e) => e.fullKey.startsWith('MFA_'))).toBe(true)
    })

    it('filters by section + banque → only ACTIF_*', () => {
      const actifs = getCatalogForSection('actif', 'banque')
      expect(actifs.length).toBe(15)
      expect(actifs.every((e) => e.fullKey.startsWith('ACTIF_'))).toBe(true)
    })

    it('a bank analyst never sees microfinance codes (no leakage)', () => {
      const bankCR = getCatalogForSection('compte_resultats', 'banque')
      expect(bankCR.every((e) => !e.fullKey.startsWith('MF'))).toBe(true)
    })

    it('a microfinance analyst never sees bank codes (no leakage)', () => {
      const mfActifs = getCatalogForSection('actif', 'microfinance')
      expect(mfActifs.every((e) => !e.fullKey.startsWith('ACTIF_'))).toBe(true)
      expect(mfActifs.every((e) => !e.fullKey.startsWith('PASSIF_'))).toBe(true)
      expect(mfActifs.every((e) => !e.fullKey.startsWith('CR_'))).toBe(true)
    })

    it('accepts plural form (actifs, passifs)', () => {
      const actifs = getCatalogForSection('actifs', 'banque')
      const passifs = getCatalogForSection('passifs', 'banque')
      expect(actifs.every((e) => e.section === 'actif')).toBe(true)
      expect(passifs.every((e) => e.section === 'passif')).toBe(true)
    })

    it('institution-only filter returns all sections for that institution', () => {
      const allBank = getCatalogForSection(undefined, 'banque')
      expect(allBank.length).toBe(BANK_CATALOG.length)
      const allMF = getCatalogForSection(undefined, 'microfinance')
      expect(allMF.length).toBe(MF_CATALOG.length)
    })

    it('no filters → full combined catalog (rare escape hatch)', () => {
      const all = getCatalogForSection(undefined, undefined)
      expect(all.length).toBe(CATALOG.length)
    })

    it('disambiguates MFP_ between microfinance passif and produit', () => {
      const passifs = getCatalogForSection('passif', 'microfinance')
      const cr = getCatalogForSection('compte_resultats', 'microfinance')
      expect(passifs.find((e) => e.fullKey === 'MFP_L20')).toBeDefined()
      expect(passifs.find((e) => e.fullKey === 'MFP_V1A')).toBeUndefined()
      expect(cr.find((e) => e.fullKey === 'MFP_V1A')).toBeDefined()
      expect(cr.find((e) => e.fullKey === 'MFP_L20')).toBeUndefined()
    })
  })

  // ─── UNDEFI DETECTION ──────────────────────────────────────────────────────
  describe('isUndefinedPoste', () => {
    it('flags null, undefined, empty', () => {
      expect(isUndefinedPoste(null)).toBe(true)
      expect(isUndefinedPoste(undefined)).toBe(true)
      expect(isUndefinedPoste('')).toBe(true)
      expect(isUndefinedPoste('   ')).toBe(true)
    })

    it('flags microfinance normalizer outputs', () => {
      expect(isUndefinedPoste('MFA_UNDEFINED_abc123')).toBe(true)
      expect(isUndefinedPoste('MFP_UNDEFINED_xyz')).toBe(true)
      expect(isUndefinedPoste('MFI_UNDEFINED')).toBe(true)
      expect(isUndefinedPoste('MFA_UNDEFI')).toBe(true)
    })

    it('flags bank normalizer outputs', () => {
      expect(isUndefinedPoste('ACTIF_UNDEFINED')).toBe(true)
      expect(isUndefinedPoste('PASSIF_UNDEFINED')).toBe(true)
      expect(isUndefinedPoste('CR_UNDEFINED')).toBe(true)
    })

    it('does not flag valid microfinance or bank codes', () => {
      expect(isUndefinedPoste('MFA_A10')).toBe(false)
      expect(isUndefinedPoste('MFP_L20')).toBe(false)
      expect(isUndefinedPoste('MFC_R08')).toBe(false)
      expect(isUndefinedPoste('ACTIF_01')).toBe(false)
      expect(isUndefinedPoste('PASSIF_10')).toBe(false)
      expect(isUndefinedPoste('CR_20')).toBe(false)
    })
  })

  // ─── CHART LABEL ───────────────────────────────────────────────────────────
  describe('chartLabel', () => {
    it('returns plan label per institution', () => {
      expect(chartLabel('microfinance')).toBe('Référentiel SFD BCEAO')
      expect(chartLabel('banque')).toBe('PCB BCEAO')
    })

    it('returns generic fallback when institution is unknown / undefined', () => {
      expect(chartLabel(undefined)).toBe('comptable')
      expect(chartLabel('unknown' as any)).toBe('comptable')
    })
  })
})
