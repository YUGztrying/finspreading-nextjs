// src/__tests__/lib/microfinance-catalog.test.ts
import {
  MF_CATALOG,
  getCatalogEntry,
  getCatalogForSection,
  isUndefinedPoste,
} from '@/lib/normalization/microfinance/catalog'

describe('microfinance catalog', () => {
  describe('MF_CATALOG', () => {
    it('contains entries for all 4 sections', () => {
      const sections = new Set(MF_CATALOG.map((e) => e.section))
      expect(sections.has('actif')).toBe(true)
      expect(sections.has('passif')).toBe(true)
      expect(sections.has('compte_resultats')).toBe(true)
    })

    it('has every entry well-formed (fullKey, rawCode, label, group)', () => {
      for (const e of MF_CATALOG) {
        expect(e.fullKey).toMatch(/^MF[ACPO]B?_[A-Za-z0-9_]+$/)
        expect(e.rawCode.length).toBeGreaterThan(0)
        expect(e.label.length).toBeGreaterThan(0)
        expect(e.group.length).toBe(1)
        expect(e.groupTitle.length).toBeGreaterThan(0)
      }
    })

    it('has no duplicate fullKey across the whole catalog', () => {
      const seen = new Set<string>()
      const dupes: string[] = []
      for (const e of MF_CATALOG) {
        if (seen.has(e.fullKey)) dupes.push(e.fullKey)
        seen.add(e.fullKey)
      }
      expect(dupes).toEqual([])
    })

    it('exposes the canonical TOTAL keys', () => {
      const totalActif = MF_CATALOG.find((e) => e.fullKey === 'MFA_TOTAL_ACTIF')
      const totalPassif = MF_CATALOG.find((e) => e.fullKey === 'MFP_TOTAL_PASSIF')
      expect(totalActif?.label).toBe('TOTAL ACTIF')
      expect(totalPassif?.label).toBe('TOTAL PASSIF')
    })
  })

  describe('getCatalogEntry', () => {
    it('returns the entry for a known full key', () => {
      const e = getCatalogEntry('MFA_A10')
      expect(e?.label).toBe('Valeurs en caisse')
      expect(e?.section).toBe('actif')
    })

    it('returns null for unknown keys', () => {
      expect(getCatalogEntry('MFA_UNDEFINED_xxx')).toBeNull()
      expect(getCatalogEntry('GARBAGE')).toBeNull()
      expect(getCatalogEntry('')).toBeNull()
      expect(getCatalogEntry(null)).toBeNull()
      expect(getCatalogEntry(undefined)).toBeNull()
    })

    it('trims whitespace before lookup', () => {
      expect(getCatalogEntry('  MFA_A10  ')?.fullKey).toBe('MFA_A10')
    })
  })

  describe('getCatalogForSection', () => {
    it('filters to actifs', () => {
      const actifs = getCatalogForSection('actif')
      expect(actifs.length).toBeGreaterThan(50)
      expect(actifs.every((e) => e.section === 'actif')).toBe(true)
    })

    it('accepts plural form (actifs, passifs)', () => {
      const actifs = getCatalogForSection('actifs')
      const passifs = getCatalogForSection('passifs')
      expect(actifs.every((e) => e.section === 'actif')).toBe(true)
      expect(passifs.every((e) => e.section === 'passif')).toBe(true)
    })

    it('returns the whole catalog when section is undefined', () => {
      const all = getCatalogForSection(undefined)
      expect(all.length).toBe(MF_CATALOG.length)
    })

    it('disambiguates MFP_ between passif and compte_resultats', () => {
      // MFP_L20 is a passif (Fonds affectés), MFP_V1A is a produit
      const passifs = getCatalogForSection('passif')
      const cr = getCatalogForSection('compte_resultats')
      expect(passifs.find((e) => e.fullKey === 'MFP_L20')).toBeDefined()
      expect(passifs.find((e) => e.fullKey === 'MFP_V1A')).toBeUndefined()
      expect(cr.find((e) => e.fullKey === 'MFP_V1A')).toBeDefined()
      expect(cr.find((e) => e.fullKey === 'MFP_L20')).toBeUndefined()
    })
  })

  describe('isUndefinedPoste', () => {
    it('flags null, undefined, empty', () => {
      expect(isUndefinedPoste(null)).toBe(true)
      expect(isUndefinedPoste(undefined)).toBe(true)
      expect(isUndefinedPoste('')).toBe(true)
      expect(isUndefinedPoste('   ')).toBe(true)
    })

    it('flags the normalizer outputs', () => {
      expect(isUndefinedPoste('MFA_UNDEFINED_abc123')).toBe(true)
      expect(isUndefinedPoste('MFP_UNDEFINED_xyz')).toBe(true)
      expect(isUndefinedPoste('MFI_UNDEFINED')).toBe(true)
      expect(isUndefinedPoste('MFA_UNDEFI')).toBe(true) // truncated display form
    })

    it('does not flag valid codes', () => {
      expect(isUndefinedPoste('MFA_A10')).toBe(false)
      expect(isUndefinedPoste('MFP_L20')).toBe(false)
      expect(isUndefinedPoste('MFC_R08')).toBe(false)
    })
  })
})
