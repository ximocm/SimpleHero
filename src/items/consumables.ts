export type ConsumableId = 'health-potion';

export interface ConsumableDefinition {
  id: ConsumableId;
  name: string;
  effect: 'heal';
  value: number;
}

export const CONSUMABLE_DEFINITIONS: Record<ConsumableId, ConsumableDefinition> = {
  'health-potion': {
    id: 'health-potion',
    name: 'Health Potion',
    effect: 'heal',
    value: 6,
  },
};
