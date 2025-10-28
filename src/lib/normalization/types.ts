// src/lib/normalization/types.ts
// Shared types for normalization functions

export interface UnmappedLine {
  original_poste: string
  original_description: string
  company_name?: string
  statement_type?: string
  original_amounts?: number[]
  source_file_url?: string
  [key: string]: any
}

export type InstitutionType = 'banque' | 'microfinance'
export type StatementType = 'actifs' | 'passifs' | 'compte_resultats' | 'hors_bilan'