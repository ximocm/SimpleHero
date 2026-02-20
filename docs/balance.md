# Balance - Base Doc

## Purpose
Central place for progression, combat numbers, loot rates, and economy values.

## Rules
- Keep formulas simple and easy to read.
- Change one variable at a time when balancing.
- Prioritize fun and clarity over realism.
- Defense is a throw, not a character stat.

## Combat Resolution (MVP)

### 1) Hit Roll by Weapon Attacks
- Roll `1d6` for each `Attack` value of the weapon.
- `1-3` = miss.
- `4-5` = hit.
- `6` = always hit.
- Hit value conversion:
- `1-3` = `0` hits.
- `4-5` = `1` hit.
- `6` = `2` hits.

### 2) Defense Throw
- Defender rolls `1d6` once.
- Defense throw conversion:
- `1-3` = `0` blocked hits.
- `4-5` = `1` blocked hit.
- `6` = `2` blocked hits.
- Add defense bonuses to blocked hits (armor reduction, shield bonus, effects).

### 3) Effective Hits
- `Effective Hits = max(0, Total Attack Hits - Total Blocked Hits)`

### 4) Damage Formula
- If `Effective Hits = 0` -> `Final Damage = 0`.
- If `Effective Hits >= 1`:
- First hit deals full weapon damage.
- Each extra hit adds `+1` damage.
- Formula: `Final Damage = Weapon Damage + (Effective Hits - 1)`.
