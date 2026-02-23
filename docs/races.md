# Races - MVP Spec

## Purpose
Define race identity with light stat differences that do not override class role.

## Race Design Rules
- MVP includes exactly 3 races: Human, Elf, Orc.
- Race impact must remain lower than class impact.
- No race passive abilities in MVP.
- No race should be mandatory for any class.

## Stat Model (MVP)
Races define these base stats:
- `Health`
- `Base Movement`
- `Body`
- `Mind`

## Race Table

| Race | Health | Base Movement | Body | Mind |
|---|---:|---:|---:|---:|
| Human | 10 | 5 | 3 | 3 |
| Elf | 8 | 6 | 2 | 4 |
| Orc | 12 | 4 | 4 | 2 |

## Movement Clarification
- There is no universal race bonus of `+2 Movement` in MVP.
- Final movement is calculated from base movement plus item and temporary modifiers.
- Movement modifiers are defined in [`docs/items.md`](docs/items.md).

## Attribute Usage Guidance
- `Body` and `Mind` are reserved for future mechanics.
- MVP combat formulas do not use `Body` or `Mind` directly.

## Future
- Add one passive per race after MVP stabilization.
- Keep future passives small and readable.
