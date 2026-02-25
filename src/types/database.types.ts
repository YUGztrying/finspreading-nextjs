// src/types/database.types.ts
// TypeScript types generated from Supabase schema
// This provides full type safety for database operations

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      financial_statements: {
        Row: {
          id: string
          user_id: string
          company_name: string
          type_institution: 'banque' | 'microfinance'
          statement_type: 'actifs' | 'passifs' | 'hors_bilan' | 'compte_resultats'
          periods: string[]
          line_items: LineItem[]
          source_files: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_name: string
          type_institution: 'banque' | 'microfinance'
          statement_type: 'actifs' | 'passifs' | 'hors_bilan' | 'compte_resultats'
          periods: string[]
          line_items: LineItem[]
          source_files?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_name?: string
          type_institution?: 'banque' | 'microfinance'
          statement_type?: 'actifs' | 'passifs' | 'hors_bilan' | 'compte_resultats'
          periods?: string[]
          line_items?: LineItem[]
          source_files?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      historique_modifications: {
        Row: {
          id: string
          statement_id: string
          user_id: string
          company_name: string
          statement_type: string
          type_modification: 
            | 'ligne_ajoutee'
            | 'ligne_supprimee'
            | 'montant_modifie'
            | 'description_modifiee'
            | 'poste_modifie'
            | 'periode_ajoutee'
            | 'periode_supprimee'
            | 'entreprise_renommee'
          ligne_index: number | null
          periode_index: number | null
          champ_modifie: string | null
          ancienne_valeur: string | null
          nouvelle_valeur: string | null
          description_ligne: string | null
          commentaire: string | null
          created_at: string
        }
        Insert: {
          id?: string
          statement_id: string
          user_id: string
          company_name: string
          statement_type: string
          type_modification: 
            | 'ligne_ajoutee'
            | 'ligne_supprimee'
            | 'montant_modifie'
            | 'description_modifiee'
            | 'poste_modifie'
            | 'periode_ajoutee'
            | 'periode_supprimee'
            | 'entreprise_renommee'
          ligne_index?: number | null
          periode_index?: number | null
          champ_modifie?: string | null
          ancienne_valeur?: string | null
          nouvelle_valeur?: string | null
          description_ligne?: string | null
          commentaire?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          statement_id?: string
          user_id?: string
          company_name?: string
          statement_type?: string
          type_modification?: 
            | 'ligne_ajoutee'
            | 'ligne_supprimee'
            | 'montant_modifie'
            | 'description_modifiee'
            | 'poste_modifie'
            | 'periode_ajoutee'
            | 'periode_supprimee'
            | 'entreprise_renommee'
          ligne_index?: number | null
          periode_index?: number | null
          champ_modifie?: string | null
          ancienne_valeur?: string | null
          nouvelle_valeur?: string | null
          description_ligne?: string | null
          commentaire?: string | null
          created_at?: string
        }
      }
      irp_overrides: {
        Row: {
          id: string
          user_id: string
          company_name: string
          irp_line_title: string
          period: string
          value: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_name: string
          irp_line_title: string
          period: string
          value: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_name?: string
          irp_line_title?: string
          period?: string
          value?: number
          created_at?: string
          updated_at?: string
        }
      }
      irp_aliases: {
        Row: {
          id: string
          user_id: string
          company_name: string
          type_institution: 'banque' | 'microfinance'
          statement_type: 'actifs' | 'passifs' | 'hors_bilan' | 'compte_resultats'
          original_poste: string
          original_description: string
          normalized_key: string
          mapped_code: string
          confidence_score: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_name: string
          type_institution: 'banque' | 'microfinance'
          statement_type: 'actifs' | 'passifs' | 'hors_bilan' | 'compte_resultats'
          original_poste: string
          original_description: string
          normalized_key: string
          mapped_code: string
          confidence_score?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_name?: string
          type_institution?: 'banque' | 'microfinance'
          statement_type?: 'actifs' | 'passifs' | 'hors_bilan' | 'compte_resultats'
          original_poste?: string
          original_description?: string
          normalized_key?: string
          mapped_code?: string
          confidence_score?: number
          created_at?: string
        }
      }
    }
    Views: {
      user_companies: {
        Row: {
          user_id: string
          company_name: string
          type_institution: 'banque' | 'microfinance'
          statement_count: number
          last_updated: string
        }
      }
      user_statement_counts: {
        Row: {
          user_id: string
          statement_type: string
          count: number
        }
      }
    }
    Functions: {}
    Enums: {}
  }
}

// Helper type for line items
export interface LineItem {
  poste: string
  description: string
  amounts: number[]
  is_subtotal?: boolean
  is_total?: boolean
  indent_level?: number
  manual?: boolean
  flags?: string[]
  brut_amount?: number
  amort_prov_amount?: number
  net_amount?: number
  net_amount_N?: number
  net_amount_N_1?: number
}

// Helper types for cleaner code
export type FinancialStatement = Database['public']['Tables']['financial_statements']['Row']
export type FinancialStatementInsert = Database['public']['Tables']['financial_statements']['Insert']
export type FinancialStatementUpdate = Database['public']['Tables']['financial_statements']['Update']

export type HistoriqueModification = Database['public']['Tables']['historique_modifications']['Row']
export type HistoriqueModificationInsert = Database['public']['Tables']['historique_modifications']['Insert']

export type IRPOverride = Database['public']['Tables']['irp_overrides']['Row']
export type IRPOverrideInsert = Database['public']['Tables']['irp_overrides']['Insert']
export type IRPOverrideUpdate = Database['public']['Tables']['irp_overrides']['Update']

export type IRPAlias = Database['public']['Tables']['irp_aliases']['Row']
export type IRPAliasInsert = Database['public']['Tables']['irp_aliases']['Insert']
export type IRPAliasUpdate = Database['public']['Tables']['irp_aliases']['Update']

// ─── Period alignment types ────────────────────────────────────────────────

/** A single analysis column with explicit per-statement-type period lookups. */
export interface PeriodMapping {
  /** Display label, e.g. "FY 2023", "H1 2024" */
  label: string
  /** ISO date to look up in actifs & passifs (null = no BS data for this column) */
  bs_period: string | null
  /** ISO date to look up in compte_resultats (null = no IS data) */
  is_period: string | null
  /** ISO date to look up in hors_bilan (null = no HB data) */
  hb_period: string | null
}

/** Result of auto-detecting whether period alignment is needed. */
export interface PeriodAlignmentInfo {
  /** true when all statement types share identical period arrays */
  aligned: boolean
  /** Per-statement-type period arrays */
  available: {
    actifs: string[]
    passifs: string[]
    compte_resultats: string[]
    hors_bilan: string[]
  }
  /** Auto-suggested mappings (best guess — user confirms via dialog) */
  suggested: PeriodMapping[]
}