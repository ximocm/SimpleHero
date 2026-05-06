import type { CombatRollSnapshot, Coord, EnemyState, HeroState, SpellId } from '../data/dungeonTypes.js';
import { SPELL_DEFINITIONS } from '../magic/spells.js';
import { SPELLBOOK_DEFINITIONS } from '../items/spellbooks.js';
import { ARMOR_DEFINITIONS } from '../items/armors.js';
import type { GameState } from './gameSystem.js';
import {
  getEquippedWeapon,
  getHeroAttackProfile,
  getHeroCastRequirementView,
  type CastRequirementView,
} from './weaponSystem.js';

export interface AttackResult {
  roll: CombatRollSnapshot;
  defenderDefeated: boolean;
}

export interface SpellCastResult {
  logEntries: string[];
}

/**
 * Performs a basic hero attack against an enemy target.
 * @param state Game state.
 * @param hero Attacking hero.
 * @param enemy Defending enemy.
 * @returns Attack result snapshot.
 */
export function performHeroAttack(state: GameState, hero: HeroState, enemy: EnemyState): AttackResult {
  const weapon = getHeroAttackProfile(hero);
  const damageBonus = hero.className === 'Warrior' && hero.skillState.powerStrikeArmed ? 3 : 0;
  const roll = resolveAttack(
    state,
    hero.id,
    enemy.id,
    weapon.attackDice,
    weapon.damage + damageBonus,
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
  const defeated = hero.hp === 0;
  if (defeated) handleHeroDefeat(state, hero);
  return { roll, defenderDefeated: defeated };
}

export function getHeroAvailableSpellIds(hero: HeroState): SpellId[] {
  const requirements = getHeroCastRequirementView(hero);
  if (!requirements.spellbookId || !requirements.focusItemId) return [];
  return [...SPELLBOOK_DEFINITIONS[requirements.spellbookId].spellIds];
}

export function performHealSpell(hero: HeroState, target: HeroState): SpellCastResult {
  const definition = SPELL_DEFINITIONS.heal;
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + (definition.healAmount ?? 0));
  const restored = target.hp - before;
  return {
    logEntries: [`${hero.className} cast Heal on ${target.className} for ${restored} HP`],
  };
}

export function performIceSpell(hero: HeroState, enemy: EnemyState): SpellCastResult {
  const rootedTurns = SPELL_DEFINITIONS.ice.rootedTurns ?? 1;
  enemy.statusEffects.rootedTurns = Math.max(enemy.statusEffects.rootedTurns, rootedTurns);
  return {
    logEntries: [`${hero.className} cast Ice on ${enemy.kind} | rooted ${rootedTurns} turn`],
  };
}

export function performFireballSpell(
  state: GameState,
  hero: HeroState,
  center: Coord,
  enemies: EnemyState[],
): SpellCastResult {
  const affectedTiles = getFireballAreaTiles(center);
  const damage = SPELL_DEFINITIONS.fireball.damage ?? 0;
  const logEntries: string[] = [];

  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    const isAffected = affectedTiles.some((tile) => tile.x === enemy.tile.x && tile.y === enemy.tile.y);
    if (!isAffected) continue;

    enemy.hp = Math.max(0, enemy.hp - damage);
    const defeated = enemy.hp === 0;
    if (defeated) handleEnemyDefeat(state, enemy);
    logEntries.push(`${hero.className} cast Fireball on ${enemy.kind} | dmg ${damage}${defeated ? ' | defeated' : ''}`);
  }

  return {
    logEntries: logEntries.length > 0 ? logEntries : [`${hero.className} cast Fireball`],
  };
}

export function getFireballAreaTiles(center: Coord): Coord[] {
  return [
    center,
    { x: center.x - 1, y: center.y },
    { x: center.x + 1, y: center.y },
    { x: center.x, y: center.y - 1 },
    { x: center.x, y: center.y + 1 },
  ];
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

function handleHeroDefeat(state: GameState, hero: HeroState): void {
  state.readyByHeroId.delete(hero.id);
  ensureLivingHeroSelected(state);

  if (state.party.heroes.every((candidate) => candidate.hp <= 0)) {
    state.runState = 'lost';
    state.turn = null;
    state.turnAutomationReadyAt = null;
    state.hoverPath = [];
    state.movingPath = [];
    state.attackModeHeroId = null;
    state.itemUseModeHeroId = null;
    state.readyByHeroId.clear();
    state.recentCombatLog.unshift('Run failed: all heroes were defeated.');
    state.recentCombatLog = state.recentCombatLog.slice(0, 6);
  }
}

function ensureLivingHeroSelected(state: GameState): void {
  const current = state.party.heroes[state.party.activeHeroIndex];
  if (current && current.hp > 0) return;

  const nextIndex = state.party.heroes.findIndex((candidate) => candidate.hp > 0);
  if (nextIndex >= 0) {
    state.party.activeHeroIndex = nextIndex;
  }
}
