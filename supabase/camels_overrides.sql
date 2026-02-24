-- supabase/camels_overrides.sql
-- Run in the Supabase SQL Editor AFTER camels_analyses.sql.
-- Adds analyst-override columns to camels_analyses (idempotent).

ALTER TABLE camels_analyses
  ADD COLUMN IF NOT EXISTS car_override       FLOAT8,
  ADD COLUMN IF NOT EXISTS npl_ratio_override FLOAT8;
