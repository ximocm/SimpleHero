import type { CombatRollSnapshot, HeroClassName, HeroRaceName, HeroState } from '../data/dungeonTypes.js';
import type { InventoryEntry } from '../items/inventory.js';

export type AppMode = 'menu' | 'character-creation' | 'game' | 'safe-zone' | 'run-complete';
export type OverlayMode = 'pause-menu' | null;

export type EquipSlot = 'armor' | 'leftHand' | 'rightHand' | 'relic' | 'backpack';

export interface HeroDraft {
  id: string;
  name: string;
  className: HeroClassName;
  raceName: HeroRaceName;
}

export interface CampaignHero {
  id: string;
  name: string;
  className: HeroClassName;
  raceName: HeroRaceName;
  equipment: HeroState['equipment'];
}

export interface CampaignProfile {
  heroes: CampaignHero[];
  stash: InventoryEntry[];
}

export const COMBAT_ROLL_ANIMATION_TOTAL_MS = 4400;

export interface CombatRollAnimationState {
  roll: CombatRollSnapshot;
  attackerLabel: string;
  defenderLabel: string;
  startedAt: number;
  endsAt: number;
}

export type DragPayload =
  | { source: 'inventory'; itemId: string }
  | { source: 'slot'; itemId: string; heroIndex: number; slot: Exclude<EquipSlot, 'backpack'> }
  | { source: 'backpack'; itemId: string; heroIndex: number; backpackIndex: number };
