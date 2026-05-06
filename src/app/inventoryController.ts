import { ITEM_DEFINITIONS } from '../items/index.js';
import type { InventoryEntry } from '../items/inventory.js';
import { persistPartyInventory } from '../systems/persistenceSystem.js';
import { canHeroActNow, consumeHeroActionPoint, getCurrentHeroTurnResources } from '../systems/turnSystem.js';
import { equipHandItem, getHandItemHandsRequired, takeHandItem } from '../systems/weaponSystem.js';
import type { GameState } from '../systems/gameSystem.js';
import type { DragPayload, EquipSlot } from './types.js';

export class InventoryController {
  private readonly itemById = new Map<string, (typeof ITEM_DEFINITIONS)[number]>(
    ITEM_DEFINITIONS.map((item) => [item.id, item]),
  );

  constructor(
    private readonly getState: () => GameState,
    private readonly getPartyInventory: () => InventoryEntry[],
  ) {}

  getItemById(): Map<string, (typeof ITEM_DEFINITIONS)[number]> {
    return this.itemById;
  }

  readDragPayload(event: DragEvent): DragPayload | null {
    const raw = event.dataTransfer?.getData('application/x-simplehero-item');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DragPayload;
    } catch {
      return null;
    }
  }

  movePayloadToSlot(payload: DragPayload, heroIndex: number, slot: EquipSlot): boolean {
    const state = this.getState();
    const item = this.itemById.get(payload.itemId);
    if (!item) return false;
    if (payload.source === 'slot' && payload.heroIndex === heroIndex && payload.slot === slot) return true;
    if (!this.canEquipItemToSlot(payload.itemId, slot)) return false;
    if (!this.canPerformEquipmentMove(payload, heroIndex, slot)) return false;

    const removed = this.removeFromSource(payload);
    if (!removed) return false;

    const hero = state.party.heroes[heroIndex];
    if (!hero) {
      this.returnToSource(payload);
      return false;
    }

    if (slot === 'backpack') {
      hero.equipment.backpack.push(payload.itemId);
      this.spendEquipmentActionPoint(payload, heroIndex, slot);
      return true;
    }

    if (slot === 'leftHand' || slot === 'rightHand') {
      this.equipInHandSlot(hero, slot, payload.itemId);
      this.spendEquipmentActionPoint(payload, heroIndex, slot);
      return true;
    }

    const previous = hero.equipment[slot] as string | null;
    if (previous) this.addInventory(previous);
    hero.equipment[slot] = payload.itemId;
    this.spendEquipmentActionPoint(payload, heroIndex, slot);
    return true;
  }

  removeFromSource(payload: DragPayload): boolean {
    const state = this.getState();
    if (payload.source === 'inventory') {
      return this.removeInventory(payload.itemId);
    }

    const hero = state.party.heroes[payload.heroIndex];
    if (!hero) return false;

    if (payload.source === 'slot') {
      if (payload.slot === 'leftHand' || payload.slot === 'rightHand') {
        return takeHandItem(hero, payload.slot, payload.itemId) !== null;
      }
      if (hero.equipment[payload.slot] !== payload.itemId) return false;
      hero.equipment[payload.slot] = null;
      return true;
    }

    if (payload.backpackIndex < 0 || payload.backpackIndex >= hero.equipment.backpack.length) return false;
    if (hero.equipment.backpack[payload.backpackIndex] !== payload.itemId) return false;
    hero.equipment.backpack.splice(payload.backpackIndex, 1);
    return true;
  }

  returnToSource(payload: DragPayload): void {
    const state = this.getState();
    if (payload.source === 'inventory') {
      this.addInventory(payload.itemId);
      return;
    }

    const hero = state.party.heroes[payload.heroIndex];
    if (!hero) return;

    if (payload.source === 'slot') {
      if (payload.slot === 'leftHand' || payload.slot === 'rightHand') {
        equipHandItem(hero, payload.slot, payload.itemId);
        return;
      }
      hero.equipment[payload.slot] = payload.itemId;
      return;
    }

    hero.equipment.backpack.splice(payload.backpackIndex, 0, payload.itemId);
  }

  addInventory(itemId: string): void {
    const inventory = this.getPartyInventory();
    const item = this.itemById.get(itemId);
    if (!item) return;
    inventory.push({
      itemId: item.id,
      name: item.name,
      file: item.file,
      category: item.category,
    });
    persistPartyInventory(inventory);
  }

  removeInventory(itemId: string): boolean {
    const inventory = this.getPartyInventory();
    const index = inventory.findIndex((item) => item.itemId === itemId);
    if (index < 0) return false;
    inventory.splice(index, 1);
    persistPartyInventory(inventory);
    return true;
  }

  canEquipItemToSlot(itemId: string, slot: EquipSlot): boolean {
    const item = this.itemById.get(itemId);
    if (!item) return false;

    if (slot === 'backpack') return true;
    if (slot === 'armor') return item.category === 'armor' && item.id !== 'shield';
    if (slot === 'leftHand' || slot === 'rightHand') {
      return item.category === 'weapon' || item.category === 'spellbook' || item.id === 'shield';
    }
    if (slot === 'relic') return item.category === 'consumable';
    return false;
  }

  getItemTooltip(itemId: string): string {
    const item = this.itemById.get(itemId);
    if (!item) return itemId;

    if (item.category === 'weapon') {
      const focus = item.castingFocus ? '\nCasting focus: yes' : '';
      return `${item.name}\nRange: ${item.range}\nAttack dice: ${item.attackDice}\nDamage: ${item.damage}\nHands: ${item.handsRequired}${focus}`;
    }

    if (item.category === 'armor') {
      const hands = item.handsRequired ? `\nHands: ${item.handsRequired}` : '';
      return `${item.name}\nDefense dice bonus: ${item.defenseDiceBonus}\nMovement modifier: ${item.movementModifier}${hands}`;
    }

    if (item.category === 'spellbook') {
      return `${item.name}\nSpells: ${item.spellIds.join(', ')}\nHands: ${item.handsRequired}`;
    }

    return `${item.name}\nEffect: ${item.effect}\nValue: ${item.value}`;
  }

  private equipInHandSlot(
    hero: GameState['party']['heroes'][number],
    slot: 'leftHand' | 'rightHand',
    itemId: string,
  ): void {
    const displacedItems = equipHandItem(hero, slot, itemId);
    for (const displacedItem of displacedItems) {
      if (displacedItem !== itemId) this.addInventory(displacedItem);
    }
  }

  private canPerformEquipmentMove(payload: DragPayload, heroIndex: number | null, slot: EquipSlot): boolean {
    const hero = this.getEquipmentActionHero(payload, heroIndex, slot);
    if (!hero) return true;

    const state = this.getState();
    const activeHero = state.party.heroes[state.party.activeHeroIndex];
    const resources = getCurrentHeroTurnResources(state);
    return hero.id === activeHero?.id && canHeroActNow(state, hero.id) && (resources?.actionPointsRemaining ?? 0) > 0;
  }

  private spendEquipmentActionPoint(payload: DragPayload, heroIndex: number | null, slot: EquipSlot): void {
    const hero = this.getEquipmentActionHero(payload, heroIndex, slot);
    if (!hero) return;
    consumeHeroActionPoint(this.getState(), hero.id);
  }

  private getEquipmentActionHero(
    payload: DragPayload,
    heroIndex: number | null,
    slot: EquipSlot,
  ): GameState['party']['heroes'][number] | null {
    const state = this.getState();
    if (!state.turn || state.turn.phase !== 'heroes') return null;

    const involvesHandSlot =
      slot === 'leftHand' ||
      slot === 'rightHand' ||
      (payload.source === 'slot' && (payload.slot === 'leftHand' || payload.slot === 'rightHand'));

    if (!involvesHandSlot) return null;

    const resolvedHeroIndex = heroIndex ?? (payload.source !== 'inventory' ? payload.heroIndex : null);
    if (resolvedHeroIndex === null) return null;
    return state.party.heroes[resolvedHeroIndex] ?? null;
  }
}
