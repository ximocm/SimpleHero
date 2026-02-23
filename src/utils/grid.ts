import { Coord } from '../data/dungeonTypes';

export function coordKey(coord: Coord): string {
  return `${coord.x},${coord.y}`;
}

export function inBounds(coord: Coord, width: number, height: number): boolean {
  return coord.x >= 0 && coord.y >= 0 && coord.x < width && coord.y < height;
}

export function neighbors4(coord: Coord): Coord[] {
  return [
    { x: coord.x, y: coord.y - 1 },
    { x: coord.x + 1, y: coord.y },
    { x: coord.x, y: coord.y + 1 },
    { x: coord.x - 1, y: coord.y },
  ];
}

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

