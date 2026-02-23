import type { Coord, Direction, HeroState, RoomData } from '../data/dungeonTypes.js';
import { createGameState, type GameState } from './gameSystem.js';
import { inBounds } from '../utils/grid.js';
import { isWalkable, TileType } from '../data/tileTypes.js';

const SAVE_KEY = 'simplehero.autosave.v1';
const HERO_COUNT = 3;

interface PersistedGameStateV1 {
  version: 1;
  savedAt: number;
  dungeon: {
    seed: number;
    totalFloors: number;
    currentRoomId: string;
    discoveredRoomIds: string[];
    floorByRoomId: Array<[string, number]>;
    rooms: RoomData[];
  };
  party: {
    activeHeroIndex: number;
    heroes: HeroState[];
  };
}

/**
 * Loads and restores game state from localStorage, if available and valid.
 * @returns Restored game state, or `null` when no valid autosave exists.
 */
export function loadPersistedGameState(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;

  try {
    const data = JSON.parse(raw) as PersistedGameStateV1;
    if (data.version !== 1) return null;
    return restoreFromSnapshot(data);
  } catch {
    return null;
  }
}

/**
 * Persists current game state to localStorage.
 * @param state Game state to persist.
 * @returns Nothing.
 */
export function persistGameState(state: GameState): void {
  const snapshot: PersistedGameStateV1 = {
    version: 1,
    savedAt: Date.now(),
    dungeon: {
      seed: state.dungeon.seed,
      totalFloors: state.dungeon.totalFloors,
      currentRoomId: state.dungeon.currentRoomId,
      discoveredRoomIds: Array.from(state.dungeon.discoveredRoomIds),
      floorByRoomId: Array.from(state.dungeon.floorByRoomId.entries()),
      rooms: Array.from(state.dungeon.rooms.values()),
    },
    party: {
      activeHeroIndex: state.party.activeHeroIndex,
      heroes: state.party.heroes.map((hero) => ({ ...hero, tile: { ...hero.tile } })),
    },
  };

  localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
}

/**
 * Clears persisted autosave from localStorage.
 * @returns Nothing.
 */
export function clearPersistedGameState(): void {
  localStorage.removeItem(SAVE_KEY);
}

function restoreFromSnapshot(snapshot: PersistedGameStateV1): GameState | null {
  if (!Number.isFinite(snapshot.dungeon.seed)) return null;
  if (!Array.isArray(snapshot.dungeon.rooms)) return null;
  if (!Array.isArray(snapshot.party.heroes)) return null;

  const fallback = createGameState(snapshot.dungeon.seed);
  const state = fallback;
  const discoveredRoomIds = Array.isArray(snapshot.dungeon.discoveredRoomIds)
    ? snapshot.dungeon.discoveredRoomIds
    : [];
  const floorByRoomId = Array.isArray(snapshot.dungeon.floorByRoomId)
    ? snapshot.dungeon.floorByRoomId
    : [];

  const rooms = new Map<string, RoomData>(
    snapshot.dungeon.rooms
      .filter((room) => typeof room.id === 'string' && room.id.length > 0)
      .map((room) => [room.id, room]),
  );
  if (rooms.size === 0) return null;

  state.dungeon.rooms = rooms;
  state.dungeon.totalFloors = Math.max(1, snapshot.dungeon.totalFloors | 0);
  state.dungeon.floorByRoomId = new Map(
    floorByRoomId.filter(([roomId, floor]) => rooms.has(roomId) && floor > 0),
  );

  const currentRoomId = rooms.has(snapshot.dungeon.currentRoomId)
    ? snapshot.dungeon.currentRoomId
    : rooms.keys().next().value;
  if (!currentRoomId) return null;
  state.dungeon.currentRoomId = currentRoomId;

  const discovered = new Set(discoveredRoomIds.filter((roomId) => rooms.has(roomId)));
  discovered.add(currentRoomId);
  state.dungeon.discoveredRoomIds = discovered;

  const restoredHeroes = snapshot.party.heroes.slice(0, HERO_COUNT).map((hero, index) => {
    const base = fallback.party.heroes[index];
    const safeRoomId = rooms.has(hero.roomId) ? hero.roomId : currentRoomId;
    const safeTile = sanitizeHeroTile(hero.tile, rooms.get(safeRoomId), base.tile);

    return {
      ...base,
      id: hero.id,
      classLetter: hero.classLetter,
      roomId: safeRoomId,
      tile: safeTile,
      facing: hero.facing as Direction,
    };
  });

  while (restoredHeroes.length < HERO_COUNT) {
    const fallbackHero = fallback.party.heroes[restoredHeroes.length];
    restoredHeroes.push({
      ...fallbackHero,
      tile: { ...fallbackHero.tile },
    });
  }

  state.party.heroes = restoredHeroes;
  state.party.activeHeroIndex = clamp(snapshot.party.activeHeroIndex, 0, HERO_COUNT - 1);
  state.hoverPath = [];
  state.movingPath = [];
  state.readyByHeroId = new Map();

  return state;
}

function sanitizeHeroTile(tile: Coord, room: RoomData | undefined, fallback: Coord): Coord {
  if (!room) return { ...fallback };
  if (!tile || !Number.isFinite(tile.x) || !Number.isFinite(tile.y)) return { ...fallback };
  if (!inBounds(tile, room.width, room.height)) return { ...fallback };
  if (!isWalkable(room.tiles[tile.y][tile.x] as TileType)) return { ...fallback };
  return { ...tile };
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}
