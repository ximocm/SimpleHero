import type { Coord, HeroClassName, HeroRaceName, HeroState } from '../data/dungeonTypes.js';
import { CLASS_DEFINITIONS } from './classes.js';
import { RACE_DEFINITIONS } from './races.js';

export interface HeroBlueprint {
  className: HeroClassName;
  raceName: HeroRaceName;
}

export const DEFAULT_PARTY_BLUEPRINTS: HeroBlueprint[] = [
  { className: 'Warrior', raceName: 'Orc' },
  { className: 'Ranger', raceName: 'Elf' },
  { className: 'Mage', raceName: 'Human' },
];

/**
 * Creates a hero state from blueprint + spawn position.
 * @param id Hero id.
 * @param roomId Initial room id.
 * @param spawnTile Initial tile coordinate.
 * @param blueprint Hero class/race setup.
 * @returns Fully initialized hero state.
 */
export function createHero(
  id: string,
  roomId: string,
  spawnTile: Coord,
  blueprint: HeroBlueprint,
): HeroState {
  const classDef = CLASS_DEFINITIONS[blueprint.className];
  const raceDef = RACE_DEFINITIONS[blueprint.raceName];

  return {
    id,
    classLetter: classDef.classLetter,
    className: classDef.name,
    raceName: raceDef.name,
    hp: raceDef.maxHp,
    maxHp: raceDef.maxHp,
    body: raceDef.body,
    mind: raceDef.mind,
    roomId,
    tile: { ...spawnTile },
    facing: 'S',
  };
}

/**
 * Creates default 3-hero party lineup from predefined blueprints.
 * @param roomId Initial room id.
 * @param startTiles Ordered spawn/start coordinates.
 * @returns Ordered hero state array.
 */
export function createDefaultHeroes(roomId: string, startTiles: readonly Coord[]): HeroState[] {
  return DEFAULT_PARTY_BLUEPRINTS.map((blueprint, index) =>
    createHero(`hero-${index}`, roomId, startTiles[index], blueprint),
  );
}
