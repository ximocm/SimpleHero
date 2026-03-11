import type { EnemyKind } from '../data/dungeonTypes.js';

export interface EnemyDefinition {
  kind: EnemyKind;
  name: string;
  maxHp: number;
  movement: number;
  range: number;
  attackDice: number;
  damage: number;
  defenseDiceBonus: number;
  goldReward: number;
}

export const ENEMY_DEFINITIONS: Record<EnemyKind, EnemyDefinition> = {
  'skeleton-sword': {
    kind: 'skeleton-sword',
    name: 'Skeleton Sword',
    maxHp: 7,
    movement: 4,
    range: 1,
    attackDice: 2,
    damage: 2,
    defenseDiceBonus: 0,
    goldReward: 4,
  },
  'skeleton-archer': {
    kind: 'skeleton-archer',
    name: 'Skeleton Archer',
    maxHp: 5,
    movement: 4,
    range: 4,
    attackDice: 2,
    damage: 2,
    defenseDiceBonus: 0,
    goldReward: 5,
  },
};
