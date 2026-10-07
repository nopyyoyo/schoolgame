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
from the database. A battle win is recorded by
`record_player_arena_win`; the player must later click `รับรางวัล` on the
player page, which calls the token-authenticated
`claim_player_arena_reward` function exactly once.

`migration-018-small-game-progression.sql` creates isolated progression for
map-based small games. The first `thai-letter-maze` map is recorded through
`record_small_game_win` after completion, and its reward is claimed later from
the player page through `claim_small_game_reward`.

`migration-019-teacher-money-adjustments.sql` creates
`adjust_player_money`, which validates the teacher's active portal session
before adding a positive or negative amount to a student's money.

`migration-020-thai-letter-maze-reward.sql` sets the reward for the first
Thai letter maze level to 150 money.

`migration-021-three-position-word.sql` registers the `three-position-word`
small game with a 150 money reward. It reuses `record_small_game_win` and
`claim_small_game_reward`.

`migration-022-three-position-word-level-2.sql` adds the sound-only second
level of `three-position-word` and requires each player to complete the
preceding level before its result can be recorded.

## Deploying an Edge Function

```powershell
cd "supabase"
supabase functions deploy <function-name>
```
