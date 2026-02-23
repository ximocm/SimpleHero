export type WeaponId =
  | 'short-sword'
  | 'two-handed-sword'
  | 'bow'
  | 'staff';

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  range: number;
  attackDice: number;
  damage: number;
  twoHanded?: boolean;
}

export const WEAPON_DEFINITIONS: Record<WeaponId, WeaponDefinition> = {
  'short-sword': {
    id: 'short-sword',
    name: 'Short Sword',
    range: 1,
    attackDice: 1,
    damage: 3,
  },
  'two-handed-sword': {
    id: 'two-handed-sword',
    name: 'Two-Handed Sword',
    range: 1,
    attackDice: 2,
    damage: 4,
    twoHanded: true,
  },
  bow: {
    id: 'bow',
    name: 'Bow',
    range: 4,
    attackDice: 1,
    damage: 3,
  },
  staff: {
    id: 'staff',
    name: 'Staff',
    range: 4,
    attackDice: 1,
    damage: 2,
  },
};
