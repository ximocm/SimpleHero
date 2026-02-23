# Phase 2 Implementation Plan - Characters + Run UX

## Goal
Build a playable character-focused slice on top of current dungeon traversal:
- Real character panels (left column) with live stats.
- Hero status clarity (active, ready at exit, hidden/returned).
- Better run UX continuity (autosave behavior + visible run state).
- Keep current intentional technical/visual deviations that improved iteration speed.

## Current Baseline (Implemented)
- Seeded room templates and deterministic room selection.
- Finite pre-generated dungeon floors (3-7) with weighted distribution.
- 3-hero movement with A* path preview.
- Transition gate: all 3 heroes must be ready on the same exit direction.
- Minimap + HUD.
- Local autosave restore on reload.

## Intentional Mismatches (Keep for now)
- Finite pre-generated dungeon floors instead of infinite expansion.
- No `SPAWN` tile type; start positions are computed from nearest walkable tiles.
- Full dungeon shown in minimap in development mode (`SHOW_FULL_DUNGEON_MAP = true`).
- `VOID_BLACK` tiles are transparent (not painted black).
- Full run autosave (not only meta-gold).
- Non-Phaser architecture for current implementation speed.

## Why These Choices Stay
- Transparent void tiles look cleaner and prettier than black filler.
- Dynamic start placement is more robust than fixed spawn tiles.
- Full minimap visibility + autosave accelerates testing and balancing.
- Deterministic finite floor sets are easier to debug than open-ended generation.

## Phase 2 Scope

### 1. Character Data Model
- Add per-hero runtime fields needed by UI:
  - `hp`, `maxHp`
  - `className`
  - `raceName`
  - `body`, `mind`
  - `isReadyAtExit` (derived from readiness map)
  - `isActive` (derived from active index)
- Keep existing movement/facing model unchanged.

### 2. Character Panels (Left Column)
- Replace placeholder `char1/char2/char3/char4` blocks with live panels.
- Each panel must display:
  - Hero label (`W`, `R`, `M` + class/race name)
  - HP text and bar
  - Body/Mind values
  - Current room id / floor
  - State badge: `Active`, `Ready`, or `Idle`
- Panel click sets active hero (same as key `1/2/3`).

### 3. Exit/Ready UX
- When hero reaches exit, panel shows `Ready`.
- Hidden hero behavior remains in dungeon canvas while ready.
- If readiness is cleared, panel returns to `Idle`.

### 4. HUD/Map Run Info
- Keep floor and room info in bottom HUD.
- Add run seed text (small) for reproducibility/debug.
- Keep full-map dev mode flag in code for now.

### 5. Persistence Expansion (Same Autosave Strategy)
- Persist any new character fields added in Phase 2.
- Backward-safe restore:
  - Missing fields fallback to defaults.
  - Invalid values clamped/sanitized.

## Acceptance Criteria
1. Left character panels render live data for all 3 heroes.
2. Clicking a panel changes active hero exactly like keyboard shortcuts.
3. Active hero is visually distinct in both panel and dungeon marker.
4. Ready heroes are clearly marked in panel and hidden on dungeon canvas.
5. `Body` and `Mind` are present in hero runtime state and visible in panels.
6. Character panel state survives accidental reload via autosave restore.
7. No two heroes occupy the same tile at any time.
8. Existing movement/path/transition behavior remains functional.
9. Transparent void visuals and dynamic start placement are preserved.

## Technical Breakdown
- `src/data/dungeonTypes.ts`
  - Extend hero state fields for Phase 2 UI/runtime (`body`, `mind`, etc.).
- `src/systems/gameSystem.ts`
  - Add/selectors for panel-friendly hero view model (derived status).
- `src/systems/partySystem.ts`
  - Initialize `body`/`mind` from race/class defaults.
- `src/systems/persistenceSystem.ts`
  - Versioned snapshot update for new hero fields including `body`/`mind`.
- `src/main.ts`
  - Replace static character placeholders with dynamic panel rendering.
  - Add click handlers for panel-based hero selection.
- Optional:
  - `src/ui/characterPanels.ts` to separate panel rendering from `main.ts`.

## Risks
- UI rendering and game state may become too coupled in `main.ts`.
- Autosave schema drift can break old snapshots if not versioned carefully.
- Frequent full-state saves may be unnecessary overhead if payload grows.

## Out of Scope for Phase 2
- Combat resolution and enemy AI.
- Items/equipment logic.
- Spellcasting implementation.
- Meta-economy and account-level progression.
- Phaser migration.

## Milestones
1. **M2.1 Data + selectors**
  - Hero runtime fields + derived panel status.
2. **M2.2 Panel UI**
  - Dynamic panel render + click to activate.
3. **M2.3 Persistence update**
  - Save/restore compatibility for new fields.
4. **M2.4 Polish + validation**
  - Visual pass and acceptance checklist verification.
