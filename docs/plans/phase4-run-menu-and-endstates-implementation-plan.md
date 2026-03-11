# Phase 4 Implementation Plan - Run Menu + End States

## Goal
Build the outer run flow around the current dungeon prototype:
- Main menu with `New Game` and `Load Game`.
- Explicit run win/lose screens instead of only raw in-run state.
- Reliable autosave resume flow with different behavior for fresh boot vs reload.
- Clear transition between menu, active run, and finished run.

## Phase 3 Gate
- Combat rooms, turns, enemy AI, and room-clear flow are already implemented.
- Run state now supports:
  - `active`
  - `won`
  - `lost`
- Current autosave restores directly into gameplay without a front menu.

## Scope Inputs
- `docs/gdd.md`: run win condition is reaching the exit room with at least one hero alive.
- `docs/gdd.md`: run lose condition is all heroes die or player retreats.
- `docs/gdd.md`: current run state should autosave locally and recover after reload.

## Phase 4 Scope

### 1. Front Menu State
- Add a top-level app state above gameplay:
  - `menu`
  - `in-run`
  - `run-complete`
- On a fresh app boot, show the menu instead of jumping straight into the dungeon.
- On a browser reload while a run snapshot exists, restore the last saved run state directly.
- Menu must show whether a resumable autosave exists.
- Fresh boot vs reload should be decided explicitly by app/session logic, not inferred only from save existence.

### 2. New Game Flow
- `New Game` starts a fresh run with a fresh seed.
- If an autosave already exists, starting a new run replaces it only after explicit confirmation.
- Starting a new run must fully reset:
  - dungeon state
  - party state
  - combat/run state
  - recent combat log
  - pending UI modes

### 3. Load Game Flow
- `Load Game` is enabled only when a valid autosave exists.
- Loading must restore the exact saved run snapshot and jump into gameplay.
- Invalid or corrupted autosave data should disable load and fall back safely to menu.
- `Load Game` is mainly for fresh boot/menu entry; reload should bypass the menu and restore automatically.

### 4. Run End States
- Winning a run:
  - trigger when the party reaches the exit room with at least one hero alive
  - switch to a dedicated run-complete screen
  - stop gameplay input and automation
- Losing a run:
  - trigger when all heroes die
  - trigger when player retreats, once retreat is implemented
  - switch to the same run-complete shell with defeat messaging

### 5. End Screen UX
- Show a simple summary:
  - result (`Victory` / `Defeat`)
  - dungeon seed
  - discovered rooms count
  - floors reached
  - surviving heroes count
- Provide actions:
  - `Back to Menu`
  - `New Game`
  - optional `Load Last Run` only if the finished run is intentionally kept

### 6. Autosave Policy
- While a run is active, autosave continues as it does now.
- Fresh boot behavior:
  - always land on menu
  - menu may offer `Load Game` if autosave exists
- Reload behavior:
  - restore the last active or finished run snapshot directly
- When a run is won or lost, decide one consistent policy for MVP:
  - Recommended: keep the finished snapshot until the player chooses `New Game`
- Menu must read autosave metadata without mutating it.
- If no autosave exists, `Load Game` stays disabled.

### 7. Retreat Hook
- Add a placeholder retreat path in the plan even if the button is not exposed yet.
- Retreat should:
  - mark the run as lost
  - exit gameplay cleanly
  - use the same end-state screen as full party defeat

### 8. UI Structure
- Keep gameplay canvas and sidebars for `in-run`.
- Add lightweight menu/end-state layouts in `src/main.ts` first; no framework rewrite.
- Avoid mixing menu rendering and gameplay rendering in the same branch-heavy function without a top-level mode switch.

## Acceptance Criteria
1. Opening the app as a fresh boot shows a menu instead of entering the run immediately.
2. `New Game` starts a fresh run from clean state.
3. `Load Game` resumes only when a valid autosave exists.
4. Winning a run moves the player to an explicit victory screen.
5. Losing a run because all heroes die moves the player to an explicit defeat screen.
6. Finished runs no longer accept gameplay input.
7. Returning to menu after a finished run does not corrupt autosave state.
8. Reloading the page restores the last active or finished run directly instead of returning to menu.

## Technical Breakdown

### Data / State
- `src/data/dungeonTypes.ts`
  - Keep `RunState` and extend only if summary metadata needs a dedicated type.
- `src/systems/gameSystem.ts`
  - Provide selectors/helpers for:
    - active run summary
    - run result messaging
    - full fresh-run reset
- `src/systems/persistenceSystem.ts`
  - Persist any new top-level menu/app state only if necessary.
  - Add a lightweight `hasAutosave()` / snapshot-metadata helper for menu UI.
  - Add the minimal boot-session marker needed to distinguish fresh boot from reload behavior.

### UI
- `src/main.ts`
  - Add top-level app mode rendering:
    - menu
    - gameplay
    - run-complete
  - Wire button actions for `New Game`, `Load Game`, and `Back to Menu`.

## Risks
- Mixing boot-time autosave restore with menu-first flow can produce double initialization bugs.
- Distinguishing fresh boot from reload can become brittle if it depends on browser navigation behavior that is not modeled explicitly.
- Reusing a finished autosave without a clear policy can confuse `Load Game`.
- If `src/main.ts` owns all app modes directly, it can become harder to maintain without small render helpers.

## Out of Scope for Phase 4
- Multiple save slots.
- Account-gold meta progression.
- Treasure/chest implementation details.
- Settings/options menu.
- Audio transitions between menu, gameplay, and end screen.

## Milestones
1. **M4.1 App mode shell**
   - Add menu/game/end-state top-level routing plus fresh-boot vs reload entry logic.
2. **M4.2 Save entry points**
   - Implement `New Game` and `Load Game` flows safely.
3. **M4.3 Run completion UX**
   - Add victory/defeat screens and input lockout.
4. **M4.4 Validation**
   - Verify reload, finished-run behavior, and corrupted-save fallback.
