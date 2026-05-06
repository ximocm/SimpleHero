import type {
  CombatRollSnapshot,
  CombatTurnState,
  Coord,
  Direction,
  EnemyState,
  HeroClassName,
  HeroRaceName,
  HeroState,
  RoomData,
  RoomEncounterState,
  RoomProgressState,
  RoomType,
  RunState,
  TreasureState,
} from '../data/dungeonTypes.js';
import type { CampaignHero, CampaignProfile } from '../app/types.js';
import type { InventoryEntry } from '../items/inventory.js';
import { ITEM_DEFINITIONS } from '../items/items.js';
import { createGameState, type GameState } from './gameSystem.js';
import { syncCombatTurnState } from './turnSystem.js';
import { inBounds } from '../utils/grid.js';
import { isWalkable, TileType } from '../data/tileTypes.js';
import { createCampaignRoster, DEFAULT_PARTY_BLUEPRINTS } from '../heroes/heroSystem.js';

const SAVE_KEY = 'simplehero.autosave.v1';
const INVENTORY_SAVE_KEY = 'simplehero.inventory.v1';
const ACCOUNT_GOLD_SAVE_KEY = 'simplehero.account-gold.v1';
const PROFILE_SAVE_KEY = 'simplehero.profile.v1';
const HERO_COUNT = 3;

interface PersistedCampaignProfileV1 {
  version: 1;
  heroes: CampaignHero[];
  stash: InventoryEntry[];
}

interface PersistedDungeonState {
  seed: number;
  totalFloors: number;
  currentRoomId: string;
  discoveredRoomIds: string[];
  floorByRoomId: Array<[string, number]>;
  rooms: RoomData[];
  enemiesByRoomId?: Array<[string, EnemyState[]]>;
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

interface PersistedGameStateV3 {
  version: 3;
  savedAt: number;
  dungeon: PersistedDungeonState;
  party: PersistedPartyStateV2;
}

interface PersistedGameStateV4 {
  version: 4;
  savedAt: number;
  dungeon: PersistedDungeonState;
  party: PersistedPartyStateV2;
}

interface PersistedGameStateV5 {
  version: 5;
  savedAt: number;
  dungeon: PersistedDungeonState;
  party: PersistedPartyStateV2;
  turn: CombatTurnState | null;
}

interface PersistedGameStateV6 {
  version: 6;
  savedAt: number;
  dungeon: PersistedDungeonState;
  party: PersistedPartyStateV2;
  turn: CombatTurnState | null;
  combatRngState: number;
  attackModeHeroId: string | null;
  recentCombatLog: string[];
  lastCombatRoll: CombatRollSnapshot | null;
}

interface PersistedGameStateV7 {
  version: 7;
  savedAt: number;
  dungeon: PersistedDungeonState;
  party: PersistedPartyStateV2;
  turn: CombatTurnState | null;
  combatRngState: number;
  attackModeHeroId: string | null;
  castModeHeroId: string | null;
  selectedSpellId: 'heal' | 'fireball' | 'ice' | null;
  recentCombatLog: string[];
  lastCombatRoll: CombatRollSnapshot | null;
  runState: RunState;
}

interface PersistedGameStateV8 {
  version: 8;
  savedAt: number;
  dungeon: PersistedDungeonState;
  party: PersistedPartyStateV2;
  turn: CombatTurnState | null;
  combatRngState: number;
  attackModeHeroId: string | null;
  castModeHeroId: string | null;
  selectedSpellId: 'heal' | 'fireball' | 'ice' | null;
  recentCombatLog: string[];
  lastCombatRoll: CombatRollSnapshot | null;
  runState: RunState;
  runGold: number;
  accountGoldApplied: boolean;
}

type PersistedSnapshot =
  | PersistedGameStateV1
  | PersistedGameStateV2
  | PersistedGameStateV3
  | PersistedGameStateV4
  | PersistedGameStateV5
  | PersistedGameStateV6
  | PersistedGameStateV7
  | PersistedGameStateV8;

/**
 * Loads and restores game state from localStorage, if available and valid.
 * @returns Restored game state, or `null` when no valid autosave exists.
 */
export function loadPersistedGameState(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;

  try {
    const data = JSON.parse(raw) as PersistedSnapshot;
    if (data.version !== 1 && data.version !== 2 && data.version !== 3 && data.version !== 4 && data.version !== 5 && data.version !== 6 && data.version !== 7 && data.version !== 8) return null;
    return restoreFromSnapshot(data);
  } catch {
    return null;
  }
}

/**
 * Returns whether any autosave snapshot exists in localStorage.
 * @returns `true` when a snapshot key is present.
 */
export function hasPersistedGameState(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

/**
 * Persists current game state to localStorage.
 * @param state Game state to persist.
 * @returns Nothing.
 */
export function persistGameState(state: GameState): void {
  const snapshot: PersistedGameStateV8 = {
    version: 8,
    savedAt: Date.now(),
    dungeon: {
      seed: state.dungeon.seed,
      totalFloors: state.dungeon.totalFloors,
      currentRoomId: state.dungeon.currentRoomId,
      discoveredRoomIds: Array.from(state.dungeon.discoveredRoomIds),
      floorByRoomId: Array.from(state.dungeon.floorByRoomId.entries()),
      rooms: Array.from(state.dungeon.rooms.values()),
      enemiesByRoomId: Array.from(state.dungeon.enemiesByRoomId.entries()).map(([roomId, enemies]) => [
        roomId,
        enemies.map((enemy) => ({
          ...enemy,
          tile: { ...enemy.tile },
          statusEffects: { ...enemy.statusEffects },
        })),
      ]),
    },
    party: {
      activeHeroIndex: state.party.activeHeroIndex,
      heroes: state.party.heroes.map((hero) => ({
        ...hero,
        tile: { ...hero.tile },
        equipment: {
          ...hero.equipment,
          backpack: [...hero.equipment.backpack],
        },
        skillState: { ...hero.skillState },
      })),
    },
    turn: state.turn
      ? {
          ...state.turn,
          heroResourcesById: Object.fromEntries(
            Object.entries(state.turn.heroResourcesById).map(([heroId, resources]) => [
              heroId,
              { ...resources },
            ]),
          ),
          enemyQueue: [...state.turn.enemyQueue],
        }
      : null,
    combatRngState: state.combatRngState >>> 0,
    attackModeHeroId: state.attackModeHeroId,
    castModeHeroId: state.castModeHeroId,
    selectedSpellId: state.selectedSpellId,
    recentCombatLog: [...state.recentCombatLog],
    lastCombatRoll: state.lastCombatRoll
      ? {
          ...state.lastCombatRoll,
          attackRolls: [...state.lastCombatRoll.attackRolls],
          attackHits: [...state.lastCombatRoll.attackHits],
          defenseRolls: [...state.lastCombatRoll.defenseRolls],
          blockedHits: [...state.lastCombatRoll.blockedHits],
        }
      : null,
    runState: state.runState,
    runGold: state.runGold,
    accountGoldApplied: state.accountGoldApplied,
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

/**
 * Clears persisted party inventory from localStorage.
 * @returns Nothing.
 */
export function clearPersistedPartyInventory(): void {
  localStorage.removeItem(INVENTORY_SAVE_KEY);
}

export function loadPersistedAccountGold(): number {
  const raw = localStorage.getItem(ACCOUNT_GOLD_SAVE_KEY);
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed | 0 : 0;
}

export function persistAccountGold(accountGold: number): void {
  localStorage.setItem(ACCOUNT_GOLD_SAVE_KEY, String(Math.max(0, accountGold | 0)));
}

export function clearPersistedAccountGold(): void {
  localStorage.removeItem(ACCOUNT_GOLD_SAVE_KEY);
}

export function loadPersistedCampaignProfile(): CampaignProfile | null {
  const raw = localStorage.getItem(PROFILE_SAVE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PersistedCampaignProfileV1;
    if (parsed.version !== 1) return null;
    return sanitizeCampaignProfile(parsed);
  } catch {
    return null;
  }
}

export function persistCampaignProfile(profile: CampaignProfile): void {
  const snapshot: PersistedCampaignProfileV1 = {
    version: 1,
    heroes: profile.heroes.map((hero) => ({
      ...hero,
      equipment: {
        ...hero.equipment,
        backpack: [...hero.equipment.backpack],
      },
    })),
    stash: profile.stash.map((entry) => ({ ...entry })),
  };
  localStorage.setItem(PROFILE_SAVE_KEY, JSON.stringify(snapshot));
}

export function clearPersistedCampaignProfile(): void {
  localStorage.removeItem(PROFILE_SAVE_KEY);
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
  const enemiesByRoomId = Array.isArray(snapshot.dungeon.enemiesByRoomId)
    ? snapshot.dungeon.enemiesByRoomId
    : [];

  const rooms = new Map<string, RoomData>(
    snapshot.dungeon.rooms
      .filter((room) => typeof room.id === 'string' && room.id.length > 0)
      .map((room) => {
        const fallbackRoom = fallback.dungeon.rooms.get(room.id);
        return [room.id, sanitizeRoomData(room, fallbackRoom)];
      }),
  );
  if (rooms.size === 0) return null;

  state.dungeon.rooms = rooms;
  state.dungeon.totalFloors = Math.max(1, snapshot.dungeon.totalFloors | 0);
  state.dungeon.floorByRoomId = new Map(
    floorByRoomId.filter(([roomId, floor]) => rooms.has(roomId) && floor > 0),
  );
  state.dungeon.enemiesByRoomId = sanitizeEnemiesByRoomId(enemiesByRoomId, rooms, fallback.dungeon.enemiesByRoomId);

  const currentRoomId = rooms.has(snapshot.dungeon.currentRoomId)
    ? snapshot.dungeon.currentRoomId
    : rooms.keys().next().value;
  if (!currentRoomId) return null;
  state.dungeon.currentRoomId = currentRoomId;

  const discovered = new Set(discoveredRoomIds.filter((roomId) => rooms.has(roomId)));
  discovered.add(currentRoomId);
  state.dungeon.discoveredRoomIds = discovered;
  normalizeRoomEncounters(rooms, state.dungeon.enemiesByRoomId);

  const restoredHeroes = snapshot.party.heroes.slice(0, HERO_COUNT).map((hero, index) => {
    const maybeHero = hero as Partial<HeroState>;
    const base = fallback.party.heroes[index];
    const safeRoomId = rooms.has(hero.roomId) ? hero.roomId : currentRoomId;
    const safeTile = sanitizeHeroTile(hero.tile, rooms.get(safeRoomId), base.tile);
    const maxHp = Math.max(1, toInt(maybeHero.maxHp, base.maxHp));

    return {
      ...base,
      id: typeof hero.id === 'string' && hero.id.length > 0 ? hero.id : base.id,
      name: typeof maybeHero.name === 'string' && maybeHero.name.trim().length > 0 ? maybeHero.name.trim().slice(0, 24) : base.name,
      classLetter: sanitizeClassLetter(hero.classLetter, base.classLetter),
      className: sanitizeClassName(maybeHero, base.className),
      raceName: sanitizeRaceName(maybeHero, base.raceName),
      hp: clamp(toInt(maybeHero.hp, base.hp), 0, maxHp),
      maxHp,
      body: Math.max(0, toInt(maybeHero.body, base.body)),
      mind: Math.max(0, toInt(maybeHero.mind, base.mind)),
      equipment: sanitizeEquipment(maybeHero.equipment, base.equipment),
      skillState: sanitizeHeroSkillState(maybeHero.skillState, base.skillState),
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
  state.turn = sanitizeTurnState(
    'turn' in snapshot ? snapshot.turn : null,
    currentRoomId,
    state.dungeon.enemiesByRoomId,
    restoredHeroes,
  );
  state.turnAutomationReadyAt = null;
  state.combatRngState =
    'combatRngState' in snapshot && Number.isFinite(snapshot.combatRngState)
      ? snapshot.combatRngState >>> 0
      : fallback.combatRngState;
  state.attackModeHeroId =
    'attackModeHeroId' in snapshot && typeof snapshot.attackModeHeroId === 'string'
      ? snapshot.attackModeHeroId
      : null;
  state.castModeHeroId =
    'castModeHeroId' in snapshot && typeof snapshot.castModeHeroId === 'string'
      ? snapshot.castModeHeroId
      : null;
  state.selectedSpellId = 'selectedSpellId' in snapshot ? sanitizeSelectedSpellId(snapshot.selectedSpellId) : null;
  state.recentCombatLog =
    'recentCombatLog' in snapshot && Array.isArray(snapshot.recentCombatLog)
      ? snapshot.recentCombatLog.filter((entry): entry is string => typeof entry === 'string').slice(0, 6)
      : [];
  state.lastCombatRoll = 'lastCombatRoll' in snapshot ? sanitizeCombatRoll(snapshot.lastCombatRoll) : null;
  state.runState = sanitizeRunState('runState' in snapshot ? snapshot.runState : 'active');
  state.runGold = 'runGold' in snapshot ? Math.max(0, toInt(snapshot.runGold, 0)) : 0;
  state.accountGoldApplied = 'accountGoldApplied' in snapshot ? Boolean(snapshot.accountGoldApplied) : false;
  syncCombatTurnState(state);

  return state;
}

function sanitizeHeroTile(tile: Coord, room: RoomData | undefined, fallback: Coord): Coord {
  if (!room) return { ...fallback };
  if (!tile || !Number.isFinite(tile.x) || !Number.isFinite(tile.y)) return { ...fallback };
  if (!inBounds(tile, room.width, room.height)) return { ...fallback };
  if (!isWalkable(room.tiles[tile.y][tile.x] as TileType)) return { ...fallback };
  return { ...tile };
}

function sanitizeCombatRoll(value: CombatRollSnapshot | null): CombatRollSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.attackerId !== 'string' || typeof value.defenderId !== 'string') return null;

  const attackRolls = Array.isArray(value.attackRolls) ? value.attackRolls.filter(Number.isFinite).map((n) => n | 0) : [];
  const attackHits = Array.isArray(value.attackHits) ? value.attackHits.filter(Number.isFinite).map((n) => n | 0) : [];
  const defenseRolls = Array.isArray(value.defenseRolls) ? value.defenseRolls.filter(Number.isFinite).map((n) => n | 0) : [];
  const blockedHits = Array.isArray(value.blockedHits) ? value.blockedHits.filter(Number.isFinite).map((n) => n | 0) : [];

  return {
    attackerId: value.attackerId,
    defenderId: value.defenderId,
    attackRolls,
    attackHits,
    defenseRolls,
    blockedHits,
    totalAttackHits: toInt(value.totalAttackHits, 0),
    totalBlockedHits: toInt(value.totalBlockedHits, 0),
    effectiveHits: toInt(value.effectiveHits, 0),
    finalDamage: toInt(value.finalDamage, 0),
  };
}

function sanitizeRoomData(room: RoomData, fallback: RoomData | undefined): RoomData {
  const fallbackType = fallback?.roomType ?? 'combat';
  const roomType = sanitizeRoomType(room.roomType, fallbackType);
  const encounter = sanitizeEncounter(room.encounter, roomType, fallback?.encounter ?? null);
  const treasure = sanitizeTreasure(room.treasure, roomType, fallback?.treasure ?? null);
  const progress = sanitizeRoomProgress(room.progress, fallback?.progress);

  return {
    ...room,
    roomType,
    encounter,
    treasure,
    progress,
  };
}

function sanitizeRoomType(value: unknown, fallback: RoomType): RoomType {
  if (value === 'combat' || value === 'treasure' || value === 'exit') return value;
  return fallback;
}

function sanitizeRunState(value: unknown): RunState {
  if (value === 'active' || value === 'won' || value === 'lost') return value;
  return 'active';
}

function sanitizeSelectedSpellId(value: unknown): 'heal' | 'fireball' | 'ice' | null {
  if (value === 'heal' || value === 'fireball' || value === 'ice') return value;
  return null;
}

function sanitizeEncounter(
  value: unknown,
  roomType: RoomType,
  fallback: RoomEncounterState | null,
): RoomEncounterState | null {
  if (roomType !== 'combat') return null;
  if (!value || typeof value !== 'object') return cloneEncounter(fallback);

  const encounter = value as Partial<RoomEncounterState>;
  const enemyIds = Array.isArray(encounter.enemyIds)
    ? encounter.enemyIds.filter((enemyId): enemyId is string => typeof enemyId === 'string')
    : fallback?.enemyIds ?? [];

  const isCleared =
    typeof encounter.isCleared === 'boolean'
      ? encounter.isCleared
      : fallback?.isCleared ?? enemyIds.length === 0;

  return {
    enemyIds: [...enemyIds],
    isCleared,
  };
}

function sanitizeTreasure(
  value: unknown,
  roomType: RoomType,
  fallback: TreasureState | null,
): TreasureState | null {
  if (roomType !== 'treasure') return null;
  if (!value || typeof value !== 'object') {
    return fallback ? { ...fallback } : { rewardId: 'gold', isCollected: false };
  }

  const treasure = value as Partial<TreasureState>;
  return {
    rewardId: treasure.rewardId === 'ruby' ? 'ruby' : treasure.rewardId === 'gold' ? 'gold' : fallback?.rewardId ?? 'gold',
    isCollected: typeof treasure.isCollected === 'boolean' ? treasure.isCollected : fallback?.isCollected ?? false,
  };
}

function cloneEncounter(value: RoomEncounterState | null): RoomEncounterState | null {
  if (!value) return { enemyIds: [], isCleared: true };
  return {
    enemyIds: [...value.enemyIds],
    isCleared: value.isCleared,
  };
}

function sanitizeRoomProgress(
  value: unknown,
  fallback: RoomProgressState | undefined,
): RoomProgressState {
  if (!value || typeof value !== 'object') {
    return {
      hasBeenEntered: fallback?.hasBeenEntered ?? false,
      hasBeenExited: fallback?.hasBeenExited ?? false,
    };
  }

  const progress = value as Partial<RoomProgressState>;
  return {
    hasBeenEntered:
      typeof progress.hasBeenEntered === 'boolean'
        ? progress.hasBeenEntered
        : fallback?.hasBeenEntered ?? false,
    hasBeenExited:
      typeof progress.hasBeenExited === 'boolean'
        ? progress.hasBeenExited
        : fallback?.hasBeenExited ?? false,
  };
}

function sanitizeEnemiesByRoomId(
  value: Array<[string, EnemyState[]]>,
  rooms: Map<string, RoomData>,
  fallback: Map<string, EnemyState[]>,
): Map<string, EnemyState[]> {
  const sanitized = new Map<string, EnemyState[]>();

  for (const roomId of rooms.keys()) {
    const room = rooms.get(roomId);
    if (!room) continue;

    const persistedEnemies = value.find(([id]) => id === roomId)?.[1];
    const fallbackEnemies = fallback.get(roomId) ?? [];
    const source = Array.isArray(persistedEnemies) ? persistedEnemies : fallbackEnemies;
    sanitized.set(roomId, sanitizeEnemyList(source, room, fallbackEnemies));
  }

  return sanitized;
}

function sanitizeEnemyList(
  value: EnemyState[],
  room: RoomData,
  fallback: EnemyState[],
): EnemyState[] {
  const occupied = new Set<string>();
  const sanitized: EnemyState[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const enemy = sanitizeEnemy(value[index], room, fallback[index] ?? fallback[0], index, occupied);
    if (!enemy) continue;
    sanitized.push(enemy);
    occupied.add(`${enemy.tile.x},${enemy.tile.y}`);
  }

  return sanitized;
}

function sanitizeEnemy(
  value: EnemyState | undefined,
  room: RoomData,
  fallback: EnemyState | undefined,
  index: number,
  occupied: Set<string>,
): EnemyState | null {
  const base = fallback ?? null;
  if (!value && !base) return null;

  const kind = sanitizeEnemyKind(value?.kind, base?.kind);
  if (!kind) return null;

  const safeTile = sanitizeEnemyTile(value?.tile, room, base?.tile, occupied);
  if (!safeTile) return null;

  const maxHp = Math.max(1, toInt(value?.maxHp, base?.maxHp ?? 1));
  return {
    id:
      typeof value?.id === 'string' && value.id.length > 0
        ? value.id
        : base?.id ?? `${room.id}:enemy-${index}`,
    kind,
    roomId: room.id,
    tile: safeTile,
    hp: clamp(toInt(value?.hp, base?.hp ?? maxHp), 0, maxHp),
    maxHp,
    movement: Math.max(0, toInt(value?.movement, base?.movement ?? 0)),
    range: Math.max(1, toInt(value?.range, base?.range ?? 1)),
    attackDice: Math.max(1, toInt(value?.attackDice, base?.attackDice ?? 1)),
    damage: Math.max(0, toInt(value?.damage, base?.damage ?? 0)),
    defenseDiceBonus: Math.max(0, toInt(value?.defenseDiceBonus, base?.defenseDiceBonus ?? 0)),
    statusEffects: {
      rootedTurns: Math.max(0, toInt(value?.statusEffects?.rootedTurns, base?.statusEffects.rootedTurns ?? 0)),
    },
  };
}

function sanitizeEnemyKind(value: unknown, fallback?: EnemyState['kind']): EnemyState['kind'] | null {
  if (value === 'skeleton-sword' || value === 'skeleton-archer') return value;
  if (fallback === 'skeleton-sword' || fallback === 'skeleton-archer') return fallback;
  return null;
}

function sanitizeEnemyTile(
  tile: Coord | undefined,
  room: RoomData,
  fallback: Coord | undefined,
  occupied: Set<string>,
): Coord | null {
  const candidate = sanitizeCoordForEnemy(tile, room) ?? sanitizeCoordForEnemy(fallback, room);
  if (!candidate) return null;

  const key = `${candidate.x},${candidate.y}`;
  if (occupied.has(key)) return null;
  return candidate;
}

function sanitizeCoordForEnemy(tile: Coord | undefined, room: RoomData): Coord | null {
  if (!tile || !Number.isFinite(tile.x) || !Number.isFinite(tile.y)) return null;
  if (!inBounds(tile, room.width, room.height)) return null;
  if (!isWalkable(room.tiles[tile.y][tile.x] as TileType)) return null;
  const exitTiles = Object.values(room.exits).filter((coord): coord is Coord => Boolean(coord));
  if (exitTiles.some((exit) => exit.x === tile.x && exit.y === tile.y)) return null;
  return { ...tile };
}

function normalizeRoomEncounters(
  rooms: Map<string, RoomData>,
  enemiesByRoomId: Map<string, EnemyState[]>,
): void {
  for (const room of rooms.values()) {
    if (!room.encounter) continue;
    const enemies = enemiesByRoomId.get(room.id) ?? [];
    room.encounter.enemyIds = enemies.map((enemy) => enemy.id);
    if (enemies.length === 0) {
      room.encounter.isCleared = true;
    }
  }
}

function sanitizeTurnState(
  value: CombatTurnState | null,
  currentRoomId: string,
  enemiesByRoomId: Map<string, EnemyState[]>,
  heroes: HeroState[],
): CombatTurnState | null {
  if (!value || typeof value !== 'object') return null;
  if (value.roomId !== currentRoomId) return null;

  const allowedHeroIds = new Set(heroes.filter((hero) => hero.hp > 0 && hero.roomId === currentRoomId).map((hero) => hero.id));
  const allowedEnemyIds = new Set((enemiesByRoomId.get(currentRoomId) ?? []).filter((enemy) => enemy.hp > 0).map((enemy) => enemy.id));
  const heroResourcesById: CombatTurnState['heroResourcesById'] = {};
  const rawHeroResources =
    value.heroResourcesById && typeof value.heroResourcesById === 'object' ? value.heroResourcesById : {};

  for (const hero of heroes) {
    if (!allowedHeroIds.has(hero.id)) continue;
    const current = rawHeroResources[hero.id];
    heroResourcesById[hero.id] = {
      movementRemaining: Math.max(0, toInt(current?.movementRemaining, 0)),
      actionPointsRemaining: Math.max(0, toInt(current?.actionPointsRemaining, 0)),
      attackSlotAvailable: current?.attackSlotAvailable !== false,
    };
  }

  const enemyQueue = Array.isArray(value.enemyQueue)
    ? value.enemyQueue.filter((enemyId): enemyId is string => typeof enemyId === 'string' && allowedEnemyIds.has(enemyId))
    : [];

  return {
    roomId: currentRoomId,
    round: Math.max(1, toInt(value.round, 1)),
    phase: value.phase === 'enemies' ? 'enemies' : 'heroes',
    heroResourcesById,
    enemyQueue,
    activeEnemyIndex: clamp(toInt(value.activeEnemyIndex, 0), 0, Math.max(0, enemyQueue.length - 1)),
  };
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

function sanitizeHeroSkillState(
  value: unknown,
  fallback: HeroState['skillState'],
): HeroState['skillState'] {
  if (!value || typeof value !== 'object') {
    return { ...fallback };
  }

  const skillState = value as Partial<HeroState['skillState']>;
  return {
    cooldownRemaining: Math.max(0, toInt(skillState.cooldownRemaining, fallback.cooldownRemaining)),
    powerStrikeArmed:
      typeof skillState.powerStrikeArmed === 'boolean'
        ? skillState.powerStrikeArmed
        : fallback.powerStrikeArmed,
  };
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

function sanitizeCampaignProfile(value: PersistedCampaignProfileV1): CampaignProfile {
  const defaultRoster = createCampaignRoster(DEFAULT_PARTY_BLUEPRINTS);
  const heroes = Array.isArray(value.heroes) ? value.heroes.slice(0, HERO_COUNT) : [];
  const sanitizedHeroes: CampaignHero[] = heroes.map((hero, index) => {
    const fallback = defaultRoster[index];
    return {
      id: typeof hero?.id === 'string' && hero.id.length > 0 ? hero.id : fallback.id,
      name: typeof hero?.name === 'string' && hero.name.trim().length > 0 ? hero.name.trim().slice(0, 24) : fallback.name,
      className: hero?.className === 'Warrior' || hero?.className === 'Ranger' || hero?.className === 'Mage' ? hero.className : fallback.className,
      raceName: hero?.raceName === 'Human' || hero?.raceName === 'Elf' || hero?.raceName === 'Orc' ? hero.raceName : fallback.raceName,
      equipment: sanitizeEquipment(hero?.equipment, fallback.equipment),
    };
  });

  while (sanitizedHeroes.length < HERO_COUNT) {
    const fallback = defaultRoster[sanitizedHeroes.length];
    sanitizedHeroes.push({
      ...fallback,
      equipment: sanitizeEquipment(fallback.equipment, fallback.equipment),
    });
  }

  return {
    heroes: sanitizedHeroes,
    stash: sanitizeInventory(Array.isArray(value.stash) ? value.stash : []),
  };
}
