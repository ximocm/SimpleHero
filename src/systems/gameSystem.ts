import type { Coord, Direction, DungeonState, PartyState, RoomData } from '../data/dungeonTypes.js';
import { isWalkable, TileType } from '../data/tileTypes.js';
import {
  moveRoomCoord,
  oppositeDirection,
  roomIdFromCoord,
  sameCoord,
} from '../utils/coord.js';
import { inBounds } from '../utils/grid.js';
import { findPathAStar } from '../utils/pathfinding.js';
import { createDungeonState, getRoomAt } from './dungeonStateSystem.js';
import { createParty, getActiveHero, setActiveHero } from './partySystem.js';

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

  const center = { x: Math.floor(room.width / 2), y: Math.floor(room.height / 2) };
  const initialStartTiles = getClosestWalkableTiles(room, center, 3);
  const party = createParty(room.id, initialStartTiles);

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
  if (state.readyByHeroId.has(hero.id)) {
    state.hoverPath = [];
    return;
  }
  state.hoverPath = findPathAStar(hero.tile, target, (coord) =>
    canWalkTile(room, coord) && !isTileOccupiedByOtherHero(state, room.id, coord, hero.id),
  );
}

export function commitMoveFromHover(state: GameState): void {
  const hero = getActiveHero(state.party);
  if (state.readyByHeroId.has(hero.id)) return;
  if (state.hoverPath.length < 2) return;
  state.movingPath = [...state.hoverPath];
}

export function stepMovement(state: GameState): boolean {
  const hero = getActiveHero(state.party);
  if (state.readyByHeroId.has(hero.id)) return false;
  if (state.movingPath.length < 2) return false;

  state.movingPath.shift();
  const next = state.movingPath[0];
  if (!next) return false;
  if (isTileOccupiedByOtherHero(state, hero.roomId, next, hero.id)) {
    state.movingPath = [];
    return false;
  }

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
  const nextRoom = getRoomAt(state.dungeon, nextCoord);
  if (!nextRoom) return;

  state.dungeon.currentRoomId = nextRoom.id;
  state.dungeon.discoveredRoomIds.add(nextRoom.id);

  const opposite = oppositeDirection(direction);
  const entry = nextRoom.exits[opposite];
  if (!entry) {
    throw new Error(`Room ${nextRoom.id} is missing entry exit ${opposite}.`);
  }
  const startTiles = getClosestWalkableTiles(nextRoom, entry, 3);

  state.party.heroes.forEach((hero, index) => {
    hero.roomId = nextRoom.id;
    hero.tile = { ...startTiles[index] };
  });

  state.readyByHeroId.clear();
  state.hoverPath = [];
  state.movingPath = [];
}

function getClosestWalkableTiles(room: RoomData, origin: Coord, count: number): Coord[] {
  const walkable: Coord[] = [];

  for (let y = 0; y < room.height; y += 1) {
    for (let x = 0; x < room.width; x += 1) {
      const coord = { x, y };
      if (!canWalkTile(room, coord)) continue;
      walkable.push(coord);
    }
  }

  walkable.sort((a, b) => {
    const da = manhattanDistance(a, origin);
    const db = manhattanDistance(b, origin);
    if (da !== db) return da - db;
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  const selected = walkable.slice(0, count);
  if (selected.length >= count) return selected;

  if (
    selected.length < count &&
    canWalkTile(room, origin) &&
    !selected.some((coord) => sameCoord(coord, origin))
  ) {
    selected.push(origin);
  }

  if (selected.length < count) {
    throw new Error(`Room ${room.id} does not contain enough walkable tiles for party start.`);
  }

  return selected;
}

function manhattanDistance(a: Coord, b: Coord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function isTileOccupiedByOtherHero(
  state: GameState,
  roomId: string,
  coord: Coord,
  currentHeroId: string,
): boolean {
  return state.party.heroes.some(
    (hero) =>
      hero.id !== currentHeroId &&
      !state.readyByHeroId.has(hero.id) &&
      hero.roomId === roomId &&
      hero.tile.x === coord.x &&
      hero.tile.y === coord.y,
  );
}

export function getTileAt(room: RoomData, coord: Coord): TileType {
  if (!inBounds(coord, room.width, room.height)) return TileType.VOID_BLACK;
  return room.tiles[coord.y][coord.x];
}

export function getCurrentRoomCoordId(state: GameState): string {
  return roomIdFromCoord(getCurrentRoom(state).coord);
}

export function getCurrentFloorNumber(state: GameState): number {
  return state.dungeon.floorByRoomId.get(state.dungeon.currentRoomId) ?? 1;
}
