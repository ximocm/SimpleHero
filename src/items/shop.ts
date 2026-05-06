import { ITEM_DEFINITIONS } from './items.js';

export interface ShopItemEntry {
  itemId: string;
  price: number;
}

const SHOP_PRICES: Record<string, number> = {
  'short-sword': 8,
  'two-handed-sword': 12,
  bow: 10,
  staff: 9,
  'light-armor': 8,
  'heavy-armor': 12,
  shield: 6,
  'health-potion': 5,
  'basic-spellbook': 11,
};

export const SHOP_ITEMS: ShopItemEntry[] = ITEM_DEFINITIONS
  .map((item) => ({
    itemId: item.id,
    price: SHOP_PRICES[item.id] ?? 10,
  }))
  .sort((left, right) => {
    if (left.price !== right.price) return left.price - right.price;
    return left.itemId.localeCompare(right.itemId);
  });

export function getShopPrice(itemId: string): number {
  return SHOP_PRICES[itemId] ?? 10;
}
