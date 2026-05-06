export type WeaponId =
  | 'short-sword'
  | 'two-handed-sword'
  | 'bow'
  | 'staff';

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  file: string;
  handsRequired: 1 | 2;
  castingFocus?: boolean;
  range: number;
  attackDice: number;
  damage: number;
}

export const WEAPON_DEFINITIONS: Record<WeaponId, WeaponDefinition> = {
  'short-sword': {
    id: 'short-sword',
    name: 'Short Sword',
    file: 'assets/images/items/short_sword.png',
    handsRequired: 1,
    range: 1,
    attackDice: 2,
    damage: 2,
  },
  'two-handed-sword': {
    id: 'two-handed-sword',
    name: 'Two-Handed Sword',
    file: 'assets/images/items/two_hand_sword.png',
    handsRequired: 2,
    range: 1,
    attackDice: 1,
    damage: 4,
  },
  bow: {
    id: 'bow',
    name: 'Bow',
    file: 'assets/images/items/bow.png',
    handsRequired: 2,
    range: 4,
    attackDice: 2,
    damage: 2,
  },
  staff: {
    id: 'staff',
    name: 'Staff',
    file: 'assets/images/items/staff.png',
    handsRequired: 1,
    castingFocus: true,
    range: 4,
    attackDice: 1,
    damage: 3,
  },
};
