import type { Coord, Direction, RoomCoord, RoomData, RoomType } from '../data/dungeonTypes.js';
import { TileType } from '../data/tileTypes.js';
import { chooseRoomTemplate } from '../rooms/roomSelector.js';
import type { RoomTemplate } from '../rooms/roomTemplates.js';
import { roomIdFromCoord } from '../utils/coord.js';
import { createRng, seedFromRoom } from '../utils/seed.js';

const EXIT_BY_MARKER: Record<string, Direction> = {
  N: 'N',
  E: 'E',
  S: 'S',
  W: 'W',
};

/**
 * Creates room data by selecting and parsing a room template.
 * @param runSeed Global run seed.
 * @param coord Room coordinate.
 * @returns Generated room data.
 */
export function createRoom(runSeed: number, coord: RoomCoord, roomType: RoomType): RoomData {
  const template = chooseRoomTemplate(runSeed, coord);
  const id = roomIdFromCoord(coord);
  const parsed = parseTemplate(template);

  return {
    id,
    coord,
    width: parsed.width,
    height: parsed.height,
    tiles: parsed.tiles,
    exits: parsed.exits,
    roomType,
    encounter: roomType === 'combat' ? { enemyIds: [], isCleared: true } : null,
    treasure: roomType === 'treasure' ? createTreasureState(runSeed, id) : null,
    progress: {
      hasBeenEntered: false,
      hasBeenExited: false,
    },
  };
}

/**
 * Parses a matrix template into tile grid and exits.
 * @param template Template to parse.
 * @returns Parsed room dimensions, tiles and exits.
 */
function parseTemplate(template: RoomTemplate): {
  width: number;
  height: number;
  tiles: TileType[][];
  exits: Partial<Record<Direction, Coord>>;
} {
  const { matrix } = template;
  if (matrix.length === 0) {
    throw new Error(`Room template "${template.id}" is empty.`);
  }

  const width = matrix[0].length;
  if (width === 0) {
    throw new Error(`Room template "${template.id}" has an empty row.`);
  }

  const height = matrix.length;
  const tiles: TileType[][] = [];
  const exits: Partial<Record<Direction, Coord>> = {};

  for (let y = 0; y < height; y += 1) {
    const row = matrix[y];
    if (row.length !== width) {
      throw new Error(`Room template "${template.id}" has inconsistent row width at y=${y}.`);
    }

    const tileRow: TileType[] = [];
    for (let x = 0; x < width; x += 1) {
      const marker = row[x];

      if (marker === '.') {
        tileRow.push(TileType.FLOOR);
        continue;
      }

      const exitDirection = EXIT_BY_MARKER[marker];
      if (exitDirection) {
        tileRow.push(TileType.EXIT);
        exits[exitDirection] = { x, y };
        continue;
      }

      tileRow.push(TileType.VOID_BLACK);
    }

    tiles.push(tileRow);
  }

  stampDefaultExits(tiles, exits, width, height);

  return { width, height, tiles, exits };
}

function stampDefaultExits(
  tiles: TileType[][],
  exits: Partial<Record<Direction, Coord>>,
  width: number,
  height: number,
): void {
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);

  if (!exits.N) {
    exits.N = { x: centerX, y: 1 };
    tiles[1][centerX] = TileType.EXIT;
  }
  if (!exits.S) {
    exits.S = { x: centerX, y: height - 2 };
    tiles[height - 2][centerX] = TileType.EXIT;
  }
  if (!exits.W) {
    exits.W = { x: 0, y: centerY };
    tiles[centerY][0] = TileType.EXIT;
  }
  if (!exits.E) {
    exits.E = { x: width - 1, y: centerY };
    tiles[centerY][width - 1] = TileType.EXIT;
  }
}

function createTreasureState(runSeed: number, roomId: string): RoomData['treasure'] {
  const rng = createRng(seedFromRoom(runSeed, `${roomId}:treasure`));
  return {
    rewardId: rng() < 0.35 ? 'ruby' : 'gold',
    isCollected: false,
  };
}
