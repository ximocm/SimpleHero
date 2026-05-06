import type { TreasureId } from '../data/dungeonTypes.js';

export interface TreasureDefinition {
  id: TreasureId;
  name: string;
  goldValue: number;
}

export const TREASURE_DEFINITIONS: Record<TreasureId, TreasureDefinition> = {
  gold: {
    id: 'gold',
    name: 'Gold Cache',
    goldValue: 10,
  },
  ruby: {
    id: 'ruby',
    name: 'Ruby',
    goldValue: 15,
  },
};
