# GDD - SimpleHero (MVP)

## 0. Document
- Project: SimpleHero
- Document owner: Game Design Team
- Author(s): Ximo
- Contributors: ____________________
- Version: 0.2 (Draft)
- Status: Draft
- Created on: 2026-02-20
- Last updated: 2026-02-23

### Revision History
| Version | Date | Author | Summary of Changes |
|---|---|---|---|
| 0.1 | 2026-02-20 | Ximo | Initial draft + MVP scope updates |
| 0.2 | 2026-02-23 | Ximo | Added spellbook/staff dependency and spell type rules |

## 1. Game Overview
- Pitch: A simple turn-based dungeon crawler for short browser sessions.
- Genre: Turn-based dungeon crawl roguelike.
- Platform: Web (desktop browser).
- Target session: 10-20 minutes per run.
- Player feeling: Tactical choices with clear and simple visuals.
- Core resolution rule: Every gameplay result is determined by a dice throw (`d6` in MVP).
- Run win condition: Reach the exit room with at least one hero alive.
- Run lose condition: All heroes die or player retreats.

## 2. Core Roguelike Loop
- Start run with a 3-hero party.
- Enter a procedurally generated dungeon.
- Clear rooms in turn-based combat.
- Resolve actions with dice throws.
- Collect items and treasure.
- Reach exit or die.
- End run and add collected gold to total account gold.

## 3. MVP Scope (Locked)
- Races: 3 (Human, Elf, Orc).
- Classes: 3 (Warrior, Ranger, Mage).
- Class skills: 1 skill per class.
- Enemies: 2 (Skeleton Sword, Skeleton Archer).
- Items:
- Light Armor
- Heavy Armor
- Short Sword
- Two-Handed Sword
- Bow
- Staff
- Basic Spellbook
- Shield
- Health Potion
- Spells:
- Heal
- Fireball (area)
- Ice (control)
- Treasure:
- Gold
- Ruby (value: 15 gold)
- Room types: 3 (Combat Room, Treasure Room, Exit Room).
- Dungeon generation: enabled (random room layout each run).

## 3.1 Magic Equipment and Spell Types
- Casting requirement:
- The caster must have a `Staff` equipped.
- The caster must also equip a `Spellbook` in the other hand.
- No spell can be cast if either required item is missing.
- Spell type source:
- The equipped spellbook defines the spell type family available to cast.
- Staff and spells must match the spellbook type.
- MVP implementation:
- Only one spellbook exists: `Basic Spellbook`.
- `Basic Spellbook` grants the current 3 spells:
- Heal
- Fireball (area)
- Ice (control)
- For `Basic Spellbook`, all casts are `Magical` type.
- Future extension:
- Additional spellbooks can be added later.
- Each new spellbook can provide different spell sets and cast types.

## 4. Progression and Economy (MVP)
- No level up during runs.
- No progression outside the dungeon.
- No shop for now.
- Only persistent progression: total gold counter.

## 5. Art and Audio
- Art: basic sprites.
- Visual direction: simple and readable, no overload.
- Note: basic sprite style is permanent and accepted as final style for the project.
- Audio: minimal SFX, optional soft background music.

## 6. Technical
- Recommended engine: Phaser 3 + TypeScript.
- Target browsers: latest Chrome and Firefox.
- Target performance: 60 FPS on average laptop.
- Save system (MVP): automatic local autosave of current run state (seed, dungeon progress, party state) to recover from accidental reloads.

## 7. Future
- More races.
- More classes.
- More enemy types.
- More spells and skills per class.
- More room types and dungeon events.
- Level up system during runs.
- Meta progression outside the dungeon.
- Shop and economy expansion.
