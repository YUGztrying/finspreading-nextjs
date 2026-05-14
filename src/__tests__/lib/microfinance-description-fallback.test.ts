/**
 * Tests for the microfinance description-based normalization fallback.
 *
 * The fallback exists for SYSCOA-IMF published reports (the "États Financiers
 * Consolidés" booklets) where Claude's OCR returns numerical poste positions
 * "1", "2", "3", … instead of the BCEAO codes (A01, A10, B2D, …). Without
 * this layer those rows end up as MFA_UNDEFINED_<hash> and refuse to merge
 * with the matching MFA_A10 rows from Etat 167 Excel uploads.
 */

import {
  normalizeDescription,
  lookupActifCodeByDescription,
  lookupPassifCodeByDescription,
  MF_ACTIF_DESC_TO_CODE_NORMALIZED,
  MF_PASSIF_DESC_TO_CODE_NORMALIZED,
} from '@/lib/normalization/microfinance/description-map'
import { normalizeActifKeyMicro } from '@/lib/normalization/microfinance/actifs'
import { normalizePassifKeyMicro } from '@/lib/normalization/microfinance/passifs'

describe('normalizeDescription', () => {
  it('strips accents, lowercases, collapses non-alphanumeric runs', () => {
    expect(normalizeDescription('Valeur en caisse')).toBe('valeur en caisse')
    expect(normalizeDescription('  Dépôts à terme constitués  ')).toBe('depots a terme constitues')
    expect(normalizeDescription("L.o.a.")).toBe('l o a')
    expect(normalizeDescription('CRÉDITS À COURT TERME')).toBe('credits a court terme')
    expect(normalizeDescription("Comptes d'ordre et divers")).toBe('comptes d ordre et divers')
  })

  it('returns empty string for null/undefined/empty', () => {
    expect(normalizeDescription(null)).toBe('')
    expect(normalizeDescription(undefined)).toBe('')
    expect(normalizeDescription('')).toBe('')
    expect(normalizeDescription('   ')).toBe('')
  })
})

describe('lookupActifCodeByDescription', () => {
  it('matches canonical descriptions exactly', () => {
    expect(lookupActifCodeByDescription('Valeur en caisse')).toBe('A10')
    expect(lookupActifCodeByDescription('Billets et monnaies')).toBe('A11')
    expect(lookupActifCodeByDescription('Comptes ordinaires débiteurs')).toBe('A12')
    expect(lookupActifCodeByDescription('Crédits à court terme')).toBe('B2D')
    expect(lookupActifCodeByDescription('Crédits à moyen terme')).toBe('B30')
    expect(lookupActifCodeByDescription('Crédits à long terme')).toBe('B40')
    expect(lookupActifCodeByDescription('TOTAL ACTIF')).toBe('E90')
  })

  it('is case- and accent-insensitive', () => {
    expect(lookupActifCodeByDescription('VALEUR EN CAISSE')).toBe('A10')
    expect(lookupActifCodeByDescription('valeur en caisse')).toBe('A10')
    expect(lookupActifCodeByDescription('Valeur En Caisse')).toBe('A10')
    expect(lookupActifCodeByDescription('Depots a terme constitues')).toBe('A2H') // no accents
  })

  it('tolerates punctuation / spacing noise from OCR', () => {
    expect(lookupActifCodeByDescription("  Comptes d'ordre et divers  ")).toBe('C6A')
    expect(lookupActifCodeByDescription('Comptes-de-stocks')).toBe('C30')
    expect(lookupActifCodeByDescription("L.o.a.")).toBe('D52')
  })

  it('returns null for ambiguous descriptions (intentionally not in the map)', () => {
    // "Créances rattachées" appears under A60, B65, C55, D60 — context is needed
    expect(lookupActifCodeByDescription('Créances rattachées')).toBeNull()
    // "Incorporelles" appears under D24, D31, D41, D46
    expect(lookupActifCodeByDescription('Incorporelles')).toBeNull()
    // "Corporelles" appears under D25, D36, D45, D47
    expect(lookupActifCodeByDescription('Corporelles')).toBeNull()
  })

  it('returns null for unknown descriptions', () => {
    expect(lookupActifCodeByDescription('not a real line item')).toBeNull()
    expect(lookupActifCodeByDescription('')).toBeNull()
    expect(lookupActifCodeByDescription(null)).toBeNull()
  })
})

describe('lookupPassifCodeByDescription', () => {
  it('matches L-section (fonds propres) descriptions', () => {
    expect(lookupPassifCodeByDescription('Capital')).toBe('L50')
    expect(lookupPassifCodeByDescription('Capital social')).toBe('L50')
    expect(lookupPassifCodeByDescription('Subventions d\'investissement')).toBe('L10')
    expect(lookupPassifCodeByDescription('Fonds de garantie')).toBe('L21')
    expect(lookupPassifCodeByDescription('Réserves')).toBe('L30')
    expect(lookupPassifCodeByDescription('TOTAL PASSIF')).toBe('L90')
  })

  it("omits F/G ambiguous descriptions (Comptes ordinaires créditeurs, Dépôts à terme reçus etc.)", () => {
    // F1A and G10 both have "Comptes ordinaires créditeurs"
    expect(lookupPassifCodeByDescription('Comptes ordinaires créditeurs')).toBeNull()
    // F2B and G15 both have "Dépôts à terme reçus"
    expect(lookupPassifCodeByDescription('Dépôts à terme reçus')).toBeNull()
  })
})

describe('normalizeActifKeyMicro (with description fallback)', () => {
  it('uses exact code when poste matches the BCEAO map', () => {
    expect(normalizeActifKeyMicro('A10', 'Valeur en caisse')).toBe('MFA_A10')
    expect(normalizeActifKeyMicro('B2D', 'Crédits à court terme')).toBe('MFA_B2D')
  })

  it('falls back to description when poste is a SYSCOA-IMF positional number', () => {
    // SYSCOA-IMF published reports number postes 1, 2, 3… — those don't
    // exist in the BCEAO code map and previously fell straight into UNDEFINED.
    expect(normalizeActifKeyMicro('1', 'Valeur en caisse')).toBe('MFA_A10')
    expect(normalizeActifKeyMicro('2', 'Billets et monnaies')).toBe('MFA_A11')
    expect(normalizeActifKeyMicro('7', 'Crédits à court terme')).toBe('MFA_B2D')
  })

  it('falls back to description when poste is empty', () => {
    expect(normalizeActifKeyMicro('', 'Comptes de stocks')).toBe('MFA_C30')
    expect(normalizeActifKeyMicro(null, 'Débiteurs divers')).toBe('MFA_C40')
  })

  it('still emits UNDEFINED + collector entry for genuinely unmappable rows', () => {
    const collector: unknown[] = []
    const result = normalizeActifKeyMicro(
      '999',
      'Some random line that does not exist in SYSCOA',
      collector as never
    )
    expect(result).toMatch(/^MFA_UNDEFINED_/)
    expect(collector).toHaveLength(1)
    expect((collector[0] as { original_poste: string }).original_poste).toBe('999')
  })

  it('preserves the TOTAL ACTIF special case (description-based, was already there)', () => {
    expect(normalizeActifKeyMicro('', 'TOTAL ACTIF')).toBe('MFA_TOTAL_ACTIF')
    expect(normalizeActifKeyMicro('E90', '')).toBe('MFA_TOTAL_ACTIF')
    // Positional poste from SYSCOA-IMF + canonical description
    expect(normalizeActifKeyMicro('45', 'Total actif')).toBe('MFA_TOTAL_ACTIF')
  })
})

describe('normalizePassifKeyMicro (with description fallback)', () => {
  it('uses exact code when poste matches', () => {
    expect(normalizePassifKeyMicro('L01', 'Provisions, fonds propres et assimilés')).toBe('MFP_L01')
    expect(normalizePassifKeyMicro('L50', 'Capital')).toBe('MFP_L50')
  })

  it('falls back to description for positional postes', () => {
    expect(normalizePassifKeyMicro('1', 'Capital social')).toBe('MFP_L50')
    expect(normalizePassifKeyMicro('', 'Fonds de garantie')).toBe('MFP_L21')
    expect(normalizePassifKeyMicro(null, 'Réserves')).toBe('MFP_L30')
  })

  it('falls back to UNDEFINED for ambiguous F/G descriptions to avoid wrong matches', () => {
    // "Comptes ordinaires créditeurs" with no code → ambiguous between F1A
    // and G10 → must stay UNDEFINED rather than guess wrong.
    const result = normalizePassifKeyMicro('', 'Comptes ordinaires créditeurs')
    expect(result).toMatch(/^MFP_UNDEFINED_/)
  })

  it('preserves the TOTAL PASSIF special case', () => {
    expect(normalizePassifKeyMicro('', 'TOTAL PASSIF')).toBe('MFP_TOTAL_PASSIF')
    expect(normalizePassifKeyMicro('L90', '')).toBe('MFP_TOTAL_PASSIF')
  })
})

describe('dictionary internal consistency', () => {
  it('actif dictionary has no key that normalizes to an empty string', () => {
    for (const k of Object.keys(MF_ACTIF_DESC_TO_CODE_NORMALIZED)) {
      expect(k.length).toBeGreaterThan(0)
    }
  })

  it('passif dictionary has no key that normalizes to an empty string', () => {
    for (const k of Object.keys(MF_PASSIF_DESC_TO_CODE_NORMALIZED)) {
      expect(k.length).toBeGreaterThan(0)
    }
  })
})
