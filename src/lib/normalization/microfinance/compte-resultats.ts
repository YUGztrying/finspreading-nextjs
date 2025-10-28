// src/lib/normalization/microfinance/compte-resultats.ts
// Normalization logic for microfinance income statements (compte de résultats)
// Ported from Base44: autoMapIncomeStatementMicrofinance

import { UnmappedLine } from '../types'

// Mapping dictionary for microfinance income statements
// Combines charges (MFC_) and produits (MFP_)
const MICROFINANCE_INCOME_STATEMENT_MAP: Record<string, string> = {
  // CHARGES (MFC_)
  MFC_R08: "Charges sur opérations avec les institutions financières",
  MFC_R1A: "Intérêts sur comptes ordinaires créditeurs",
  MFC_R1B: "Organe financier",
  MFC_R1C: "Caisse centrale",
  MFC_R1D: "Trésor Public",
  MFC_R1E: "CCP",
  MFC_R1F: "Banques et correspondants",
  MFC_R1H: "Établissements Financiers",
  MFC_R1I: "SFD",
  MFC_R1K: "Autres institutions financières",
  MFC_R1L: "Intérêts sur autres comptes de dépôts créditeurs",
  MFC_R1N: "Dépôts à terme reçus",
  MFC_R1P: "Dépôts de garantie reçus",
  MFC_R1Q: "Autres dépôts reçus",
  MFC_R2A: "Intérêts sur compte d'emprunts",
  MFC_R2F: "Intérêts sur emprunts à moins d'un an",
  MFC_R2G: "Intérêts sur emprunts à terme",
  MFC_R2R: "Autres intérêts",
  MFC_R2T: "Divers intérêts",
  MFC_R2Z: "Commissions",
  MFC_R3A: "Charges sur opérations avec les membres, bénéficiaires ou clients",
  MFC_R3C: "Intérêts sur comptes des membres, bénéficiaires ou clients",
  MFC_R3D: "Intérêts sur comptes ordinaires créditeurs",
  MFC_R3F: "Intérêts sur dépôts à terme reçus",
  MFC_R3G: "Intérêts sur comptes d'épargne à régime spécial",
  MFC_R3H: "Intérêts sur dépôts de garantie reçus",
  MFC_R3J: "Intérêts sur autres dépôts reçus",
  MFC_R3N: "Intérêts sur emprunts et autres sommes dues",
  MFC_R3Q: "Autres intérêts",
  MFC_R3T: "Commissions",
  MFC_R4B: "Charges sur opérations sur titres et sur opérations diverses",
  MFC_R4C: "Charges et pertes sur titres de placement",
  MFC_R4K: "Charges sur opérations diverses",
  MFC_R4N: "Commissions",
  MFC_R5B: "Charges sur immobilisations financières",
  MFC_R5C: "Frais d'acquisition",
  MFC_R5D: "Étalement de la prime",
  MFC_R5E: "Charges sur crédit-bail et opérations assimilées",
  MFC_R5G: "Charges sur opérations de crédit-bail",
  MFC_R5H: "Dotations aux amortissements",
  MFC_R5J: "Dotations aux provisions",
  MFC_R5K: "Moins-values de cession",
  MFC_R5L: "Autres charges",
  MFC_R5M: "Charges sur opérations de location avec option d'achat",
  MFC_R5N: "Dotations aux amortissements",
  MFC_R5P: "Dotations aux provisions",
  MFC_R5Q: "Moins-values de cession",
  MFC_R5R: "Autres charges",
  MFC_R5S: "Charges sur opérations de location-vente",
  MFC_R5T: "Dotations aux amortissements",
  MFC_R5U: "Dotations aux provisions",
  MFC_R5V: "Moins-values de cession",
  MFC_R5X: "Autres charges",
  MFC_R5Y: "Charges sur emprunt et titres subordonnés",
  MFC_R6A: "Charges sur opérations de change",
  MFC_R6B: "Pertes sur opérations de change",
  MFC_R6C: "Commissions",
  MFC_R6F: "Charges sur opérations hors bilan",
  MFC_R6K: "Charges sur engagements de financement reçus des institutions financières",
  MFC_R6M: "Charges sur engagements de garanties reçus des institutions financières",
  MFC_R6L: "Charges sur engagements de financements reçus des membres, clients ou bénéficiaires",
  MFC_R6P: "Charges sur engagements de garanties reçus des membres, bénéficiaires ou clients",
  MFC_R6S: "Charges sur engagements sur titres",
  MFC_R6T: "Charges sur autres engagements reçus",
  MFC_R6V: "Charges sur prestations de services financiers",
  MFC_R6W: "Charges sur les moyens de paiement",
  MFC_R6X: "Autres charges sur prestations de services financiers",
  MFC_R7A: "Autres charges d'exploitation financières",
  MFC_R7B: "Moins-values sur cessions d'éléments d'actifs",
  MFC_R7C: "Transferts de produits d'exploitation financière",
  MFC_R7D: "Diverses charges d'exploitation financière",
  MFC_R8G: "Achats de marchandises",
  MFC_R8J: "Stocks vendus",
  MFC_R8L: "Variations de stocks de marchandises",
  MFC_Z28: "Charges générales d'exploitation",
  MFC_S02: "Frais de personnel",
  MFC_S03: "Salaires et traitements",
  MFC_S04: "Charges sociales",
  MFC_S05: "Rémunérations versées aux stagiaires",
  MFC_S1A: "Impôts et taxes",
  MFC_S1B: "Autres impôts sur rémunérations",
  MFC_S1C: "Autres impôts, taxes et prélèvements assimilés versés à l'administration des impôts",
  MFC_S1D: "Impôts directs",
  MFC_S1G: "Impôts indirects",
  MFC_S1H: "Droits d'enregistrement et de timbre",
  MFC_S1J: "Impôts et taxes divers",
  MFC_S1K: "Autres impôts, taxes et prélèvements assimilés versés aux autres organismes",
  MFC_S2A: "Autres charges externes et charges diverses d'exploitation",
  MFC_S2B: "Services extérieurs",
  MFC_S2C: "Redevance de crédit-bail",
  MFC_S2D: "Loyers",
  MFC_S2F: "Charges locatives et de copropriété",
  MFC_S2H: "Entretien et réparation",
  MFC_S2J: "Primes d'assurance",
  MFC_S2M: "Frais de formation de personnel",
  MFC_S2K: "Études et recherches",
  MFC_S2L: "Divers",
  MFC_S3A: "Autres services extérieurs",
  MFC_S3B: "Personnel extérieur à l'institution",
  MFC_S3C: "Rémunérations d'intermédiaires et honoraires",
  MFC_S3E: "Publicité, publications et relations publiques",
  MFC_S3G: "Transports de biens",
  MFC_S3J: "Transports collectifs de personnel",
  MFC_S3L: "Déplacements, missions et réceptions",
  MFC_S3M: "Achats non stocks de matières et fournitures",
  MFC_S3N: "Frais postaux et frais de télécommunication",
  MFC_S3P: "Divers",
  MFC_S4A: "Charges diverses d'exploitation",
  MFC_S4B: "Redevance pour concessions, brevets, licences, procédés, droits et valeurs similaires",
  MFC_S4D: "Indemnités de fonction versées",
  MFC_S4I: "Frais de tenue d'assemblée",
  MFC_S4K: "Moins-value de cession sur immobilisations",
  MFC_S4L: "Sur immobilisations incorporelles et corporelles",
  MFC_S4M: "Sur immobilisations financières",
  MFC_S4P: "Transferts de produits d'exploitation non financière",
  MFC_S4Q: "Produits rétrocédés",
  MFC_S4R: "Autres transferts de produits",
  MFC_S4S: "Autres charges diverses d'exploitation non financière",
  MFC_T50: "Dotations du fonds pour risques financiers généraux",
  MFC_T51: "Dotations aux amortissements et aux provisions sur immobilisations",
  MFC_T53: "Dotations aux amortissements de charges à répartir",
  MFC_T54: "Dotations aux amortissements des immobilisations d'exploitation",
  MFC_T55: "Dotations aux amortissements des immobilisations hors exploitation",
  MFC_T56: "Dotations aux provisions pour dépréciation des immobilisations en cours",
  MFC_T57: "Dotations aux provisions pour dépréciation des immobilisations d'exploitation",
  MFC_T58: "Dotations aux provisions pour dépréciation des immobilisations hors exploitation",
  MFC_T6B: "Dotations aux provisions et pertes sur créances irrécouvrables",
  MFC_T6C: "Dotations aux provisions sur créances en souffrance",
  MFC_T6D: "Dotations aux provisions sur créances en souffrance de 6 mois au plus",
  MFC_T6E: "Dotations aux provisions sur créances en souffrance de plus de 6 mois à 12 mois mois au plus",
  MFC_T6F: "Dotations aux provisions sur créances en souffrance de plus de12 mois à 24 mois mois au plus",
  MFC_T6G: "Dotations aux provisions pour dépréciation des autres éléments d'actif",
  MFC_T6H: "Dotations aux provisions pour risques et charges",
  MFC_T6J: "Dotations aux provisions réglementées",
  MFC_T6K: "Pertes sur créances irrécouvrables couvertes par des provisions",
  MFC_T6L: "Pertes sur créances irrécouvrables non couvertes par des provisions",
  MFC_T80: "Charges exceptionnelles",
  MFC_T81: "Pertes sur exercices antérieurs",
  MFC_T82: "Impôts sur les excédents",
  MFC_L80: "Excédent",
  MFC_T84: "Total charges",
  
  // PRODUITS (MFP_)
  MFP_V08: "Produits sur opérations avec les institutions financières",
  MFP_V1A: "Intérêts sur comptes ordinaires débiteurs",
  MFP_V1B: "Organe financier",
  MFP_V1C: "Caisse centrale",
  MFP_V1D: "Trésor public",
  MFP_V1E: "CCP",
  MFP_V1F: "Banques et correspondants",
  MFP_V1H: "Établissements financiers",
  MFP_V1I: "SFD",
  MFP_V1K: "Autres institutions financières",
  MFP_V1L: "Intérêts sur autres comptes de dépôts débiteurs",
  MFP_V1Q: "Intérêts sur dépôts à terme constitués",
  MFP_V1R: "Intérêts sur dépôts de garantie constitués",
  MFP_V1S: "Intérêts sur autres dépôts constitués",
  MFP_V2A: "Intérêts sur comptes de prêts",
  MFP_V2C: "Intérêts sur prêts à moins d'un an",
  MFP_V2G: "Intérêts sur prêts à terme",
  MFP_V2Q: "Autres intérêts",
  MFP_V2S: "Divers intérêts",
  MFP_V2T: "Commissions",
  MFP_V3A: "Produits sur opérations avec les membres, bénéficiaires ou clients",
  MFP_V3B: "Intérêts sur crédits aux membres, bénéficiaires ou clients",
  MFP_V3G: "Intérêts sur crédits à court terme",
  MFP_V3M: "Intérêts sur crédits à moyen terme",
  MFP_V3N: "Intérêts sur crédits à long terme",
  MFP_V3R: "Autres intérêts",
  MFP_V3T: "Divers intérêts",
  MFP_V3X: "Commissions",
  MFP_V4B: "Produits sur opérations sur titres et sur opérations et diverses",
  MFP_V4C: "Produits et profits sur titres de placement",
  MFP_V4D: "Intérêts sur crédits accordés au personnel non membre",
  MFP_V4E: "Produits sur opérations diverses",
  MFP_V4F: "Commissions",
  MFP_V5B: "Produits sur immobilisations financières",
  MFP_V5C: "Produits sur prêts et titres subordonnés",
  MFP_V5D: "Dividendes et produits assimilés sur titres de participation",
  MFP_V5F: "Produits et profits sur titres d'investissement",
  MFP_V5G: "Produits sur opérations de crédit-bail et opérations assimilées",
  MFP_V5H: "Produits sur opérations de crédit-bail",
  MFP_V5J: "Loyers",
  MFP_V5K: "Reprises de provisions",
  MFP_V5L: "Plus-values de cession",
  MFP_V5M: "Autres produits",
  MFP_V5N: "Produits sur opérations location avec option d'achat",
  MFP_V5P: "Loyers",
  MFP_V5Q: "Reprises de provisions",
  MFP_V5R: "Plus-values de cession",
  MFP_V5S: "Autres produits",
  MFP_V5T: "Produits sur opérations de location-vente",
  MFP_V5V: "Loyers",
  MFP_V5W: "Reprises de provisions",
  MFP_V5X: "Plus-values de cession",
  MFP_V5Y: "Autres produits",
  MFP_V6A: "Produits sur opérations de change",
  MFP_V6B: "Gains sur opérations de change",
  MFP_V6C: "Commissions",
  MFP_V6F: "Produits sur opérations hors bilan",
  MFP_V6K: "Produits sur engagements de financement donnés aux institutions financières",
  MFP_V6L: "Produits sur engagements de financement donnés aux membres, bénéficiaires ou clients",
  MFP_V6N: "Produits sur engagements de garantie donnés aux institutions financières",
  MFP_V6P: "Produits sur engagements de garantie donnés aux membres, bénéficiaires ou clients",
  MFP_V6Q: "Produits sur engagements sur titres",
  MFP_V6R: "Produits sur autres engagements donnés",
  MFP_V6S: "Produits sur opérations effectuées pour le compte de tiers",
  MFP_V6U: "Produits sur prestations de services financiers",
  MFP_V6V: "Produits sur moyens de paiement",
  MFP_V6W: "Autres produits sur prestations de services financiers",
  MFP_V7A: "Autres produits d'exploitation financière",
  MFP_V7B: "Plus-values sur cession d'éléments d'actifs",
  MFP_V7C: "Transfert de charges d'exploitation financières",
  MFP_V7D: "Divers produits d'exploitation financière",
  MFP_V8A: "Ventes et variation de stock",
  MFP_V8B: "Marge commerciale",
  MFP_V8C: "Vente de marchandises",
  MFP_V8D: "Variations négatives de stocks de marchandises",
  MFP_Z37: "Produits généraux d'exploitation",
  MFP_W4A: "Produits divers d'exploitation",
  MFP_W4B: "Redevances pour concessions, brevets, licences, droits et valeurs similaires",
  MFP_W4D: "Indemnités de fonction et rémunérations administrateurs, gérants reçues",
  MFP_W4G: "Plus-value de cession",
  MFP_W4H: "Sur immobilisations incorporelles et corporelles",
  MFP_W4J: "Sur immobilisations financières",
  MFP_W4K: "Revenus des immeubles hors exploitation",
  MFP_W4L: "Transferts de charges d'exploitation non financière",
  MFP_W4M: "Charges refacturées",
  MFP_W4N: "Charges à répartir sur plusieurs exercices",
  MFP_W4P: "Autres transferts de charges",
  MFP_W4Q: "Autres produits divers d'exploitation",
  MFP_W50: "Production immobilisée",
  MFP_W51: "Immobilisations corporelles",
  MFP_W52: "Immobilisations incorporelles",
  MFP_W53: "Subventions d'exploitation",
  MFP_X50: "Reprises du fonds pour risques bancaires généraux",
  MFP_X51: "Reprises d'amortissements et provisions sur immobilisations",
  MFP_X54: "Reprises d'amortissements des immobilisations",
  MFP_X56: "Reprises de provisions sur immobilisations",
  MFP_X6B: "Reprises de provisions et récupération sur créances amorties",
  MFP_X6C: "Reprises de provisions sur créances en souffrance",
  MFP_X6D: "Reprises de provisions sur créances en souffrance de 6 mois au plus",
  MFP_X6E: "Reprises de provisions sur créances en souffrance de plus de 6 mois à 12 mois au plus",
  MFP_X6F: "Reprises de provisions sur créances en souffrance de plus de 12 mois à 24 mois au plus",
  MFP_X6G: "Reprises de provisions pour dépréciations des autres éléments d'actifs",
  MFP_X6H: "Reprises de provisions pour risques et charges",
  MFP_X6J: "Récupération sur créances amorties",
  MFP_X6I: "Reprises de provisions réglementées",
  MFP_X80: "Produits exceptionnels",
  MFP_X81: "Profits sur exercices antérieurs",
  MFP_L80: "DEFICIT",
  MFP_X84: "Total produits"
}

/**
 * Normalize microfinance compte de résultats line to standardized key
 * Auto-mapping based on first letter:
 * - R, S, T → MFC_ (Charges)
 * - V, W, X → MFP_ (Produits)
 * - Z, L → Try both MFC_ and MFP_
 * 
 * @param poste - Original account code (e.g., "R08", "V3B", "S02")
 * @param desc - Original description
 * @param collector - Array to collect unmapped lines
 * @param context - Additional context
 * @returns Normalized key (e.g., "MFC_R08", "MFP_V3B", "MFI_UNDEFINED")
 */
export function normalizeCompteResultatsKeyMicro(
  poste: string | number | null | undefined,
  desc: string | null | undefined,
  collector?: UnmappedLine[],
  context: Record<string, any> = {}
): string {
  const posteStr = (poste || '').toString().trim().toUpperCase()
  const descStr = (desc || '').toString().trim().toUpperCase()

  if (!posteStr) return 'MFI_UNDEFINED'

  const firstLetter = posteStr[0]

  // 🔹 CHARGES: R, S, T → MFC_
  if (['R', 'S', 'T'].includes(firstLetter)) {
    const mappedCode = `MFC_${posteStr}`
    if (MICROFINANCE_INCOME_STATEMENT_MAP[mappedCode]) {
      return mappedCode
    }
  }

  // 🔹 PRODUITS: V, W, X → MFP_
  if (['V', 'W', 'X'].includes(firstLetter)) {
    const mappedCode = `MFP_${posteStr}`
    if (MICROFINANCE_INCOME_STATEMENT_MAP[mappedCode]) {
      return mappedCode
    }
  }

  // 🔹 SPECIAL: Z, L → Try both MFC_ and MFP_
  if (['Z', 'L'].includes(firstLetter)) {
    const mfcCode = `MFC_${posteStr}`
    const mfpCode = `MFP_${posteStr}`

    if (MICROFINANCE_INCOME_STATEMENT_MAP[mfcCode]) {
      return mfcCode
    }
    if (MICROFINANCE_INCOME_STATEMENT_MAP[mfpCode]) {
      return mfpCode
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

  return 'MFI_UNDEFINED'
}

/**
 * Get label for a mapped code
 */
export function getMappingLabel(code: string): string {
  return MICROFINANCE_INCOME_STATEMENT_MAP[code] || ''
}

/**
 * Get all available mappings with labels
 */
export function getAvailableMappingsMicrofinanceIncome(): Array<{ code: string; label: string }> {
  return Object.entries(MICROFINANCE_INCOME_STATEMENT_MAP).map(([code, description]) => ({
    code,
    label: `${code} - ${description}`
  }))
}