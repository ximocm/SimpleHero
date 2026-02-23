export enum TileType {
  VOID_BLACK = 'VOID_BLACK',
  FLOOR = 'FLOOR',
  SPAWN = 'SPAWN',
  EXIT = 'EXIT',
}

export const WALKABLE_TILES = new Set<TileType>([
  TileType.FLOOR,
  TileType.SPAWN,
  TileType.EXIT,
]);

export function isWalkable(tile: TileType): boolean {
  return WALKABLE_TILES.has(tile);
}

