// src/lib/normalization/banks/passifs.ts
// Normalization logic for bank liabilities (passifs)
// Ported from Base44: normalizePassifKey

import { UnmappedLine } from '../types'

/**
 * Helper function to map 9.x sub-items to 10-16
 * 9.1 -> PASSIF_10, 9.2 -> PASSIF_11, etc.
 */
function mapNineSubsToTenSixteen(numStr: string): string {
  const mapping: Record<string, string> = {
    '9.1': '10',
    '9.2': '11',
    '9.3': '12',
    '9.4': '13',
    '9.5': '14',
    '9.6': '15',
    '9.7': '16'
  }

  if (mapping[numStr]) {
    return `PASSIF_${mapping[numStr]}`
  }

  // For simple numbers like "1", "9", "10", etc.
  return `PASSIF_${numStr.replace('.', '').padStart(2, '0')}`
}

/**
 * Normalize passif line to standardized IRP key
 * 
 * @param poste - Original account code
 * @param desc - Original description
 * @param collector - Array to collect unmapped lines
 * @param context - Additional context (company_name, statement_type, etc.)
 * @returns Normalized key (e.g., "PASSIF_01", "PASSIF_TOTAL", "PASSIF_UNDEFINED")
 */
export function normalizePassifKey(
  poste: string | number | null | undefined,
  desc: string | null | undefined,
  collector?: UnmappedLine[],
  context: Record<string, any> = {}
): string {
  // Normalize inputs
  const posteStr = (poste || '').toString().trim()
  const descStr = (desc || '').toString().trim().toUpperCase()

  // 🔹 HIGHEST PRIORITY: TOTAL
  if (descStr.includes('TOTAL DU PASSIF') || descStr.includes('TOTAL PASSIF')) {
    return 'PASSIF_TOTAL'
  }

  // 🔹 Mapping by RBP code (direct mapping like actifs)
  const rbpMapping: Record<string, string> = {
    RBP_0010: 'PASSIF_01',  // Banque Centrale, CCP
    RBP_0020: 'PASSIF_02',  // Dettes interbancaires
    RBP_0030: 'PASSIF_03',  // Dettes clientèle
    RBP_0040: 'PASSIF_04',  // Dettes représentées par un titre
    RBP_0050: 'PASSIF_05',  // Autres passifs
    RBP_0060: 'PASSIF_06',  // Comptes de régularisation
    RBP_0070: 'PASSIF_07',  // Provisions
    RBP_0080: 'PASSIF_08',  // Emprunts et titres émis subordonnés
    RBP_0090: 'PASSIF_09',  // Capitaux propres et ressources assimilées
    RBP_0100: 'PASSIF_10',  // Capital souscrit versé
    RBP_0110: 'PASSIF_11',  // Primes liées au capital
    RBP_0120: 'PASSIF_12',  // Réserves
    RBP_0130: 'PASSIF_13',  // Écart de réévaluation
    RBP_0140: 'PASSIF_14',  // Provisions réglementées
    RBP_0150: 'PASSIF_15',  // Report à nouveau
    RBP_0160: 'PASSIF_16',  // Résultat de l'exercice
    RBP_0170: 'PASSIF_TOTAL'  // Total passif
  }

  if (posteStr.startsWith('RBP_') && rbpMapping[posteStr]) {
    return rbpMapping[posteStr]
  }

  // 🔹 Case 1: RBP_xxxx codes with number in description
  if (/^RBP_\d{4}$/i.test(posteStr)) {
    const match = descStr.match(/^(\d+(\.\d+)?)/)
    if (match) {
      return mapNineSubsToTenSixteen(match[1])
    }
    return posteStr.toUpperCase() // Fallback to original code
  }

  // 🔹 Case 2: Explicit number in poste (e.g., 1, 2, 10, 16)
  if (/^\d{1,2}$/.test(posteStr)) {
    const num = parseInt(posteStr, 10)
    
    // Direct mapping for 1-9 (simple passifs)
    if (num >= 1 && num <= 9) {
      return `PASSIF_${String(num).padStart(2, '0')}`
    }
    
    // For 10-16 (capitaux propres), use direct mapping
    if (num >= 10 && num <= 16) {
      return `PASSIF_${num}`
    }
    
    // Fallback to mapNineSubsToTenSixteen for edge cases
    return mapNineSubsToTenSixteen(posteStr)
  }

  // 🔹 Case 3: Number at start of description (e.g., "1. Banque Centrale")
  const descMatch = descStr.match(/^(\d{1,2})[\.\-\)\s]/)
  if (descMatch) {
    const num = parseInt(descMatch[1], 10)
    
    // Direct mapping for 1-9
    if (num >= 1 && num <= 9) {
      return `PASSIF_${String(num).padStart(2, '0')}`
    }
    
    // Direct mapping for 10-16
    if (num >= 10 && num <= 16) {
      return `PASSIF_${num}`
    }
    
    // Fallback
    return mapNineSubsToTenSixteen(descMatch[1])
  }

  // 🔹 Case 4: Manual mapping by keywords
  const keywordMapping: Record<string, string> = {
    'CAPITAL SOUSCRIT': 'PASSIF_10',
    'PRIMES LIEES AU CAPITAL': 'PASSIF_11',
    'RESERVES': 'PASSIF_12',
    'ECART DE REEVALUATION': 'PASSIF_13',
    'PROVISIONS REGLEMENTEES': 'PASSIF_14',
    'REPORT A NOUVEAU': 'PASSIF_15',
    "RESULTAT DE L'EXERCICE": 'PASSIF_16'
  }

  for (const [keyword, code] of Object.entries(keywordMapping)) {
    if (descStr.includes(keyword)) {
      return code
    }
  }

  // 🔹 Fallback: Collect unmapped line
  if (collector) {
    collector.push({
      original_poste: posteStr,
      original_description: descStr,
      ...context
    })
  }

  return 'PASSIF_UNDEFINED'
}