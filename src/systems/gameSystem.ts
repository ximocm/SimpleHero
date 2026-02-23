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

export interface HeroPanelView {
  id: string;
  classLetter: 'W' | 'R' | 'M';
  className: string;
  raceName: string;
  hp: number;
  maxHp: number;
  body: number;
  mind: number;
  armor: string | null;
  leftHand: string | null;
  rightHand: string | null;
  relic: string | null;
  backpackCount: number;
  roomId: string;
  floorNumber: number;
  isActive: boolean;
  isReadyAtExit: boolean;
}

/**
 * Creates the full game state from a seed.
 * @param seed Run seed.
 * @returns Initialized game state.
 */
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

/**
 * Gets the currently active room from dungeon state.
 * @param state Game state.
 * @returns Current room data.
 */
export function getCurrentRoom(state: GameState): RoomData {
  const room = state.dungeon.rooms.get(state.dungeon.currentRoomId);
  if (!room) throw new Error('Current room missing');
  return room;
}

/**
 * Sets the active hero index and clears pending paths.
 * @param state Game state to mutate.
 * @param index Hero index to activate.
 * @returns Nothing.
 */
export function setActiveHeroIndex(state: GameState, index: number): void {
  setActiveHero(state.party, index);
  state.hoverPath = [];
  state.movingPath = [];
}

/**
 * Recomputes hover path for active hero to target tile.
 * @param state Game state to mutate.
 * @param target Destination tile.
 * @returns Nothing.
 */
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

/**
 * Commits current hover path as movement path.
 * @param state Game state to mutate.
 * @returns Nothing.
 */
export function commitMoveFromHover(state: GameState): void {
  const hero = getActiveHero(state.party);
  if (state.readyByHeroId.has(hero.id)) return;
  if (state.hoverPath.length < 2) return;
  state.movingPath = [...state.hoverPath];
}

/**
 * Advances active hero by one step in movement path.
 * @param state Game state to mutate.
 * @returns `true` when hero moved this tick, else `false`.
 */
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

/**
 * Checks if a tile is within room bounds and walkable.
 * @param room Room to evaluate.
 * @param coord Coordinate to test.
 * @returns `true` when tile can be walked on.
 */
export function canWalkTile(room: RoomData, coord: Coord): boolean {
  if (!inBounds(coord, room.width, room.height)) return false;
  return isWalkable(room.tiles[coord.y][coord.x]);
}

/**
 * Updates hero facing based on movement direction.
 * @param from Previous tile.
 * @param to Next tile.
 * @param hero Hero object to mutate.
 * @returns Nothing.
 */
function updateFacing(from: Coord, to: Coord, hero: PartyState['heroes'][number]): void {
  if (to.x > from.x) hero.facing = 'E';
  else if (to.x < from.x) hero.facing = 'W';
  else if (to.y > from.y) hero.facing = 'S';
  else if (to.y < from.y) hero.facing = 'N';
}

/**
 * Marks/unmarks hero as ready when standing on an exit.
 * @param state Game state to mutate.
 * @param heroId Hero identifier.
 * @param tile Hero tile coordinate.
 * @returns Nothing.
 */
function refreshExitReady(state: GameState, heroId: string, tile: Coord): void {
  const room = getCurrentRoom(state);
  const direction = findExitDirection(room, tile);
  if (direction) {
    state.readyByHeroId.set(heroId, direction);
  } else {
    state.readyByHeroId.delete(heroId);
  }
}

/**
 * Finds which exit direction a tile belongs to.
 * @param room Room to inspect.
 * @param tile Tile to match.
 * @returns Matching direction, or `null` if tile is not an exit.
 */
function findExitDirection(room: RoomData, tile: Coord): Direction | null {
  const entries = Object.entries(room.exits) as Array<[Direction, Coord | undefined]>;
  for (const [direction, coord] of entries) {
    if (coord && sameCoord(coord, tile)) return direction;
  }
  return null;
}

/**
 * Transitions party to next room when all heroes are ready on same exit.
 * @param state Game state to mutate.
 * @returns Nothing.
 */
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

/**
 * Selects nearest walkable tiles to an origin coordinate.
 * @param room Room to search.
 * @param origin Origin coordinate.
 * @param count Number of tiles to return.
 * @returns Ordered closest walkable coordinates.
 */
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

/**
 * Calculates Manhattan distance between two coordinates.
 * @param a First coordinate.
 * @param b Second coordinate.
 * @returns Manhattan distance.
 */
function manhattanDistance(a: Coord, b: Coord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Checks whether a tile is occupied by another (visible) hero.
 * @param state Game state.
 * @param roomId Room where occupancy is checked.
 * @param coord Tile coordinate to check.
 * @param currentHeroId Hero id that should be ignored.
 * @returns `true` when another hero occupies the tile.
 */
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

/**
 * Returns tile type at coordinate, treating out-of-bounds as void.
 * @param room Room data.
 * @param coord Tile coordinate.
 * @returns Tile type at coordinate.
 */
export function getTileAt(room: RoomData, coord: Coord): TileType {
  if (!inBounds(coord, room.width, room.height)) return TileType.VOID_BLACK;
  return room.tiles[coord.y][coord.x];
}

/**
 * Returns current room id string.
 * @param state Game state.
 * @returns Current room id.
 */
export function getCurrentRoomCoordId(state: GameState): string {
  return roomIdFromCoord(getCurrentRoom(state).coord);
}

/**
 * Returns current floor number within generated dungeon.
 * @param state Game state.
 * @returns Current floor index starting at 1.
 */
export function getCurrentFloorNumber(state: GameState): number {
  return state.dungeon.floorByRoomId.get(state.dungeon.currentRoomId) ?? 1;
}

/**
 * Returns panel-ready hero view data for UI rendering.
 * @param state Game state.
 * @returns Ordered hero view models for panel display.
 */
export function getHeroPanelViews(state: GameState): HeroPanelView[] {
  return state.party.heroes.map((hero, index) => ({
    id: hero.id,
    classLetter: hero.classLetter,
    className: hero.className,
    raceName: hero.raceName,
    hp: hero.hp,
    maxHp: hero.maxHp,
    body: hero.body,
    mind: hero.mind,
    armor: hero.equipment.armor,
    leftHand: hero.equipment.leftHand,
    rightHand: hero.equipment.rightHand,
    relic: hero.equipment.relic,
    backpackCount: hero.equipment.backpack.length,
    roomId: hero.roomId,
    floorNumber: state.dungeon.floorByRoomId.get(hero.roomId) ?? 1,
    isActive: index === state.party.activeHeroIndex,
    isReadyAtExit: state.readyByHeroId.has(hero.id),
  }));
}
