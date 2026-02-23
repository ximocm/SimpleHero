export type ArmorId = 'light-armor' | 'heavy-armor' | 'shield';

export interface ArmorDefinition {
  id: ArmorId;
  name: string;
  defenseDiceBonus: number;
  movementModifier: number;
  shield?: boolean;
}

export const ARMOR_DEFINITIONS: Record<ArmorId, ArmorDefinition> = {
  'light-armor': {
    id: 'light-armor',
    name: 'Light Armor',
    defenseDiceBonus: 1,
    movementModifier: 0,
  },
  'heavy-armor': {
    id: 'heavy-armor',
    name: 'Heavy Armor',
    defenseDiceBonus: 2,
    movementModifier: -1,
  },
  shield: {
    id: 'shield',
    name: 'Shield',
    defenseDiceBonus: 1,
    movementModifier: 0,
    shield: true,
  },
};
