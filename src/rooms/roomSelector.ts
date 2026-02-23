import type { RoomCoord } from '../data/dungeonTypes.js';
import { roomIdFromCoord } from '../utils/coord.js';
import { createRng, seedFromRoom } from '../utils/seed.js';
import { ROOM_TEMPLATES, type RoomTemplate } from './roomTemplates.js';

/**
 * Selects a room template deterministically for a room coordinate.
 * @param runSeed Global run seed.
 * @param coord Room coordinate.
 * @returns Selected room template.
 */
export function chooseRoomTemplate(runSeed: number, coord: RoomCoord): RoomTemplate {
  if (ROOM_TEMPLATES.length === 0) {
    throw new Error('ROOM_TEMPLATES is empty. Add at least one template.');
  }

  const roomId = roomIdFromCoord(coord);
  const rng = createRng(seedFromRoom(runSeed, `${roomId}:template`));
  return pickWeightedTemplate(rng());
}

/**
 * Picks one template using weighted random selection.
 * @param random01 Random value in [0, 1).
 * @returns Selected room template.
 */
function pickWeightedTemplate(random01: number): RoomTemplate {
  const totalWeight = ROOM_TEMPLATES.reduce((sum, template) => sum + (template.weight ?? 1), 0);
  const target = random01 * totalWeight;

  let acc = 0;
  for (const template of ROOM_TEMPLATES) {
    acc += template.weight ?? 1;
    if (target <= acc) return template;
  }

  return ROOM_TEMPLATES[ROOM_TEMPLATES.length - 1];
}
