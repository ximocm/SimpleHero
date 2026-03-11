# Phase 3 Implementation Plan - Combat Foundation + Room Encounters

## Goal
Build the first playable combat slice on top of the existing traversal and hero UX:
- Turn-based combat state layered onto the current dungeon flow.
- Deterministic enemy encounters in combat rooms.
- Basic attacks for heroes and enemies using the formulas in `docs/balance.md`.
- Room-clear progression without combat rewards.
- Minimal combat UI that makes turn order and action availability obvious.

## Phase 2 Gate
- Phase 2 is complete as of 2026-03-03 and is the baseline for this phase.
- This phase assumes the current implementation keeps:
  - Live character panels with active/ready status.
  - Autosave restore for party and dungeon state.
  - Existing equipment and party inventory UI.
  - Current finite deterministic dungeon generation and minimap behavior.

## Current Baseline (Implemented)
- Seeded deterministic finite dungeon floors with room transitions gated by all 3 heroes reaching the same exit.
- A* click movement with hover path preview.
- Three persistent heroes with HP, class/race identity, Body/Mind, facing, and equipment slots.
- Left-side hero panels, right-side minimap/inventory UI, and local autosave restore.
- Item definitions and drag/drop equipment management already exist, but combat does not.

## Pre-Combat Alignment
Before implementing balance-sensitive combat logic:
- Normalize runtime weapon and armor stats in `src/items/*.ts` to match `docs/items.md`, or explicitly update the docs to match the chosen values.
- Decide whether starter heroes begin with auto-equipped default loadouts or must equip from starting inventory before first combat.

## Phase 3 Scope

### 1. Room Encounter Model
- Add explicit room kind metadata:
  - `combat`
  - `treasure`
  - `exit`
- Add explicit per-room encounter state instead of relying on traversal-only room data.
- Combat rooms own encounter state with:
  - `enemyIds`
  - `isCleared`
- Entering a combat room starts or resumes its encounter state.
- Exits in an active combat room stay blocked until the encounter is cleared.
- Treasure and exit rooms do not spawn enemies in this phase.

### 2. Enemy Runtime State
- Add enemy runtime data for active combat rooms:
  - `id`
  - `kind`
  - `roomId`
  - `tile`
  - `hp`, `maxHp`
  - `movement`
  - `range`
  - `attackDice`
  - `damage`
  - `defenseDiceBonus`
  - turn status effects
- Implement only the locked MVP enemies from `docs/enemies.md`:
  - `Skeleton Sword`
  - `Skeleton Archer`
- Encounter composition must use the allowed deterministic room compositions from `docs/enemies.md`.

### 3. Combat Turn Loop
- Combat is round-based and only exists while a combat room encounter is active.
- Each round resolves in this order:
  1. Hero phase
  2. Enemy phase
  3. Round cleanup
- During the hero phase:
  - The player may switch between living heroes in the current room in any order.
  - The active hero panel drives which hero is currently selected.
  - Each living hero gets:
    - movement up to `Final Movement`
    - `1 Attack Slot`
    - `2 Action Points`
  - Heroes keep their own remaining resources for the whole hero phase.
- Pressing `End Turn` hands control to the enemy phase.
- After the enemy phase resolves automatically, a new hero phase starts and refreshes hero resources.

### 4. Basic Attack Resolution
- Implement only basic attacks in this phase.
- Attack resolution must follow `docs/balance.md` exactly:
  1. Check attack-slot availability.
  2. Roll attack dice.
  3. Convert attack dice to hits.
  4. Roll defense dice.
  5. Convert defense dice to blocked hits.
  6. Compute effective hits.
  7. Compute final damage.
  8. Apply HP loss.
  9. Consume attack slot.
- Range is determined by equipped weapon.
- If no valid weapon is equipped, a hero uses the explicit fallback unarmed attack.
- Defense dice must include:
  - base `1`
  - armor bonus
  - shield bonus
- Defeated units are removed from the board immediately.

### 5. Combat Movement Rules
- While combat is active, movement becomes turn-limited instead of unrestricted.
- Pathfinding stays grid-based and uses the existing walkability rules.
- Movement cost is `1` per tile.
- A unit cannot move through occupied tiles.
- A hero cannot enter an exit tile while the encounter is still active.
- Existing non-combat traversal behavior remains unchanged outside active combat.

### 6. Enemy AI
- Enemy behavior follows `docs/enemies.md` and must remain deterministic and readable.
- `Skeleton Sword`:
  - attack nearest hero in melee if possible
  - otherwise move toward the nearest hero
- `Skeleton Archer`:
  - attack the lowest-HP hero in range if possible
  - otherwise reposition to prefer a 3-4 tile distance from the nearest hero
- Enemy movement uses the same grid/path rules as heroes.
- Enemy decisions should break ties deterministically so autosave restore produces the same outcome.

### 7. Rewards and Run State
- Clearing a combat room only marks it cleared and unblocks traversal.
- Combat rooms do not award gold or items.
- Treasure/chest rooms are the only reward source in MVP.
- A cleared combat room stays cleared after reload and does not respawn enemies.

### 8. Combat UI
- Extend the current UI with minimal but explicit combat feedback:
  - current phase (`Hero` or `Enemy`)
  - current acting unit
  - active hero remaining movement
  - active hero remaining action points
  - attack-slot availability
- Show enemy markers on the board with:
  - type label
  - current HP
- Character panels should show defeated state for downed heroes.
- Provide at least one clear way to end the current hero turn.

## Acceptance Criteria
1. Entering a combat room spawns a deterministic valid enemy encounter exactly once.
2. Active combat blocks room exit transitions until all enemies are defeated.
3. The hero phase enforces per-hero movement, attack-slot, and action-point limits.
4. Basic attack damage matches the formulas in `docs/balance.md`.
5. Enemy turns resolve automatically and follow the documented target priorities.
6. Defeated enemies are removed immediately and do not act again.
7. Clearing a combat room only updates encounter-clear state and traversal gating.
8. Cleared combat rooms remain cleared after autosave restore.
9. Existing non-combat traversal, path preview, and character panels remain functional outside combat.
10. No two living units occupy the same tile at any time.

## Technical Breakdown
- `src/data/dungeonTypes.ts`
  - Add room kind, encounter state, and enemy runtime types.
- `src/systems/dungeonStateSystem.ts`
  - Assign deterministic room kinds and persist encounter lifecycle.
- `src/systems/gameSystem.ts`
  - Coordinate mode switching between traversal and combat.
  - Expose combat-ready UI selectors.
- `src/systems/partySystem.ts`
  - Add per-hero phase budgets and turn reset helpers.
- `src/systems/persistenceSystem.ts`
  - Bump snapshot schema for room encounter state and enemies.
- `src/main.ts`
  - Add combat HUD, end-turn control, enemy rendering, and combat input routing.
- New suggested modules:
  - `src/data/combatTypes.ts`
  - `src/systems/combatSystem.ts`
  - `src/systems/encounterSystem.ts`
  - `src/enemies/index.ts`

## Risks
- Combat state can overload `src/main.ts` if rendering and rules stay too coupled.
- Existing autosave restore must remain deterministic once enemy turns are introduced.
- Item-stat mismatches between docs and runtime code will create confusing balance regressions if left unresolved.
- Hero-phase UX can become unclear if end-turn state is not explicit in the HUD.

## Out of Scope for Phase 3
- Class skills (`Power Strike`, `Dash`, `Spellcast`).
- Mage spells (`Heal`, `Fireball`, `Ice`).
- Consumable use in combat.
- Loot drops and treasure-room interaction beyond room-kind scaffolding.
- Animation polish, VFX, and audio feedback.

## Milestones
1. **M3.1 Data alignment + state scaffolding**
  - Normalize item stats, add room kinds, add encounter/combat data contracts.
2. **M3.2 Hero combat loop**
  - Hero-phase budgets, end-turn flow, basic hero attacks, combat HUD.
3. **M3.3 Enemy encounters**
  - Enemy spawning, AI, and room-clear logic.
4. **M3.4 Persistence + validation**
  - Autosave schema update, reload safety, acceptance checklist pass.
