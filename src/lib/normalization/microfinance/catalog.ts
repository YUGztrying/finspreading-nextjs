// src/lib/normalization/microfinance/catalog.ts
// Single source of truth for the financial-statement code picker UI — both
// microfinance (SYSCOA-IMF) and bank (PCB BCEAO) plans.
//
// Each entry maps a normalized full key (MFA_A10 / MFP_F1A / MFC_R08 / ACTIF_01 /
// PASSIF_03 / CR_10 …) to its canonical French label, the statement section it
// belongs to, and the institution type it applies to. The picker filters by
// (section, institutionType) before showing entries.
//
// Note on the MFP_ prefix collision: it is used both for microfinance Passifs
// (F/G/H/K/L codes) and microfinance Produits (V/W/X/Z codes). The `section`
// field disambiguates.

export type CatalogSection = 'actif' | 'passif' | 'hors_bilan' | 'compte_resultats'
export type InstitutionType = 'banque' | 'microfinance'

export interface CatalogEntry {
  /** Full normalized key as stored in line.poste */
  fullKey: string
  /** Raw poste code (A10, F1A, R08, 01, 03…) — the part after the prefix */
  rawCode: string
  /** Canonical French label */
  label: string
  /** Section the entry belongs to */
  section: CatalogSection
  /** Institution type the entry applies to */
  institutionType: InstitutionType
  /** Group key for visual grouping in the picker (e.g. A, B, C, "01-04", "10-16") */
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
    institutionType: 'microfinance',
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
    institutionType: 'microfinance',
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
    institutionType: 'microfinance',
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
    const [, rawCode] = code.split('_') as ['MFC' | 'MFP', string]
    const groupLetter = rawCode[0]
    return {
      fullKey: code,
      rawCode,
      label: cleanLabel,
      section: 'compte_resultats',
      institutionType: 'microfinance',
      group: groupLetter,
      groupTitle: CR_GROUPS[groupLetter] ?? groupLetter,
    }
  })
}

// ─── BANK PCB BCEAO ──────────────────────────────────────────────────────────
// Source: src/lib/normalization/banks/{actifs,passifs,compte-resultats}.ts —
// labels reconstructed from inline comments / keyword maps in those files plus
// the published PCB BCEAO chart. Codes are simpler than SYSCOA-IMF: actifs run
// 01→14, passifs 01→16, CR 01→20. Each section is split into a few logical
// groups so the picker stays scannable.

const BANK_ACTIF_GROUPS: Record<string, string> = {
  '01-06': '01–06 — Opérations interbancaires & sur titres',
  '07-09': '07–09 — Autres actifs & régularisation',
  '10-12': '10–12 — Titres de participation & prêts subordonnés',
  '13-14': '13–14 — Immobilisations',
  TOTAL: 'Total',
}

const BANK_PASSIF_GROUPS: Record<string, string> = {
  '01-04': '01–04 — Dettes (interbancaires, clientèle, titres émis)',
  '05-06': '05–06 — Autres passifs & régularisation',
  '07-08': '07–08 — Provisions & emprunts subordonnés',
  '09-16': '09–16 — Capitaux propres et assimilés',
  TOTAL: 'Total',
}

const BANK_CR_GROUPS: Record<string, string> = {
  '01-09': '01–09 — Produits et charges d\'exploitation bancaire',
  '10': '10 — Produit Net Bancaire',
  '11-14': '11–14 — Charges générales & résultat brut',
  '15-16': '15–16 — Coût du risque & résultat d\'exploitation',
  '17-20': '17–20 — Hors exploitation & résultat net',
}

const BANK_ACTIFS: Array<[string, string]> = [
  ['01', 'Caisse, Banque Centrale, CCP'],
  ['02', 'Effets publics et valeurs assimilés'],
  ['03', 'Créances interbancaires'],
  ['04', 'Créances clientèle'],
  ['05', 'Obligations et titres à revenu fixe'],
  ['06', 'Actions et titres à revenu variable'],
  ['07', 'Actionnaires ou associés'],
  ['08', 'Autres actifs'],
  ['09', 'Comptes de régularisation'],
  ['10', 'Participations long terme'],
  ['11', 'Parts dans entreprises liées'],
  ['12', 'Prêts subordonnés'],
  ['13', 'Immobilisations incorporelles'],
  ['14', 'Immobilisations corporelles'],
]

const BANK_PASSIFS: Array<[string, string]> = [
  ['01', 'Banque Centrale, CCP'],
  ['02', 'Dettes interbancaires'],
  ['03', 'Dettes clientèle'],
  ['04', 'Dettes représentées par un titre'],
  ['05', 'Autres passifs'],
  ['06', 'Comptes de régularisation'],
  ['07', 'Provisions'],
  ['08', 'Emprunts et titres émis subordonnés'],
  ['09', 'Capitaux propres et ressources assimilées'],
  ['10', 'Capital souscrit versé'],
  ['11', 'Primes liées au capital'],
  ['12', 'Réserves'],
  ['13', 'Écart de réévaluation'],
  ['14', 'Provisions réglementées'],
  ['15', 'Report à nouveau'],
  ['16', 'Résultat de l\'exercice'],
]

const BANK_CR: Array<[string, string]> = [
  ['01', 'Intérêts et produits assimilés'],
  ['02', 'Intérêts et charges assimilées'],
  ['03', 'Revenus des titres à revenu variable'],
  ['04', 'Commissions (Produits)'],
  ['05', 'Commissions (Charges)'],
  ['06', 'Gains ou pertes nets sur opérations des portefeuilles de négociation'],
  ['07', 'Gains ou pertes nets sur opérations des portefeuilles de placement et assimilés'],
  ['08', 'Autres produits d\'exploitation bancaire'],
  ['09', 'Autres charges d\'exploitation bancaire'],
  ['10', 'Produit Net Bancaire (PNB)'],
  ['11', 'Subventions d\'investissement'],
  ['12', 'Charges générales d\'exploitation'],
  ['13', 'Dotations aux amortissements et aux dépréciations'],
  ['14', 'Résultat brut d\'exploitation'],
  ['15', 'Coût du risque'],
  ['16', 'Résultat d\'exploitation'],
  ['17', 'Gains ou pertes nets sur actifs immobilisés'],
  ['18', 'Résultat avant impôt'],
  ['19', 'Impôts sur les bénéfices'],
  ['20', 'Résultat net'],
]

function bankActifGroup(rawCode: string): string {
  const n = parseInt(rawCode, 10)
  if (n >= 1 && n <= 6) return '01-06'
  if (n >= 7 && n <= 9) return '07-09'
  if (n >= 10 && n <= 12) return '10-12'
  if (n >= 13 && n <= 14) return '13-14'
  return 'TOTAL'
}

function bankPassifGroup(rawCode: string): string {
  const n = parseInt(rawCode, 10)
  if (n >= 1 && n <= 4) return '01-04'
  if (n >= 5 && n <= 6) return '05-06'
  if (n >= 7 && n <= 8) return '07-08'
  if (n >= 9 && n <= 16) return '09-16'
  return 'TOTAL'
}

function bankCRGroup(rawCode: string): string {
  const n = parseInt(rawCode, 10)
  if (n >= 1 && n <= 9) return '01-09'
  if (n === 10) return '10'
  if (n >= 11 && n <= 14) return '11-14'
  if (n >= 15 && n <= 16) return '15-16'
  if (n >= 17 && n <= 20) return '17-20'
  return ''
}

function buildBankActifs(): CatalogEntry[] {
  const entries: CatalogEntry[] = BANK_ACTIFS.map(([rawCode, label]) => {
    const group = bankActifGroup(rawCode)
    return {
      fullKey: `ACTIF_${rawCode}`,
      rawCode,
      label,
      section: 'actif',
      institutionType: 'banque',
      group,
      groupTitle: BANK_ACTIF_GROUPS[group] ?? group,
    }
  })
  entries.push({
    fullKey: 'ACTIF_TOTAL',
    rawCode: 'TOTAL',
    label: 'TOTAL ACTIF',
    section: 'actif',
    institutionType: 'banque',
    group: 'TOTAL',
    groupTitle: BANK_ACTIF_GROUPS.TOTAL,
  })
  return entries
}

function buildBankPassifs(): CatalogEntry[] {
  const entries: CatalogEntry[] = BANK_PASSIFS.map(([rawCode, label]) => {
    const group = bankPassifGroup(rawCode)
    return {
      fullKey: `PASSIF_${rawCode}`,
      rawCode,
      label,
      section: 'passif',
      institutionType: 'banque',
      group,
      groupTitle: BANK_PASSIF_GROUPS[group] ?? group,
    }
  })
  entries.push({
    fullKey: 'PASSIF_TOTAL',
    rawCode: 'TOTAL',
    label: 'TOTAL PASSIF',
    section: 'passif',
    institutionType: 'banque',
    group: 'TOTAL',
    groupTitle: BANK_PASSIF_GROUPS.TOTAL,
  })
  return entries
}

function buildBankCR(): CatalogEntry[] {
  return BANK_CR.map(([rawCode, label]) => {
    const group = bankCRGroup(rawCode)
    return {
      fullKey: `CR_${rawCode}`,
      rawCode,
      label,
      section: 'compte_resultats',
      institutionType: 'banque',
      group,
      groupTitle: BANK_CR_GROUPS[group] ?? group,
    }
  })
}

// ─── PUBLIC API ──────────────────────────────────────────────────────────────

export const MF_CATALOG: CatalogEntry[] = [
  ...buildActifs(),
  ...buildPassifs(),
  ...buildCompteResultats(),
]

export const BANK_CATALOG: CatalogEntry[] = [
  ...buildBankActifs(),
  ...buildBankPassifs(),
  ...buildBankCR(),
]

export const CATALOG: CatalogEntry[] = [...MF_CATALOG, ...BANK_CATALOG]

const CATALOG_BY_KEY: Record<string, CatalogEntry> = CATALOG.reduce(
  (acc, entry) => {
    acc[entry.fullKey] = entry
    return acc
  },
  {} as Record<string, CatalogEntry>
)

function normalizeSection(section: CatalogSection | string | undefined): string | undefined {
  if (!section) return undefined
  // accept 'actifs' / 'passifs' (plural form used by statementType)
  if (section === 'actifs') return 'actif'
  if (section === 'passifs') return 'passif'
  return section
}

function normalizeInstitution(
  institutionType: InstitutionType | string | undefined
): InstitutionType | undefined {
  if (!institutionType) return undefined
  if (institutionType === 'banque' || institutionType === 'microfinance') return institutionType
  return undefined
}

/** Look up a catalog entry by its full normalized key. */
export function getCatalogEntry(fullKey: string | null | undefined): CatalogEntry | null {
  if (!fullKey) return null
  return CATALOG_BY_KEY[fullKey.trim()] ?? null
}

/**
 * Get catalog entries for a given section and (optionally) institution type.
 *
 * - When `institutionType` is provided, only entries for that institution are returned.
 * - When `section` is undefined, all sections for the requested institution are returned.
 * - When both are undefined, the full catalog is returned (rare — used as escape hatch
 *   by the picker's "Voir tous les états" toggle).
 */
export function getCatalogForSection(
  section?: CatalogSection | string,
  institutionType?: InstitutionType | string
): CatalogEntry[] {
  const normSection = normalizeSection(section)
  const normInst = normalizeInstitution(institutionType)
  let pool = CATALOG
  if (normInst) pool = pool.filter((e) => e.institutionType === normInst)
  if (normSection) pool = pool.filter((e) => e.section === normSection)
  return pool
}

/**
 * Detect whether a poste value is "undefined" (was not mapped by the normalizer).
 * Microfinance normalizers produce MFA_UNDEFINED_<hash>, MFP_UNDEFINED_<hash>, MFI_UNDEFINED.
 * Bank normalizers produce ACTIF_UNDEFINED, PASSIF_UNDEFINED, CR_UNDEFINED.
 * All contain the substring "UNDEFI" so a single check covers both.
 */
export function isUndefinedPoste(poste: string | null | undefined): boolean {
  if (!poste) return true
  const p = poste.trim().toUpperCase()
  return p === '' || p.includes('UNDEFI')
}

/**
 * Pretty name of the chart of accounts for the given institution. Used by the
 * pedagogical banner ("Chaque ligne porte un code <plan> …").
 */
export function chartLabel(institutionType?: InstitutionType | string): string {
  const normInst = normalizeInstitution(institutionType)
  if (normInst === 'banque') return 'PCB BCEAO'
  if (normInst === 'microfinance') return 'SYSCOA-IMF'
  return 'comptable'
}
