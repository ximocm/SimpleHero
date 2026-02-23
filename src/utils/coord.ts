import type { Coord, Direction, RoomCoord } from '../data/dungeonTypes.js';

export function roomIdFromCoord(coord: RoomCoord): string {
  return `${coord.x},${coord.y}`;
}

export function sameCoord(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

export function directionToDelta(direction: Direction): Coord {
  if (direction === 'N') return { x: 0, y: -1 };
  if (direction === 'S') return { x: 0, y: 1 };
  if (direction === 'E') return { x: 1, y: 0 };
  return { x: -1, y: 0 };
}

export function oppositeDirection(direction: Direction): Direction {
  if (direction === 'N') return 'S';
  if (direction === 'S') return 'N';
  if (direction === 'E') return 'W';
  return 'E';
}

export function moveRoomCoord(coord: RoomCoord, direction: Direction): RoomCoord {
  const delta = directionToDelta(direction);
  return { x: coord.x + delta.x, y: coord.y + delta.y };
}
