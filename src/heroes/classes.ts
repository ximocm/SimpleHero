import type { HeroClassName } from '../data/dungeonTypes.js';

export interface ClassDefinition {
  name: HeroClassName;
  classLetter: 'W' | 'R' | 'M';
}

export const CLASS_DEFINITIONS: Record<HeroClassName, ClassDefinition> = {
  Warrior: {
    name: 'Warrior',
    classLetter: 'W',
  },
  Ranger: {
    name: 'Ranger',
    classLetter: 'R',
  },
  Mage: {
    name: 'Mage',
    classLetter: 'M',
  },
};
