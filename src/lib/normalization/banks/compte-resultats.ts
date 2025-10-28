// src/lib/normalization/banks/compte-resultats.ts
// Normalization logic for bank income statements (compte de résultats)
// Ported from Base44: normalizeCompteResultatsKey

import { UnmappedLine } from '../types'

interface CRMapping {
  cr_code: string
  rcr_code: string
  number: string
  keywords: string[]
}

/**
 * Normalize compte de résultats line to standardized IRP key
 * Priority: RCR code > Numeric poste > Keywords
 * 
 * @param poste - Original account code
 * @param description - Original description
 * @param unmappedCollector - Array to collect unmapped lines
 * @param context - Additional context (company_name, statement_type, etc.)
 * @returns Normalized key (e.g., "CR_01", "CR_20", "CR_UNDEFINED")
 */
export function normalizeCompteResultatsKey(
  poste: string | number | null | undefined,
  description: string | null | undefined,
  unmappedCollector?: UnmappedLine[],
  context: Record<string, any> = {}
): string {
  const posteStr = (poste || '').toString().trim()
  const descStr = (description || '').toString()

  if (!descStr) {
    return posteStr || 'CR_UNDEFINED'
  }

  // If CR_XX code already exists in poste, keep it
  if (posteStr.startsWith('CR_')) {
    return posteStr
  }

  // Complete mapping table
  const completeMapping: CRMapping[] = [
    { cr_code: 'CR_01', rcr_code: 'RCR_0010', number: '1', keywords: ['interetsetproduitsassimiles'] },
    { cr_code: 'CR_02', rcr_code: 'RCR_0020', number: '2', keywords: ['interetsetchargesassimilees'] },
    { cr_code: 'CR_03', rcr_code: 'RCR_0030', number: '3', keywords: ['revenusdestitresarevenuvariable'] },
    { cr_code: 'CR_04', rcr_code: 'RCR_0040', number: '4', keywords: ['commissionsproduits'] },
    { cr_code: 'CR_05', rcr_code: 'RCR_0050', number: '5', keywords: ['commissionscharges'] },
    { cr_code: 'CR_06', rcr_code: 'RCR_0060', number: '6', keywords: ['gainsoupertesnetssuroperationsdesportefeuillesdenegociation'] },
    { cr_code: 'CR_07', rcr_code: 'RCR_0070', number: '7', keywords: ['gainsoupertesnetssuroperationsdesportefeuillesdeplacementetassimiles'] },
    { cr_code: 'CR_08', rcr_code: 'RCR_0080', number: '8', keywords: ['autresproduitsdexploitationbancaire'] },
    { cr_code: 'CR_09', rcr_code: 'RCR_0090', number: '9', keywords: ['autreschargesdexploitationbancaire'] },
    { cr_code: 'CR_10', rcr_code: 'RCR_0100', number: '10', keywords: ['produitnetbancaire'] },
    { cr_code: 'CR_11', rcr_code: 'RCR_0110', number: '11', keywords: ['subventionsdinvestissement'] },
    { cr_code: 'CR_12', rcr_code: 'RCR_0120', number: '12', keywords: ['chargesgeneralesdexploitation'] },
    { cr_code: 'CR_13', rcr_code: 'RCR_0130', number: '13', keywords: ['dotationsauxamortissementsetauxdepreciations', 'dotationsauxamortissements'] },
    { cr_code: 'CR_14', rcr_code: 'RCR_0140', number: '14', keywords: ['resultatbrutdexploitation'] },
    { cr_code: 'CR_15', rcr_code: 'RCR_0150', number: '15', keywords: ['coutdurisque'] },
    { cr_code: 'CR_16', rcr_code: 'RCR_0160', number: '16', keywords: ['resultatdexploitation'] },
    { cr_code: 'CR_17', rcr_code: 'RCR_0170', number: '17', keywords: ['gainsoupertesnetssuractifsimmobilises'] },
    { cr_code: 'CR_18', rcr_code: 'RCR_0180', number: '18', keywords: ['resultatavantimpot'] },
    { cr_code: 'CR_19', rcr_code: 'RCR_0190', number: '19', keywords: ['impotssurlesbenefices', 'impotsurlesbenefices'] },
    { cr_code: 'CR_20', rcr_code: 'RCR_0200', number: '20', keywords: ['resultatnet'] }
  ]

  // PRIORITY 1: Match by RCR code
  const matchByRCR = completeMapping.find(item => item.rcr_code === posteStr)
  if (matchByRCR) {
    return matchByRCR.cr_code
  }

  // PRIORITY 2a: Match by numeric poste (1-20)
  const numericPoste = parseInt(posteStr, 10)
  if (!isNaN(numericPoste) && numericPoste >= 1 && numericPoste <= 20) {
    const matchByNumber = completeMapping.find(item => item.number === String(numericPoste))
    if (matchByNumber) {
      return matchByNumber.cr_code
    }
  }

  // PRIORITY 2b: Match by keywords in description
  const normalizedDesc = descStr
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric characters

  for (const item of completeMapping) {
    for (const keyword of item.keywords) {
      if (normalizedDesc.includes(keyword)) {
        return item.cr_code
      }
    }
  }

  // FALLBACK: Collect unmapped line
  if (unmappedCollector) {
    unmappedCollector.push({
      original_poste: posteStr,
      original_description: descStr,
      ...context
    })
  }

  return 'CR_UNDEFINED'
}