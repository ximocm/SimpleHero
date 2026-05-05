import type {
  CombatTurnState,
  Coord,
  EnemyState,
  HeroState,
  HeroTurnResources,
  RoomData,
} from '../data/dungeonTypes.js';
import { RACE_DEFINITIONS } from '../heroes/races.js';
import { ARMOR_DEFINITIONS } from '../items/armors.js';
import { TileType } from '../data/tileTypes.js';
import { sameCoord } from '../utils/coord.js';
import { findPathAStar } from '../utils/pathfinding.js';
import type { GameState } from './gameSystem.js';
import { performEnemyAttack } from './combatSystem.js';

const DEFAULT_ACTION_POINTS = 2;
const AUTOMATED_TURN_DELAY_MS = 280;

export interface TurnBannerView {
  isCombatActive: boolean;
  activeLabel: string;
  round: number;
  heroResources: HeroTurnResources | null;
}

/**
 * Synchronizes combat turn state with the current room.
 * @param state Game state.
 * @returns Nothing.
 */
export function syncCombatTurnState(state: GameState): void {
  if (state.runState !== 'active') {
    state.turn = null;
    state.turnAutomationReadyAt = null;
    state.attackModeHeroId = null;
    state.castModeHeroId = null;
    state.skillModeHeroId = null;
    state.selectedSpellId = null;
    state.selectedSkillId = null;
    return;
  }
  const room = state.dungeon.rooms.get(state.dungeon.currentRoomId);
  if (!room || !shouldRunCombatTurns(room)) {
    state.turn = null;
    state.turnAutomationReadyAt = null;
    state.attackModeHeroId = null;
    state.castModeHeroId = null;
    state.skillModeHeroId = null;
    state.selectedSpellId = null;
    state.selectedSkillId = null;
    return;
  }

  if (state.turn?.roomId === room.id) {
    normalizeTurnState(state, room);
    return;
  }

  state.turn = createCombatTurnState(state, room);
  state.turnAutomationReadyAt = null;
}

/**
 * Advances automated enemy turns when the enemy phase is active.
 * @param state Game state.
 * @param nowMs Current clock time in milliseconds.
 * @returns `true` when state changed.
 */
export function advanceAutomatedTurns(state: GameState, nowMs: number): boolean {
  if (state.runState !== 'active') return false;
  const turn = state.turn;
  if (!turn || turn.phase !== 'enemies') return false;

  const enemyId = turn.enemyQueue[turn.activeEnemyIndex];
  if (!enemyId) {
    beginHeroPhase(state);
    return true;
  }

  if (state.turnAutomationReadyAt === null) {
    state.turnAutomationReadyAt = nowMs + AUTOMATED_TURN_DELAY_MS;
    return false;
  }
  if (nowMs < state.turnAutomationReadyAt) return false;

  resolveEnemyTurn(state, enemyId);
  turn.activeEnemyIndex += 1;

  if (turn.activeEnemyIndex >= turn.enemyQueue.length) {
    beginHeroPhase(state);
  } else {
    state.turnAutomationReadyAt = nowMs + AUTOMATED_TURN_DELAY_MS;
  }

  state.hoverPath = [];
  state.movingPath = [];
  return true;
}

/**
 * Passes from the heroes phase to the enemy phase.
 * @param state Game state.
 * @returns Nothing.
 */
export function passTurn(state: GameState): void {
  if (state.runState !== 'active') return;
  const turn = state.turn;
  if (!turn || turn.phase !== 'heroes') return;
  beginEnemyPhase(state);
}

/**
 * Returns whether the currently selected hero can act during the current phase.
 * @param state Game state.
 * @param heroId Hero identifier.
 * @returns `true` when that hero belongs to the active heroes phase.
 */
export function canHeroActNow(state: GameState, heroId: string): boolean {
  if (state.runState !== 'active') return false;
  const hero = state.party.heroes.find((candidate) => candidate.id === heroId);
  if (!hero || hero.hp <= 0) return false;
  const turn = state.turn;
  if (!turn) return true;
  if (turn.phase !== 'heroes') return false;
  return Boolean(turn.heroResourcesById[heroId]);
}

/**
 * Returns whether a hero may be selected during the current phase.
 * @param state Game state.
 * @param heroId Hero identifier.
 * @returns `true` when the hero can become the selected party member.
 */
export function canSelectHeroThisPhase(state: GameState, heroId: string): boolean {
  const hero = state.party.heroes.find((candidate) => candidate.id === heroId);
  if (!hero || hero.hp <= 0) return false;

  const turn = state.turn;
  if (!turn) return true;
  if (turn.phase !== 'heroes') return false;
  return hero.roomId === turn.roomId;
}

/**
 * Consumes one tile of movement from the selected hero.
 * @param state Game state.
 * @param heroId Hero identifier.
 * @returns Remaining movement.
 */
export function consumeHeroMovement(state: GameState, heroId: string): number {
  const resources = getHeroResourcesRef(state, heroId);
  if (!resources) return Number.MAX_SAFE_INTEGER;
  resources.movementRemaining = Math.max(0, resources.movementRemaining - 1);
  return resources.movementRemaining;
}

/**
 * Consumes one action point from the selected hero.
 * @param state Game state.
 * @param heroId Hero identifier.
 * @returns Remaining action points.
 */
export function consumeHeroActionPoint(state: GameState, heroId: string): number {
  const resources = getHeroResourcesRef(state, heroId);
  if (!resources) return Number.MAX_SAFE_INTEGER;
  resources.actionPointsRemaining = Math.max(0, resources.actionPointsRemaining - 1);
  return resources.actionPointsRemaining;
}

/**
 * Returns current resources for the selected hero during heroes phase.
 * @param state Game state.
 * @returns Resource snapshot or `null`.
 */
export function getCurrentHeroTurnResources(state: GameState): HeroTurnResources | null {
  const hero = state.party.heroes[state.party.activeHeroIndex];
  if (!hero || hero.hp <= 0) return null;
  const resources = getHeroResourcesRef(state, hero.id);
  return resources ? { ...resources } : null;
}

/**
 * Returns whether the heroes phase is active.
 * @param state Game state.
 * @returns `true` when player-controlled heroes may act.
 */
export function isCurrentTurnHero(state: GameState): boolean {
  return state.turn?.phase === 'heroes';
}

/**
 * Returns current turn banner information for UI.
 * @param state Game state.
 * @returns Banner view model.
 */
export function getTurnBannerView(state: GameState): TurnBannerView {
  const turn = state.turn;
  if (!turn) {
    return {
      isCombatActive: false,
      activeLabel: 'Exploration',
      round: 0,
      heroResources: null,
    };
  }

  if (turn.phase === 'heroes') {
    return {
      isCombatActive: true,
      activeLabel: 'Heroes Phase',
      round: turn.round,
      heroResources: getCurrentHeroTurnResources(state),
    };
  }

  const enemyId = turn.enemyQueue[turn.activeEnemyIndex];
  const enemy = (state.dungeon.enemiesByRoomId.get(turn.roomId) ?? []).find((candidate) => candidate.id === enemyId);
  return {
    isCombatActive: true,
    activeLabel: enemy ? `${enemy.kind} Phase` : 'Enemies Phase',
    round: turn.round,
    heroResources: null,
  };
}

/**
 * Resolves hero movement allowance from race and armor.
 * @param hero Hero to evaluate.
 * @returns Final movement for the current turn.
 */
export function getHeroFinalMovement(hero: HeroState): number {
  const race = RACE_DEFINITIONS[hero.raceName];
  const armorId = hero.equipment.armor;
  const armor =
    armorId && Object.prototype.hasOwnProperty.call(ARMOR_DEFINITIONS, armorId)
      ? ARMOR_DEFINITIONS[armorId as keyof typeof ARMOR_DEFINITIONS]
      : null;
  const armorModifier = armor?.movementModifier ?? 0;
  return Math.max(0, race.baseMovement + armorModifier);
}

function createCombatTurnState(state: GameState, room: RoomData): CombatTurnState {
  return {
    roomId: room.id,
    round: 1,
    phase: 'heroes',
    heroResourcesById: createHeroResourcesById(state, room.id),
    enemyQueue: [],
    activeEnemyIndex: 0,
  };
}

function normalizeTurnState(state: GameState, room: RoomData): void {
  const turn = state.turn;
  if (!turn) return;

  const allowedHeroIds = new Set(
    state.party.heroes.filter((hero) => hero.roomId === room.id && hero.hp > 0).map((hero) => hero.id),
  );
  const allowedEnemyIds = new Set(
    (state.dungeon.enemiesByRoomId.get(room.id) ?? []).filter((enemy) => enemy.hp > 0).map((enemy) => enemy.id),
  );

  const nextHeroResources: Record<string, HeroTurnResources> = {};
  for (const hero of state.party.heroes) {
    if (!allowedHeroIds.has(hero.id)) continue;
    nextHeroResources[hero.id] = sanitizeHeroResources(turn.heroResourcesById[hero.id], hero);
  }

  turn.heroResourcesById = nextHeroResources;
  turn.enemyQueue = turn.enemyQueue.filter((enemyId) => allowedEnemyIds.has(enemyId));
  turn.activeEnemyIndex = Math.max(0, Math.min(turn.activeEnemyIndex, Math.max(0, turn.enemyQueue.length - 1)));

  if (turn.phase === 'heroes' && Object.keys(turn.heroResourcesById).length === 0) {
    beginEnemyPhase(state);
  }
  if (turn.phase === 'enemies' && turn.enemyQueue.length === 0) {
    beginHeroPhase(state);
  }
}

function createHeroResourcesById(state: GameState, roomId: string): Record<string, HeroTurnResources> {
  const resourcesById: Record<string, HeroTurnResources> = {};
  for (const hero of state.party.heroes) {
    if (hero.roomId !== roomId || hero.hp <= 0) continue;
    resourcesById[hero.id] = {
      movementRemaining: getHeroFinalMovement(hero),
      actionPointsRemaining: DEFAULT_ACTION_POINTS,
      attackSlotAvailable: true,
    };
  }
  return resourcesById;
}

function sanitizeHeroResources(value: HeroTurnResources | undefined, hero: HeroState): HeroTurnResources {
  return {
    movementRemaining: Math.max(0, value?.movementRemaining ?? getHeroFinalMovement(hero)),
    actionPointsRemaining: Math.max(0, value?.actionPointsRemaining ?? DEFAULT_ACTION_POINTS),
    attackSlotAvailable: value?.attackSlotAvailable ?? true,
  };
}

function beginEnemyPhase(state: GameState): void {
  const turn = state.turn;
  if (!turn) return;

  turn.phase = 'enemies';
  turn.enemyQueue = (state.dungeon.enemiesByRoomId.get(turn.roomId) ?? [])
    .filter((enemy) => enemy.hp > 0)
    .map((enemy) => enemy.id);
  turn.activeEnemyIndex = 0;
  state.turnAutomationReadyAt = null;
  state.hoverPath = [];
  state.movingPath = [];
  state.attackModeHeroId = null;
  state.castModeHeroId = null;
  state.skillModeHeroId = null;
  state.selectedSpellId = null;
  state.selectedSkillId = null;
  for (const hero of state.party.heroes) {
    for (const key of Object.keys(hero.skillCooldowns)) {
      const k = key as keyof typeof hero.skillCooldowns;
      hero.skillCooldowns[k] = Math.max(0, (hero.skillCooldowns[k] ?? 0) - 1);
    }
  }
}

function beginHeroPhase(state: GameState): void {
  const turn = state.turn;
  if (!turn) return;

  turn.phase = 'heroes';
  turn.round += 1;
  turn.heroResourcesById = createHeroResourcesById(state, turn.roomId);
  turn.enemyQueue = [];
  turn.activeEnemyIndex = 0;
  state.turnAutomationReadyAt = null;
  state.hoverPath = [];
  state.movingPath = [];
  state.castModeHeroId = null;
  state.selectedSpellId = null;

  const firstHeroIndex = state.party.heroes.findIndex(
    (hero) => hero.roomId === turn.roomId && hero.hp > 0 && turn.heroResourcesById[hero.id],
  );
  if (firstHeroIndex >= 0) state.party.activeHeroIndex = firstHeroIndex;
}

function getHeroResourcesRef(state: GameState, heroId: string): HeroTurnResources | null {
  const turn = state.turn;
  if (!turn || turn.phase !== 'heroes') return null;
  return turn.heroResourcesById[heroId] ?? null;
}

function shouldRunCombatTurns(room: RoomData): boolean {
  return room.roomType === 'combat' && room.encounter !== null && !room.encounter.isCleared;
}

function resolveEnemyTurn(state: GameState, enemyId: string): void {
  const roomId = state.dungeon.currentRoomId;
  const enemies = state.dungeon.enemiesByRoomId.get(roomId) ?? [];
  const enemy = enemies.find((candidate) => candidate.id === enemyId);
  if (!enemy || enemy.hp <= 0) return;

  const heroes = state.party.heroes.filter((hero) => hero.roomId === roomId && hero.hp > 0);
  if (heroes.length === 0) return;

  if (enemy.kind === 'skeleton-archer') {
    resolveSkeletonArcherTurn(state, roomId, enemy, heroes);
    enemy.statusEffects.rootedTurns = Math.max(0, enemy.statusEffects.rootedTurns - 1);
    return;
  }

  const target = findNearestHero(enemy.tile, heroes);
  if (!target) return;
  if (manhattanDistance(enemy.tile, target.tile) <= enemy.range) {
    const result = performEnemyAttack(state, enemy, target);
    state.lastCombatRoll = result.roll;
    state.recentCombatLog.unshift(
      `${enemy.kind} -> ${target.className} | atk [${result.roll.attackRolls.join(',')}] def [${result.roll.defenseRolls.join(',')}] dmg ${result.roll.finalDamage}${result.defenderDefeated ? ' | defeated' : ''}`,
    );
    state.recentCombatLog = state.recentCombatLog.slice(0, 6);
    enemy.statusEffects.rootedTurns = Math.max(0, enemy.statusEffects.rootedTurns - 1);
    return;
  }

  const path = findPathAStar(enemy.tile, target.tile, (coord) =>
    canEnemyPathThrough(state, roomId, coord, target.tile),
  );
  if (path.length < 2) return;

  const maxSteps = Math.max(0, enemy.movement - Math.max(0, enemy.statusEffects.rootedTurns));
  if (maxSteps === 0) return;

  const furthestIndex = Math.min(path.length - 2, maxSteps);
  const destination = path[furthestIndex];
  if (!destination) {
    enemy.statusEffects.rootedTurns = Math.max(0, enemy.statusEffects.rootedTurns - 1);
    return;
  }
  enemy.tile = { ...destination };
  enemy.statusEffects.rootedTurns = Math.max(0, enemy.statusEffects.rootedTurns - 1);
}

function resolveSkeletonArcherTurn(
  state: GameState,
  roomId: string,
  enemy: EnemyState,
  heroes: HeroState[],
): void {
  const inRangeTarget = [...heroes]
    .filter((hero) => manhattanDistance(hero.tile, enemy.tile) <= enemy.range)
    .sort((a, b) => {
      if (a.hp !== b.hp) return a.hp - b.hp;
      const da = manhattanDistance(a.tile, enemy.tile);
      const db = manhattanDistance(b.tile, enemy.tile);
      if (da !== db) return da - db;
      return a.id.localeCompare(b.id);
    })[0];

  if (inRangeTarget) {
    const result = performEnemyAttack(state, enemy, inRangeTarget);
    state.lastCombatRoll = result.roll;
    state.recentCombatLog.unshift(
      `${enemy.kind} -> ${inRangeTarget.className} | atk [${result.roll.attackRolls.join(',')}] def [${result.roll.defenseRolls.join(',')}] dmg ${result.roll.finalDamage}${result.defenderDefeated ? ' | defeated' : ''}`,
    );
    state.recentCombatLog = state.recentCombatLog.slice(0, 6);
    return;
  }

  const maxSteps = Math.max(0, enemy.movement - Math.max(0, enemy.statusEffects.rootedTurns));
  if (maxSteps === 0) return;

  const reachableTiles = getReachableEnemyTiles(state, roomId, enemy, maxSteps);
  if (reachableTiles.length === 0) return;

  const destination = [...reachableTiles].sort((a, b) => compareArcherTiles(a, b, heroes))[0];
  if (!destination || sameCoord(destination, enemy.tile)) return;
  enemy.tile = { ...destination };
}

function compareArcherTiles(a: Coord, b: Coord, heroes: HeroState[]): number {
  const scoreA = scoreArcherTile(a, heroes);
  const scoreB = scoreArcherTile(b, heroes);

  if (scoreA.bandPenalty !== scoreB.bandPenalty) return scoreA.bandPenalty - scoreB.bandPenalty;
  if (scoreA.firingPenalty !== scoreB.firingPenalty) return scoreA.firingPenalty - scoreB.firingPenalty;
  if (scoreA.desiredDistancePenalty !== scoreB.desiredDistancePenalty) {
    return scoreA.desiredDistancePenalty - scoreB.desiredDistancePenalty;
  }
  if (scoreA.lowestTargetHp !== scoreB.lowestTargetHp) return scoreA.lowestTargetHp - scoreB.lowestTargetHp;
  if (scoreA.nearestHeroDistance !== scoreB.nearestHeroDistance) return scoreB.nearestHeroDistance - scoreA.nearestHeroDistance;
  if (a.y !== b.y) return a.y - b.y;
  return a.x - b.x;
}

function scoreArcherTile(tile: Coord, heroes: HeroState[]): {
  bandPenalty: number;
  firingPenalty: number;
  desiredDistancePenalty: number;
  lowestTargetHp: number;
  nearestHeroDistance: number;
} {
  const distances = heroes.map((hero) => ({
    hero,
    distance: manhattanDistance(tile, hero.tile),
  }));
  const nearestHeroDistance = Math.min(...distances.map(({ distance }) => distance));
  const heroesInRange = distances.filter(({ distance }) => distance <= 4);
  const lowestTargetHp =
    heroesInRange.length > 0 ? Math.min(...heroesInRange.map(({ hero }) => hero.hp)) : Number.MAX_SAFE_INTEGER;

  return {
    bandPenalty: nearestHeroDistance >= 3 && nearestHeroDistance <= 4 ? 0 : 1,
    firingPenalty: heroesInRange.length > 0 ? 0 : 1,
    desiredDistancePenalty: Math.abs(4 - nearestHeroDistance),
    lowestTargetHp,
    nearestHeroDistance,
  };
}

function getReachableEnemyTiles(
  state: GameState,
  roomId: string,
  enemy: EnemyState,
  maxSteps: number,
): Coord[] {
  const room = state.dungeon.rooms.get(roomId);
  if (!room) return [];

  const reachable: Coord[] = [];
  for (let y = 0; y < room.height; y += 1) {
    for (let x = 0; x < room.width; x += 1) {
      const coord = { x, y };
      if (sameCoord(coord, enemy.tile)) {
        reachable.push(coord);
        continue;
      }

      const path = findPathAStar(enemy.tile, coord, (candidate) =>
        canEnemyPathThrough(state, roomId, candidate, coord, enemy.id),
      );
      if (path.length < 2) continue;
      if (path.length - 1 > maxSteps) continue;
      reachable.push(coord);
    }
  }

  return reachable;
}

function findNearestHero(origin: Coord, heroes: HeroState[]): HeroState | null {
  return (
    [...heroes].sort((a, b) => {
      const da = manhattanDistance(a.tile, origin);
      const db = manhattanDistance(b.tile, origin);
      if (da !== db) return da - db;
      return a.id.localeCompare(b.id);
    })[0] ?? null
  );
}

function canEnemyPathThrough(
  state: GameState,
  roomId: string,
  coord: Coord,
  targetTile: Coord,
  movingEnemyId?: string,
): boolean {
  const room = state.dungeon.rooms.get(roomId);
  if (!room) return false;
  if (!isWalkableCoord(room, coord)) return false;
  if (sameCoord(coord, targetTile)) return true;

  const heroOccupied = state.party.heroes.some(
    (hero) => hero.roomId === roomId && hero.hp > 0 && sameCoord(hero.tile, coord),
  );
  if (heroOccupied) return false;

  const enemyOccupied = (state.dungeon.enemiesByRoomId.get(roomId) ?? []).some(
    (enemy) => enemy.id !== movingEnemyId && enemy.hp > 0 && sameCoord(enemy.tile, coord),
  );
  return !enemyOccupied;
}

function isWalkableCoord(room: RoomData, coord: Coord): boolean {
  return (
    coord.x >= 0 &&
    coord.y >= 0 &&
    coord.x < room.width &&
    coord.y < room.height &&
    room.tiles[coord.y][coord.x] !== TileType.VOID_BLACK
  );
}

function manhattanDistance(a: Coord, b: Coord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
