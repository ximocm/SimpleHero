import type { Coord, Direction, RoomCoord } from '../data/dungeonTypes.js';

/**
 * Converts room coordinates into a stable room id.
 * @param coord Room coordinate.
 * @returns Room id in `x,y` format.
 */
export function roomIdFromCoord(coord: RoomCoord): string {
  return `${coord.x},${coord.y}`;
}

/**
 * Compares two coordinates for exact equality.
 * @param a First coordinate.
 * @param b Second coordinate.
 * @returns `true` when both x and y are equal.
 */
export function sameCoord(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * Converts a cardinal direction to its delta vector.
 * @param direction Direction to convert.
 * @returns Coordinate delta for one step in that direction.
 */
export function directionToDelta(direction: Direction): Coord {
  if (direction === 'N') return { x: 0, y: -1 };
  if (direction === 'S') return { x: 0, y: 1 };
  if (direction === 'E') return { x: 1, y: 0 };
  return { x: -1, y: 0 };
}

/**
 * Returns the opposite cardinal direction.
 * @param direction Input direction.
 * @returns Opposite direction.
 */
export function oppositeDirection(direction: Direction): Direction {
  if (direction === 'N') return 'S';
  if (direction === 'S') return 'N';
  if (direction === 'E') return 'W';
  return 'E';
}

/**
 * Moves a room coordinate one step in the given direction.
 * @param coord Starting room coordinate.
 * @param direction Direction to move.
 * @returns New room coordinate.
 */
export function moveRoomCoord(coord: RoomCoord, direction: Direction): RoomCoord {
  const delta = directionToDelta(direction);
  return { x: coord.x + delta.x, y: coord.y + delta.y };
}
