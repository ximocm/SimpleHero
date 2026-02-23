import type { Direction, DungeonState, RoomCoord, RoomData } from '../data/dungeonTypes.js';
import { createRng, seedFromRoom } from '../utils/seed.js';
import { moveRoomCoord, roomIdFromCoord } from '../utils/coord.js';
import { TileType } from '../data/tileTypes.js';
import { createRoom } from './dungeonGenerationSystem.js';

const FLOOR_COUNT_WEIGHTS: Array<{ floors: number; weight: number }> = [
  { floors: 3, weight: 10 },
  { floors: 4, weight: 20 },
  { floors: 5, weight: 40 },
  { floors: 6, weight: 20 },
  { floors: 7, weight: 10 },
];

const DIRECTIONS: Direction[] = ['N', 'E', 'S', 'W'];

/**
 * Creates full dungeon state, including pre-generated floors and rooms.
 * @param seed Run seed.
 * @returns Initialized dungeon state.
 */
export function createDungeonState(seed: number): DungeonState {
  const totalFloors = rollFloorCount(seed);
  const coords = generateFloorCoords(seed, totalFloors);
  const rooms = new Map<string, RoomData>();
  const floorByRoomId = new Map<string, number>();

  coords.forEach((coord, index) => {
    const room = createRoom(seed, coord);
    rooms.set(room.id, room);
    floorByRoomId.set(room.id, index + 1);
  });

  pruneDisconnectedExits(rooms);

  const originId = roomIdFromCoord(coords[0]);
  return {
    seed,
    totalFloors,
    floorByRoomId,
    rooms,
    discoveredRoomIds: new Set([originId]),
    currentRoomId: originId,
  };
}

/**
 * Retrieves a pre-generated room at coordinate.
 * @param state Dungeon state.
 * @param coord Room coordinate.
 * @returns Room data when present; otherwise `undefined`.
 */
export function getRoomAt(state: DungeonState, coord: RoomCoord): RoomData | undefined {
  return state.rooms.get(roomIdFromCoord(coord));
}

/**
 * Rolls total floor count using configured weighted distribution.
 * @param seed Run seed.
 * @returns Number of floors between 3 and 7.
 */
function rollFloorCount(seed: number): number {
  const rng = createRng(seedFromRoom(seed, 'dungeon-floor-count'));
  const totalWeight = FLOOR_COUNT_WEIGHTS.reduce((sum, item) => sum + item.weight, 0);
  const roll = rng() * totalWeight;

  let acc = 0;
  for (const item of FLOOR_COUNT_WEIGHTS) {
    acc += item.weight;
    if (roll <= acc) return item.floors;
  }

  return FLOOR_COUNT_WEIGHTS[FLOOR_COUNT_WEIGHTS.length - 1].floors;
}

/**
 * Generates connected room coordinates for all dungeon floors.
 * @param seed Run seed.
 * @param totalFloors Number of floors to generate.
 * @returns Ordered room coordinates from start to end floor.
 */
function generateFloorCoords(seed: number, totalFloors: number): RoomCoord[] {
  const rng = createRng(seedFromRoom(seed, 'dungeon-layout'));
  const coords: RoomCoord[] = [{ x: 0, y: 0 }];
  const used = new Set<string>([roomIdFromCoord(coords[0])]);

  while (coords.length < totalFloors) {
    const current = coords[coords.length - 1];
    const options = DIRECTIONS.map((direction) => moveRoomCoord(current, direction)).filter(
      (coord) => !used.has(roomIdFromCoord(coord)),
    );

    if (options.length === 0) {
      throw new Error('Failed to generate dungeon layout: no available room coordinates.');
    }

    const selected = options[Math.floor(rng() * options.length)];
    coords.push(selected);
    used.add(roomIdFromCoord(selected));
  }

  return coords;
}

/**
 * Removes exits that lead to non-generated rooms.
 * @param rooms Map of generated rooms keyed by room id.
 * @returns Nothing.
 */
function pruneDisconnectedExits(rooms: Map<string, RoomData>): void {
  for (const room of rooms.values()) {
    for (const [direction, exitCoord] of Object.entries(room.exits) as Array<
      [Direction, { x: number; y: number } | undefined]
    >) {
      if (!exitCoord) continue;

      const targetCoord = moveRoomCoord(room.coord, direction);
      const targetId = roomIdFromCoord(targetCoord);
      if (rooms.has(targetId)) continue;

      room.tiles[exitCoord.y][exitCoord.x] = TileType.FLOOR;
      delete room.exits[direction];
    }
  }
}
