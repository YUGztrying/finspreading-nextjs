// src/lib/normalization/banks/actifs.ts
// Normalization logic for bank balance sheet assets (Actifs)
// Ported from Base44 normalizeActifKey.jsx

export interface UnmappedLine {
  original_poste: string
  original_description: string
  company_name?: string
  statement_type?: string
  [key: string]: any
}

/**
 * Normalizes asset line item codes and descriptions to standardized keys
 * @param poste - Original account code
 * @param desc - Original line description
 * @param collector - Array to collect unmapped lines
 * @param context - Additional context (company_name, statement_type, etc.)
 * @returns Normalized key (e.g., "ACTIF_01", "ACTIF_TOTAL", "ACTIF_UNDEFINED")
 */
export function normalizeActifKey(
  poste: string | null | undefined,
  desc: string | null | undefined,
  collector?: UnmappedLine[],
  context: Record<string, any> = {}
): string {
  if (!poste) poste = ""
  if (!desc) desc = ""

  poste = poste.toString().trim()
  desc = desc.toString().trim().toUpperCase()

  // 🔹 Special case: TOTAL ACTIF (Maximum Priority)
  if (
    desc.includes("TOTAL ACTIF") ||
    desc.includes("TOTAL DE L'ACTIF") ||
    poste === "RBA_0150"
  ) {
    return "ACTIF_TOTAL"
  }

  // 🔹 Mapping by RBA code
  const rbaMapping: Record<string, string> = {
    "RBA_0010": "ACTIF_01", // Caisse, Banque Centrale, CCP
    "RBA_0020": "ACTIF_02", // Effets publics et valeurs assimilés
    "RBA_0030": "ACTIF_03", // Créances interbancaires
    "RBA_0040": "ACTIF_04", // Créances clientèle
    "RBA_0050": "ACTIF_05", // Obligations et titres à revenu fixe
    "RBA_0060": "ACTIF_06", // Actions et titres à revenu variable
    "RBA_0070": "ACTIF_07", // Actionnaires ou associés
    "RBA_0080": "ACTIF_08", // Autres actifs
    "RBA_0090": "ACTIF_09", // Comptes de régularisation
    "RBA_0100": "ACTIF_10", // Participations long terme
    "RBA_0110": "ACTIF_11", // Parts dans entreprises liées
    "RBA_0120": "ACTIF_12", // Prêts subordonnés
    "RBA_0130": "ACTIF_13", // Immo incorporelles
    "RBA_0140": "ACTIF_14", // Immo corporelles
  }

  if (poste.startsWith("RBA_") && rbaMapping[poste]) {
    return rbaMapping[poste]
  }

  // 🔹 Simple numbering (1 to 14)
  if (/^\d{1,2}$/.test(poste)) {
    return `ACTIF_${poste.padStart(2, "0")}`
  }

  // Capture 1 or 2 digits at the start of description (e.g., "1. Caisse...")
  const match = desc.match(/^(\d{1,2})[\.\-\)]/)
  if (match) {
    return `ACTIF_${match[1].padStart(2, "0")}`
  }

  // 🔹 Manual mapping by keywords (Fallback if no number appears)
  const descMapping: Record<string, string> = {
    "CAISSE": "ACTIF_01",
    "BANQUE CENTRALE": "ACTIF_01",
    "EFFETS PUBLICS": "ACTIF_02",
    "CREANCES INTERBANCAIRES": "ACTIF_03",
    "CLIENTELE": "ACTIF_04",
    "OBLIGATION": "ACTIF_05",
    "ACTIONS": "ACTIF_06",
    "ASSOCIES": "ACTIF_07",
    "AUTRES ACTIFS": "ACTIF_08",
    "REGULARISATION": "ACTIF_09",
    "PARTICIPATION": "ACTIF_10",
    "ENTREPRISES LIEES": "ACTIF_11",
    "SUBORDONNES": "ACTIF_12",
    "INCORPORELLES": "ACTIF_13",
    "CORPORELLES": "ACTIF_14",
  }

  for (const key in descMapping) {
    if (desc.includes(key)) {
      return descMapping[key]
    }
  }

  // 🔹 Smart fallback: log the line and return UNDEFINED
  if (collector && Array.isArray(collector)) {
    collector.push({
      original_poste: poste,
      original_description: desc,
      ...context,
    })
  }

  return "ACTIF_UNDEFINED"
}