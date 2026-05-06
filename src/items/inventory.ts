import { ITEM_DEFINITIONS } from './items.js';

export interface InventoryEntry {
  itemId: string;
  name: string;
  file: string;
  category: 'weapon' | 'armor' | 'consumable' | 'spellbook';
}

export function createInventoryEntry(itemId: string): InventoryEntry | null {
  const item = ITEM_DEFINITIONS.find((entry) => entry.id === itemId);
  if (!item) return null;

  return {
    itemId: item.id,
    name: item.name,
    file: item.file,
    category: item.category,
  };
}

/**
 * Creates the shared stash the party starts with at the beginning of a run.
 * @returns Starter inventory entries.
 */
export function createStarterPartyInventory(): InventoryEntry[] {
  const starterSword = createInventoryEntry('two-handed-sword');
  return starterSword ? [starterSword] : [];
}
