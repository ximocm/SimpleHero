import type { Coord, Direction, RoomCoord, RoomData } from '../data/dungeonTypes.js';
import { TileType } from '../data/tileTypes.js';
import { roomIdFromCoord } from '../utils/coord.js';
import { createRng, seedFromRoom } from '../utils/seed.js';

export const ROOM_WIDTH = 16;
export const ROOM_HEIGHT = 12;

export function createRoom(runSeed: number, coord: RoomCoord): RoomData {
  const id = roomIdFromCoord(coord);
  const rng = createRng(seedFromRoom(runSeed, id));

  const tiles = createVoidGrid(ROOM_WIDTH, ROOM_HEIGHT);

  for (let y = 1; y < ROOM_HEIGHT - 1; y += 1) {
    for (let x = 1; x < ROOM_WIDTH - 1; x += 1) {
      tiles[y][x] = TileType.FLOOR;
    }
  }

  const exits = createExits(tiles);
  const spawnTiles = createSpawns(rng, exits);
  for (const spawn of spawnTiles) {
    tiles[spawn.y][spawn.x] = TileType.SPAWN;
  }

  return {
    id,
    coord,
    width: ROOM_WIDTH,
    height: ROOM_HEIGHT,
    tiles,
    exits,
    spawnTiles,
  };
}

function createVoidGrid(width: number, height: number): TileType[][] {
  const rows: TileType[][] = [];
  for (let y = 0; y < height; y += 1) {
    const row: TileType[] = [];
    for (let x = 0; x < width; x += 1) {
      row.push(TileType.VOID_BLACK);
    }
    rows.push(row);
  }
  return rows;
}

function createExits(tiles: TileType[][]): Partial<Record<Direction, Coord>> {
  const midX = Math.floor(ROOM_WIDTH / 2);
  const midY = Math.floor(ROOM_HEIGHT / 2);

  const exits: Partial<Record<Direction, Coord>> = {
    N: { x: midX, y: 1 },
    E: { x: ROOM_WIDTH - 2, y: midY },
    S: { x: midX, y: ROOM_HEIGHT - 2 },
    W: { x: 1, y: midY },
  };

  Object.values(exits).forEach((tile) => {
    if (!tile) return;
    tiles[tile.y][tile.x] = TileType.EXIT;
  });

  return exits;
}

function createSpawns(
  rng: () => number,
  exits: Partial<Record<Direction, Coord>>,
): Coord[] {
  const centerX = Math.floor(ROOM_WIDTH / 2);
  const centerY = Math.floor(ROOM_HEIGHT / 2);

  const offsets: Coord[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  const startIndex = Math.floor(rng() * offsets.length);
  const selected: Coord[] = [];
  for (let i = 0; i < 3; i += 1) {
    const off = offsets[(startIndex + i) % offsets.length];
    selected.push({ x: centerX + off.x, y: centerY + off.y });
  }

  if (Object.keys(exits).length === 0) {
    return [
      { x: centerX, y: centerY },
      { x: centerX + 1, y: centerY },
      { x: centerX - 1, y: centerY },
    ];
  }

  return selected;
}
