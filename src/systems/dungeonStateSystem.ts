import type { DungeonState, RoomCoord, RoomData } from '../data/dungeonTypes.js';
import { roomIdFromCoord } from '../utils/coord.js';
import { createRoom } from './dungeonGenerationSystem.js';

export function createDungeonState(seed: number): DungeonState {
  const origin: RoomCoord = { x: 0, y: 0 };
  const room = createRoom(seed, origin);

  return {
    seed,
    rooms: new Map([[room.id, room]]),
    discoveredRoomIds: new Set([room.id]),
    currentRoomId: room.id,
  };
}

export function getOrCreateRoom(state: DungeonState, coord: RoomCoord): RoomData {
  const id = roomIdFromCoord(coord);
  const existing = state.rooms.get(id);
  if (existing) return existing;

  const created = createRoom(state.seed, coord);
  state.rooms.set(created.id, created);
  return created;
}
