-- ThaiMon migration 028: reusable invite codes with active/inactive toggle
-- Run this in the Supabase SQL Editor for project pbomxjysvrfycanjfizx
--
-- reusable = TRUE  -> code can be used by many players (e.g. a class code)
-- active   = FALSE -> reusable code is temporarily disabled by admin

ALTER TABLE thaimon_invite_codes
  ADD COLUMN IF NOT EXISTS reusable BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE thaimon_invite_codes
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
