import type { Coord } from '../data/dungeonTypes.js';
import { coordKey, neighbors4 } from './grid.js';

interface Node {
  coord: Coord;
  g: number;
  f: number;
}

function heuristic(a: Coord, b: Coord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function findPathAStar(
  start: Coord,
  goal: Coord,
  canWalk: (coord: Coord) => boolean,
): Coord[] {
  const startKey = coordKey(start);
  const goalKey = coordKey(goal);
  if (startKey === goalKey) return [start];

  const open: Node[] = [{ coord: start, g: 0, f: heuristic(start, goal) }];
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startKey, 0]]);
  const closed = new Set<string>();

  while (open.length > 0) {
    let bestIndex = 0;
    for (let i = 1; i < open.length; i += 1) {
      if (open[i].f < open[bestIndex].f) bestIndex = i;
    }

    const current = open.splice(bestIndex, 1)[0];
    const currentKey = coordKey(current.coord);
    if (currentKey === goalKey) {
      return reconstruct(goal, cameFrom);
    }

    closed.add(currentKey);

    for (const next of neighbors4(current.coord)) {
      const nextKey = coordKey(next);
      if (closed.has(nextKey) || !canWalk(next)) continue;

      const tentativeG = current.g + 1;
      const knownG = gScore.get(nextKey);
      if (knownG !== undefined && tentativeG >= knownG) continue;

      cameFrom.set(nextKey, currentKey);
      gScore.set(nextKey, tentativeG);

      const existing = open.find((n) => coordKey(n.coord) === nextKey);
      const f = tentativeG + heuristic(next, goal);
      if (existing) {
        existing.g = tentativeG;
        existing.f = f;
      } else {
        open.push({ coord: next, g: tentativeG, f });
      }
    }
  }

  return [];
}

function reconstruct(goal: Coord, cameFrom: Map<string, string>): Coord[] {
  const path: Coord[] = [goal];
  let currentKey = coordKey(goal);

  while (cameFrom.has(currentKey)) {
    const previous = cameFrom.get(currentKey);
    if (!previous) break;

    const [x, y] = previous.split(',').map(Number);
    path.push({ x, y });
    currentKey = previous;
  }

  return path.reverse();
}
