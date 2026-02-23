# Items - MVP Spec

## Purpose
Define item stats and interaction rules needed to implement MVP combat and utility.

## Global Item Rules
- A hero equips at most 1 weapon and 1 armor.
- Shield is an off-hand item and cannot be equipped with `Two-Handed Sword`.
- Item modifiers are additive unless explicitly stated otherwise.

## Turn Economy Interaction
- Changing equipped weapon costs `1 Action Point`.
- Using a consumable costs `1 Action Point`.
- Equipping or unequipping shield costs `1 Action Point`.

## Weapon Stats (MVP)
Weapons use only `Range`, `Attacks d6`, and `Damage`.

| Weapon | Range | Attacks d6 | Damage | Effect |
|---|---|---:|---:|---|
| Short Sword | CaC | 2 | 2 | - |
| Two-Handed Sword | CaC | 1 | 4 | Two-Handed |
| Bow | 4 | 2 | 2 | - |
| Staff | 4 | 1 | 3 | Channel Magic |

### Weapon Effects
- `Two-Handed`: blocks shield equip.
- `Channel Magic`: required to cast Mage spells.

## Armor Stats (MVP)
Armor grants defense dice bonus and may change movement.

| Armor | Defense Dice Bonus | Flat Damage Reduction | Movement Modifier |
|---|---:|---:|---:|
| Light Armor | 1 | 0 | +1 |
| Heavy Armor | 2 | 0 | 0 |

## Off-Hand Item (MVP)

| Item | Rule |
|---|---|
| Shield | Grants `+1 Defense Dice Bonus`; cannot be used with `Two-Handed Sword` |

## Consumables (MVP)

| Item | Effect |
|---|---|
| Health Potion | Restore `6 HP` to one hero, capped by max HP |

## Derived Stat Rules
- `Final Movement = Base Movement + Armor Movement Modifier + Temporary Effects`.
- `Defense Dice Total = 1 + Armor Defense Dice Bonus + Shield Defense Dice Bonus + Temporary Defense Dice Effects`.
- `Flat Damage Reduction Total = Armor Flat Damage Reduction + Shield Flat Damage Reduction + Temporary Flat Reduction Effects`.
- `Flat Damage Reduction Total` is reserved for future use and is not active in MVP.

## Economy Reference
- Item buy and sell prices are out of scope for MVP.
- Treasure values are defined in [`docs/balance.md`](docs/balance.md).
