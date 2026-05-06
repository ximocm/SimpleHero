# Phase 6 Implementation Plan - Final MVP

## Goal
Close the remaining gaps between the current playable build and the locked MVP:
- complete the treasure and gold loop
- add the missing non-magic class skills
- enforce the remaining turn-economy rules
- add retreat as a loss condition
- align runtime stats with the locked docs
- reduce `src/main.ts` from a monolithic entry file into smaller app modules

## Phase 5 Gate
- Turn-based combat, enemy AI, run states, save/load, and spellcasting already exist.
- The game is playable end-to-end, but several locked MVP systems are still incomplete or only scaffolded.
- `src/main.ts` has grown into a high-coupling file that mixes boot, input, render, inventory, and loop logic.

## Locked MVP Gaps To Close
- Treasure rooms must provide the only room-based reward source in MVP.
- Total account gold must persist across runs.
- Warrior and Ranger must each have one active class skill.
- Retreat must cleanly end the run as a defeat.
- Equipment changes that affect hand slots must respect action-point cost during combat.
- Runtime weapon and armor numbers must match the locked spec in `docs/items.md`.

## Scope Inputs
- `docs/gdd.md`: locked MVP scope, treasure, ruby, and total gold progression.
- `docs/items.md`: weapon/armor values and equip-cost rules.
- `docs/classes.md`: Warrior `Power Strike`, Ranger `Dash`, Mage `Spellcast`.
- `docs/balance.md`: action-point economy and run gold policy.
- Previous implementation phases already delivered:
  - dungeon generation
  - combat
  - menu/end-state flow
  - spellcasting

## Phase 6 Scope

### 1. Treasure Room Reward Loop
- Add explicit treasure reward state to room data.
- Treasure rooms must own one deterministic reward payload.
- Entering a treasure room should complete the reward interaction for MVP.
- Treasure room completion must depend on reward collection, not only room traversal.

### 2. Run Gold and Account Gold
- Add `runGold` to runtime state.
- Add persistent `accountGold` storage outside the autosave snapshot.
- When a run finishes, credit `runGold` into `accountGold` exactly once.
- Show both values in the UI so the player can verify progression.

### 3. Missing Class Skills
- Warrior:
  - add `Power Strike`
  - costs `1 AP`
  - arms the next basic attack this turn with `+3` damage
  - expires at turn end if unused
  - cooldown `2`
- Ranger:
  - add `Dash`
  - costs `1 AP`
  - grants `+2` movement this turn
  - cooldown `2`
- Mage:
  - keep `Spellcast` as the existing cast action using the attack slot
- Add the minimum runtime skill-state model needed to support cooldowns and temporary effects.

### 4. Remaining Turn-Economy Enforcement
- Hand-slot equipment changes in combat must consume `1 AP`.
- Shield and other hand-slot swaps must use the same AP path.
- Out-of-combat drag/drop should stay unrestricted.
- Equipment changes must still preserve current two-hand and spellbook/focus rules.

### 5. Retreat
- Add a retreat action in gameplay UI.
- Retreat should:
  - confirm with the player
  - set run state to `lost`
  - stop gameplay interaction
  - reuse the existing defeat/end-state flow

### 6. Data Alignment
- Update runtime weapon values to match `docs/items.md`.
- Update armor movement modifiers to match the locked spec.
- Keep the central item-definition files as the only source of truth.

### 7. `main.ts` Decomposition
- Replace the large `src/main.ts` implementation with a thin entrypoint.
- Extract app responsibilities into focused modules:
  - controller / lifecycle
  - renderer / HUD / canvas drawing
  - inventory drag/drop and equip logic
  - shared app UI types
- Preserve behavior while improving maintainability and testability.

## Acceptance Criteria
1. Entering a treasure room grants a deterministic treasure reward exactly once.
2. Treasure rooms count as completed only after reward collection.
3. `runGold` is visible during the run.
4. Finished runs add `runGold` into persistent `accountGold` exactly once.
5. Warrior `Power Strike` works with cooldown and same-turn expiration.
6. Ranger `Dash` grants extra movement only for the current turn and respects cooldown.
7. Retreat cleanly ends the run as a defeat and uses the run-complete screen.
8. Hand-slot equipment changes in combat consume action points.
9. Runtime weapon and armor values match the locked MVP docs.
10. `src/main.ts` is reduced to a small coordinator/entrypoint and the app behavior still builds and runs cleanly.

## Technical Breakdown

### Data
- `src/data/dungeonTypes.ts`
  - add treasure-room reward state
  - add hero skill-state data
- `src/items/treasures.ts`
  - add MVP treasure reward catalog
- `src/items/weapons.ts`
  - align values with docs
- `src/items/armors.ts`
  - align movement modifiers with docs
- `src/heroes/classes.ts`
  - add skill metadata

### Systems
- `src/systems/gameSystem.ts`
  - handle treasure collection
  - expose skill actions
  - support retreat
  - update run summary data
- `src/systems/combatSystem.ts`
  - apply `Power Strike` damage bonus
- `src/systems/turnSystem.ts`
  - tick cooldowns and clear turn-limited skill state
- `src/systems/persistenceSystem.ts`
  - persist new runtime state
  - add account-gold storage helpers
- `src/systems/dungeonGenerationSystem.ts`
  - assign deterministic treasure rewards

### App Architecture
- `src/main.ts`
  - become a thin entrypoint
- new app modules:
  - `src/app/controller.ts`
  - `src/app/renderer.ts`
  - `src/app/inventoryController.ts`
  - `src/app/types.ts`

### UI
- `src/ui/layout.ts`
  - add class-skill and retreat actions
- `src/ui/sidebarViews.ts`
  - show skill readiness/cooldown state
- `src/ui/overlayViews.ts`
  - show run gold and account gold on menu/end-state surfaces

## Risks
- Reward payout can be duplicated on reload if the “already applied” state is not persisted carefully.
- AP-cost enforcement for drag/drop can become confusing if the acting hero is ambiguous.
- Splitting `main.ts` without a clear boundary can just recreate the same monolith in a different file.
- Skill temporary effects can become brittle if they are stored implicitly instead of in explicit hero state.

## Out of Scope for Phase 6
- Additional treasure item types beyond MVP gold/ruby rewards.
- Shops, meta-progression beyond total account gold, or inventory economy.
- Additional class skills or cooldown systems beyond the locked MVP set.
- Full test harness or automated gameplay regression suite.
- Further app-module decomposition beyond the first `main.ts` split.

## Milestones
1. **M6.1 Reward loop**
   - Add treasure reward state, run gold, and account-gold persistence.
2. **M6.2 Skills and rules**
   - Implement Warrior/Ranger skills, retreat, and hand-slot AP costs.
3. **M6.3 Data lock**
   - Align runtime numbers with `docs/items.md`.
4. **M6.4 Architecture cleanup**
   - Split `main.ts` into focused app modules while preserving behavior.
5. **M6.5 Final verification**
   - Confirm the project builds and the locked MVP loop is complete.
