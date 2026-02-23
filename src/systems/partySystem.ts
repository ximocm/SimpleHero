import type { Coord, HeroState, PartyState } from '../data/dungeonTypes.js';

const HERO_CLASSES: Array<'W' | 'R' | 'M'> = ['W', 'R', 'M'];

/**
 * Builds the party and places heroes on provided starting tiles.
 * @param roomId Current room id.
 * @param startTiles Ordered starting tiles for heroes.
 * @returns Initialized party state.
 */
export function createParty(roomId: string, startTiles: readonly Coord[]): PartyState {
  const heroes: HeroState[] = HERO_CLASSES.map((classLetter, index) => ({
    id: `hero-${index}`,
    classLetter,
    roomId,
    tile: { ...startTiles[index] },
    facing: 'S',
  }));

  return {
    heroes,
    activeHeroIndex: 0,
  };
}

/**
 * Returns the currently selected active hero.
 * @param state Party state.
 * @returns Active hero reference.
 */
export function getActiveHero(state: PartyState): HeroState {
  return state.heroes[state.activeHeroIndex];
}

/**
 * Updates active hero index when index is valid.
 * @param state Party state to mutate.
 * @param index Candidate hero index.
 * @returns Nothing.
 */
export function setActiveHero(state: PartyState, index: number): void {
  if (index < 0 || index >= state.heroes.length) return;
  state.activeHeroIndex = index;
}
