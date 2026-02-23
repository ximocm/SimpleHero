import type { Coord, HeroClassName, HeroRaceName, HeroState, PartyState } from '../data/dungeonTypes.js';

interface HeroProfile {
  classLetter: 'W' | 'R' | 'M';
  className: HeroClassName;
  raceName: HeroRaceName;
  maxHp: number;
  body: number;
  mind: number;
}

const HERO_PROFILES: HeroProfile[] = [
  { classLetter: 'W', className: 'Warrior', raceName: 'Orc', maxHp: 12, body: 4, mind: 2 },
  { classLetter: 'R', className: 'Ranger', raceName: 'Elf', maxHp: 8, body: 2, mind: 4 },
  { classLetter: 'M', className: 'Mage', raceName: 'Human', maxHp: 10, body: 3, mind: 3 },
];

/**
 * Builds the party and places heroes on provided starting tiles.
 * @param roomId Current room id.
 * @param startTiles Ordered starting tiles for heroes.
 * @returns Initialized party state.
 */
export function createParty(roomId: string, startTiles: readonly Coord[]): PartyState {
  const heroes: HeroState[] = HERO_PROFILES.map((profile, index) => ({
    id: `hero-${index}`,
    classLetter: profile.classLetter,
    className: profile.className,
    raceName: profile.raceName,
    hp: profile.maxHp,
    maxHp: profile.maxHp,
    body: profile.body,
    mind: profile.mind,
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
