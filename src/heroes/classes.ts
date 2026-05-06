import type { HeroClassName } from '../data/dungeonTypes.js';

export type ClassSkillId = 'power-strike' | 'dash' | 'spellcast';

export interface ClassDefinition {
  name: HeroClassName;
  classLetter: 'W' | 'R' | 'M';
  skillId: ClassSkillId;
  skillName: string;
  skillCooldownTurns: number;
}

export const CLASS_DEFINITIONS: Record<HeroClassName, ClassDefinition> = {
  Warrior: {
    name: 'Warrior',
    classLetter: 'W',
    skillId: 'power-strike',
    skillName: 'Power Strike',
    skillCooldownTurns: 2,
  },
  Ranger: {
    name: 'Ranger',
    classLetter: 'R',
    skillId: 'dash',
    skillName: 'Dash',
    skillCooldownTurns: 2,
  },
  Mage: {
    name: 'Mage',
    classLetter: 'M',
    skillId: 'spellcast',
    skillName: 'Spellcast',
    skillCooldownTurns: 0,
  },
};
