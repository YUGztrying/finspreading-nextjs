-- supabase/period_mappings.sql
-- Run in the Supabase SQL Editor (idempotent).
--
-- Stores user-confirmed period alignment for companies whose balance-sheet
-- and income-statement periods do not match 1:1.
--
-- mappings JSONB is an array of objects, each:
-- {
--   "label":     "H1 2024",           -- display label
--   "bs_period": "2024-06-30",        -- period to look up in actifs / passifs
--   "is_period": "2024-06-30",        -- period to look up in compte_resultats
--   "hb_period": "2024-06-30"         -- period to look up in hors_bilan
-- }
-- Any of bs_period / is_period / hb_period can be null (= no data for that type).

CREATE TABLE IF NOT EXISTS period_mappings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name  TEXT NOT NULL,
  mappings      JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, company_name)
);

CREATE INDEX IF NOT EXISTS idx_period_mappings_user_company
  ON period_mappings(user_id, company_name);

-- RLS
ALTER TABLE period_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own mappings"   ON period_mappings;
DROP POLICY IF EXISTS "Users can insert own mappings"  ON period_mappings;
DROP POLICY IF EXISTS "Users can update own mappings"  ON period_mappings;
DROP POLICY IF EXISTS "Users can delete own mappings"  ON period_mappings;

CREATE POLICY "Users can view own mappings"
  ON period_mappings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mappings"
  ON period_mappings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mappings"
  ON period_mappings FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own mappings"
  ON period_mappings FOR DELETE USING (auth.uid() = user_id);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_period_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS period_mappings_updated_at ON period_mappings;

CREATE TRIGGER period_mappings_updated_at
  BEFORE UPDATE ON period_mappings
  FOR EACH ROW EXECUTE FUNCTION update_period_mappings_updated_at();
