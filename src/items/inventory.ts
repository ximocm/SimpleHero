import { ITEM_DEFINITIONS } from './items.js';

export interface InventoryEntry {
  itemId: string;
  name: string;
  file: string;
  category: 'weapon' | 'armor' | 'consumable';
}

/**
 * Creates a default party inventory with one of each known item.
 * @returns Starter inventory entries.
 */
export function createStarterPartyInventory(): InventoryEntry[] {
  return ITEM_DEFINITIONS.map((item) => ({
    itemId: item.id,
    name: item.name,
    file: item.file,
    category: item.category,
  }));
}
