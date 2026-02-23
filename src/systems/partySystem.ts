import type { Coord, HeroState, PartyState } from '../data/dungeonTypes.js';

const HERO_CLASSES: Array<'W' | 'R' | 'M'> = ['W', 'R', 'M'];

export function createParty(roomId: string, spawnTiles: Coord[]): PartyState {
  const heroes: HeroState[] = HERO_CLASSES.map((classLetter, index) => ({
    id: `hero-${index}`,
    classLetter,
    roomId,
    tile: { ...spawnTiles[index] },
    facing: 'S',
  }));

  return {
    heroes,
    activeHeroIndex: 0,
  };
}

export function getActiveHero(state: PartyState): HeroState {
  return state.heroes[state.activeHeroIndex];
}

export function setActiveHero(state: PartyState, index: number): void {
  if (index < 0 || index >= state.heroes.length) return;
  state.activeHeroIndex = index;
}
