import { Coord, Direction, DungeonState, PartyState, RoomData } from '../data/dungeonTypes';
import { isWalkable, TileType } from '../data/tileTypes';
import {
  moveRoomCoord,
  oppositeDirection,
  roomIdFromCoord,
  sameCoord,
} from '../utils/coord';
import { inBounds } from '../utils/grid';
import { findPathAStar } from '../utils/pathfinding';
import { createDungeonState, getOrCreateRoom } from './dungeonStateSystem';
import { createParty, getActiveHero, setActiveHero } from './partySystem';

export interface GameState {
  dungeon: DungeonState;
  party: PartyState;
  hoverPath: Coord[];
  movingPath: Coord[];
  readyByHeroId: Map<string, Direction>;
}

export function createGameState(seed: number): GameState {
  const dungeon = createDungeonState(seed);
  const room = dungeon.rooms.get(dungeon.currentRoomId);
  if (!room) {
    throw new Error('Initial room missing');
  }

  const party = createParty(room.id, room.spawnTiles);

  return {
    dungeon,
    party,
    hoverPath: [],
    movingPath: [],
    readyByHeroId: new Map(),
  };
}

export function getCurrentRoom(state: GameState): RoomData {
  const room = state.dungeon.rooms.get(state.dungeon.currentRoomId);
  if (!room) throw new Error('Current room missing');
  return room;
}

export function setActiveHeroIndex(state: GameState, index: number): void {
  setActiveHero(state.party, index);
  state.hoverPath = [];
  state.movingPath = [];
}

export function updateHoverPath(state: GameState, target: Coord): void {
  const room = getCurrentRoom(state);
  const hero = getActiveHero(state.party);
  state.hoverPath = findPathAStar(hero.tile, target, (coord) => canWalkTile(room, coord));
}

export function commitMoveFromHover(state: GameState): void {
  if (state.hoverPath.length < 2) return;
  state.movingPath = [...state.hoverPath];
}

export function stepMovement(state: GameState): boolean {
  const hero = getActiveHero(state.party);
  if (state.movingPath.length < 2) return false;

  state.movingPath.shift();
  const next = state.movingPath[0];
  if (!next) return false;

  updateFacing(hero.tile, next, hero);
  hero.tile = { ...next };

  refreshExitReady(state, hero.id, hero.tile);
  maybeTransitionRoom(state);
  return true;
}

export function canWalkTile(room: RoomData, coord: Coord): boolean {
  if (!inBounds(coord, room.width, room.height)) return false;
  return isWalkable(room.tiles[coord.y][coord.x]);
}

function updateFacing(from: Coord, to: Coord, hero: PartyState['heroes'][number]): void {
  if (to.x > from.x) hero.facing = 'E';
  else if (to.x < from.x) hero.facing = 'W';
  else if (to.y > from.y) hero.facing = 'S';
  else if (to.y < from.y) hero.facing = 'N';
}

function refreshExitReady(state: GameState, heroId: string, tile: Coord): void {
  const room = getCurrentRoom(state);
  const direction = findExitDirection(room, tile);
  if (direction) {
    state.readyByHeroId.set(heroId, direction);
  } else {
    state.readyByHeroId.delete(heroId);
  }
}

function findExitDirection(room: RoomData, tile: Coord): Direction | null {
  const entries = Object.entries(room.exits) as Array<[Direction, Coord | undefined]>;
  for (const [direction, coord] of entries) {
    if (coord && sameCoord(coord, tile)) return direction;
  }
  return null;
}

function maybeTransitionRoom(state: GameState): void {
  if (state.readyByHeroId.size !== 3) return;

  const directions = Array.from(state.readyByHeroId.values());
  const direction = directions[0];
  if (!directions.every((d) => d === direction)) return;

  const current = getCurrentRoom(state);
  const nextCoord = moveRoomCoord(current.coord, direction);
  const nextRoom = getOrCreateRoom(state.dungeon, nextCoord);

  state.dungeon.currentRoomId = nextRoom.id;
  state.dungeon.discoveredRoomIds.add(nextRoom.id);

  const opposite = oppositeDirection(direction);
  const entry = nextRoom.exits[opposite] ?? nextRoom.spawnTiles[0];
  const spawnTargets = [entry, ...nextRoom.spawnTiles].slice(0, 3);

  state.party.heroes.forEach((hero, index) => {
    hero.roomId = nextRoom.id;
    hero.tile = { ...spawnTargets[index] };
  });

  state.readyByHeroId.clear();
  state.hoverPath = [];
  state.movingPath = [];
}

export function getTileAt(room: RoomData, coord: Coord): TileType {
  if (!inBounds(coord, room.width, room.height)) return TileType.VOID_BLACK;
  return room.tiles[coord.y][coord.x];
}

export function getCurrentRoomCoordId(state: GameState): string {
  return roomIdFromCoord(getCurrentRoom(state).coord);
}

