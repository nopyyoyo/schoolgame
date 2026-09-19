# Supabase migrations for schoolgame

This repository is the authoritative GitHub Pages source (`nopyyoyo/schoolgame`).
Its Supabase project is `pbomxjysvrfycanjfizx` (same backend used by earlier
prototype work). Numbered migrations up to `migration-011` were created and
applied from a previous local project copy before this repo's `supabase/`
folder existed; migration tracking continues here from `migration-012` onward.

## Applying a migration

```powershell
cd "supabase"
supabase db push
```

or run the SQL file directly in the Supabase SQL editor.

`migration-016-player-arena-ladder.sql` creates the separate ten-level
single-player ladder. Add or edit rows in `player_arena_levels` to extend it;
the portal and battle app read the level definitions and per-player progress
from the database. Rewards are granted by the token-authenticated
`claim_player_arena_reward` database function after a ladder battle is won.

## Deploying an Edge Function

```powershell
cd "supabase"
supabase functions deploy <function-name>
```
