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
  range: number;
  attackDice: number;
  damage: number;
}

export const WEAPON_DEFINITIONS: Record<WeaponId, WeaponDefinition> = {
  'short-sword': {
    id: 'short-sword',
    name: 'Short Sword',
    file: 'assets/images/items/short-sword.svg',
    handsRequired: 1,
    range: 1,
    attackDice: 1,
    damage: 3,
  },
  'two-handed-sword': {
    id: 'two-handed-sword',
    name: 'Two-Handed Sword',
    file: 'assets/images/items/two-handed-sword.svg',
    handsRequired: 2,
    range: 1,
    attackDice: 2,
    damage: 4,
  },
  bow: {
    id: 'bow',
    name: 'Bow',
    file: 'assets/images/items/bow.svg',
    handsRequired: 2,
    range: 4,
    attackDice: 1,
    damage: 3,
  },
  staff: {
    id: 'staff',
    name: 'Staff',
    file: 'assets/images/items/staff.svg',
    handsRequired: 2,
    range: 4,
    attackDice: 1,
    damage: 2,
  },
};
