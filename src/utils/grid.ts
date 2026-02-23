import type { Coord } from '../data/dungeonTypes.js';

/**
 * Converts a coordinate into a stable string key.
 * @param coord Coordinate to serialize.
 * @returns Key in `x,y` format.
 */
export function coordKey(coord: Coord): string {
  return `${coord.x},${coord.y}`;
}

/**
 * Checks whether a coordinate is inside grid bounds.
 * @param coord Coordinate to check.
 * @param width Grid width.
 * @param height Grid height.
 * @returns `true` when coordinate is in bounds.
 */
export function inBounds(coord: Coord, width: number, height: number): boolean {
  return coord.x >= 0 && coord.y >= 0 && coord.x < width && coord.y < height;
}

/**
 * Returns four-directional neighboring coordinates.
 * @param coord Origin coordinate.
 * @returns Neighbor coordinates in N, E, S, W order.
 */
export function neighbors4(coord: Coord): Coord[] {
  return [
    { x: coord.x, y: coord.y - 1 },
    { x: coord.x + 1, y: coord.y },
    { x: coord.x, y: coord.y + 1 },
    { x: coord.x - 1, y: coord.y },
  ];
}

/**
 * Maps canvas pixel coordinates to tile coordinates.
 * @param mouseX Cursor x in canvas-local space.
 * @param mouseY Cursor y in canvas-local space.
 * @param offsetX Board x offset in canvas.
 * @param offsetY Board y offset in canvas.
 * @param tileSize Tile size in pixels.
 * @returns Tile coordinate under the cursor.
 */
export function tileFromCanvas(
  mouseX: number,
  mouseY: number,
  offsetX: number,
  offsetY: number,
  tileSize: number,
): Coord {
  return {
    x: Math.floor((mouseX - offsetX) / tileSize),
    y: Math.floor((mouseY - offsetY) / tileSize),
  };
}
