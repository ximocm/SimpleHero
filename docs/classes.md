# Classes - MVP Spec

## Purpose
Define class roles, base skills, and spell behavior with implementation-ready rules.

## Global Class Rules
- MVP has exactly 3 playable classes.
- Each class has 1 active class skill.
- A unit can use at most 1 class skill per turn.
- Mage is the only class that can cast spells in MVP.

## Turn Economy
On a hero turn, a hero has:
- Free movement up to `Final Movement` tiles total.
- `1 Attack Slot`.
- `2 Action Points` for utility actions.

### Movement Rule
- Movement can be split into any number of segments during the turn.
- Total moved tiles cannot exceed `Final Movement`.

### Attack Slot Rule
- A hero can perform at most one basic attack per turn.
- If an effect uses the Attack Slot, a basic attack cannot also be used.

### Action Point Rule
- Each utility action costs `1 Action Point` unless specified otherwise.
- Typical utility actions include changing weapon, using a consumable, and helping an ally.

## Class Definitions (MVP)

### Warrior
- Role: Frontline melee defender.
- Preferred gear: Heavy Armor, Shield, Short Sword, Two-Handed Sword.
- Skill: `Power Strike`
- Type: Utility buff.
- Cost: `1 Action Point`.
- Effect: Add `+3` to final damage of the next basic attack this turn.
- Expiration: Ends at turn end if unused.
- Cooldown: 2 turns.

### Ranger
- Role: Mobile ranged physical damage.
- Preferred gear: Light Armor, Bow.
- Skill: `Dash`
- Type: Utility movement boost.
- Cost: `1 Action Point`.
- Effect: Gain `+2 Final Movement` this turn.
- Restriction: Does not increase attack range.
- Cooldown: 2 turns.

### Mage
- Role: Utility and area control.
- Preferred gear: Light Armor, Staff.
- Skill: `Spellcast`
- Type: Magic attack action.
- Cost: Uses the `Attack Slot`.
- Effect: Cast one spell instead of basic attack.
- Cooldown: 0 turns on `Spellcast` action itself.
- Restriction: Maximum 1 spell cast per turn.

## Spell Rules (Mage only)

### Targeting
- Spells require valid target selection before resolution.
- If no valid target exists, spell cannot be cast.

### Heal
- Target: 1 ally within range `4`.
- Effect: Restore `6 HP`.
- Limit: Cannot exceed target max HP.

### Fireball
- Target: Enemy tile within range `4`.
- Area: Target tile plus orthogonally adjacent tiles.
- Effect: Each enemy in area takes `3` magic damage.
- Friendly fire: Disabled in MVP.

### Ice
- Target: 1 enemy within range `4`.
- Effect: Apply `Rooted` for 1 enemy turn.
- Rooted rule: Target movement becomes `0`, attack still allowed if already in range.

## Cooldown Timing Rule
- A cooldown decreases by `1` at end of owner turn.
- A skill with cooldown `2` becomes available again after two full owner turn ends.

## Future
- Add one additional skill per class after MVP stabilization.
- Revisit Mage monopoly on magic after first balance cycle.
