import type { HeroState } from '../data/dungeonTypes.js';
import { ARMOR_DEFINITIONS } from '../items/armors.js';
import { SPELLBOOK_DEFINITIONS, type SpellbookId } from '../items/spellbooks.js';
import {
  WEAPON_DEFINITIONS,
  type WeaponDefinition,
  type WeaponId,
} from '../items/weapons.js';

export type HandSlot = 'leftHand' | 'rightHand';

const UNARMED_ATTACK = {
  range: 1,
  attackDice: 1,
  damage: 1,
} as const;

export interface WeaponAttackProfile {
  label: string;
  range: number;
  attackDice: number;
  damage: number;
}

export interface CastRequirementView {
  spellbookId: SpellbookId | null;
  spellbookName: string | null;
  focusItemId: WeaponId | null;
  focusName: string | null;
}

export function isWeaponId(itemId: string | null | undefined): itemId is WeaponId {
  return typeof itemId === 'string' && Object.prototype.hasOwnProperty.call(WEAPON_DEFINITIONS, itemId);
}

export function getWeaponDefinition(itemId: string | null | undefined): WeaponDefinition | null {
  return isWeaponId(itemId) ? WEAPON_DEFINITIONS[itemId] : null;
}

export function getEquippedWeaponId(hero: HeroState): WeaponId | null {
  const candidates = [hero.equipment.rightHand, hero.equipment.leftHand];
  const weaponId = candidates.find(isWeaponId);
  return weaponId ?? null;
}

export function getEquippedWeapon(hero: HeroState): WeaponDefinition | null {
  const weaponId = getEquippedWeaponId(hero);
  return weaponId ? WEAPON_DEFINITIONS[weaponId] : null;
}

export function getHeroAttackProfile(hero: HeroState): WeaponAttackProfile {
  const weapon = getEquippedWeapon(hero);
  if (!weapon) {
    return {
      label: 'Unarmed',
      ...UNARMED_ATTACK,
    };
  }

  return {
    label: weapon.name,
    range: weapon.range,
    attackDice: weapon.attackDice,
    damage: weapon.damage,
  };
}

export function getHeroAttackRange(hero: HeroState): number {
  return getHeroAttackProfile(hero).range;
}

export function getHeroCastRequirementView(hero: HeroState): CastRequirementView {
  const leftIsSpellbook = getSpellbookId(hero.equipment.leftHand);
  const rightIsSpellbook = getSpellbookId(hero.equipment.rightHand);
  const spellbookId = leftIsSpellbook ?? rightIsSpellbook;
  const focusItemId = getEquippedCastingFocusId(hero, spellbookId);

  return {
    spellbookId,
    spellbookName: spellbookId ? SPELLBOOK_DEFINITIONS[spellbookId].name : null,
    focusItemId,
    focusName: focusItemId ? WEAPON_DEFINITIONS[focusItemId].name : null,
  };
}

export function canHeroCastSpells(hero: HeroState): boolean {
  const requirements = getHeroCastRequirementView(hero);
  return hero.className === 'Mage' && Boolean(requirements.spellbookId && requirements.focusItemId);
}

export function getHandItemHandsRequired(itemId: string | null | undefined): 0 | 1 | 2 {
  const weapon = getWeaponDefinition(itemId);
  if (weapon) return weapon.handsRequired;

  if (typeof itemId === 'string' && Object.prototype.hasOwnProperty.call(SPELLBOOK_DEFINITIONS, itemId)) {
    return SPELLBOOK_DEFINITIONS[itemId as SpellbookId].handsRequired;
  }

  if (itemId === 'shield') return ARMOR_DEFINITIONS.shield.handsRequired ?? 1;
  return 0;
}

export function equipHandItem(hero: HeroState, slot: HandSlot, itemId: string): string[] {
  const displaced: string[] = [];
  const handsRequired = getHandItemHandsRequired(itemId);
  const otherSlot: HandSlot = slot === 'leftHand' ? 'rightHand' : 'leftHand';

  if (handsRequired === 2) {
    collectTakenItem(displaced, takeHandItem(hero, 'leftHand'));
    collectTakenItem(displaced, takeHandItem(hero, 'rightHand'));
    hero.equipment.leftHand = itemId;
    hero.equipment.rightHand = itemId;
    return displaced;
  }

  if (getHandItemHandsRequired(hero.equipment[otherSlot]) === 2) {
    collectTakenItem(displaced, takeHandItem(hero, 'leftHand'));
    collectTakenItem(displaced, takeHandItem(hero, 'rightHand'));
  }

  collectTakenItem(displaced, takeHandItem(hero, slot));
  hero.equipment[slot] = itemId;
  return displaced;
}

export function takeHandItem(hero: HeroState, slot: HandSlot, expectedItemId?: string): string[] | null {
  const current = hero.equipment[slot];
  if (!current) return expectedItemId ? null : [];
  if (expectedItemId && current !== expectedItemId) return null;

  const removed: string[] = [];
  const handsRequired = getHandItemHandsRequired(current);
  const otherSlot: HandSlot = slot === 'leftHand' ? 'rightHand' : 'leftHand';

  hero.equipment[slot] = null;
  removed.push(current);

  if (handsRequired === 2 && hero.equipment[otherSlot] === current) {
    hero.equipment[otherSlot] = null;
  }

  return removed;
}

function getSpellbookId(itemId: string | null | undefined): SpellbookId | null {
  return typeof itemId === 'string' && Object.prototype.hasOwnProperty.call(SPELLBOOK_DEFINITIONS, itemId)
    ? (itemId as SpellbookId)
    : null;
}

function getEquippedCastingFocusId(hero: HeroState, spellbookId: SpellbookId | null): WeaponId | null {
  const focusCandidates = [
    spellbookId && hero.equipment.leftHand === spellbookId ? hero.equipment.rightHand : hero.equipment.leftHand,
    spellbookId && hero.equipment.rightHand === spellbookId ? hero.equipment.leftHand : hero.equipment.rightHand,
  ];

  for (const itemId of focusCandidates) {
    const weapon = getWeaponDefinition(itemId);
    if (weapon?.castingFocus) {
      return weapon.id;
    }
  }

  return null;
}

function collectTakenItem(target: string[], itemIds: string[] | null): void {
  if (!itemIds) return;
  for (const itemId of itemIds) {
    if (!target.includes(itemId)) target.push(itemId);
  }
}
