// src/lib/normalization/microfinance/catalog.ts
// Single source of truth for the SYSCOA-IMF microfinance code picker UI.
//
// Each entry maps a normalized full key (MFA_A10, MFP_F1A, MFC_R08, …) to its
// canonical French label and the statement section it belongs to. The picker
// reads this catalog to render a searchable list grouped by section letter.
//
// Note on the MFP_ prefix collision: it is used both for microfinance Passifs
// (F/G/H/K/L codes) and microfinance Produits (V/W/X/Z codes). The `section`
// field disambiguates — the picker filters by section before showing entries.

export type CatalogSection = 'actif' | 'passif' | 'hors_bilan' | 'compte_resultats'

export interface CatalogEntry {
  /** Full normalized key as stored in line.poste */
  fullKey: string
  /** Raw poste code (A10, F1A, R08…) — the part after the prefix */
  rawCode: string
  /** Canonical French label */
  label: string
  /** Section the entry belongs to */
  section: CatalogSection
  /** Group letter for visual grouping in the picker (A, B, C, D, E, F, G, H, K, L, R, S, T, V, W, X) */
  group: string
  /** Group title shown in the picker section header */
  groupTitle: string
}

const ACTIF_GROUPS: Record<string, string> = {
  A: 'A — Opérations de trésorerie et avec les institutions financières',
  B: 'B — Opérations avec les membres, bénéficiaires ou clients',
  C: 'C — Opérations sur titres et opérations diverses',
  D: 'D — Valeurs immobilisées',
  E: 'E — Actionnaires, associés ou membres',
  Z: 'Z — Prêts / crédits / immos issus de garantie',
}

const PASSIF_GROUPS: Record<string, string> = {
  F: 'F — Trésorerie et institutions financières',
  G: 'G — Membres, bénéficiaires ou clients',
  H: 'H — Titres et opérations diverses',
  K: 'K — Versements à effectuer sur immobilisations financières',
  L: 'L — Provisions, fonds propres et assimilés',
}

const CR_GROUPS: Record<string, string> = {
  R: 'R — Charges sur opérations financières',
  S: 'S — Charges générales d\'exploitation',
  T: 'T — Dotations & charges exceptionnelles',
  V: 'V — Produits sur opérations financières',
  W: 'W — Produits divers d\'exploitation',
  X: 'X — Reprises & produits exceptionnels',
  Z: 'Z — Soldes intermédiaires',
  L: 'L — Résultat',
}

// ─── ACTIFS ──────────────────────────────────────────────────────────────────
const ACTIFS: Array<[string, string]> = [
  // A — Trésorerie & IF
  ['A01', 'Opérations de trésorerie et avec les institutions financières'],
  ['A10', 'Valeurs en caisse'],
  ['A11', 'Billets et monnaies'],
  ['A12', 'Comptes ordinaires débiteurs'],
  ['A2A', 'Autres comptes de dépôts débiteurs'],
  ['A2H', 'Dépôts à terme constitués'],
  ['A2I', 'Dépôts de garantie constitués'],
  ['A2J', 'Autres dépôts constitués'],
  ['A3A', 'Comptes de prêts'],
  ['A3B', 'Prêts à moins d\'un an'],
  ['A3C', 'Prêts à terme'],
  ['A60', 'Créances rattachées'],
  ['A70', 'Prêts en souffrance / prêts immobilisés'],
  ['Z01', 'Prêts immobilisés'],
  ['A71', 'Prêts en souffrance ≤ 6 mois'],
  ['A72', 'Prêts en souffrance > 6 à ≤ 12 mois'],
  ['A73', 'Prêts en souffrance > 12 à ≤ 24 mois'],

  // B — Membres / bénéficiaires / clients
  ['B01', 'Opérations avec les membres, bénéficiaires ou clients'],
  ['B2D', 'Crédits à court terme'],
  ['B2N', 'Comptes ordinaires débiteurs'],
  ['B30', 'Crédits à moyen terme'],
  ['B40', 'Crédits à long terme'],
  ['B65', 'Créances rattachées'],
  ['B70', 'Crédits en souffrance'],
  ['Z02', 'Crédits immobilisés'],
  ['B71', 'Crédits en souffrance ≤ 6 mois'],
  ['B72', 'Crédits en souffrance > 6 à ≤ 12 mois'],
  ['B73', 'Crédits en souffrance > 12 à ≤ 24 mois'],

  // C — Titres & opérations diverses
  ['C01', 'Opérations sur titres et opérations diverses'],
  ['C10', 'Titres de placement'],
  ['C30', 'Comptes de stocks'],
  ['C31', 'Stocks de meubles'],
  ['C32', 'Stocks de marchandises'],
  ['C33', 'Stocks de fournitures'],
  ['C34', 'Autres stocks et assimilés'],
  ['C40', 'Débiteurs divers'],
  ['C55', 'Créances rattachées'],
  ['C56', 'Valeurs à l\'encaissement avec crédit immédiat'],
  ['C59', 'Valeurs à rejeter'],
  ['C6A', 'Comptes d\'ordre et divers'],
  ['C6B', 'Comptes de liaison'],
  ['C6C', 'Comptes de différence de conversion'],
  ['C6G', 'Comptes de régularisation actif'],
  ['C6Q', 'Comptes transitoires'],
  ['C6R', 'Comptes d\'attente actif'],

  // D — Valeurs immobilisées
  ['D01', 'Valeurs immobilisées'],
  ['D1A', 'Immobilisations financières'],
  ['D10', 'Prêts et titres subordonnés'],
  ['D1E', 'Titres de participation'],
  ['D1L', 'Titres d\'investissement'],
  ['D1S', 'Dépôts et cautionnements'],
  ['D23', 'Immobilisations en cours'],
  ['D24', 'Incorporelles (en cours)'],
  ['D25', 'Corporelles (en cours)'],
  ['D30', 'Immobilisations d\'exploitation'],
  ['D31', 'Incorporelles (exploitation)'],
  ['D36', 'Corporelles (exploitation)'],
  ['D40', 'Immobilisations hors exploitation'],
  ['D41', 'Incorporelles (hors exploitation)'],
  ['D45', 'Corporelles (hors exploitation)'],
  ['Z03', 'Immobilisations acquises par réalisation de garantie'],
  ['D46', 'Incorporelles (acquises par garantie)'],
  ['D47', 'Corporelles (acquises par garantie)'],
  ['D50', 'Crédit-bail et opérations assimilées'],
  ['D51', 'Crédit-bail'],
  ['D52', 'Location avec option d\'achat (L.O.A.)'],
  ['D53', 'Location-vente'],
  ['D60', 'Créances rattachées'],
  ['D70', 'Créances en souffrance'],
  ['D71', 'Créances en souffrance ≤ 6 mois'],
  ['D72', 'Créances en souffrance > 6 à ≤ 12 mois'],
  ['D73', 'Créances en souffrance > 12 à ≤ 24 mois'],

  // E — Actionnaires
  ['E01', 'Actionnaires, associés ou membres'],
  ['E02', 'Capital non appelé'],
  ['E03', 'Capital appelé non versé'],
  ['E05', 'Excédent de charges sur les produits'],
]

// ─── PASSIFS ─────────────────────────────────────────────────────────────────
const PASSIFS: Array<[string, string]> = [
  // F — Trésorerie & IF
  ['F01', 'Opérations de trésorerie et avec les institutions financières'],
  ['F1A', 'Comptes ordinaires créditeurs'],
  ['F2A', 'Autres comptes de dépôts créditeurs'],
  ['F2B', 'Dépôts à terme reçus'],
  ['F2C', 'Dépôts de garantie reçus'],
  ['F2D', 'Autres dépôts reçus'],
  ['F3A', 'Comptes d\'emprunts'],
  ['F3E', 'Emprunts à moins d\'un an'],
  ['F3F', 'Emprunts à terme'],
  ['F50', 'Autres sommes dues aux institutions financières'],
  ['F55', 'Ressources affectées'],
  ['F60', 'Dettes rattachées'],

  // G — Membres
  ['G01', 'Opérations avec les membres, bénéficiaires ou clients'],
  ['G10', 'Comptes ordinaires créditeurs'],
  ['G15', 'Dépôts à terme reçus'],
  ['G2A', 'Comptes d\'épargne à régime spécial'],
  ['G30', 'Dépôts de garantie reçus'],
  ['G35', 'Autres dépôts reçus'],
  ['G60', 'Emprunts'],
  ['G70', 'Autres sommes dues'],
  ['G90', 'Dettes rattachées'],

  // H — Titres & op. diverses
  ['H01', 'Opérations sur titres et opérations diverses'],
  ['H10', 'Versements restant à effectuer sur titres'],
  ['H40', 'Créditeurs divers'],
  ['H6A', 'Comptes d\'ordre et divers'],
  ['H6B', 'Comptes de liaison'],
  ['H6C', 'Comptes de différence de conversion'],
  ['H6G', 'Comptes de régularisation passif'],
  ['H6P', 'Comptes d\'attente passif'],

  // K — Versements sur immos financières
  ['K01', 'Versements restant à effectuer sur immobilisations financières'],
  ['K20', 'Dettes rattachées'],

  // L — Provisions, fonds propres
  ['L01', 'Provisions, fonds propres et assimilés'],
  ['L10', 'Subventions d\'investissement'],
  ['L20', 'Fonds affectés'],
  ['L21', 'Fonds de garantie'],
  ['L22', 'Fonds d\'assurance'],
  ['L23', 'Fonds de bonification'],
  ['L24', 'Fonds de sécurité'],
  ['L25', 'Autres fonds affectés'],
  ['L27', 'Provisions pour risques et charges'],
  ['L30', 'Réserves'],
  ['L31', 'Réserves générales'],
  ['L32', 'Réserves obligatoires'],
  ['L33', 'Réserves facultatives'],
  ['L35', 'Réserves diverses'],
  ['L36', 'Primes liées au capital'],
  ['L37', 'Écart de réévaluation'],
  ['L41', 'Report à nouveau créditeur'],
  ['L43', 'Report à nouveau débiteur'],
  ['L45', 'Résultat de l\'exercice'],
  ['L50', 'Capital'],
  ['L55', 'Capital souscrit appelé'],
  ['L56', 'Capital souscrit non appelé'],
  ['L57', 'Capital souscrit non versé'],
  ['L58', 'Fonds de dotation'],
  ['L59', 'Autres fonds propres'],
  ['L60', 'Subventions d\'exploitation'],
  ['L61', 'Subventions d\'équipement'],
  ['L62', 'Subventions diverses'],
  ['L65', 'Fonds propres et assimilés'],
  ['L70', 'Emprunts subordonnés'],
  ['L75', 'Titres subordonnés'],
  ['L80', 'Provisions réglementées'],
  ['L81', 'Provisions pour pertes et charges'],
  ['L82', 'Provisions pour engagements sociaux'],
]

// ─── COMPTE DE RÉSULTATS ─────────────────────────────────────────────────────
// Source: src/lib/normalization/microfinance/compte-resultats.ts —
// MICROFINANCE_INCOME_STATEMENT_MAP. We re-import keys to keep one source of
// truth for labels; here we only add section/group metadata.

import { getAvailableMappingsMicrofinanceIncome } from './compte-resultats'

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function makeEntry(
  rawCode: string,
  label: string,
  section: CatalogSection,
  prefix: 'MFA' | 'MFP' | 'MFC' | 'MFOB',
  groups: Record<string, string>
): CatalogEntry {
  const groupLetter = rawCode[0]
  return {
    fullKey: `${prefix}_${rawCode}`,
    rawCode,
    label,
    section,
    group: groupLetter,
    groupTitle: groups[groupLetter] ?? groupLetter,
  }
}

function buildActifs(): CatalogEntry[] {
  const entries: CatalogEntry[] = ACTIFS.map(([rawCode, label]) =>
    makeEntry(rawCode, label, 'actif', 'MFA', ACTIF_GROUPS)
  )
  entries.push({
    fullKey: 'MFA_TOTAL_ACTIF',
    rawCode: 'E90',
    label: 'TOTAL ACTIF',
    section: 'actif',
    group: 'E',
    groupTitle: ACTIF_GROUPS.E,
  })
  return entries
}

function buildPassifs(): CatalogEntry[] {
  const entries: CatalogEntry[] = PASSIFS.map(([rawCode, label]) =>
    makeEntry(rawCode, label, 'passif', 'MFP', PASSIF_GROUPS)
  )
  entries.push({
    fullKey: 'MFP_TOTAL_PASSIF',
    rawCode: 'L90',
    label: 'TOTAL PASSIF',
    section: 'passif',
    group: 'L',
    groupTitle: PASSIF_GROUPS.L,
  })
  return entries
}

function buildCompteResultats(): CatalogEntry[] {
  return getAvailableMappingsMicrofinanceIncome().map(({ code, label }) => {
    // label here is already "MFC_R08 - Description" from getAvailableMappings
    // strip the "MFX_XXX - " prefix to get the clean label
    const cleanLabel = label.replace(/^MF[A-Z]_[A-Z0-9]+\s*-\s*/, '')
    const [prefix, rawCode] = code.split('_') as ['MFC' | 'MFP', string]
    const groupLetter = rawCode[0]
    return {
      fullKey: code,
      rawCode,
      label: cleanLabel,
      section: 'compte_resultats',
      group: groupLetter,
      groupTitle: CR_GROUPS[groupLetter] ?? groupLetter,
    }
  })
}

// ─── PUBLIC API ──────────────────────────────────────────────────────────────

export const MF_CATALOG: CatalogEntry[] = [
  ...buildActifs(),
  ...buildPassifs(),
  ...buildCompteResultats(),
]

const CATALOG_BY_KEY: Record<string, CatalogEntry> = MF_CATALOG.reduce(
  (acc, entry) => {
    acc[entry.fullKey] = entry
    return acc
  },
  {} as Record<string, CatalogEntry>
)

/** Look up a catalog entry by its full normalized key. */
export function getCatalogEntry(fullKey: string | null | undefined): CatalogEntry | null {
  if (!fullKey) return null
  return CATALOG_BY_KEY[fullKey.trim()] ?? null
}

/** Get all catalog entries for a given statement section. */
export function getCatalogForSection(section: CatalogSection | string | undefined): CatalogEntry[] {
  if (!section) return MF_CATALOG
  const normalized = section.replace(/s$/, '') // 'actifs' → 'actif', 'passifs' → 'passif'
  return MF_CATALOG.filter((e) => e.section === normalized || e.section === section)
}

/**
 * Detect whether a poste value is "undefined" (was not mapped by the
 * normalizer). The normalizer produces MFA_UNDEFINED_<hash>, MFP_UNDEFINED_<hash>,
 * MFI_UNDEFINED — all of which we treat as "no code assigned".
 */
export function isUndefinedPoste(poste: string | null | undefined): boolean {
  if (!poste) return true
  const p = poste.trim().toUpperCase()
  return p === '' || p.includes('UNDEFINED') || p.includes('UNDEFI')
}
