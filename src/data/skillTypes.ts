import type { HeroClassName } from './dungeonTypes.js';

export type SkillId = 'power-strike' | 'dash' | 'quick-shot';
export type SkillTargetingMode = 'self' | 'enemy';

export interface SkillDefinition {
  id: SkillId;
  name: string;
  classRestriction: HeroClassName;
  targetingMode: SkillTargetingMode;
  actionPointCost: number;
  consumesAttackSlot: boolean;
  cooldownTurns: number;
  requiredEquipmentTags?: string[];
}
