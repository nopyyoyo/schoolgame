# Three-Position Word Game: Execution Plan

## Goal

Create a new small game that teaches Thai object vocabulary. The player automatically
appears to walk upward while selecting one of three fixed lanes. For each of ten
checkpoints, the player must listen to an object word and choose the lane containing
the matching Thai word.

## Existing Assets and Reuse

- Background maps:
  - `Small games/layered_map_15x40.txt`: the repeating checkpoint map.
  - `Small games/layered_map_15x20.txt`: the final completion walk.
- Vocabulary assets:
  - `Small games/object sound/`: one MP3 per object.
  - `Small games/object photo/`: one PNG per object.
  - `Small games/Thai translation.txt`: `basename@Thai label` mappings.
- Completion sound: `app/Music/106 Fanfare.mp3`.
- Reuse from `small-games/letter-maze/`:
  - Layered-map loading and rendering.
  - Player-character sprite selection from the portal query string.
  - Supabase session integration and `record_small_game_win` RPC.
  - Countdown, restart, and player-page return patterns.

## Game Module

Create `small-games/three-position-word/` with:

- `game.html`: game shell, question labels, countdown, top lane controls, and actions.
- `game.css`: fixed-size pixel-art viewport, scrolling stage, lane controls, prompt
  animation, and end-state styling.
- `game-config.js`: game ID, map paths, lane positions, checkpoint count, movement
  timing, character defaults, and audio paths.
- `game.js`: game-state machine, scrolling, lane movement, question generation,
  collision, enemy, and completion logic.
- `map-loader.js`: reuse or share the validated layered-map loader.

## Vocabulary Catalog

At startup:

1. Load the Thai translation text and parse each non-empty line as
   `basename@Thai label`.
2. Build a question object for each mapped basename:
   `{ id, thaiLabel, soundUrl, photoUrl }`.
3. Verify that every mapping has both a corresponding MP3 and PNG, and that there
   are at least three valid entries.
4. Display a visible initialization error and do not start the game if validation
   fails.

For every checkpoint:

1. Randomly select one correct question.
2. Select two distinct incorrect questions.
3. Shuffle the three choices across left, center, and right lanes.
4. Render their Thai labels at the top of the viewport.
5. Play the correct answer's sound and simultaneously zoom/fade its photo in the
   center of the viewport.

## Movement and Controls

### Lanes

Use three fixed player lane centers based on the 15-column map:

| Lane | Touch columns | Intended player center |
| --- | --- | --- |
| Left | 1-5 | Between columns 3 and 4 |
| Center | 6-10 | Column 8 |
| Right | 11-15 | Between columns 12 and 13 |

The implementation will express these locations in the map's zero-based coordinate
system and validate them against the collision map before gameplay begins.

### Input

- Show three arrow buttons at the top of the game, aligned to the three lanes.
- On touch or pen input, map columns 1-5 to left, 6-10 to center, and 11-15 to
  right.
- Support left/right keyboard keys as an accessibility equivalent.
- Ignore movement input during the countdown, failed state, and completion sequence.

### Lane Change

- Keep the player visually near the bottom of the viewport.
- Move the background downward continuously to simulate upward walking.
- On a lane request, move the player horizontally at the same effective speed as
  the automatic forward movement and face toward the target lane.
- Test the complete lateral path against blocking tiles. If it intersects a block,
  animate the player back to the origin lane and restore the original facing.

## Checkpoint Loop

1. Show `3`, `2`, `1`, then start the first background scroll.
2. Start a checkpoint question early enough that its audio and image prompt finish
   before the player reaches the obstacle row.
3. Spawn lane-locked enemies around row 37 in both incorrect lanes.
4. The obstacle region prevents switching lanes after the decision point. An enemy
   contact ends the run.
5. When the player passes the checkpoint through the correct lane, remove its
   temporary entities, increment the checkpoint, and generate the next question.
6. Continue the 15x40 map without a visible gap by recycling its scroll offset and
   entities.
7. Repeat until ten checkpoints have been passed.

## Completion

After checkpoint 10:

1. Disable all player controls.
2. Continue scrolling with `layered_map_15x20.txt`.
3. Automatically move the player toward column 7.
4. Continue the upward-walk animation until the player reaches 12 tiles from the
   bottom, then turn the sprite around.
5. Play `106 Fanfare.mp3`.
6. Call `record_small_game_win` once with the game ID, level number, session token,
   and a newly generated request UUID.
7. Show the completion state only after recording succeeds; show an explicit retry
   message if the server call fails.

## Portal and Reward Integration

1. Add a Supabase migration inserting this game into `small_game_levels`, including
   its game ID, display name, map reference, and configured reward.
2. Update `portal.js` so small games are represented as a list, not only the current
   `thai-letter-maze` entry.
3. Render this game's status and launch button beside the letter-maze card.
4. Once completed, use the existing `claim_small_game_reward` flow to expose the
   configured reward on the player page.

## Failure and Restart

On enemy collision:

1. Stop scrolling, movement, and all pending checkpoint timers.
2. Show a clear failure state explaining that the player selected the wrong lane.
3. Provide restart and player-page return actions.
4. Do not call the completion RPC or grant a reward.

## Validation Checklist

- Translation keys, sounds, and photos form a complete matching catalog.
- Countdown prevents movement until it completes.
- All three buttons, touch zones, and keyboard input select the expected lane.
- Valid lane changes finish in the requested lane with correct sprite facing.
- Blocked lane changes visibly return to the origin lane.
- Correct and incorrect choices vary across lanes and use distinct distractors.
- Wrong lanes consistently produce an enemy collision and failure state.
- Ten correct checkpoint passes scroll without a visual map seam.
- Completion locks controls, runs the finish sequence, and records completion once.
- The player page displays completion and supports claiming the configured reward.

## Review Items

The following product values are still required before implementation:

- The reward type and amount for this game.
- The exact desired failure presentation beyond restart/back actions, if it should
  differ from the proposed retry screen.
- Confirmation that the map's referenced "pixels" mean tile columns/rows, as used
  throughout this plan.
