-- supabase/camels_analyses.sql
-- Run this in the Supabase SQL Editor to create the CAMELS analysis table.
-- This table is shared: the Spreading App writes financial_statements,
-- and the CAMELS module reads them and writes analysis results here.

CREATE TABLE IF NOT EXISTS camels_analyses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name      TEXT NOT NULL,
  period            TEXT NOT NULL,
  type_institution  TEXT NOT NULL DEFAULT 'banque',

  -- Individual ratio FLOAT8 columns for fast querying
  equity_assets                    FLOAT8,
  debt_assets                      FLOAT8,
  npl_ratio                        FLOAT8,
  coverage_ratio                   FLOAT8,
  cost_of_risk_avg_assets          FLOAT8,
  cost_to_income                   FLOAT8,
  roaa                             FLOAT8,
  roae                             FLOAT8,
  net_interest_margin              FLOAT8,
  liquid_assets_total_assets       FLOAT8,
  gross_loans_deposits             FLOAT8,

  -- Ratings as JSONB (each has {rating, status, ratios})
  capital_rating        JSONB,
  asset_quality_rating  JSONB,
  management_rating     JSONB,
  earnings_rating       JSONB,
  liquidity_rating      JSONB,
  composite_rating      JSONB,

  -- Analysis paragraphs
  analysis_capital         TEXT,
  analysis_asset_quality   TEXT,
  analysis_management      TEXT,
  analysis_earnings        TEXT,
  analysis_liquidity       TEXT,
  analysis_composite       TEXT,

  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id, company_name, period)
);

-- Index for fast lookups by user + company
CREATE INDEX IF NOT EXISTS idx_camels_user_company
  ON camels_analyses(user_id, company_name);

-- RLS policies
ALTER TABLE camels_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyses"
  ON camels_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses"
  ON camels_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses"
  ON camels_analyses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own analyses"
  ON camels_analyses FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_camels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER camels_analyses_updated_at
  BEFORE UPDATE ON camels_analyses
  FOR EACH ROW EXECUTE FUNCTION update_camels_updated_at();
