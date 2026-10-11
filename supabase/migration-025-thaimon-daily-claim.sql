-- ThaiMon migration 025: daily pokeball claim tracking
-- Run this in the Supabase SQL Editor for project pbomxjysvrfycanjfizx

ALTER TABLE thaimon_players
  ADD COLUMN IF NOT EXISTS last_daily_claim_at TIMESTAMPTZ;
