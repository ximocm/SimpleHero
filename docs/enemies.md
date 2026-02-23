# Enemies - MVP Spec

## Purpose
Define concrete enemy units for MVP combat, including stats, behavior, rewards, and room appearance rules.

## Design Rules
- Enemy behavior must be deterministic and readable.
- MVP includes only 2 enemy types from the locked scope.
- Enemies must be beatable with basic attacks and one class skill usage.
- AI should prioritize clarity over optimal play.

## Shared Enemy Stat Model
Each enemy uses these fields:
- `Health`: Hit points.
- `Movement`: Tiles enemy can move on its turn.
- `Range`: Attack distance in tiles.
- `Weapon Attacks`: Number of `1d6` attack rolls.
- `Weapon Damage`: Base damage for first effective hit.
- `Defense Dice Bonus`: Extra defense dice added to the base 1 defense die.
- `Gold Reward`: Gold gained when enemy dies.

## Enemy Definitions (MVP)

### Skeleton Sword
- Role: Frontline melee pressure.
- Health: `7`
- Movement: `4`
- Range: `CaC`
- Weapon Attacks: `2`
- Weapon Damage: `2`
- Defense Dice Bonus: `0`
- Gold Reward: `4`
- Target priority:
  1. Nearest hero in melee range.
  2. If no target in range, move toward nearest hero.

### Skeleton Archer
- Role: Backline ranged harassment.
- Health: `5`
- Movement: `4`
- Range: `4`
- Weapon Attacks: `2`
- Weapon Damage: `2`
- Defense Dice Bonus: `0`
- Gold Reward: `5`
- Target priority:
  1. Lowest current HP hero in range.
  2. If no target in range, move to maintain distance of 3-4 tiles from nearest hero.

## Room Appearance Rules (MVP)
- Combat Room contains 1-3 enemies total.
- Allowed compositions:
  - `1x Skeleton Sword`
  - `1x Skeleton Archer`
  - `2x Skeleton Sword`
  - `1x Skeleton Sword + 1x Skeleton Archer`
  - `2x Skeleton Archer`
  - `2x Skeleton Sword + 1x Skeleton Archer`
- No bosses in MVP.

## Rewards and Economy Hooks
- Party gains each defeated enemy `Gold Reward` immediately when combat ends.
- Enemy rewards are additive with treasure room rewards.

## Future
- Add elite variants with one extra behavior rule.
- Add bosses in dedicated rooms after MVP stabilization.
