import type { SkillDefinition, SkillId } from '../data/skillTypes.js';

export const SKILL_DEFINITIONS: Record<SkillId, SkillDefinition> = {
  'power-strike': {
    id: 'power-strike',
    name: 'Power Strike',
    classRestriction: 'Warrior',
    targetingMode: 'self',
    actionPointCost: 1,
    consumesAttackSlot: false,
    cooldownTurns: 2,
    requiredEquipmentTags: ['melee-weapon'],
  },
  dash: {
    id: 'dash',
    name: 'Dash',
    classRestriction: 'Ranger',
    targetingMode: 'self',
    actionPointCost: 1,
    consumesAttackSlot: false,
    cooldownTurns: 2,
  },
  'quick-shot': {
    id: 'quick-shot',
    name: 'Quick Shot',
    classRestriction: 'Ranger',
    targetingMode: 'enemy',
    actionPointCost: 1,
    consumesAttackSlot: true,
    cooldownTurns: 1,
    requiredEquipmentTags: ['bow'],
  },
};
