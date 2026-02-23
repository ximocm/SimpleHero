export type ArmorId = 'light-armor' | 'heavy-armor' | 'shield';

export interface ArmorDefinition {
  id: ArmorId;
  name: string;
  file: string;
  defenseDiceBonus: number;
  movementModifier: number;
  handsRequired?: 1;
  shield?: boolean;
}

export const ARMOR_DEFINITIONS: Record<ArmorId, ArmorDefinition> = {
  'light-armor': {
    id: 'light-armor',
    name: 'Light Armor',
    file: 'assets/images/items/light-armor.png',
    defenseDiceBonus: 1,
    movementModifier: 0,
  },
  'heavy-armor': {
    id: 'heavy-armor',
    name: 'Heavy Armor',
    file: 'assets/images/items/heavy-armor.png',
    defenseDiceBonus: 2,
    movementModifier: -1,
  },
  shield: {
    id: 'shield',
    name: 'Shield',
    file: 'assets/images/items/shield.png',
    defenseDiceBonus: 1,
    movementModifier: 0,
    handsRequired: 1,
    shield: true,
  },
};
