import type {
  CombatTurnState,
  CombatRollSnapshot,
  Coord,
  Direction,
  DungeonState,
  EnemyState,
  HeroState,
  PartyState,
  RoomData,
  RoomEncounterState,
  RoomType,
  RunState,
  SpellId,
} from '../data/dungeonTypes.js';
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
import {
  getHeroAvailableSpellIds,
  performFireballSpell,
  performHealSpell,
  performHeroAttack,
  performIceSpell,
} from './combatSystem.js';
import { CONSUMABLE_DEFINITIONS } from '../items/consumables.js';
import { SPELL_DEFINITIONS } from '../magic/spells.js';
import { canHeroCastSpells, getHeroAttackRange } from './weaponSystem.js';
import {
  canHeroActNow,
  canSelectHeroThisPhase,
  consumeHeroActionPoint,
  consumeHeroMovement,
  getCurrentHeroTurnResources,
  getHeroFinalMovement,
  syncCombatTurnState,
} from './turnSystem.js';

export interface GameState {
  dungeon: DungeonState;
  party: PartyState;
  runState: RunState;
  hoverPath: Coord[];
  spellPreviewTiles: Coord[];
  movingPath: Coord[];
  readyByHeroId: Map<string, Direction>;
  turn: CombatTurnState | null;
  turnAutomationReadyAt: number | null;
  combatRngState: number;
  attackModeHeroId: string | null;
  castModeHeroId: string | null;
  selectedSpellId: SpellId | null;
  itemUseModeHeroId: string | null;
  recentCombatLog: string[];
  lastCombatRoll: CombatRollSnapshot | null;
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
  isDefeated: boolean;
  isReadyAtExit: boolean;
  movementRemaining: number | null;
  actionPointsRemaining: number | null;
  attackSlotAvailable: boolean | null;
}

export interface RoomEncounterView {
  roomType: RoomType;
  isBlockingExit: boolean;
  isCleared: boolean;
  enemyCount: number;
}

export interface EnemyBoardView {
  id: string;
  kind: EnemyState['kind'];
  tile: Coord;
  hp: number;
  maxHp: number;
  isAttackTargetable: boolean;
  isSpellTargetable: boolean;
}

export interface ConsumableActionView {
  label: string;
  isAvailable: boolean;
}

export interface CastActionView {
  isAvailable: boolean;
  spellIds: SpellId[];
}

export interface RunSummaryView {
  result: RunState;
  seed: number;
  discoveredRooms: number;
  floorsReached: number;
  survivingHeroes: number;
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
  const state: GameState = {
    dungeon,
    party,
    runState: 'active',
    hoverPath: [],
    spellPreviewTiles: [],
    movingPath: [],
    readyByHeroId: new Map(),
    turn: null,
    turnAutomationReadyAt: null,
    combatRngState: (seed ^ 0x9e3779b9) >>> 0,
    attackModeHeroId: null,
    castModeHeroId: null,
    selectedSpellId: null,
    itemUseModeHeroId: null,
    recentCombatLog: [],
    lastCombatRoll: null,
  };
  syncCombatTurnState(state);
  return state;
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
  if (state.runState !== 'active') return;
  const nextHero = state.party.heroes[index];
  if (!nextHero) return;
  if (!canSelectHeroThisPhase(state, nextHero.id)) return;
  setActiveHero(state.party, index);
  state.hoverPath = [];
  state.spellPreviewTiles = [];
  state.movingPath = [];
  if (state.attackModeHeroId && state.attackModeHeroId !== nextHero.id) {
    state.attackModeHeroId = nextHero.id;
  }
  if (state.castModeHeroId && state.castModeHeroId !== nextHero.id) {
    state.castModeHeroId = nextHero.id;
    state.selectedSpellId = null;
    state.spellPreviewTiles = [];
  }
  if (state.itemUseModeHeroId && state.itemUseModeHeroId !== nextHero.id) {
    state.itemUseModeHeroId = nextHero.id;
  }
}

/**
 * Recomputes hover path for active hero to target tile.
 * @param state Game state to mutate.
 * @param target Destination tile.
 * @returns Nothing.
 */
export function updateHoverPath(state: GameState, target: Coord): void {
  if (state.runState !== 'active') {
    state.hoverPath = [];
    state.spellPreviewTiles = [];
    return;
  }
  const room = getCurrentRoom(state);
  const hero = getActiveHero(state.party);
  if (state.readyByHeroId.has(hero.id) || !canHeroActNow(state, hero.id)) {
    state.hoverPath = [];
    state.spellPreviewTiles = [];
    return;
  }
  const path = findPathAStar(hero.tile, target, (coord) =>
    canWalkTile(room, coord) &&
    !isTileOccupiedByOtherHero(state, room.id, coord, hero.id) &&
    !isTileOccupiedByEnemy(state, room.id, coord),
  );
  const resources = getCurrentHeroTurnResources(state);
  if (resources && path.length > 1 && path.length - 1 > resources.movementRemaining) {
    state.hoverPath = [];
    state.spellPreviewTiles = [];
    return;
  }
  state.hoverPath = path;
  state.spellPreviewTiles = [];
}

/**
 * Commits current hover path as movement path.
 * @param state Game state to mutate.
 * @returns Nothing.
 */
export function commitMoveFromHover(state: GameState): void {
  if (state.runState !== 'active') return;
  const hero = getActiveHero(state.party);
  if (state.readyByHeroId.has(hero.id) || !canHeroActNow(state, hero.id)) return;
  if (state.attackModeHeroId) return;
  if (state.castModeHeroId) return;
  if (state.itemUseModeHeroId) return;
  if (state.hoverPath.length < 2) return;
  state.movingPath = [...state.hoverPath];
}

/**
 * Advances active hero by one step in movement path.
 * @param state Game state to mutate.
 * @returns `true` when hero moved this tick, else `false`.
 */
export function stepMovement(state: GameState): boolean {
  if (state.runState !== 'active') return false;
  const hero = getActiveHero(state.party);
  if (state.readyByHeroId.has(hero.id) || !canHeroActNow(state, hero.id)) return false;
  if (state.attackModeHeroId) return false;
  if (state.castModeHeroId) return false;
  if (state.itemUseModeHeroId) return false;
  if (state.movingPath.length < 2) return false;

  state.movingPath.shift();
  const next = state.movingPath[0];
  if (!next) return false;
  if (isTileOccupiedByOtherHero(state, hero.roomId, next, hero.id)) {
    state.movingPath = [];
    return false;
  }
  if (isTileOccupiedByEnemy(state, hero.roomId, next)) {
    state.movingPath = [];
    return false;
  }

  updateFacing(hero.tile, next, hero);
  hero.tile = { ...next };
  const movementRemaining = consumeHeroMovement(state, hero.id);

  refreshExitReady(state, hero.id, hero.tile);
  maybeTransitionRoom(state);
  if (movementRemaining <= 0) {
    state.hoverPath = [];
    state.movingPath = [];
  }
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
  if (isRoomEncounterBlockingExit(room)) {
    state.readyByHeroId.delete(heroId);
    return;
  }

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
  const current = getCurrentRoom(state);
  if (isRoomEncounterBlockingExit(current)) {
    state.readyByHeroId.clear();
    return;
  }

  const livingHeroes = state.party.heroes.filter((hero) => hero.hp > 0);
  if (livingHeroes.length === 0) return;
  if (!livingHeroes.every((hero) => state.readyByHeroId.has(hero.id))) return;

  const directions = Array.from(state.readyByHeroId.values());
  const direction = directions[0];
  if (!directions.every((d) => d === direction)) return;

  const nextCoord = moveRoomCoord(current.coord, direction);
  const nextRoom = getRoomAt(state.dungeon, nextCoord);
  if (!nextRoom) return;

  current.progress.hasBeenExited = true;
  state.dungeon.currentRoomId = nextRoom.id;
  state.dungeon.discoveredRoomIds.add(nextRoom.id);
  nextRoom.progress.hasBeenEntered = true;

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
  syncCombatTurnState(state);
  if (nextRoom.roomType === 'exit' && state.party.heroes.some((hero) => hero.hp > 0)) {
    if (areAllRequiredRoomsCleared(state.dungeon)) {
      setRunState(state, 'won');
      state.recentCombatLog.unshift('Run complete: the party cleared every required room and reached the exit.');
      state.recentCombatLog = state.recentCombatLog.slice(0, 6);
    } else {
      state.recentCombatLog.unshift('Exit sealed: clear every combat room and complete every treasure room before the run can be won.');
      state.recentCombatLog = state.recentCombatLog.slice(0, 6);
    }
  }
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
      hero.hp > 0 &&
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
 * Returns current room type and encounter status for HUD/UI.
 * @param state Game state.
 * @returns Encounter view for current room.
 */
export function getCurrentRoomEncounterView(state: GameState): RoomEncounterView {
  const room = getCurrentRoom(state);
  const enemyCount = getCurrentRoomEnemies(state).length;
  const isCleared = isRoomObjectiveCleared(room);

  return {
    roomType: room.roomType,
    isBlockingExit: isRoomEncounterBlockingExit(room),
    isCleared,
    enemyCount,
  };
}

/**
 * Returns panel-ready hero view data for UI rendering.
 * @param state Game state.
 * @returns Ordered hero view models for panel display.
 */
export function getHeroPanelViews(state: GameState): HeroPanelView[] {
  return state.party.heroes.map((hero, index) => {
    const turn = state.turn;
    const isHeroPhaseInCurrentRoom = turn?.phase === 'heroes' && hero.roomId === turn.roomId;
    const turnResources = isHeroPhaseInCurrentRoom
      ? turn.heroResourcesById[hero.id] ?? {
          movementRemaining: getHeroFinalMovement(hero),
          actionPointsRemaining: 2,
          attackSlotAvailable: true,
        }
      : null;

    return {
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
      isDefeated: hero.hp <= 0,
      isReadyAtExit: state.readyByHeroId.has(hero.id),
      movementRemaining: turnResources?.movementRemaining ?? null,
      actionPointsRemaining: turnResources?.actionPointsRemaining ?? null,
      attackSlotAvailable: turnResources?.attackSlotAvailable ?? null,
    };
  });
}

/**
 * Returns spawned enemies currently belonging to the active room.
 * @param state Game state.
 * @returns Room enemy array.
 */
export function getCurrentRoomEnemies(state: GameState): EnemyState[] {
  return state.dungeon.enemiesByRoomId.get(state.dungeon.currentRoomId) ?? [];
}

/**
 * Returns enemy board view data for rendering and attack targeting.
 * @param state Game state.
 * @returns Enemy render models.
 */
export function getCurrentRoomEnemyViews(state: GameState): EnemyBoardView[] {
  const hero = getActiveHero(state.party);
  const attackHeroId = state.attackModeHeroId;
  return getCurrentRoomEnemies(state).map((enemy) => ({
    id: enemy.id,
    kind: enemy.kind,
    tile: enemy.tile,
    hp: enemy.hp,
    maxHp: enemy.maxHp,
    isAttackTargetable:
      enemy.hp > 0 &&
      attackHeroId === hero.id &&
      canHeroBasicAttackEnemy(state, hero.id, enemy.id),
    isSpellTargetable: enemy.hp > 0 && isEnemySpellTargetable(state, hero.id, enemy.id),
  }));
}

/**
 * Enables/disables basic attack targeting for the active hero.
 * @param state Game state.
 * @returns `true` when attack mode is now active.
 */
export function toggleAttackMode(state: GameState): boolean {
  if (state.runState !== 'active') return false;
  const hero = getActiveHero(state.party);
  if (!canHeroActNow(state, hero.id)) return false;
  const resources = getCurrentHeroTurnResources(state);
  if (!resources?.attackSlotAvailable) return false;

  state.movingPath = [];
  state.hoverPath = [];
  state.spellPreviewTiles = [];
  state.attackModeHeroId = state.attackModeHeroId === hero.id ? null : hero.id;
  state.castModeHeroId = null;
  state.selectedSpellId = null;
  state.itemUseModeHeroId = null;
  return state.attackModeHeroId === hero.id;
}

/**
 * Resolves a basic attack from the selected hero to a clicked enemy tile.
 * @param state Game state.
 * @param target Destination tile clicked on canvas.
 * @returns `true` when an attack was performed.
 */
export function tryHeroAttackAtTile(state: GameState, target: Coord): boolean {
  if (state.runState !== 'active') return false;
  const hero = getActiveHero(state.party);
  if (state.attackModeHeroId !== hero.id) return false;

  const enemy = getCurrentRoomEnemies(state).find((candidate) => candidate.hp > 0 && sameCoord(candidate.tile, target));
  if (!enemy) return false;
  if (!canHeroBasicAttackEnemy(state, hero.id, enemy.id)) return false;

  const result = performHeroAttack(state, hero, enemy);
  const resources = state.turn?.heroResourcesById[hero.id];
  if (resources) resources.attackSlotAvailable = false;
  state.lastCombatRoll = result.roll;
  state.recentCombatLog.unshift(formatCombatLogEntry(hero.className, enemy.kind, result.roll, result.defenderDefeated));
  state.recentCombatLog = state.recentCombatLog.slice(0, 6);
  state.attackModeHeroId = null;
  state.castModeHeroId = null;
  state.selectedSpellId = null;
  state.itemUseModeHeroId = null;
  state.hoverPath = [];
  state.spellPreviewTiles = [];
  state.movingPath = [];
  syncCombatTurnState(state);
  return true;
}

/**
 * Returns whether a hero can basic-attack a given enemy right now.
 * @param state Game state.
 * @param heroId Hero identifier.
 * @param enemyId Enemy identifier.
 * @returns `true` when the target is in range and the slot is available.
 */
export function canHeroBasicAttackEnemy(state: GameState, heroId: string, enemyId: string): boolean {
  if (state.runState !== 'active') return false;
  const hero = state.party.heroes.find((candidate) => candidate.id === heroId);
  const enemy = getCurrentRoomEnemies(state).find((candidate) => candidate.id === enemyId && candidate.hp > 0);
  if (!hero || hero.hp <= 0 || !enemy) return false;
  if (!canHeroActNow(state, heroId)) return false;

  const resources = state.turn?.heroResourcesById[heroId];
  if (state.turn && !resources?.attackSlotAvailable) return false;

  return manhattanDistance(hero.tile, enemy.tile) <= getHeroAttackRange(hero);
}

/**
 * Returns whether the active hero can use their equipped consumable.
 * @param state Game state.
 * @returns `true` when a relic consumable can be used now.
 */
export function canUseActiveHeroConsumable(state: GameState): boolean {
  if (state.runState !== 'active') return false;
  const hero = getActiveHero(state.party);
  if (state.turn) {
    if (!canHeroActNow(state, hero.id)) return false;
    const resources = state.turn.heroResourcesById[hero.id];
    if (!resources || resources.actionPointsRemaining <= 0) return false;
  }
  return hero.equipment.backpack.some((itemId) => isUsableConsumable(itemId, hero));
}

/**
 * Returns action-button view data for the active hero consumable.
 * @param state Game state.
 * @returns Consumable action view.
 */
export function getActiveHeroConsumableActionView(state: GameState): ConsumableActionView {
  const hero = getActiveHero(state.party);
  const consumableId = hero.equipment.backpack.find((itemId) => isUsableConsumable(itemId, hero));
  if (!consumableId) {
    return {
      label: 'use item',
      isAvailable: false,
    };
  }

  const consumable = CONSUMABLE_DEFINITIONS[consumableId as keyof typeof CONSUMABLE_DEFINITIONS];
  return {
    label: consumable ? `use ${consumable.name}` : 'use item',
    isAvailable: canUseActiveHeroConsumable(state),
  };
}

export function getActiveHeroCastActionView(state: GameState): CastActionView {
  const hero = getActiveHero(state.party);
  if (hero.className !== 'Mage') {
    return { isAvailable: false, spellIds: [] };
  }

  const resources = getCurrentHeroTurnResources(state);
  return {
    isAvailable:
      canHeroActNow(state, hero.id) &&
      Boolean(resources?.attackSlotAvailable) &&
      canHeroCastSpells(hero),
    spellIds: getHeroAvailableSpellIds(hero),
  };
}

export function toggleCastMode(state: GameState): boolean {
  if (state.runState !== 'active') return false;
  const hero = getActiveHero(state.party);
  const castAction = getActiveHeroCastActionView(state);
  if (!castAction.isAvailable) return false;

  const isOpen = state.castModeHeroId === hero.id;
  state.attackModeHeroId = null;
  state.itemUseModeHeroId = null;
  state.hoverPath = [];
  state.spellPreviewTiles = [];
  state.movingPath = [];

  if (isOpen) {
    state.castModeHeroId = null;
    state.selectedSpellId = null;
    state.spellPreviewTiles = [];
    return false;
  }

  state.castModeHeroId = hero.id;
  state.selectedSpellId = null;
  state.spellPreviewTiles = [];
  return true;
}

export function selectActiveHeroSpell(state: GameState, spellId: SpellId): boolean {
  const hero = getActiveHero(state.party);
  if (state.castModeHeroId !== hero.id) return false;
  if (!getHeroAvailableSpellIds(hero).includes(spellId)) return false;
  state.selectedSpellId = spellId;
  state.spellPreviewTiles = [];
  return true;
}

export function cancelCastMode(state: GameState): void {
  state.castModeHeroId = null;
  state.selectedSpellId = null;
  state.spellPreviewTiles = [];
}

export function getSelectedSpellDefinition(state: GameState) {
  return state.selectedSpellId ? SPELL_DEFINITIONS[state.selectedSpellId] : null;
}

export function tryHeroCastSpellAtTile(state: GameState, target: Coord): boolean {
  if (state.runState !== 'active') return false;
  const hero = getActiveHero(state.party);
  if (state.castModeHeroId !== hero.id || !state.selectedSpellId) return false;
  if (!canHeroActNow(state, hero.id)) return false;

  const resources = state.turn?.heroResourcesById[hero.id];
  if (state.turn && !resources?.attackSlotAvailable) return false;

  const spell = SPELL_DEFINITIONS[state.selectedSpellId];
  if (spell.targeting === 'ally') {
    const ally = state.party.heroes.find(
      (candidate) => candidate.roomId === hero.roomId && candidate.hp > 0 && sameCoord(candidate.tile, target),
    );
    if (!ally) return false;
    if (!canHeroCastSpellOnHero(state, hero.id, ally.id)) return false;
    const result = performHealSpell(hero, ally);
    finalizeSpellCast(state, hero.id, result.logEntries);
    return true;
  }

  const targetEnemy = getCurrentRoomEnemies(state).find((enemy) => enemy.hp > 0 && sameCoord(enemy.tile, target));
  if (!targetEnemy) return false;

  if (spell.id === 'ice') {
    if (!canHeroCastSpellOnEnemy(state, hero.id, targetEnemy.id)) return false;
    const result = performIceSpell(hero, targetEnemy);
    finalizeSpellCast(state, hero.id, result.logEntries);
    return true;
  }

  if (spell.id === 'fireball') {
    if (!canHeroCastSpellOnEnemy(state, hero.id, targetEnemy.id)) return false;
    const result = performFireballSpell(state, hero, target, getCurrentRoomEnemies(state));
    finalizeSpellCast(state, hero.id, result.logEntries);
    syncCombatTurnState(state);
    return true;
  }

  return false;
}

export function canHeroCastSpellOnHero(state: GameState, heroId: string, targetHeroId: string): boolean {
  const hero = state.party.heroes.find((candidate) => candidate.id === heroId);
  const target = state.party.heroes.find((candidate) => candidate.id === targetHeroId);
  if (!hero || !target || hero.hp <= 0 || target.hp <= 0) return false;
  if (!canHeroCastSpells(hero)) return false;
  if (state.castModeHeroId !== heroId || state.selectedSpellId !== 'heal') return false;
  return hero.roomId === target.roomId && manhattanDistance(hero.tile, target.tile) <= SPELL_DEFINITIONS.heal.range;
}

export function canHeroCastSpellOnEnemy(state: GameState, heroId: string, enemyId: string): boolean {
  const hero = state.party.heroes.find((candidate) => candidate.id === heroId);
  const enemy = getCurrentRoomEnemies(state).find((candidate) => candidate.id === enemyId && candidate.hp > 0);
  if (!hero || hero.hp <= 0 || !enemy) return false;
  if (!canHeroCastSpells(hero)) return false;
  if (state.castModeHeroId !== heroId || !state.selectedSpellId) return false;
  const spell = SPELL_DEFINITIONS[state.selectedSpellId];
  return manhattanDistance(hero.tile, enemy.tile) <= spell.range;
}

export function isEnemySpellTargetable(state: GameState, heroId: string, enemyId: string): boolean {
  if (!state.selectedSpellId) return false;
  const spell = SPELL_DEFINITIONS[state.selectedSpellId];
  if (spell.targeting === 'ally') return false;
  return canHeroCastSpellOnEnemy(state, heroId, enemyId);
}

/**
 * Enables/disables backpack consumable use mode for the active hero.
 * @param state Game state.
 * @returns `true` when item use mode is now active.
 */
export function toggleItemUseMode(state: GameState): boolean {
  if (state.runState !== 'active') return false;
  const hero = getActiveHero(state.party);
  if (!canUseActiveHeroConsumable(state)) return false;
  state.attackModeHeroId = null;
  state.castModeHeroId = null;
  state.selectedSpellId = null;
  state.movingPath = [];
  state.hoverPath = [];
  state.spellPreviewTiles = [];
  state.itemUseModeHeroId = state.itemUseModeHeroId === hero.id ? null : hero.id;
  return state.itemUseModeHeroId === hero.id;
}

/**
 * Uses one consumable from the active hero backpack and consumes 1 AP in combat.
 * @param state Game state.
 * @param itemId Consumable item id selected from backpack.
 * @returns `true` when an item was used.
 */
export function useActiveHeroBackpackConsumable(state: GameState, itemId: string): boolean {
  if (state.runState !== 'active') return false;
  const hero = getActiveHero(state.party);
  if (state.itemUseModeHeroId !== hero.id) return false;
  if (!canUseActiveHeroConsumable(state)) return false;
  const backpackIndex = hero.equipment.backpack.findIndex((entry) => entry === itemId);
  if (backpackIndex < 0) return false;

  const consumable = CONSUMABLE_DEFINITIONS[itemId as keyof typeof CONSUMABLE_DEFINITIONS];
  if (!consumable) return false;
  if (!isUsableConsumable(itemId, hero)) return false;

  if (consumable.effect === 'heal') {
    hero.hp = Math.min(hero.maxHp, hero.hp + consumable.value);
  }

  hero.equipment.backpack.splice(backpackIndex, 1);
  if (state.turn) {
    consumeHeroActionPoint(state, hero.id);
  }
  state.attackModeHeroId = null;
  state.castModeHeroId = null;
  state.selectedSpellId = null;
  state.itemUseModeHeroId = null;
  state.recentCombatLog.unshift(`${hero.className} used ${consumable.name} and restored ${consumable.value} HP`);
  state.recentCombatLog = state.recentCombatLog.slice(0, 6);
  return true;
}

/**
 * Returns whether a backpack item should be highlighted as usable right now.
 * @param state Game state.
 * @param heroId Hero identifier.
 * @param itemId Backpack item id.
 * @returns `true` when the item is a currently usable consumable in use mode.
 */
export function isBackpackConsumableTargetable(state: GameState, heroId: string, itemId: string): boolean {
  const hero = state.party.heroes.find((candidate) => candidate.id === heroId);
  if (!hero) return false;
  return state.itemUseModeHeroId === heroId && hero.equipment.backpack.includes(itemId) && isUsableConsumable(itemId, hero);
}

function isUsableConsumable(itemId: string, hero: HeroState): boolean {
  const consumable = CONSUMABLE_DEFINITIONS[itemId as keyof typeof CONSUMABLE_DEFINITIONS];
  if (!consumable) return false;
  if (consumable.effect === 'heal') return hero.hp < hero.maxHp;
  return false;
}

/**
 * Returns whether a room currently blocks exit transitions.
 * @param room Room to inspect.
 * @returns `true` when encounter must be cleared before leaving.
 */
export function isRoomEncounterBlockingExit(room: RoomData): boolean {
  return room.roomType === 'combat' && room.encounter !== null && !room.encounter.isCleared;
}

/**
 * Returns the encounter state for a room if present.
 * @param room Room to inspect.
 * @returns Encounter state or `null`.
 */
export function getRoomEncounter(room: RoomData): RoomEncounterState | null {
  return room.encounter;
}

export function isRoomObjectiveCleared(room: RoomData): boolean {
  if (room.roomType === 'combat') {
    return room.encounter !== null && room.encounter.isCleared;
  }
  if (room.roomType === 'treasure') {
    return room.progress.hasBeenEntered && room.progress.hasBeenExited;
  }
  return true;
}

export function areAllRequiredRoomsCleared(dungeon: DungeonState): boolean {
  for (const room of dungeon.rooms.values()) {
    if (room.roomType === 'exit') continue;
    if (!isRoomObjectiveCleared(room)) return false;
  }
  return true;
}

function isTileOccupiedByEnemy(state: GameState, roomId: string, coord: Coord): boolean {
  const roomEnemies = state.dungeon.enemiesByRoomId.get(roomId) ?? [];
  return roomEnemies.some((enemy) => enemy.hp > 0 && sameCoord(enemy.tile, coord));
}

export function setRunState(state: GameState, next: RunState): void {
  state.runState = next;
  if (next !== 'active') {
    state.turn = null;
    state.turnAutomationReadyAt = null;
    state.hoverPath = [];
    state.spellPreviewTiles = [];
    state.movingPath = [];
    state.attackModeHeroId = null;
    state.castModeHeroId = null;
    state.selectedSpellId = null;
    state.itemUseModeHeroId = null;
    state.readyByHeroId.clear();
  }
  ensureActiveHeroIsLiving(state);
}

export function ensureActiveHeroIsLiving(state: GameState): void {
  const current = state.party.heroes[state.party.activeHeroIndex];
  if (current && current.hp > 0) return;

  const nextIndex = state.party.heroes.findIndex((hero) => hero.hp > 0);
  if (nextIndex >= 0) {
    state.party.activeHeroIndex = nextIndex;
  }
}

export function getRunSummaryView(state: GameState): RunSummaryView {
  const highestFloorReached = state.party.heroes.reduce((maxFloor, hero) => {
    const floor = state.dungeon.floorByRoomId.get(hero.roomId) ?? 1;
    return Math.max(maxFloor, floor);
  }, 1);

  return {
    result: state.runState,
    seed: state.dungeon.seed,
    discoveredRooms: state.dungeon.discoveredRoomIds.size,
    floorsReached: highestFloorReached,
    survivingHeroes: state.party.heroes.filter((hero) => hero.hp > 0).length,
  };
}

function finalizeSpellCast(state: GameState, heroId: string, logEntries: string[]): void {
  const resources = state.turn?.heroResourcesById[heroId];
  if (resources) {
    resources.attackSlotAvailable = false;
  }
  state.recentCombatLog.unshift(...logEntries.reverse());
  state.recentCombatLog = state.recentCombatLog.slice(0, 6);
  state.castModeHeroId = null;
  state.selectedSpellId = null;
  state.attackModeHeroId = null;
  state.hoverPath = [];
  state.spellPreviewTiles = [];
  state.movingPath = [];
}

function formatCombatLogEntry(
  attackerLabel: string,
  defenderLabel: string,
  roll: CombatRollSnapshot,
  defenderDefeated: boolean,
): string {
  return `${attackerLabel} -> ${defenderLabel} | atk [${roll.attackRolls.join(',')}] def [${roll.defenseRolls.join(',')}] dmg ${roll.finalDamage}${defenderDefeated ? ' | defeated' : ''}`;
}
