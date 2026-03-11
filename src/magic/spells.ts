export type SpellId = 'heal' | 'fireball' | 'ice';

export interface SpellDefinition {
  id: SpellId;
  name: string;
  range: number;
  targeting: 'ally' | 'enemy' | 'enemy-area';
  usesAttackSlot: true;
  healAmount?: number;
  damage?: number;
  rootedTurns?: number;
}

export const SPELL_DEFINITIONS: Record<SpellId, SpellDefinition> = {
  heal: {
    id: 'heal',
    name: 'Heal',
    range: 4,
    targeting: 'ally',
    usesAttackSlot: true,
    healAmount: 6,
  },
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    range: 4,
    targeting: 'enemy-area',
    usesAttackSlot: true,
    damage: 3,
  },
  ice: {
    id: 'ice',
    name: 'Ice',
    range: 4,
    targeting: 'enemy',
    usesAttackSlot: true,
    rootedTurns: 1,
  },
};
