import type { Coord, Direction, EnemyKind, EnemyState, RoomData } from '../data/dungeonTypes.js';
import { isWalkable } from '../data/tileTypes.js';
import { ENEMY_DEFINITIONS } from '../enemies/enemyDefinitions.js';
import { roomIdFromCoord, sameCoord } from '../utils/coord.js';
import { seedFromRoom, createRng } from '../utils/seed.js';

const ENEMY_COMPOSITIONS: EnemyKind[][] = [
  ['skeleton-sword'],
  ['skeleton-archer'],
  ['skeleton-sword', 'skeleton-sword'],
  ['skeleton-sword', 'skeleton-archer'],
  ['skeleton-archer', 'skeleton-archer'],
  ['skeleton-sword', 'skeleton-sword', 'skeleton-archer'],
];

/**
 * Creates deterministic enemy states for a combat room.
 * @param runSeed Global run seed.
 * @param room Room to populate.
 * @param entryDirection Side heroes are expected to enter from.
 * @returns Spawned enemies in stable order.
 */
export function spawnEnemiesForRoom(
  runSeed: number,
  room: RoomData,
  entryDirection: Direction | null,
): EnemyState[] {
  if (room.roomType !== 'combat') return [];

  const composition = chooseEnemyComposition(runSeed, room.id);
  const occupiedByHeroes = getReservedHeroTiles(room, entryDirection);
  const spawnTiles = chooseEnemySpawnTiles(runSeed, room, composition.length, occupiedByHeroes, entryDirection);

  return composition.map((kind, index) => createEnemyState(kind, room.id, spawnTiles[index], index));
}

/**
 * Creates runtime state for a single enemy from the central definition catalog.
 * @param kind Enemy kind identifier.
 * @param roomId Owning room id.
 * @param tile Spawn tile.
 * @param index Stable enemy index within room.
 * @returns Enemy runtime state.
 */
export function createEnemyState(
  kind: EnemyKind,
  roomId: string,
  tile: Coord,
  index: number,
): EnemyState {
  const definition = ENEMY_DEFINITIONS[kind];
  return {
    id: `${roomId}:enemy-${index}`,
    kind,
    roomId,
    tile: { ...tile },
    hp: definition.maxHp,
    maxHp: definition.maxHp,
    movement: definition.movement,
    range: definition.range,
    attackDice: definition.attackDice,
    damage: definition.damage,
    defenseDiceBonus: definition.defenseDiceBonus,
    statusEffects: {
      rootedTurns: 0,
    },
  };
}

/**
 * Chooses a deterministic allowed enemy composition for a room.
 * @param runSeed Global run seed.
 * @param roomId Stable room id.
 * @returns Ordered enemy kind list.
 */
export function chooseEnemyComposition(runSeed: number, roomId: string): EnemyKind[] {
  const rng = createRng(seedFromRoom(runSeed, `${roomId}:enemy-composition`));
  const composition = ENEMY_COMPOSITIONS[Math.floor(rng() * ENEMY_COMPOSITIONS.length)];
  return [...composition];
}

function chooseEnemySpawnTiles(
  runSeed: number,
  room: RoomData,
  count: number,
  reservedHeroTiles: readonly Coord[],
  entryDirection: Direction | null,
): Coord[] {
  const candidates = getEnemySpawnCandidates(room, reservedHeroTiles);
  if (candidates.length < count) {
    throw new Error(`Room ${room.id} does not contain enough valid enemy spawn tiles.`);
  }

  const entryAnchor = getEntryAnchor(room, entryDirection);
  const spawnSeed = createRng(seedFromRoom(runSeed, `${room.id}:enemy-spawn`));
  const sortedByEntryDistance = [...candidates].sort((a, b) => {
    const da = manhattanDistance(a, entryAnchor);
    const db = manhattanDistance(b, entryAnchor);
    if (da !== db) return db - da;
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  const topBandSize = Math.min(sortedByEntryDistance.length, Math.max(count * 2, 4));
  const anchor = sortedByEntryDistance[Math.floor(spawnSeed() * topBandSize)];
  const selected: Coord[] = [anchor];

  while (selected.length < count) {
    const next = [...candidates]
      .filter((coord) => !selected.some((picked) => sameCoord(picked, coord)))
      .sort((a, b) => {
        const clusterA = manhattanDistance(a, anchor);
        const clusterB = manhattanDistance(b, anchor);
        if (clusterA !== clusterB) return clusterA - clusterB;

        const entryA = manhattanDistance(a, entryAnchor);
        const entryB = manhattanDistance(b, entryAnchor);
        if (entryA !== entryB) return entryB - entryA;

        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
      })[0];

    if (!next) break;
    selected.push(next);
  }

  if (selected.length !== count) {
    throw new Error(`Room ${room.id} failed deterministic enemy spawn selection.`);
  }

  return selected;
}

function getEnemySpawnCandidates(room: RoomData, reservedHeroTiles: readonly Coord[]): Coord[] {
  const exitTiles = Object.values(room.exits).filter((coord): coord is Coord => Boolean(coord));
  const candidates: Coord[] = [];

  for (let y = 0; y < room.height; y += 1) {
    for (let x = 0; x < room.width; x += 1) {
      const coord = { x, y };
      if (!isWalkable(room.tiles[y][x])) continue;
      if (exitTiles.some((exit) => sameCoord(exit, coord))) continue;
      if (reservedHeroTiles.some((heroTile) => sameCoord(heroTile, coord))) continue;
      candidates.push(coord);
    }
  }

  return candidates;
}

function getReservedHeroTiles(room: RoomData, entryDirection: Direction | null): Coord[] {
  const anchor = getEntryAnchor(room, entryDirection);
  const walkable: Coord[] = [];

  for (let y = 0; y < room.height; y += 1) {
    for (let x = 0; x < room.width; x += 1) {
      const coord = { x, y };
      if (!isWalkable(room.tiles[y][x])) continue;
      walkable.push(coord);
    }
  }

  walkable.sort((a, b) => {
    const da = manhattanDistance(a, anchor);
    const db = manhattanDistance(b, anchor);
    if (da !== db) return da - db;
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  return walkable.slice(0, 6);
}

function getEntryAnchor(room: RoomData, entryDirection: Direction | null): Coord {
  const exitCoord = entryDirection ? room.exits[entryDirection] : undefined;
  if (exitCoord) return exitCoord;
  return { x: Math.floor(room.width / 2), y: Math.floor(room.height / 2) };
}

/**
 * Derives the direction from a room toward its previous room in the linear floor chain.
 * @param room Current room.
 * @param previousCoord Previous room coordinate.
 * @returns Direction of the entry side, or `null` for the first room.
 */
export function getEntryDirectionForRoom(
  room: RoomData,
  previousCoord: { x: number; y: number } | null,
): Direction | null {
  if (!previousCoord) return null;
  const currentId = roomIdFromCoord(room.coord);
  const previousId = roomIdFromCoord(previousCoord);
  if (currentId === previousId) return null;

  if (previousCoord.x < room.coord.x) return 'W';
  if (previousCoord.x > room.coord.x) return 'E';
  if (previousCoord.y < room.coord.y) return 'N';
  return 'S';
}

function manhattanDistance(a: Coord, b: Coord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
