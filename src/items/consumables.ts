export type ConsumableId = 'health-potion';

export interface ConsumableDefinition {
  id: ConsumableId;
  name: string;
  file: string;
  effect: 'heal';
  value: number;
}

export const CONSUMABLE_DEFINITIONS: Record<ConsumableId, ConsumableDefinition> = {
  'health-potion': {
    id: 'health-potion',
    name: 'Health Potion',
    file: 'assets/images/items/health-potion.svg',
    effect: 'heal',
    value: 6,
  },
};
