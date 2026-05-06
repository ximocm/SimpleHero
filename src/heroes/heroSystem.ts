import type { Coord, HeroClassName, HeroRaceName, HeroState } from '../data/dungeonTypes.js';
import { CLASS_DEFINITIONS } from './classes.js';
import { RACE_DEFINITIONS } from './races.js';
import { equipHandItem } from '../systems/weaponSystem.js';

export interface HeroBlueprint {
  name: string;
  className: HeroClassName;
  raceName: HeroRaceName;
}

export interface HeroRosterEntry extends HeroBlueprint {
  id: string;
  equipment: HeroState['equipment'];
}

export const DEFAULT_PARTY_BLUEPRINTS: HeroBlueprint[] = [
  { name: 'Brakka', className: 'Warrior', raceName: 'Orc' },
  { name: 'Lysa', className: 'Ranger', raceName: 'Elf' },
  { name: 'Iria', className: 'Mage', raceName: 'Human' },
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
    name: blueprint.name.trim() || `${raceDef.name} ${classDef.name}`,
    classLetter: classDef.classLetter,
    className: classDef.name,
    raceName: raceDef.name,
    hp: raceDef.maxHp,
    maxHp: raceDef.maxHp,
    body: raceDef.body,
    mind: raceDef.mind,
    equipment: {
      armor: null,
      leftHand: null,
      rightHand: null,
      relic: null,
      backpack: [],
    },
    skillState: {
      cooldownRemaining: 0,
      powerStrikeArmed: false,
    },
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
    applyStarterLoadout(createHero(`hero-${index}`, roomId, startTiles[index], blueprint)),
  );
}

export function createCampaignRoster(blueprints: readonly HeroBlueprint[]): HeroRosterEntry[] {
  return blueprints.map((blueprint, index) => ({
    id: `hero-${index}`,
    name: blueprint.name.trim() || `Hero ${index + 1}`,
    className: blueprint.className,
    raceName: blueprint.raceName,
    equipment: createStarterEquipmentForClass(blueprint.className),
  }));
}

export function createHeroesFromRoster(
  roomId: string,
  startTiles: readonly Coord[],
  roster: readonly HeroRosterEntry[],
): HeroState[] {
  return roster.map((entry, index) => {
    const hero = createHero(entry.id, roomId, startTiles[index], entry);
    hero.equipment = cloneHeroEquipment(entry.equipment);
    return hero;
  });
}

export function syncRosterFromHeroes(heroes: readonly HeroState[]): HeroRosterEntry[] {
  return heroes.map((hero) => ({
    id: hero.id,
    name: hero.name,
    className: hero.className,
    raceName: hero.raceName,
    equipment: cloneHeroEquipment(hero.equipment),
  }));
}

export function cloneHeroEquipment(equipment: HeroState['equipment']): HeroState['equipment'] {
  return {
    armor: equipment.armor,
    leftHand: equipment.leftHand,
    rightHand: equipment.rightHand,
    relic: equipment.relic,
    backpack: [...equipment.backpack],
  };
}

export function createStarterEquipmentForClass(className: HeroClassName): HeroState['equipment'] {
  const hero = {
    equipment: {
      armor: null,
      leftHand: null,
      rightHand: null,
      relic: null,
      backpack: [],
    },
    className,
  } as unknown as HeroState;
  applyStarterLoadout(hero);
  return cloneHeroEquipment(hero.equipment);
}

function applyStarterLoadout(hero: HeroState): HeroState {
  if (hero.className === 'Warrior') {
    hero.equipment.armor = 'heavy-armor';
    equipHandItem(hero, 'leftHand', 'short-sword');
    equipHandItem(hero, 'rightHand', 'shield');
    hero.equipment.backpack = ['health-potion'];
    return hero;
  }

  if (hero.className === 'Ranger') {
    hero.equipment.armor = 'light-armor';
    equipHandItem(hero, 'leftHand', 'bow');
    hero.equipment.backpack = ['health-potion'];
    return hero;
  }

  hero.equipment.armor = 'light-armor';
  equipHandItem(hero, 'leftHand', 'staff');
  equipHandItem(hero, 'rightHand', 'basic-spellbook');
  hero.equipment.backpack = ['health-potion'];
  return hero;
}
