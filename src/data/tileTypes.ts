export enum TileType {
  VOID_BLACK = 'VOID_BLACK',
  FLOOR = 'FLOOR',
  EXIT = 'EXIT',
}

export const WALKABLE_TILES = new Set<TileType>([
  TileType.FLOOR,
  TileType.EXIT,
]);

/**
 * Checks whether a tile type can be walked on.
 * @param tile Tile type to evaluate.
 * @returns `true` when tile is in the walkable set.
 */
export function isWalkable(tile: TileType): boolean {
  return WALKABLE_TILES.has(tile);
}
