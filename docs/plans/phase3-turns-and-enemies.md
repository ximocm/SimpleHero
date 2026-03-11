# Phase 3 Implementation Plan - Turns + Enemies

## Goal
Build the first playable combat slice on top of the current traversal prototype:
- Deterministic heroes phase followed by enemy phase.
- Combat room encounters with seeded enemy spawns.
- Basic enemy AI for Skeleton Sword and Skeleton Archer.
- Per-turn movement/action limits for heroes.
- Combat state persistence and clear room completion flow.

## Current Baseline (Implemented)
- Deterministic dungeon generation with pre-generated rooms and floors.
- 3-hero party with click-to-move A* pathing.
- Active-hero selection and room transition gate through exits.
- Character runtime stats, equipment, and autosave restore.
- Plain TypeScript systems architecture centered on `GameState`.

## Scope Inputs
- `docs/gdd.md`: MVP loop requires clearing rooms in turn-based combat.
- `docs/balance.md`: fixed turn economy and attack resolution order.
- `docs/classes.md`: hero turns use `Final Movement`, `1 Attack Slot`, `2 Action Points`.
- `docs/enemies.md`: MVP enemy roster is locked to Skeleton Sword and Skeleton Archer.
- Phase 2 explicitly left combat, enemy AI, and spellcasting out of scope.

## Phase 3 Scope

### 1. Combat/Encounter State
- Add explicit room encounter state instead of relying on traversal-only room data.
- Introduce room type support for MVP:
  - `combat`
  - `treasure`
  - `exit`
- Only `combat` rooms spawn enemies in this phase.
- A combat room is considered cleared when all spawned enemies are defeated.
- Exit transition remains blocked while the current combat encounter is unresolved.

### 2. Turn System
- Replace freeform movement with explicit turn flow while in combat.
- Use a simple deterministic side-based flow for MVP:
  1. Heroes phase
  2. Enemies phase
- During the heroes phase, the player may switch between living heroes in the current room in any order.
- The enemies phase resolves living enemies in stable spawn order.
- Skip dead units automatically.
- Each hero phase tracks per-hero:
  - `movementRemaining`
  - `attackSlotAvailable`
  - `actionPointsRemaining`
  - temporary turn effects
- End heroes turn hands control to the enemy phase; after the enemy phase finishes, a new heroes phase begins and applies cooldown/effect expiry rules.
- Out of combat, keep current exploration controls unless they directly conflict with the combat loop.

### 3. Hero Combat Actions
- Support the minimum hero actions needed to make MVP combat playable:
  - Move up to `Final Movement`
  - Basic attack
  - End turn
- Movement must be splittable within the same hero turn until `movementRemaining` reaches `0`.
- A basic attack consumes the hero `Attack Slot`.
- Utility AP actions and class skills should be modeled in the turn state now, even if only partially exposed in UI this phase.
- Spell targeting and non-basic utility actions can remain stubbed if the underlying turn economy supports them cleanly.

### 4. Enemy Runtime Model
- Add enemy entity state parallel to hero state, including:
  - `id`
  - `kind`
  - `roomId`
  - `tile`
  - `hp`, `maxHp`
  - `movement`
  - `range`
  - attack/defense stats
  - turn status effects
- Keep enemy definitions data-driven from a central catalog so stats are not duplicated across systems.

### 5. Enemy Spawning
- Spawn enemies deterministically from run seed + room id.
- Restrict combat room compositions to the sets in `docs/enemies.md`.
- Spawn positions must:
  - be on walkable tiles
  - not overlap exits
  - not overlap heroes
  - not overlap other enemies
- Prefer spawn clustering away from the hero entry side so the room opens with movement decisions.

### 6. Enemy AI
- Skeleton Sword:
  - attack nearest hero in melee if possible
  - otherwise move toward nearest hero using pathfinding
- Skeleton Archer:
  - attack the lowest current HP hero within range
  - otherwise move to maintain distance 3-4 from the nearest hero when possible
  - fall back to moving toward a valid firing position if ideal spacing is unavailable
- AI decisions must be deterministic and readable rather than optimal.
- Reuse grid/pathfinding helpers where possible; add occupancy-aware enemy pathing instead of duplicating A* logic.

### 7. Combat Resolution
- Implement the exact attack order from `docs/balance.md`.
- Use seeded RNG for deterministic combat rolls during a run.
- Minimum MVP attack support in this phase:
  - hero basic attack against one enemy
  - enemy basic attack against one hero
- Apply defeat immediately at `hp = 0`.
- Remove defeated enemies from future turn order and board occupancy.
- Mark heroes at `hp = 0` as defeated and unselectable.

### 8. Rewards and Room Completion
- When the last enemy dies:
  - mark the encounter cleared
  - unblock room traversal/exit behavior
- If all heroes die, trigger run loss state instead of normal exploration.
- Treasure/chest reward flow can remain Phase 4; combat itself does not grant rewards.

### 9. Persistence Update
- Extend autosave to persist:
  - room types / encounter state
  - active turn data
  - enemies per room
  - combat RNG state if needed for deterministic restore
- Snapshot restore must sanitize invalid enemy positions/stats the same way heroes are sanitized today.
- Bump save version rather than mutating v2 assumptions in place.

### 10. UX / Rendering
- Show whose turn it is.
- Show movement/attack availability for the active hero.
- Render enemies distinctly from heroes with visible facing optional, not required.
- Indicate valid attack targets and blocked movement during combat.
- Prevent click-to-move commands when it is not a hero turn.
- Keep current canvas/minimap approach; no renderer rewrite in this phase.

## Acceptance Criteria
1. Entering a combat room initializes a deterministic encounter with 1-3 valid enemies.
2. Heroes phase and enemy phase alternate correctly, with enemies acting in stable spawn order.
3. A hero cannot move farther than `Final Movement` during a single turn.
4. A hero cannot use more than one attack action per turn.
5. Enemy AI behaves according to the locked Skeleton Sword / Skeleton Archer rules.
6. Combat damage resolution follows `docs/balance.md` in the exact specified order.
7. Defeated units are removed from occupancy and future turn processing immediately.
8. Room exits cannot be used while enemies remain in the current combat room.
9. Winning combat marks the room cleared and unblocks traversal without granting enemy rewards.
10. Reloading mid-combat restores turn, enemy, and room-clear state without corruption.

## Technical Breakdown

### Data Model
- `src/data/dungeonTypes.ts`
  - Add `RoomType`, `EnemyKind`, `EnemyState`, encounter/turn-state types.
  - Extend `GameState` dependencies to support combat runtime.

### Systems
- `src/systems/dungeonStateSystem.ts`
  - Assign deterministic room types and seed encounter metadata.
- `src/systems/gameSystem.ts`
  - Stop being movement-only orchestration; own top-level phase/combat selectors.
  - Gate room transition on combat-clear state.
- New `src/systems/turnSystem.ts`
  - Own heroes phase, enemy phase, end-turn resets, and cooldown ticks.
- New `src/systems/enemySystem.ts`
  - Enemy creation, spawn placement, AI intent, enemy turn execution.
- New `src/systems/combatSystem.ts`
  - Attack resolution and defeat handling.
- `src/systems/persistenceSystem.ts`
  - Save/restore for encounter, enemy, and turn state.

### Utilities
- `src/utils/pathfinding.ts`
  - Extend with occupancy-aware helpers and reachable-tile queries for movement range.
- `src/utils/seed.ts`
  - Add derived seeds for room type, enemy composition, spawn placement, and combat rolls if needed.

### UI
- `src/main.ts`
  - Split input handling by exploration vs combat state.
  - Render enemies and turn HUD.
  - Expose `End Turn` control and attack targeting feedback.

## Risks
- `GameState` can become overloaded if encounter, traversal, and UI concerns all remain in one file.
- Mid-combat autosave restore will be fragile unless RNG/turn ownership is modeled explicitly.
- Archer positioning logic can become noisy if occupancy and distance heuristics are not kept simple.
- Mixing exploration and combat input in `src/main.ts` may create regressions unless mode checks are centralized.

## Out of Scope for Phase 3
- Full spellbook/spell targeting UX.
- Full utility action set (`help ally`, consumable use, weapon swap polish).
- Bosses, elite enemies, or additional enemy types.
- Meta-progression and end-of-run account gold settlement.
- Renderer/framework migration.

## Milestones
1. **M3.1 Room encounters + data model**
   - Room type assignment, enemy definitions, encounter state, save schema update.
2. **M3.2 Turn engine**
   - Heroes phase, enemy phase, per-turn resources, end-turn progression.
3. **M3.3 Combat resolution**
   - Basic attacks, damage formulas, defeat handling.
4. **M3.4 Enemy AI + spawn rules**
   - Deterministic spawn placement and both skeleton behaviors.
5. **M3.5 UI integration + validation**
   - Turn HUD, attack targeting, exit blocking, autosave verification.
