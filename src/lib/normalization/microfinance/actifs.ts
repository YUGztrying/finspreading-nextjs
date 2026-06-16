// src/lib/normalization/microfinance/actifs.ts
// Normalization logic for microfinance assets (actifs)
// Ported from Base44: normalizeActifKeyMicro

import { UnmappedLine } from '../types'
import { lookupActifCodeByDescription } from './description-map'

// Mapping based on ACTIFS.pdf (microfinance)
// Convention: MFA_<CODE POSTE>
// E90 (TOTAL ACTIF) mapped to MFA_TOTAL_ACTIF

const MF_ASSET_MAP: Record<string, string> = {
  // A — OPÉRATIONS DE TRÉSORERIE ET AVEC LES INSTITUTIONS FINANCIÈRES
  A01: 'MFA_A01', // (en-tête / section)
  A10: 'MFA_A10', // Valeur en caisse
  A11: 'MFA_A11', // Billets et monnaies
  A12: 'MFA_A12', // Comptes ordinaires débiteurs
  A16: 'MFA_A16', // Centre des Chèques postaux (détail de A12)
  A17: 'MFA_A17', // Banques et correspondants (détail de A12)
  A20: 'MFA_A20', // Systèmes Financiers Décentralisés (détail de A12)
  A21: 'MFA_A21', // Autres institutions financières (détail de A12)
  A2A: 'MFA_A2A', // Autres comptes de dépôts débiteurs
  A2H: 'MFA_A2H', // Dépôts à terme constitués
  A2I: 'MFA_A2I', // Dépôts de garantie constitués
  A2J: 'MFA_A2J', // Autres dépôts constitués
  A3A: 'MFA_A3A', // Comptes de prêts
  A3B: 'MFA_A3B', // Prêts à moins d'un an
  A3C: 'MFA_A3C', // Prêts à terme
  A60: 'MFA_A60', // Créances rattachées
  A70: 'MFA_A70', // Prêts en souffrance prêts immobilisés
  Z01: 'MFA_Z01', // Prêts immobilisés
  A71: 'MFA_A71', // Prêts en souffrance ≤ 6 mois
  A72: 'MFA_A72', // Prêts en souffrance >6 à ≤12 mois
  A73: 'MFA_A73', // Prêts en souffrance >12 à ≤24 mois

  // B — OPÉRATIONS AVEC LES MEMBRES / BÉNÉFICIAIRES / CLIENTS
  B01: 'MFA_B01', // (en-tête / section)
  B2D: 'MFA_B2D', // Crédits à court terme
  B2N: 'MFA_B2N', // Comptes ordinaires
  B30: 'MFA_B30', // Crédits à moyen terme
  B40: 'MFA_B40', // Crédits à long terme
  B65: 'MFA_B65', // Créances rattachées
  B70: 'MFA_B70', // Crédits en souffrance
  Z02: 'MFA_Z02', // Crédits immobilisés
  B71: 'MFA_B71', // Crédits en souffrance ≤ 6 mois
  B72: 'MFA_B72', // Crédits en souffrance >6 à ≤12 mois
  B73: 'MFA_B73', // Crédits en souffrance >12 à ≤24 mois

  // C — OPÉRATIONS SUR TITRES ET OPÉRATIONS DIVERSES
  C01: 'MFA_C01', // (en-tête / section)
  C10: 'MFA_C10', // Titres de placement
  C30: 'MFA_C30', // Comptes de stocks
  C31: 'MFA_C31', // Stocks de meubles
  C32: 'MFA_C32', // Stocks de marchandises
  C33: 'MFA_C33', // Stocks de fournitures
  C34: 'MFA_C34', // Autres stocks et assimilés
  C40: 'MFA_C40', // Débiteurs divers
  C55: 'MFA_C55', // Créances rattachées
  C56: 'MFA_C56', // Valeur à l'encaissement avec crédit immédiat
  C59: 'MFA_C59', // Valeur à rejeter
  C6A: 'MFA_C6A', // Comptes d'ordre et divers
  C6N: 'MFA_C6N', // Comptes transitoires et d'attente actif (378 + 3791)
  C6B: 'MFA_C6B', // Comptes de liaison
  C6C: 'MFA_C6C', // Comptes de différence de conversion
  C6G: 'MFA_C6G', // Comptes de régularisation actif
  C6Q: 'MFA_C6Q', // Comptes transitoires
  C6R: 'MFA_C6R', // Comptes d'attente actif

  // D — VALEURS IMMOBILISÉES
  D01: 'MFA_D01', // (en-tête / section)
  D1A: 'MFA_D1A', // Immobilisations financières
  D10: 'MFA_D10', // Prêts et titres subordonnés
  D1E: 'MFA_D1E', // Titres de participation
  D1L: 'MFA_D1L', // Titres d'investissement
  D1S: 'MFA_D1S', // Dépôts et cautionnements
  D23: 'MFA_D23', // Immobilisations en cours
  D24: 'MFA_D24', // Incorporelles
  D25: 'MFA_D25', // Corporelles
  D30: 'MFA_D30', // Immobilisations d'exploitation
  D31: 'MFA_D31', // Incorporelles
  D36: 'MFA_D36', // Corporelles
  D40: 'MFA_D40', // Immobilisations hors exploitation
  D41: 'MFA_D41', // Incorporelles
  D45: 'MFA_D45', // Corporelles
  Z03: 'MFA_Z03', // Immos acquises par réalisation de garantie
  D46: 'MFA_D46', // Incorporelles
  D47: 'MFA_D47', // Corporelles
  D50: 'MFA_D50', // Crédits-bail & opérations assimilées
  D51: 'MFA_D51', // Crédits-bail
  D52: 'MFA_D52', // L.o.a.
  D53: 'MFA_D53', // Location vente
  D60: 'MFA_D60', // Créances rattachées
  D70: 'MFA_D70', // Créances en souffrance
  D71: 'MFA_D71', // Créances en souffrance ≤ 6 mois
  D72: 'MFA_D72', // Créances en souffrance >6 à ≤12 mois
  D73: 'MFA_D73', // Créances en souffrance >12 à ≤24 mois

  // E — ACTIONNAIRES / ASSOCIÉS / MEMBRES
  E01: 'MFA_E01', // (en-tête / section)
  E02: 'MFA_E02', // Capital non appelé
  E03: 'MFA_E03', // Capital appelé non versé
  E05: 'MFA_E05', // Excédent de charges sur les produits

  // TOTAL
  E90: 'MFA_TOTAL_ACTIF' // TOTAL ACTIF
}

/**
 * Hash function to generate unique keys for unmapped lines
 */
function hashCode(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0 // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36) // Convert to base36 string
}

/**
 * Normalize microfinance actif line to standardized IRP key
 * 
 * @param poste - Original account code
 * @param desc - Original description
 * @param collector - Array to collect unmapped lines
 * @param context - Additional context (company_name, statement_type, etc.)
 * @returns Normalized key (e.g., "MFA_A10", "MFA_TOTAL_ACTIF", "MFA_UNDEFINED_xxxxx")
 */
export function normalizeActifKeyMicro(
  poste: string | number | null | undefined,
  desc: string | null | undefined,
  collector?: UnmappedLine[],
  context: Record<string, any> = {}
): string {
  const posteStr = (poste || '').toString().trim().toUpperCase()
  const descStr = (desc || '').toString().trim().toUpperCase()

  // 🔹 HIGHEST PRIORITY: TOTAL ACTIF
  if (posteStr === 'E90' || descStr.includes('TOTAL ACTIF')) {
    return 'MFA_TOTAL_ACTIF'
  }

  // 🔹 Direct mapping by exact code (recommended)
  if (MF_ASSET_MAP[posteStr]) {
    return MF_ASSET_MAP[posteStr]
  }

  // 🔹 Description-based fallback: SFD published reports number postes
  // 1, 2, 3, … with no alphanumeric code, so the exact-code lookup above misses
  // even when the line is a perfectly valid BCEAO poste. Try matching the
  // canonical description before giving up.
  const codeFromDesc = lookupActifCodeByDescription(desc)
  if (codeFromDesc && MF_ASSET_MAP[codeFromDesc]) {
    return MF_ASSET_MAP[codeFromDesc]
  }

  // 🔹 Fallback: Generate unique key for unmapped lines
  const uniqueKey = `${posteStr}_${descStr}`.replace(/[^A-Z0-9_]/g, '_')
  const hashedKey = hashCode(uniqueKey)
  const finalKey = `MFA_UNDEFINED_${hashedKey}`

  if (collector) {
    collector.push({
      original_poste: posteStr,
      original_description: descStr,
      generated_key: finalKey,
      ...context
    })
  }

  return finalKey
}