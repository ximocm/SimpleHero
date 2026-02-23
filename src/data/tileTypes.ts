export enum TileType {
  VOID_BLACK = 'VOID_BLACK',
  FLOOR = 'FLOOR',
  EXIT = 'EXIT',
}

export const WALKABLE_TILES = new Set<TileType>([
  TileType.FLOOR,
  TileType.EXIT,
]);

export function isWalkable(tile: TileType): boolean {
  return WALKABLE_TILES.has(tile);
}
