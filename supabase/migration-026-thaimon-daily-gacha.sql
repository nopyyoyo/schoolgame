-- ThaiMon migration 026: daily gachapon claim tracking
-- Run this in the Supabase SQL Editor for project pbomxjysvrfycanjfizx
-- (Run migration 025 first if you haven't yet)

ALTER TABLE thaimon_players
  ADD COLUMN IF NOT EXISTS last_daily_gacha_claim_at TIMESTAMPTZ;
