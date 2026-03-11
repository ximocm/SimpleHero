import type { CombatRollSnapshot, EnemyState, HeroState } from '../data/dungeonTypes.js';
import { ARMOR_DEFINITIONS } from '../items/armors.js';
import { WEAPON_DEFINITIONS } from '../items/weapons.js';
import type { GameState } from './gameSystem.js';

const UNARMED_ATTACK = {
  range: 1,
  attackDice: 1,
  damage: 1,
};

export interface AttackResult {
  roll: CombatRollSnapshot;
  defenderDefeated: boolean;
}

/**
 * Performs a basic hero attack against an enemy target.
 * @param state Game state.
 * @param hero Attacking hero.
 * @param enemy Defending enemy.
 * @returns Attack result snapshot.
 */
export function performHeroAttack(state: GameState, hero: HeroState, enemy: EnemyState): AttackResult {
  const weapon = getEquippedWeapon(hero);
  const roll = resolveAttack(
    state,
    hero.id,
    enemy.id,
    weapon.attackDice,
    weapon.damage,
    getEnemyDefenseDiceBonus(enemy),
  );

  enemy.hp = Math.max(0, enemy.hp - roll.finalDamage);
  const defeated = enemy.hp === 0;
  if (defeated) handleEnemyDefeat(state, enemy);
  return { roll, defenderDefeated: defeated };
}

/**
 * Performs a basic enemy attack against a hero target.
 * @param state Game state.
 * @param enemy Attacking enemy.
 * @param hero Defending hero.
 * @returns Attack result snapshot.
 */
export function performEnemyAttack(state: GameState, enemy: EnemyState, hero: HeroState): AttackResult {
  const roll = resolveAttack(
    state,
    enemy.id,
    hero.id,
    enemy.attackDice,
    enemy.damage,
    getHeroDefenseDiceBonus(hero),
  );

  hero.hp = Math.max(0, hero.hp - roll.finalDamage);
  return { roll, defenderDefeated: hero.hp === 0 };
}

/**
 * Returns the selected hero's current weapon range.
 * @param hero Hero to inspect.
 * @returns Basic attack range.
 */
export function getHeroAttackRange(hero: HeroState): number {
  return getEquippedWeapon(hero).range;
}

function resolveAttack(
  state: GameState,
  attackerId: string,
  defenderId: string,
  attackDice: number,
  weaponDamage: number,
  defenseDiceBonus: number,
): CombatRollSnapshot {
  const attackRolls = Array.from({ length: attackDice }, () => rollD6(state));
  const attackHits = attackRolls.map(convertDieToHits);
  const totalAttackHits = attackHits.reduce((sum, value) => sum + value, 0);

  const defenseDiceTotal = Math.max(1, 1 + defenseDiceBonus);
  const defenseRolls = Array.from({ length: defenseDiceTotal }, () => rollD6(state));
  const blockedHits = defenseRolls.map(convertDieToHits);
  const totalBlockedHits = blockedHits.reduce((sum, value) => sum + value, 0);
  const effectiveHits = Math.max(0, totalAttackHits - totalBlockedHits);
  const finalDamage = effectiveHits === 0 ? 0 : weaponDamage + (effectiveHits - 1);

  return {
    attackerId,
    defenderId,
    attackRolls,
    attackHits,
    defenseRolls,
    blockedHits,
    totalAttackHits,
    totalBlockedHits,
    effectiveHits,
    finalDamage,
  };
}

function getEquippedWeapon(hero: HeroState): { range: number; attackDice: number; damage: number } {
  const candidates = [hero.equipment.rightHand, hero.equipment.leftHand].filter(
    (itemId): itemId is keyof typeof WEAPON_DEFINITIONS =>
      typeof itemId === 'string' && Object.prototype.hasOwnProperty.call(WEAPON_DEFINITIONS, itemId),
  );
  const weaponId = candidates[0];
  return weaponId ? WEAPON_DEFINITIONS[weaponId] : UNARMED_ATTACK;
}

function getHeroDefenseDiceBonus(hero: HeroState): number {
  let bonus = 0;
  if (hero.equipment.armor && Object.prototype.hasOwnProperty.call(ARMOR_DEFINITIONS, hero.equipment.armor)) {
    bonus += ARMOR_DEFINITIONS[hero.equipment.armor as keyof typeof ARMOR_DEFINITIONS].defenseDiceBonus;
  }

  if (hero.equipment.leftHand === 'shield') bonus += ARMOR_DEFINITIONS.shield.defenseDiceBonus;
  else if (hero.equipment.rightHand === 'shield') bonus += ARMOR_DEFINITIONS.shield.defenseDiceBonus;

  return bonus;
}

function getEnemyDefenseDiceBonus(enemy: EnemyState): number {
  return enemy.defenseDiceBonus;
}

function convertDieToHits(roll: number): number {
  if (roll >= 6) return 2;
  if (roll >= 4) return 1;
  return 0;
}

function rollD6(state: GameState): number {
  state.combatRngState = (Math.imul(1664525, state.combatRngState) + 1013904223) >>> 0;
  return (state.combatRngState % 6) + 1;
}

function handleEnemyDefeat(state: GameState, enemy: EnemyState): void {
  const room = state.dungeon.rooms.get(enemy.roomId);
  const roomEnemies = state.dungeon.enemiesByRoomId.get(enemy.roomId) ?? [];
  if (!room) return;

  if (room.encounter) {
    room.encounter.enemyIds = roomEnemies.filter((candidate) => candidate.hp > 0).map((candidate) => candidate.id);
    room.encounter.isCleared = room.encounter.enemyIds.length === 0;
  }
}
