import type { HeroRaceName } from '../data/dungeonTypes.js';

export interface RaceDefinition {
  name: HeroRaceName;
  maxHp: number;
  body: number;
  mind: number;
}

export const RACE_DEFINITIONS: Record<HeroRaceName, RaceDefinition> = {
  Human: {
    name: 'Human',
    maxHp: 10,
    body: 3,
    mind: 3,
  },
  Elf: {
    name: 'Elf',
    maxHp: 8,
    body: 2,
    mind: 4,
  },
  Orc: {
    name: 'Orc',
    maxHp: 12,
    body: 4,
    mind: 2,
  },
};
