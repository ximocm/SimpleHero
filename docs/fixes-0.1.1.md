# Fixes 0.1.1 - Playtest Feedback

## Goal
Convert the first external playtest feedback into small, independent issues for version `0.1.1`.

The focus of this patch should be usability and fairness:
- make turn state obvious
- reduce repeated clicks for common combat actions
- clarify dice, resources, and action costs
- fix timing problems in combat feedback
- remove unfair or confusing room-entry behavior

## Feedback Summary
- It is not clear which hero has already used their turn.
- `Skip Turn` looks like it might only apply to the selected champion.
- Requiring every hero to stand on the door tile feels awkward.
- Heroes stacking on the door is unfair, especially when the stack order is reversed.
- Damage appears on tokens before dice animations finish.
- `Dash` looks like it does nothing.
- Dice behavior is hard to understand.
- It is not clear whether the basic attack has already been spent.
- Team HP should be more visible from the board.
- Clicking an enemy should probably perform a basic attack by default.
- Combat needs keyboard bindings for common actions.
- It is unclear whether the caster has mana.

## Issue Checklist

### Turn State and Action Economy
- [x] Show each hero's turn status directly in the board/HUD.
  - Display at least: active hero, already acted heroes, and heroes still available this round.
  - Avoid relying only on the selected hero highlight.
- [x] Rename or restyle `Skip Turn` so its scope is unambiguous.
  - Decide whether it ends only the selected hero activation or the whole player phase.
  - Button label and disabled states must match that rule.
- [x] Show whether the selected hero has spent their basic attack.
  - Add a visible attack-slot indicator near AP/turn controls.
  - Make spent/unspent state readable without opening any extra panel.
- [ ] Add keyboard bindings for core combat actions.
  - Minimum: basic attack, class skill, skip/end activation, cancel selection.
  - Show bindings in button tooltips or compact labels.

### Default Combat Interaction
- [x] Make enemy click perform basic attack by default when valid.
  - If the selected hero can basic attack the clicked enemy, execute it without requiring the `Basic Attack` button first.
  - If the attack is invalid, show the existing reason/disabled state instead of silently doing nothing.
- [x] Keep explicit `Basic Attack` action available for clarity.
  - The button should still exist as a discoverable command and for keyboard focus.

### Dice Readability and Combat Timing
- [ ] Explain dice rolls in the combat UI.
  - Show attack dice, defense/mitigation dice if any, modifiers, and final damage in a compact combat log line.
  - Use consistent terms from `docs/balance.md`.
- [ ] Delay HP/token damage updates until dice animation resolves.
  - Dice animation, roll result, damage application, and token feedback should happen in that order.
  - Avoid showing final damage before the player sees why it happened.
- [ ] Add a short final-result state after dice resolve.
  - The player should have enough time to connect roll result with HP loss before the next automatic step.

### Board Visibility
- [x] Put team HP closer to the board.
  - Add compact HP pips/bars near hero tokens, the board edge, or the active combat HUD.
  - The player should not need to scan the sidebar to know team health during combat.
- [x] Make per-token damage and current HP readable without cluttering the board.
  - Prefer compact overlays that are stable during movement and dice animations.

### Door and Room Entry Fairness
- [ ] Remove the requirement that every hero must stand on the door tile.
  - Replace it with a clearer room-transition rule, such as party-ready confirmation, adjacency, or reaching the doorway with one hero.
- [ ] Prevent unfair stacking on the door.
  - Preserve party order or place heroes into valid entry tiles deterministically.
  - Never reverse order accidentally when entering a room.
- [ ] Add entry placement rules for blocked or occupied tiles.
  - Use nearest valid tile search when preferred entry positions are unavailable.
  - Make failures explicit if no valid placement exists.

### Class Skill Clarity
- [ ] Make `Dash` visibly change movement state.
  - Show the gained movement immediately in the selected hero HUD.
  - Add temporary board feedback or a movement-range refresh after activation.
- [ ] Add a clear cooldown/used state for `Dash`.
  - The player should know whether it failed, is unavailable, or has already been applied.

### Mage Resource Clarity
- [ ] Decide whether Mage uses mana in `0.1.1`.
  - If no mana exists, remove any implication of mana and describe spell limits through AP/attack slot/cooldown.
  - If mana exists, show current/max mana near the Mage's HP and action controls.
- [ ] Align spell UI labels with the chosen resource model.
  - Avoid mixing `mana`, `spellcast`, `attack slot`, and `cooldown` language unless each has an explicit visible state.

## Suggested Priority
1. Turn/action clarity: turn status, skip scope, basic attack spent state.
2. Combat default interaction: click enemy to basic attack, keyboard bindings.
3. Dice readability and delayed damage application.
4. Door transition and anti-stacking rules.
5. Board-adjacent team HP.
6. Dash and Mage resource clarity.

## Acceptance Criteria
- A new player can identify whose turn it is, who has already acted, and whether the selected hero can still basic attack.
- Clicking a valid enemy with a selected hero performs the expected default attack.
- Damage is not reflected on tokens or HP UI before dice resolution finishes.
- Room entry no longer requires every hero to occupy the door tile and does not reverse-stack the party.
- `Dash` gives immediate visible feedback when activated.
- Mage resource limits are visible and consistently named, or mana references are removed.
