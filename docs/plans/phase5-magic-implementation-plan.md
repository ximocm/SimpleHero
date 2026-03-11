# Phase 5 Implementation Plan - Magic + Spellcasting

## Goal
Add the first playable magic system for the Mage:
- three MVP spells
- one-handed staff or other casting focus in one hand
- spellbook in the other hand
- `cast` action in combat
- small spell picker anchored to the cast action

## Phase 4 Gate
- Turn-based combat, basic attacks, enemy AI, save/load, and run-end states already exist.
- Menu and run resume flow already exist.
- Equipment drag/drop and hand slots already exist.

## Locked Design Rules
- Mage is the only class that can cast spells in MVP.
- A Mage must have:
  - a `Spellbook` in one hand
  - a `Staff` or another item with `castingFocus: true` in the other hand
- Staff is now one-handed for this phase.
- Spell list comes from the equipped spellbook.
- In MVP there is only one spellbook:
  - `Basic Spellbook`
- `Basic Spellbook` grants:
  - `Heal`
  - `Fireball`
  - `Ice`
- Casting uses the Mage `Attack Slot`.
- Maximum 1 spell cast per turn.

## Scope Inputs
- `docs/gdd.md`: spellbook + staff dependency already exists conceptually.
- `docs/classes.md`: `Spellcast` uses the Attack Slot and Mage is the only caster.
- User clarification for Phase 5 overrides current runtime assumptions:
  - staff must be one-handed
  - cast action opens a spell menu
  - focus requirement should be generic, not hardcoded only to staff

## Phase 5 Scope

### 1. Item/Data Model Update
- Add explicit spellbook item support.
- Extend weapon/item definitions with a magic capability field:
  - recommended: `castingFocus: boolean`
- Set `staff` to:
  - one-handed
  - `castingFocus: true`
- Allow future non-staff focuses without redesigning the cast checks.
- Add `Basic Spellbook` item definition and asset reference.

### 2. Spell Catalog
- Add a central spell definition catalog for MVP.
- Each spell definition should include:
  - `id`
  - `name`
  - `sourceSpellbook`
  - `range`
  - targeting mode
  - effect payload
  - whether it consumes the attack slot
- Keep spell data out of UI code.

### 3. Mage Casting Eligibility
- A hero can enter cast mode only if all of these are true:
  - hero class is `Mage`
  - hero is in the heroes phase
  - hero still has Attack Slot available
  - hero has a spellbook equipped
  - hero has a casting focus equipped in the other hand
- If either hand requirement fails, `cast` is disabled.

### 4. Cast Action UX
- Add a `cast` button beside the existing combat actions.
- Clicking `cast` opens a small menu above or near that button.
- The menu lists the spells granted by the equipped spellbook.
- Selecting a spell enters spell-targeting mode.
- Clicking `cast` again or changing actions cancels cast mode.
- The menu should be compact and not replace the whole screen.

### 5. Spell Targeting Flow
- `Heal`
  - target 1 ally within range `4`
- `Fireball`
  - target 1 enemy tile within range `4`
  - affect target tile plus orthogonally adjacent tiles
  - friendly fire disabled
- `Ice`
  - target 1 enemy within range `4`
- UI should clearly distinguish:
  - spell-selection mode
  - spell-targeting mode
- Invalid targets should not consume the spell.

### 6. Spell Resolution
- `Heal`
  - restore `6 HP`
  - cannot exceed target max HP
- `Fireball`
  - deal flat `3` magic damage to each enemy in area
  - does not use weapon damage or attack dice
- `Ice`
  - apply `Rooted` for `1` enemy turn
- Casting consumes the Attack Slot after successful resolution.
- Spell resolution must update combat log and save state.

### 7. Runtime State
- Add spell-selection / cast-mode UI state to `GameState`.
- Keep selected spell id separate from basic attack mode.
- Persist spell mode safely if mid-turn autosave happens.
- Reuse existing status-effect state for `Rooted` where possible.

### 8. Equipment Interaction Rules
- Spellbook occupies one hand slot.
- Casting focus occupies the other hand slot.
- Shield cannot coexist with the required book+focus combo if both hands are needed.
- Existing hand-equip logic must support:
  - one-handed staff + book
  - future one-handed focus + book
- Tooltip/UI should make the casting requirement visible.

### 9. Combat UI Feedback
- Show current spellbook or `no spellbook`.
- Show current focus or `no focus`.
- When cast mode is active, show selected spell in the status line.
- Valid spell targets should highlight distinctly from basic attack targets.

## Acceptance Criteria
1. `staff` is one-handed and can be equipped alongside a spellbook.
2. Mage only gets `cast` when a spellbook and casting focus are equipped correctly.
3. Clicking `cast` opens a compact spell menu instead of casting immediately.
4. `Basic Spellbook` exposes exactly `Heal`, `Fireball`, and `Ice`.
5. `Heal` restores HP to one ally within range `4`.
6. `Fireball` deals `3` damage to enemies in the target-plus-orthogonal area.
7. `Ice` applies `Rooted` for `1` enemy turn.
8. Casting consumes the Mage Attack Slot and prevents another spell/basic attack that turn.
9. Spell targeting, resolution, and effects survive autosave/reload cleanly.
10. Non-Mage heroes cannot use the cast system even if they equip the items.

## Technical Breakdown

### Data
- `src/items/weapons.ts`
  - add `castingFocus`
  - make `staff` one-handed
- new `src/items/spellbooks.ts`
  - define `Basic Spellbook`
- new `src/magic/spells.ts`
  - central spell catalog

### Systems
- `src/systems/gameSystem.ts`
  - add cast mode selectors and spell targeting flow
- `src/systems/combatSystem.ts`
  - add spell resolution helpers
- `src/systems/turnSystem.ts`
  - keep spell use tied to Attack Slot
- `src/systems/persistenceSystem.ts`
  - save/restore cast-mode state safely

### UI
- `src/main.ts`
  - add `cast` button and anchored spell menu
  - add spell targeting feedback
- `src/ui/sidebarViews.ts`
  - show spellbook/focus info on hero panels if useful

## Risks
- Mixing spell selection and attack targeting can make input state brittle if they are not modeled separately.
- Hand-slot rules will get inconsistent quickly if spellbooks are bolted onto the current weapon-only assumptions.
- `Fireball` area targeting can create visual ambiguity if target tiles are not rendered clearly.

## Out of Scope for Phase 5
- Additional spellbooks.
- Mana resource system.
- Spell cooldowns beyond the Attack Slot restriction.
- Non-Mage magic classes.
- Persistent spell progression.

## Milestones
1. **M5.1 Item model + spellbook data**
   - Add spellbook items, one-handed staff, casting focus flag.
2. **M5.2 Cast action state**
   - Add cast button, spell menu, selected-spell runtime state.
3. **M5.3 Spell resolution**
   - Implement Heal, Fireball, and Ice.
4. **M5.4 Persistence + polish**
   - Restore spell state safely and add combat/status feedback.
