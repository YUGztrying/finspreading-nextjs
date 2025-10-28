// src/lib/normalization/microfinance/passifs.ts
// Normalization logic for microfinance liabilities (passifs)
// Ported from Base44: normalizePassifKeyMicro

import { UnmappedLine } from '../types'

// Mapping based on PASSIFS.pdf (microfinance)
// Convention: MFP_<CODE POSTE>
// L90 (TOTAL PASSIF) mapped to MFP_TOTAL_PASSIF

const MF_PASSIF_MAP: Record<string, string> = {
  // 🔹 F : Trésorerie & institutions financières
  F01: 'MFP_F01',
  F1A: 'MFP_F1A',
  F2A: 'MFP_F2A',
  F2B: 'MFP_F2B',
  F2C: 'MFP_F2C',
  F2D: 'MFP_F2D',
  F3A: 'MFP_F3A',
  F3E: 'MFP_F3E',
  F3F: 'MFP_F3F',
  F50: 'MFP_F50',
  F55: 'MFP_F55',
  F60: 'MFP_F60',

  // 🔹 G : Membres, bénéficiaires ou clients
  G01: 'MFP_G01',
  G10: 'MFP_G10',
  G15: 'MFP_G15',
  G2A: 'MFP_G2A',
  G30: 'MFP_G30',
  G35: 'MFP_G35',
  G60: 'MFP_G60',
  G70: 'MFP_G70',
  G90: 'MFP_G90',

  // 🔹 H : Titres & opérations diverses
  H01: 'MFP_H01',
  H10: 'MFP_H10',
  H40: 'MFP_H40',
  H6A: 'MFP_H6A',
  H6B: 'MFP_H6B',
  H6C: 'MFP_H6C',
  H6G: 'MFP_H6G',
  H6P: 'MFP_H6P',

  // 🔹 K : Versements sur immobilisations financières
  K01: 'MFP_K01',
  K20: 'MFP_K20',

  // 🔹 L : Provisions, fonds propres et assimilés
  L01: 'MFP_L01',
  L10: 'MFP_L10',
  L20: 'MFP_L20',
  L21: 'MFP_L21',
  L22: 'MFP_L22',
  L23: 'MFP_L23',
  L24: 'MFP_L24',
  L25: 'MFP_L25',
  L27: 'MFP_L27',
  L30: 'MFP_L30',
  L31: 'MFP_L31',
  L32: 'MFP_L32',
  L33: 'MFP_L33',
  L35: 'MFP_L35',
  L36: 'MFP_L36',
  L37: 'MFP_L37',
  L41: 'MFP_L41',
  L43: 'MFP_L43',
  L45: 'MFP_L45',
  L50: 'MFP_L50',
  L55: 'MFP_L55',
  L56: 'MFP_L56',
  L57: 'MFP_L57',
  L58: 'MFP_L58',
  L59: 'MFP_L59',
  L60: 'MFP_L60',
  L61: 'MFP_L61',
  L62: 'MFP_L62',
  L65: 'MFP_L65',
  L70: 'MFP_L70',
  L75: 'MFP_L75',
  L80: 'MFP_L80',
  L81: 'MFP_L81',
  L82: 'MFP_L82',

  // 🔹 Total
  L90: 'MFP_TOTAL_PASSIF'
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
 * Normalize microfinance passif line to standardized IRP key
 * 
 * @param poste - Original account code
 * @param desc - Original description
 * @param collector - Array to collect unmapped lines
 * @param context - Additional context (company_name, statement_type, etc.)
 * @returns Normalized key (e.g., "MFP_F01", "MFP_TOTAL_PASSIF", "MFP_UNDEFINED_xxxxx")
 */
export function normalizePassifKeyMicro(
  poste: string | number | null | undefined,
  desc: string | null | undefined,
  collector?: UnmappedLine[],
  context: Record<string, any> = {}
): string {
  const posteStr = (poste || '').toString().trim().toUpperCase()
  const descStr = (desc || '').toString().trim().toUpperCase()

  // 🔹 HIGHEST PRIORITY: TOTAL PASSIF
  if (descStr.includes('TOTAL PASSIF') || posteStr === 'L90') {
    return 'MFP_TOTAL_PASSIF'
  }

  // 🔹 Direct mapping by exact code
  if (MF_PASSIF_MAP[posteStr]) {
    return MF_PASSIF_MAP[posteStr]
  }

  // 🔹 Fallback: Generate unique key for unmapped lines
  const uniqueKey = `${posteStr}_${descStr}`.replace(/[^A-Z0-9_]/g, '_')
  const hashedKey = hashCode(uniqueKey)
  const finalKey = `MFP_UNDEFINED_${hashedKey}`

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