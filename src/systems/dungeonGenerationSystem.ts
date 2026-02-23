import type { Coord, Direction, RoomCoord, RoomData } from '../data/dungeonTypes.js';
import { TileType } from '../data/tileTypes.js';
import { chooseRoomTemplate } from '../rooms/roomSelector.js';
import type { RoomTemplate } from '../rooms/roomTemplates.js';
import { roomIdFromCoord } from '../utils/coord.js';

const EXIT_BY_MARKER: Record<string, Direction> = {
  N: 'N',
  E: 'E',
  S: 'S',
  W: 'W',
};

export function createRoom(runSeed: number, coord: RoomCoord): RoomData {
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
  };
}

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

  return { width, height, tiles, exits };
}
