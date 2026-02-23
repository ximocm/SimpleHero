import { TileType } from './tileTypes';

export type Direction = 'N' | 'E' | 'S' | 'W';

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
  spawnTiles: Coord[];
}

export interface HeroState {
  id: string;
  classLetter: 'W' | 'R' | 'M';
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
  rooms: Map<string, RoomData>;
  discoveredRoomIds: Set<string>;
  currentRoomId: string;
}

