-- supabase/period_fx_rates.sql
-- Run in the Supabase SQL Editor (idempotent).
--
-- Stores analyst-entered FX rates per reporting period for a given company.
-- Used by the IRM (Investment Risk Memo) layer to convert LCY financial
-- statements into USD for ratio analysis.
--
-- Two rates are stored per period:
--   fx_eop  — end-of-period rate, used for balance-sheet items (stocks)
--   fx_avg  — average rate for the period, used for P&L items (flows)
--
-- Analysts look these up in the internal IFC FX library and enter them
-- manually — no auto-fetching.

CREATE TABLE IF NOT EXISTS period_fx_rates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name   TEXT NOT NULL,
  period         TEXT NOT NULL,         -- ISO date string or period label
  fx_eop         NUMERIC,               -- nullable so analyst can save partial drafts
  fx_avg         NUMERIC,
  source         TEXT,                  -- e.g. "IFC FX library, 2023"
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, company_name, period)
);

CREATE INDEX IF NOT EXISTS idx_period_fx_rates_user_company
  ON period_fx_rates(user_id, company_name);

-- RLS
ALTER TABLE period_fx_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own fx rates"   ON period_fx_rates;
DROP POLICY IF EXISTS "Users can insert own fx rates" ON period_fx_rates;
DROP POLICY IF EXISTS "Users can update own fx rates" ON period_fx_rates;
DROP POLICY IF EXISTS "Users can delete own fx rates" ON period_fx_rates;

CREATE POLICY "Users can view own fx rates"
  ON period_fx_rates FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fx rates"
  ON period_fx_rates FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fx rates"
  ON period_fx_rates FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own fx rates"
  ON period_fx_rates FOR DELETE USING (auth.uid() = user_id);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_period_fx_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS period_fx_rates_updated_at ON period_fx_rates;

CREATE TRIGGER period_fx_rates_updated_at
  BEFORE UPDATE ON period_fx_rates
  FOR EACH ROW EXECUTE FUNCTION update_period_fx_rates_updated_at();
