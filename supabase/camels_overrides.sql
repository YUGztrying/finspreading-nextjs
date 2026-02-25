-- supabase/camels_overrides.sql
-- Run in the Supabase SQL Editor AFTER camels_analyses.sql (idempotent).
-- Adds analyst-override columns to camels_analyses.
--
-- car_override:        Regulatory CAR (%) as a decimal, e.g. 0.145 for 14.5%
-- npl_amount_override: Absolute NPL amount in same units as the balance sheet.
--                      NPL Ratio and Coverage Ratio are derived from this automatically.

ALTER TABLE camels_analyses
  ADD COLUMN IF NOT EXISTS car_override         FLOAT8,
  ADD COLUMN IF NOT EXISTS npl_amount_override  FLOAT8;
