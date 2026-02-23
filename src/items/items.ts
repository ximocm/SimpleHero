import { ARMOR_DEFINITIONS, type ArmorDefinition } from './armors.js';
import { CONSUMABLE_DEFINITIONS, type ConsumableDefinition } from './consumables.js';
import { WEAPON_DEFINITIONS, type WeaponDefinition } from './weapons.js';

export type ItemCategory = 'weapon' | 'armor' | 'consumable';

export type ItemDefinition =
  | (WeaponDefinition & { category: 'weapon' })
  | (ArmorDefinition & { category: 'armor' })
  | (ConsumableDefinition & { category: 'consumable' });

export const ITEM_DEFINITIONS: ItemDefinition[] = [
  ...Object.values(WEAPON_DEFINITIONS).map((item) => ({ ...item, category: 'weapon' as const })),
  ...Object.values(ARMOR_DEFINITIONS).map((item) => ({ ...item, category: 'armor' as const })),
  ...Object.values(CONSUMABLE_DEFINITIONS).map((item) => ({
    ...item,
    category: 'consumable' as const,
  })),
];
