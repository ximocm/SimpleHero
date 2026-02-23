import type {
  Coord,
  Direction,
  HeroClassName,
  HeroRaceName,
  HeroState,
  RoomData,
} from '../data/dungeonTypes.js';
import type { InventoryEntry } from '../items/inventory.js';
import { ITEM_DEFINITIONS } from '../items/items.js';
import { createGameState, type GameState } from './gameSystem.js';
import { inBounds } from '../utils/grid.js';
import { isWalkable, TileType } from '../data/tileTypes.js';

const SAVE_KEY = 'simplehero.autosave.v1';
const INVENTORY_SAVE_KEY = 'simplehero.inventory.v1';
const HERO_COUNT = 3;

interface PersistedDungeonState {
  seed: number;
  totalFloors: number;
  currentRoomId: string;
  discoveredRoomIds: string[];
  floorByRoomId: Array<[string, number]>;
  rooms: RoomData[];
}

interface PersistedHeroV1 {
  id: string;
  classLetter: 'W' | 'R' | 'M';
  roomId: string;
  tile: Coord;
  facing: Direction;
}

interface PersistedPartyStateV1 {
  activeHeroIndex: number;
  heroes: PersistedHeroV1[];
}

interface PersistedPartyStateV2 {
  activeHeroIndex: number;
  heroes: HeroState[];
}

interface PersistedGameStateV1 {
  version: 1;
  savedAt: number;
  dungeon: PersistedDungeonState;
  party: PersistedPartyStateV1;
}

interface PersistedGameStateV2 {
  version: 2;
  savedAt: number;
  dungeon: PersistedDungeonState;
  party: PersistedPartyStateV2;
}

type PersistedSnapshot = PersistedGameStateV1 | PersistedGameStateV2;

/**
 * Loads and restores game state from localStorage, if available and valid.
 * @returns Restored game state, or `null` when no valid autosave exists.
 */
export function loadPersistedGameState(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;

  try {
    const data = JSON.parse(raw) as PersistedSnapshot;
    if (data.version !== 1 && data.version !== 2) return null;
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
  const snapshot: PersistedGameStateV2 = {
    version: 2,
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

/**
 * Loads party inventory entries from localStorage.
 * @returns Restored inventory entries, or `null` when none/invalid.
 */
export function loadPersistedPartyInventory(): InventoryEntry[] | null {
  const raw = localStorage.getItem(INVENTORY_SAVE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return sanitizeInventory(parsed);
  } catch {
    return null;
  }
}

/**
 * Persists current party inventory to localStorage.
 * @param inventory Inventory entries to persist.
 * @returns Nothing.
 */
export function persistPartyInventory(inventory: readonly InventoryEntry[]): void {
  localStorage.setItem(INVENTORY_SAVE_KEY, JSON.stringify(inventory));
}

function restoreFromSnapshot(snapshot: PersistedSnapshot): GameState | null {
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
    const maybeHero = hero as Partial<HeroState>;
    const base = fallback.party.heroes[index];
    const safeRoomId = rooms.has(hero.roomId) ? hero.roomId : currentRoomId;
    const safeTile = sanitizeHeroTile(hero.tile, rooms.get(safeRoomId), base.tile);
    const maxHp = Math.max(1, toInt(maybeHero.maxHp, base.maxHp));

    return {
      ...base,
      id: typeof hero.id === 'string' && hero.id.length > 0 ? hero.id : base.id,
      classLetter: sanitizeClassLetter(hero.classLetter, base.classLetter),
      className: sanitizeClassName(maybeHero, base.className),
      raceName: sanitizeRaceName(maybeHero, base.raceName),
      hp: clamp(toInt(maybeHero.hp, base.hp), 0, maxHp),
      maxHp,
      body: Math.max(0, toInt(maybeHero.body, base.body)),
      mind: Math.max(0, toInt(maybeHero.mind, base.mind)),
      equipment: sanitizeEquipment(maybeHero.equipment, base.equipment),
      roomId: safeRoomId,
      tile: safeTile,
      facing: sanitizeFacing(hero.facing, base.facing),
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

function sanitizeClassLetter(value: unknown, fallback: HeroState['classLetter']): HeroState['classLetter'] {
  if (value === 'W' || value === 'R' || value === 'M') return value;
  return fallback;
}

function sanitizeClassName(hero: Partial<HeroState>, fallback: HeroClassName): HeroClassName {
  if (hero.className === 'Warrior' || hero.className === 'Ranger' || hero.className === 'Mage') {
    return hero.className;
  }

  if (hero.classLetter === 'W') return 'Warrior';
  if (hero.classLetter === 'R') return 'Ranger';
  if (hero.classLetter === 'M') return 'Mage';
  return fallback;
}

function sanitizeRaceName(hero: Partial<HeroState>, fallback: HeroRaceName): HeroRaceName {
  if (hero.raceName === 'Human' || hero.raceName === 'Elf' || hero.raceName === 'Orc') {
    return hero.raceName;
  }
  return fallback;
}

function sanitizeFacing(value: unknown, fallback: Direction): Direction {
  if (value === 'N' || value === 'E' || value === 'S' || value === 'W') return value;
  return fallback;
}

function toInt(value: unknown, fallback: number): number {
  return Number.isFinite(value) ? (value as number) | 0 : fallback;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function sanitizeEquipment(
  value: unknown,
  fallback: HeroState['equipment'],
): HeroState['equipment'] {
  if (!value || typeof value !== 'object') return { ...fallback, backpack: [...fallback.backpack] };

  const v = value as Partial<HeroState['equipment']>;
  return {
    armor: typeof v.armor === 'string' ? v.armor : null,
    leftHand: typeof v.leftHand === 'string' ? v.leftHand : null,
    rightHand: typeof v.rightHand === 'string' ? v.rightHand : null,
    relic: typeof v.relic === 'string' ? v.relic : null,
    backpack: Array.isArray(v.backpack)
      ? v.backpack.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

function sanitizeInventory(value: unknown[]): InventoryEntry[] {
  const canonicalById = new Map<string, (typeof ITEM_DEFINITIONS)[number]>(
    ITEM_DEFINITIONS.map((item) => [item.id, item]),
  );
  const sanitized: InventoryEntry[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const itemId = (entry as { itemId?: unknown }).itemId;
    if (typeof itemId !== 'string') continue;
    const canonical = canonicalById.get(itemId);
    if (!canonical) continue;

    sanitized.push({
      itemId: canonical.id,
      name: canonical.name,
      file: canonical.file,
      category: canonical.category,
    });
  }

  return sanitized;
}
