import type { TileType } from './tileTypes.js';

export type Direction = 'N' | 'E' | 'S' | 'W';
export type HeroClassName = 'Warrior' | 'Ranger' | 'Mage';
export type HeroRaceName = 'Human' | 'Elf' | 'Orc';
export type RoomType = 'combat' | 'treasure' | 'exit';
export type EnemyKind = 'skeleton-sword' | 'skeleton-archer';
export type TurnUnitKind = 'hero' | 'enemy';
export type CombatPhase = 'heroes' | 'enemies';

export interface Coord {
  x: number;
  y: number;
}

export interface RoomCoord {
  x: number;
  y: number;
}

export interface RoomData {
  id: string;
  coord: RoomCoord;
  width: number;
  height: number;
  tiles: TileType[][];
  exits: Partial<Record<Direction, Coord>>;
  roomType: RoomType;
  encounter: RoomEncounterState | null;
}

export interface RoomEncounterState {
  enemyIds: string[];
  isCleared: boolean;
}

export interface EnemyTurnStatusEffects {
  rootedTurns: number;
}

export interface EnemyState {
  id: string;
  kind: EnemyKind;
  roomId: string;
  tile: Coord;
  hp: number;
  maxHp: number;
  movement: number;
  range: number;
  attackDice: number;
  damage: number;
  defenseDiceBonus: number;
  statusEffects: EnemyTurnStatusEffects;
}

export interface HeroTurnResources {
  movementRemaining: number;
  actionPointsRemaining: number;
  attackSlotAvailable: boolean;
}

export interface TurnUnitRef {
  kind: TurnUnitKind;
  id: string;
}

export interface CombatTurnState {
  roomId: string;
  round: number;
  phase: CombatPhase;
  heroResourcesById: Record<string, HeroTurnResources>;
  enemyQueue: string[];
  activeEnemyIndex: number;
}

export interface CombatRollSnapshot {
  attackerId: string;
  defenderId: string;
  attackRolls: number[];
  attackHits: number[];
  defenseRolls: number[];
  blockedHits: number[];
  totalAttackHits: number;
  totalBlockedHits: number;
  effectiveHits: number;
  finalDamage: number;
}

export interface HeroState {
  id: string;
  classLetter: 'W' | 'R' | 'M';
  className: HeroClassName;
  raceName: HeroRaceName;
  hp: number;
  maxHp: number;
  body: number;
  mind: number;
  equipment: {
    armor: string | null;
    leftHand: string | null;
    rightHand: string | null;
    relic: string | null;
    backpack: string[];
  };
  roomId: string;
  tile: Coord;
  facing: Direction;
}

export interface PartyState {
  heroes: HeroState[];
  activeHeroIndex: number;
}

export interface DungeonState {
  seed: number;
  totalFloors: number;
  floorByRoomId: Map<string, number>;
  rooms: Map<string, RoomData>;
  enemiesByRoomId: Map<string, EnemyState[]>;
  discoveredRoomIds: Set<string>;
  currentRoomId: string;
}
