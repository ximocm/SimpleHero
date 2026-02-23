import type { TileType } from './tileTypes.js';

export type Direction = 'N' | 'E' | 'S' | 'W';
export type HeroClassName = 'Warrior' | 'Ranger' | 'Mage';
export type HeroRaceName = 'Human' | 'Elf' | 'Orc';

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
  discoveredRoomIds: Set<string>;
  currentRoomId: string;
}
