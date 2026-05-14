// src/lib/normalization/microfinance/description-map.ts
// Description-to-code fallback for microfinance SYSCOA-IMF balance sheet lines.
//
// Why this exists:
//   The microfinance BCEAO "Etat 167" Excel uses standard codes (A01, A10,
//   B2D, F1A, L01, …) that we already map exactly via the code dictionaries
//   in actifs.ts / passifs.ts. But the *published* SYSCOA-IMF annual report
//   PDFs (the "États Financiers Consolidés" booklets) number postes 1, 2, 3,
//   … with no alphanumeric codes — so Claude's OCR returns no usable poste
//   and every line falls into MFA_UNDEFINED_<hash>, which prevents merging
//   with the Excel rows under the same company. Result: duplicate rows after
//   a merge.
//
// What this does:
//   For every code with an UNAMBIGUOUS canonical SYSCOA-IMF description, we
//   add a reverse lookup. After the exact-code match fails, the normalizer
//   tries a normalized-description match against this table. Ambiguous
//   wordings ("Créances rattachées", "Incorporelles", "Corporelles" — they
//   recur under multiple parents) are intentionally OMITTED so a wrong code
//   never beats UNDEFINED.

/**
 * Aggressive text normalization for description matching.
 * NFD-strips accents, lowercases, collapses any non-alphanumeric run to a
 * single space, trims. Survives ALL CAPS, "Crédit / crédit", "L.o.a." vs
 * "loa", trailing punctuation, etc.
 */
export function normalizeDescription(s: string | null | undefined): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// ─── ACTIFS ──────────────────────────────────────────────────────────────────
// Keys are pre-normalized (apply normalizeDescription) so lookups are O(1).
// Values are the raw poste codes — the normalizer prepends MFA_ itself.
export const MF_ACTIF_DESC_TO_CODE: Record<string, string> = {
  // Section headers
  'operations de tresorerie et avec les institutions financieres': 'A01',
  'operations de tresorerie': 'A01',
  'operations avec les membres beneficiaires ou clients': 'B01',
  'operations avec les membres': 'B01',
  'operations sur titres et operations diverses': 'C01',
  'operations sur titres': 'C01',
  'valeurs immobilisees': 'D01',
  'actionnaires associes ou membres': 'E01',

  // A — Trésorerie
  'valeur en caisse': 'A10',
  'billets et monnaies': 'A11',
  'comptes ordinaires debiteurs': 'A12',
  'autres comptes de depots debiteurs': 'A2A',
  'autres comptes de depots autres que ordinaires debiteurs': 'A2A',
  'depots a terme constitues': 'A2H',
  'depots de garantie constitues': 'A2I',
  'autres depots constitues': 'A2J',
  'autres depots constitues autres que ordinaires': 'A2J',
  'comptes de prets': 'A3A',
  'prets a moins d un an': 'A3B',
  'prets a terme': 'A3C',
  'prets en souffrance prets immobilises': 'A70',
  'prets immobilises': 'Z01',
  'prets en souffrance de moins de 6 mois': 'A71',
  'prets en souffrance de 6 a 12 mois': 'A72',
  'prets en souffrance de 6 mois a 12 mois au plus': 'A72',
  'prets en souffrance de plus de 12 mois': 'A73',
  'prets en souffrance de plus de 12 mois a 24 mois au plus': 'A73',

  // B — Membres
  'credits a court terme': 'B2D',
  'credits a moyen terme': 'B30',
  'credits a long terme': 'B40',
  'credits en souffrance': 'B70',
  'credits immobilises': 'Z02',
  'credits en souffrance de moins de 6 mois': 'B71',
  'credits en souffrance de 6 a 12 mois': 'B72',
  'credits en souffrance de 6 mois a 12 mois au plus': 'B72',
  'credits en souffrance de plus de 12 mois': 'B73',
  'credits en souffrance de plus de 12 mois a 24 mois au plus': 'B73',

  // C — Titres & opérations diverses
  'titres de placement': 'C10',
  'comptes de stocks': 'C30',
  'stocks de meubles': 'C31',
  'stocks de marchandises': 'C32',
  'stocks de fournitures': 'C33',
  'autres stocks et assimiles': 'C34',
  'debiteurs divers': 'C40',
  'valeur a l encaissement avec credit immediat': 'C56',
  'valeur a rejeter': 'C59',
  'comptes d ordre et divers': 'C6A',
  'comptes de liaison': 'C6B',
  'comptes de difference de conversion': 'C6C',
  'comptes de regularisation actif': 'C6G',
  'comptes transitoires': 'C6Q',
  'comptes d attente actif': 'C6R',

  // D — Immobilisations
  'immobilisations financieres': 'D1A',
  'prets et titres subordonnes': 'D10',
  'titres de participation': 'D1E',
  'titres d investissement': 'D1L',
  'depots et cautionnements': 'D1S',
  'immobilisations en cours': 'D23',
  'immobilisations d exploitation': 'D30',
  'immobilisations hors exploitation': 'D40',
  'immobilisations acquises par realisation de garantie': 'Z03',
  'credits bail et operations assimilees': 'D50',
  'credits bail': 'D51',
  'l o a': 'D52',
  'location vente': 'D53',
  // D71/D72/D73 — "Créances en souffrance" with duration. The exact
  // duration wording is unique enough vs the A7x/B7x ranges because those
  // use "Prêts" / "Crédits" not "Créances".
  'creances en souffrance de moins de 6 mois': 'D71',
  'creances en souffrance de 6 a 12 mois': 'D72',
  'creances en souffrance de 6 mois a 12 mois au plus': 'D72',
  'creances en souffrance de plus de 12 mois': 'D73',
  'creances en souffrance de plus de 12 mois a 24 mois au plus': 'D73',

  // E — Actionnaires
  'capital non appele': 'E02',
  'actionnaires associes ou membres capital non appele': 'E02',
  'capital appele non verse': 'E03',
  'actionnaires associes ou membres capital appele non verse': 'E03',
  'excedent de charges sur les produits': 'E05',

  // Total
  'total actif': 'E90',
}

// ─── PASSIFS ─────────────────────────────────────────────────────────────────
// Note: F section (institutions financières) and G section (membres) share
// many word-for-word descriptions in real reports — we OMIT those from the
// fallback to avoid wrong matches. Only descriptions that are unique across
// the entire passif side are included.
export const MF_PASSIF_DESC_TO_CODE: Record<string, string> = {
  // Section headers
  'operations de tresorerie et avec les institutions financieres': 'F01',
  'operations avec les membres beneficiaires ou clients': 'G01',
  'operations avec les membres': 'G01',
  'operations sur titres et operations diverses': 'H01',
  'operations sur titres': 'H01',
  'versements restant a effectuer sur immobilisations financieres': 'K01',
  'provisions fonds propres et assimiles': 'L01',
  'provisions fonds propres et assimiles passif': 'L01',

  // F — Trésorerie & IF (only descriptions unique within passif side)
  // F1A "Comptes ordinaires créditeurs" overlaps with G10, leave out
  // F2B "Dépôts à terme reçus" overlaps with G15, leave out
  // F2C "Dépôts de garantie reçus" overlaps with G30, leave out
  // F2D "Autres dépôts reçus" overlaps with G35, leave out
  'comptes d emprunts': 'F3A',
  'emprunts a moins d un an': 'F3E',
  'emprunts a terme': 'F3F',
  'emprunts a termes': 'F3F',
  'autres sommes dues aux institutions financieres': 'F50',
  'ressources affectees': 'F55',

  // G — Membres (only G-side specific descriptions)
  'comptes d epargne a regime special': 'G2A',
  // G60 "Emprunts" too short; skip

  // H — Titres & op. diverses
  'versements restant a effectuer sur titres': 'H10',
  'crediteurs divers': 'H40',
  'comptes d ordre et divers passif': 'H6A',
  'comptes de liaison passif': 'H6B',
  'comptes de difference de conversion passif': 'H6C',
  'comptes de regularisation passif': 'H6G',
  'comptes d attente passif': 'H6P',

  // L — Provisions, fonds propres
  'subventions d investissement': 'L10',
  'fonds affectes': 'L20',
  'fonds de garantie': 'L21',
  'fonds d assurance': 'L22',
  'fonds de bonification': 'L23',
  'fonds de securite': 'L24',
  'autres fonds affectes': 'L25',
  'provisions pour risques et charges': 'L27',
  'reserves': 'L30',
  'reserves generales': 'L31',
  'reserves obligatoires': 'L32',
  'reserves facultatives': 'L33',
  'reserves diverses': 'L35',
  'primes liees au capital': 'L36',
  'ecart de reevaluation': 'L37',
  'report a nouveau crediteur': 'L41',
  'report a nouveau debiteur': 'L43',
  'resultat de l exercice': 'L45',
  'capital': 'L50',
  'capital social': 'L50',
  'capital souscrit appele': 'L55',
  'capital souscrit non appele': 'L56',
  'capital souscrit non verse': 'L57',
  'fonds de dotation': 'L58',
  'autres fonds propres': 'L59',
  'subventions d exploitation': 'L60',
  'subventions d equipement': 'L61',
  'subventions diverses': 'L62',
  'fonds propres et assimiles': 'L65',
  'emprunts subordonnes': 'L70',
  'titres subordonnes': 'L75',
  'provisions reglementees': 'L80',
  'provisions pour pertes et charges': 'L81',
  'provisions pour engagements sociaux': 'L82',

  // Total
  'total passif': 'L90',
  'total general passif': 'L90',
}

/**
 * Pre-normalize the maps once at module load. We accept already-normalized
 * keys in the literals above so this is just a sanity step (re-normalizing
 * an already-normalized string is a no-op).
 */
function normalizeKeys(m: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(m)) {
    out[normalizeDescription(k)] = v
  }
  return out
}

export const MF_ACTIF_DESC_TO_CODE_NORMALIZED = normalizeKeys(MF_ACTIF_DESC_TO_CODE)
export const MF_PASSIF_DESC_TO_CODE_NORMALIZED = normalizeKeys(MF_PASSIF_DESC_TO_CODE)

/**
 * Look up a poste code from a free-form description.
 * Returns the raw code (e.g. "A10", "L20") or null if no unambiguous match.
 */
export function lookupActifCodeByDescription(desc: string | null | undefined): string | null {
  const norm = normalizeDescription(desc)
  if (!norm) return null
  return MF_ACTIF_DESC_TO_CODE_NORMALIZED[norm] ?? null
}

export function lookupPassifCodeByDescription(desc: string | null | undefined): string | null {
  const norm = normalizeDescription(desc)
  if (!norm) return null
  return MF_PASSIF_DESC_TO_CODE_NORMALIZED[norm] ?? null
}
