-- ThaiMon migration 027: mic exemption flag for players
-- Run this in the Supabase SQL Editor for project pbomxjysvrfycanjfizx
-- When FALSE (default), the player MUST use a microphone for catching,
-- evolution voice challenges, and daily claims — no auto-pass fallback.
-- Admin can set TRUE for specific players to exempt them.

ALTER TABLE thaimon_players
  ADD COLUMN IF NOT EXISTS mic_exempt BOOLEAN NOT NULL DEFAULT FALSE;
