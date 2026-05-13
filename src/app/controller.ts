import type { Coord, HeroState } from '../data/dungeonTypes.js';
import { TileType } from '../data/tileTypes.js';
import {
  retreatRun,
  canHeroCastSpellOnEnemy,
  canWalkTile,
  cancelCastMode,
  assignPendingRoomEntryPlacement,
  clearPendingRoomEntryPlacement,
  commitMoveFromHover,
  completePendingRoomEntry,
  createGameState,
  ensureActiveHeroIsLiving,
  explainInvalidBasicAttackAtTile,
  getCurrentRoom,
  getCurrentRoomEnemies,
  getTileAt,
  selectActiveHeroSpell,
  setActiveHeroIndex,
  stepMovement,
  toggleAttackMode,
  toggleCastMode,
  toggleItemUseMode,
  tryHeroAttackAtTile,
  tryHeroCastSpellAtTile,
  tryHeroUseSkillAtTile,
  updateHoverPath,
  useActiveHeroBackpackConsumable,
  useActiveHeroSkill,
  type GameState,
} from '../systems/gameSystem.js';
import { getFireballAreaTiles } from '../systems/combatSystem.js';
import { advanceAutomatedTurns, passTurn } from '../systems/turnSystem.js';
import {
  clearPersistedGameState,
  clearPersistedPartyInventory,
  hasPersistedGameState,
  loadPersistedAccountGold,
  loadPersistedCampaignProfile,
  loadPersistedGameState,
  loadPersistedPartyInventory,
  persistAccountGold,
  persistCampaignProfile,
  persistGameState,
  persistPartyInventory,
} from '../systems/persistenceSystem.js';
import { createStarterPartyInventory } from '../items/index.js';
import { createInventoryEntry, type InventoryEntry } from '../items/inventory.js';
import { getAppLayoutHtml, requireContext, requireElement } from '../ui/layout.js';
import { inBounds, tileFromCanvas } from '../utils/grid.js';
import { InventoryController } from './inventoryController.js';
import { drawFrame, getBoardOffset, getTileSize, renderAppMode, renderCastMenu, renderCharacterPanels, renderCombatLog, renderPartyInventory, type AppRenderRefs } from './renderer.js';
import { COMBAT_ROLL_ANIMATION_TOTAL_MS, type AppMode, type CombatRollAnimationState, type DragPayload, type HeroDraft, type OverlayMode } from './types.js';
import { ITEM_DEFINITIONS } from '../items/items.js';
import { getShopPrice } from '../items/shop.js';
import { getCharacterCreationOverlayHtml, getSafeZoneOverlayHtml, getStartMenuOverlayHtml } from '../ui/overlayViews.js';
import { createCampaignRoster, DEFAULT_PARTY_BLUEPRINTS, syncRosterFromHeroes } from '../heroes/heroSystem.js';
import { equipHandItem, takeHandItem } from '../systems/weaponSystem.js';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 720;
const HUD_HEIGHT = 64;
const MOVE_STEP_INTERVAL_MS = 180;
const SHOW_FULL_DUNGEON_MAP = true;
const SESSION_RESTORE_NAV_TYPE = 'reload';
const STARTING_ACCOUNT_GOLD = 30;

export class AppController {
  private state: GameState;
  private partyInventory: InventoryEntry[];
  private profile = loadPersistedCampaignProfile();
  private creationDrafts: HeroDraft[] = DEFAULT_PARTY_BLUEPRINTS.map((blueprint, index) => ({
    id: `hero-${index}`,
    name: blueprint.name,
    className: blueprint.className,
    raceName: blueprint.raceName,
  }));
  private accountGold = loadPersistedAccountGold();
  private safeZoneHeroIndex = 0;
  private appMode: AppMode;
  private overlayMode: OverlayMode = null;
  private inventoryModalOpen = false;
  private diceAnimation: CombatRollAnimationState | null = null;
  private lastObservedCombatRoll: GameState['lastCombatRoll'] = null;
  private lastMoveStepAt = 0;
  private readonly inventoryController: InventoryController;
  private readonly refs: AppRenderRefs;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly minimapCtx: CanvasRenderingContext2D;
  private readonly resultCtx: CanvasRenderingContext2D;

  constructor() {
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const shouldRestoreOnReload = navigationEntry?.type === SESSION_RESTORE_NAV_TYPE;
    const restoredState = shouldRestoreOnReload ? loadPersistedGameState() : null;
    const restoredInventory = shouldRestoreOnReload ? loadPersistedPartyInventory() : null;

    this.state = restoredState ?? createGameState(Date.now());
    this.partyInventory = restoredInventory ?? createStarterPartyInventory();
    this.appMode = restoredState ? (restoredState.runState === 'active' ? 'game' : 'run-complete') : 'menu';
    this.lastObservedCombatRoll = this.state.lastCombatRoll;

    const app = document.querySelector<HTMLDivElement>('#app');
    if (!app) throw new Error('Missing #app root');
    app.innerHTML = getAppLayoutHtml(CANVAS_WIDTH, CANVAS_HEIGHT);

    this.refs = {
      canvas: requireElement<HTMLCanvasElement>('#gameCanvas'),
      minimapCanvas: requireElement<HTMLCanvasElement>('#minimapCanvas'),
      resultCanvas: requireElement<HTMLCanvasElement>('#resultCanvas'),
      gameRoot: requireElement<HTMLDivElement>('#gameRoot'),
      screenOverlay: requireElement<HTMLDivElement>('#screenOverlay'),
      inventoryModal: requireElement<HTMLDivElement>('#inventoryModal'),
      roomEntryModal: requireElement<HTMLDivElement>('#roomEntryModal'),
      inventoryModalGold: requireElement<HTMLDivElement>('#inventoryModalGold'),
      inventoryModalList: requireElement<HTMLDivElement>('#inventoryModalList'),
      status: requireElement<HTMLDivElement>('#status'),
      controlsHint: requireElement<HTMLDivElement>('#controlsHint'),
      characterPanels: requireElement<HTMLDivElement>('#characterPanels'),
      goldValue: requireElement<HTMLDivElement>('#goldValue'),
      combatLog: requireElement<HTMLDivElement>('#combatLog'),
      partyInventoryList: requireElement<HTMLDivElement>('#partyInventoryList'),
      inventoryButton: requireElement<HTMLButtonElement>('#inventoryButton'),
      attackButton: requireElement<HTMLButtonElement>('#attackButton'),
      skillButton: requireElement<HTMLButtonElement>('#skillButton'),
      castButton: requireElement<HTMLButtonElement>('#castButton'),
      castMenu: requireElement<HTMLDivElement>('#castMenu'),
      useItemButton: requireElement<HTMLButtonElement>('#useItemButton'),
      skipTurnButton: requireElement<HTMLButtonElement>('#skipTurnButton'),
    };
    this.ctx = requireContext(this.refs.canvas);
    this.minimapCtx = requireContext(this.refs.minimapCanvas);
    this.resultCtx = requireContext(this.refs.resultCanvas);
    this.inventoryController = new InventoryController(() => this.state, () => this.partyInventory);
  }

  start(): void {
    this.bindEvents();
    this.syncAccountGoldFromState();
    this.renderAll();
    this.renderAppMode();
    this.tick();

    window.setInterval(() => {
      if (this.appMode === 'game' || this.appMode === 'run-complete') {
        this.persistAll();
      }
    }, 3000);

    window.addEventListener('beforeunload', () => {
      if (this.appMode === 'game' || this.appMode === 'run-complete') {
        this.persistAll();
      }
    });
  }

  private isGameplayMode(): boolean {
    return this.appMode === 'game' && this.overlayMode === null && this.state.pendingRoomEntry === null;
  }

  private renderAll(): void {
    renderCharacterPanels(
      this.state,
      { characterPanels: this.refs.characterPanels },
      this.inventoryController.getItemById() as unknown as Map<string, unknown>,
      (itemId) => this.inventoryController.getItemTooltip(itemId),
    );
    renderPartyInventory(
      this.state,
      this.partyInventory,
      this.accountGold,
      {
        goldValue: this.refs.goldValue,
        inventoryButton: this.refs.inventoryButton,
        inventoryModalGold: this.refs.inventoryModalGold,
        inventoryModalList: this.refs.inventoryModalList,
      },
      (itemId) => this.inventoryController.getItemTooltip(itemId),
    );
    renderCombatLog(this.state, { combatLog: this.refs.combatLog });
    renderCastMenu(this.state, { castMenu: this.refs.castMenu });
    this.syncInventoryModalVisibility();
    this.renderRoomEntryModal();
  }

  private renderRoomEntryModal(): void {
    const pending = this.state.pendingRoomEntry;
    if (this.appMode !== 'game' || !pending) {
      this.refs.roomEntryModal.style.display = 'none';
      this.refs.roomEntryModal.innerHTML = '';
      return;
    }

    const room = getCurrentRoom(this.state);
    const allowed = new Set(pending.allowedTiles.map((tile) => `${tile.x},${tile.y}`));
    const placements = new Map(
      Object.entries(pending.placementsByHeroId)
        .filter((entry): entry is [string, Coord] => entry[1] !== null)
        .map(([heroId, tile]) => [`${tile.x},${tile.y}`, heroId]),
    );
    const placedHeroIds = new Set(Object.keys(pending.placementsByHeroId).filter((heroId) => pending.placementsByHeroId[heroId]));
    const heroesById = new Map(this.state.party.heroes.map((hero) => [hero.id, hero]));
    const allPlaced = pending.heroOrder.every((heroId) => pending.placementsByHeroId[heroId]);

    this.refs.roomEntryModal.style.display = 'flex';
    this.refs.roomEntryModal.innerHTML = `
      <div style="width:min(920px, calc(100vw - 48px)); max-height:calc(100vh - 48px); overflow:auto; border:1px solid rgba(148,163,184,0.34); background:rgba(2,6,23,0.96); box-shadow:0 18px 52px rgba(2,6,23,0.62); padding:18px;">
        <div style="display:flex; justify-content:space-between; gap:16px; align-items:flex-start; margin-bottom:14px;">
          <div>
            <div style="font-size:18px; color:#f8fafc;">Room entry</div>
            <div style="font-size:12px; color:#94a3b8; margin-top:4px;">Place the party within 3 tiles of the entrance before combat starts.</div>
          </div>
          <button
            data-entry-action="confirm"
            type="button"
            ${allPlaced ? '' : 'disabled'}
            style="padding:9px 12px; border:1px solid ${allPlaced ? 'rgba(74,222,128,0.5)' : 'rgba(71,85,105,0.5)'}; background:${allPlaced ? 'rgba(20,83,45,0.5)' : 'rgba(15,23,42,0.7)'}; color:${allPlaced ? '#dcfce7' : '#64748b'}; cursor:${allPlaced ? 'pointer' : 'default'};"
          >
            start room
          </button>
        </div>
        <div style="display:grid; grid-template-columns:minmax(220px, 0.72fr) minmax(360px, 1fr); gap:18px; align-items:start;">
          <div style="border:1px solid rgba(148,163,184,0.2); background:rgba(15,23,42,0.54); padding:12px;">
            <div style="font-size:12px; color:#94a3b8; margin-bottom:10px;">Drag heroes</div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${pending.heroOrder
                .map((heroId, orderIndex) => {
                  const hero = heroesById.get(heroId);
                  if (!hero) return '';
                  const isPlaced = placedHeroIds.has(heroId);
                  const tile = pending.placementsByHeroId[heroId];
                  return `
                    <div style="display:flex; align-items:center; gap:8px;">
                      <div
                        data-entry-hero-id="${escapeAttr(heroId)}"
                        draggable="true"
                        style="width:34px; height:34px; border-radius:999px; display:flex; align-items:center; justify-content:center; border:2px solid ${orderIndex === 0 ? '#fbbf24' : 'rgba(226,232,240,0.7)'}; background:${isPlaced ? 'rgba(20,83,45,0.72)' : 'rgba(30,41,59,0.86)'}; color:#f8fafc; font-weight:700; cursor:grab;"
                      >${hero.classLetter}</div>
                      <div style="min-width:0; flex:1;">
                        <div style="font-size:13px; color:#f8fafc;">${escapeHtml(hero.name)}</div>
                        <div style="font-size:11px; color:#94a3b8;">${hero.className}${tile ? ` · ${tile.x},${tile.y}` : ''}</div>
                      </div>
                      ${isPlaced ? `<button data-entry-action="clear" data-entry-hero-id="${escapeAttr(heroId)}" type="button" style="padding:5px 7px; border:1px solid rgba(148,163,184,0.28); background:rgba(30,41,59,0.72); color:#cbd5e1; cursor:pointer;">clear</button>` : ''}
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>
          <div style="display:grid; grid-template-columns:repeat(${room.width}, 42px); gap:4px; justify-content:center;">
            ${room.tiles
              .map((row, y) =>
                row
                  .map((tileType, x) => {
                    const key = `${x},${y}`;
                    const isAllowed = allowed.has(key);
                    const placedHeroId = placements.get(key);
                    const placedHero = placedHeroId ? heroesById.get(placedHeroId) : null;
                    const isEntry = x === pending.entryTile.x && y === pending.entryTile.y;
                    const isVoid = tileType === TileType.VOID_BLACK;
                    return `
                      <div
                        ${isAllowed ? `data-entry-tile="true" data-entry-x="${x}" data-entry-y="${y}"` : ''}
                        style="width:42px; height:42px; box-sizing:border-box; display:flex; align-items:center; justify-content:center; border:1px solid ${isEntry ? '#fbbf24' : isAllowed ? 'rgba(74,222,128,0.45)' : 'rgba(51,65,85,0.6)'}; background:${isVoid ? 'rgba(2,6,23,0.72)' : isAllowed ? 'rgba(20,83,45,0.28)' : 'rgba(30,41,59,0.5)'};"
                      >
                        ${
                          placedHero
                            ? `<div data-entry-hero-id="${escapeAttr(placedHero.id)}" draggable="true" style="width:28px; height:28px; border-radius:999px; display:flex; align-items:center; justify-content:center; background:#fbbf24; color:#0f172a; font-weight:800; cursor:grab;">${placedHero.classLetter}</div>`
                            : isEntry
                              ? `<span style="font-size:10px; color:#fef3c7;">IN</span>`
                              : ''
                        }
                      </div>
                    `;
                  })
                  .join(''),
              )
              .join('')}
          </div>
        </div>
      </div>
    `;
  }

  private renderAppMode(): void {
    if (this.appMode === 'character-creation') {
      this.inventoryModalOpen = false;
      this.syncInventoryModalVisibility();
      this.refs.gameRoot.style.display = 'none';
      this.refs.screenOverlay.style.display = 'block';
      this.refs.screenOverlay.innerHTML = getCharacterCreationOverlayHtml(this.creationDrafts, STARTING_ACCOUNT_GOLD);
      return;
    }

    if (this.appMode === 'safe-zone' && this.profile) {
      this.inventoryModalOpen = false;
      this.syncInventoryModalVisibility();
      this.refs.gameRoot.style.display = 'none';
      this.refs.screenOverlay.style.display = 'block';
      this.refs.screenOverlay.innerHTML = getSafeZoneOverlayHtml({
        profile: this.profile,
        accountGold: this.accountGold,
        selectedHeroIndex: this.safeZoneHeroIndex,
      });
      return;
    }

    if (this.appMode === 'menu') {
      this.inventoryModalOpen = false;
      this.syncInventoryModalVisibility();
      this.refs.gameRoot.style.display = 'none';
      this.refs.screenOverlay.style.display = 'block';
      this.refs.screenOverlay.innerHTML = getStartMenuOverlayHtml(hasPersistedGameState(), this.profile !== null, this.accountGold);
      return;
    }

    this.syncInventoryModalVisibility();
    renderAppMode(this.appMode, this.overlayMode, this.state, this.accountGold, this.profile !== null, {
      gameRoot: this.refs.gameRoot,
      screenOverlay: this.refs.screenOverlay,
    });
  }

  private startNewGame(): void {
    if (hasPersistedGameState()) {
      const confirmed = window.confirm('Replace the current saved run and start a new game?');
      if (!confirmed) return;
    }

    if (!this.profile) {
      this.creationDrafts = DEFAULT_PARTY_BLUEPRINTS.map((blueprint, index) => ({
        id: `hero-${index}`,
        name: blueprint.name,
        className: blueprint.className,
        raceName: blueprint.raceName,
      }));
      this.appMode = 'character-creation';
      this.overlayMode = null;
      this.renderAppMode();
      return;
    }

    this.launchExpedition();
  }

  private loadSavedGame(): void {
    const loadedState = loadPersistedGameState();
    if (!loadedState) {
      this.renderAppMode();
      return;
    }

    this.state = loadedState;
    this.partyInventory = loadPersistedPartyInventory() ?? createStarterPartyInventory();
    this.appMode = this.state.runState === 'active' ? 'game' : 'run-complete';
    this.overlayMode = null;
    this.lastMoveStepAt = 0;
    this.resetCombatRollPresentation();
    this.syncAccountGoldFromState();
    this.renderAll();
    this.renderAppMode();
  }

  private bindEvents(): void {
    this.bindPanelEvents();
    this.bindInventoryEvents();
    this.bindActionButtons();
    this.bindRoomEntryModalEvents();
    this.bindOverlayEvents();
    this.bindCanvasEvents();
    this.bindKeyboardEvents();
  }

  private bindPanelEvents(): void {
    this.refs.characterPanels.addEventListener('click', (event) => {
      if (!this.isGameplayMode()) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const backpackItem = target.closest<HTMLElement>('[data-backpack-item-id]');
      if (backpackItem) {
        const heroIndex = Number(backpackItem.dataset.heroIndex);
        const itemId = backpackItem.dataset.backpackItemId;
        if (Number.isInteger(heroIndex) && itemId) {
          setActiveHeroIndex(this.state, heroIndex);
          const used = useActiveHeroBackpackConsumable(this.state, itemId);
          if (used) {
            this.persistAll();
            this.renderAll();
            return;
          }
        }
      }

      const panel = target.closest<HTMLElement>('[data-hero-index]');
      if (!panel) return;
      const index = Number(panel.dataset.heroIndex);
      if (!Number.isInteger(index)) return;

      const clickedHero = this.state.party.heroes[index];
      if (clickedHero && this.state.selectedSpellId === 'heal') {
        const casted = tryHeroCastSpellAtTile(this.state, clickedHero.tile);
        if (casted) {
          this.persistAll();
          this.renderAll();
          return;
        }
      }

      setActiveHeroIndex(this.state, index);
      this.persistAll();
      renderCharacterPanels(
        this.state,
        { characterPanels: this.refs.characterPanels },
        this.inventoryController.getItemById() as unknown as Map<string, unknown>,
        (itemId) => this.inventoryController.getItemTooltip(itemId),
      );
      renderCastMenu(this.state, { castMenu: this.refs.castMenu });
    });

    this.refs.characterPanels.addEventListener('dragstart', (event) => {
      if (!this.isGameplayMode()) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const draggable = target.closest<HTMLElement>('[data-drag-source]');
      if (!draggable) return;

      const source = draggable.dataset.dragSource;
      if (source === 'slot') {
        const heroIndex = Number(draggable.dataset.heroIndex);
        const slot = draggable.dataset.slot as Exclude<'armor' | 'leftHand' | 'rightHand' | 'relic', 'backpack'> | undefined;
        const itemId = draggable.dataset.itemId;
        if (!Number.isInteger(heroIndex) || !slot || !itemId) return;
        const payload: DragPayload = { source: 'slot', heroIndex, slot, itemId };
        event.dataTransfer?.setData('application/x-simplehero-item', JSON.stringify(payload));
        event.dataTransfer?.setData('text/plain', itemId);
        return;
      }

      if (source === 'backpack') {
        const heroIndex = Number(draggable.dataset.heroIndex);
        const backpackIndex = Number(draggable.dataset.backpackIndex);
        const itemId = draggable.dataset.itemId;
        if (!Number.isInteger(heroIndex) || !Number.isInteger(backpackIndex) || !itemId) return;
        const payload: DragPayload = { source: 'backpack', heroIndex, backpackIndex, itemId };
        event.dataTransfer?.setData('application/x-simplehero-item', JSON.stringify(payload));
        event.dataTransfer?.setData('text/plain', itemId);
      }
    });

    this.refs.characterPanels.addEventListener('dragover', (event) => {
      if (!this.isGameplayMode()) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest<HTMLElement>('[data-drop-slot]')) return;
      event.preventDefault();
    });

    this.refs.characterPanels.addEventListener('drop', (event) => {
      if (!this.isGameplayMode()) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const dropZone = target.closest<HTMLElement>('[data-drop-slot]');
      if (!dropZone) return;
      event.preventDefault();

      const payload = this.inventoryController.readDragPayload(event);
      if (!payload) return;

      const heroIndex = Number(dropZone.dataset.heroIndex);
      const slot = dropZone.dataset.dropSlot as 'armor' | 'leftHand' | 'rightHand' | 'relic' | 'backpack' | undefined;
      if (!Number.isInteger(heroIndex) || !slot) return;

      if (!this.inventoryController.movePayloadToSlot(payload, heroIndex, slot)) return;
      this.persistAll();
      this.renderAll();
    });
  }

  private bindInventoryEvents(): void {
    this.refs.inventoryModalList.addEventListener('dragstart', (event) => {
      if (!this.isGameplayMode()) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const draggable = target.closest<HTMLElement>('[data-drag-source="inventory"]');
      if (!draggable) return;
      const itemId = draggable.dataset.itemId;
      if (!itemId) return;

      const payload: DragPayload = { source: 'inventory', itemId };
      event.dataTransfer?.setData('application/x-simplehero-item', JSON.stringify(payload));
      event.dataTransfer?.setData('text/plain', itemId);
    });

    this.refs.inventoryModalList.addEventListener('dragover', (event) => {
      if (!this.isGameplayMode()) return;
      event.preventDefault();
    });

    this.refs.inventoryModalList.addEventListener('drop', (event) => {
      if (!this.isGameplayMode()) return;
      event.preventDefault();
      const payload = this.inventoryController.readDragPayload(event);
      if (!payload) return;

      const removed = this.inventoryController.removeFromSource(payload);
      if (!removed) return;
      this.inventoryController.addInventory(payload.itemId);
      this.persistAll();
      this.renderAll();
    });
  }

  private bindRoomEntryModalEvents(): void {
    this.refs.roomEntryModal.addEventListener('dragstart', (event) => {
      const target = event.target as HTMLElement | null;
      const heroId = target?.closest<HTMLElement>('[data-entry-hero-id]')?.dataset.entryHeroId;
      if (!heroId) return;
      event.dataTransfer?.setData('application/x-simplehero-entry-hero', heroId);
      event.dataTransfer?.setData('text/plain', heroId);
    });

    this.refs.roomEntryModal.addEventListener('dragover', (event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest<HTMLElement>('[data-entry-tile]')) return;
      event.preventDefault();
    });

    this.refs.roomEntryModal.addEventListener('drop', (event) => {
      const target = event.target as HTMLElement | null;
      const tile = target?.closest<HTMLElement>('[data-entry-tile]');
      if (!tile) return;
      event.preventDefault();
      const heroId = event.dataTransfer?.getData('application/x-simplehero-entry-hero');
      const x = Number(tile.dataset.entryX);
      const y = Number(tile.dataset.entryY);
      if (!heroId || !Number.isInteger(x) || !Number.isInteger(y)) return;
      if (!assignPendingRoomEntryPlacement(this.state, heroId, { x, y })) return;
      this.persistAll();
      this.renderAll();
    });

    this.refs.roomEntryModal.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      const action = target?.closest<HTMLElement>('[data-entry-action]')?.dataset.entryAction;
      if (!action) return;

      if (action === 'clear') {
        const heroId = target?.closest<HTMLElement>('[data-entry-hero-id]')?.dataset.entryHeroId;
        if (!heroId) return;
        clearPendingRoomEntryPlacement(this.state, heroId);
        this.persistAll();
        this.renderAll();
        return;
      }

      if (action === 'confirm') {
        if (!completePendingRoomEntry(this.state)) return;
        this.persistAll();
        this.renderAll();
      }
    });
  }

  private bindActionButtons(): void {
    requireElement<HTMLButtonElement>('#menuButton').addEventListener('click', () => {
      if (!this.isGameplayMode()) return;
      this.overlayMode = 'pause-menu';
      this.inventoryModalOpen = false;
      this.syncInventoryModalVisibility();
      this.renderAppMode();
    });

    this.refs.inventoryButton.addEventListener('click', () => {
      if (!this.isGameplayMode()) return;
      this.inventoryModalOpen = !this.inventoryModalOpen;
      this.syncInventoryModalVisibility();
    });

    requireElement<HTMLButtonElement>('#inventoryModalCloseButton').addEventListener('click', () => {
      this.inventoryModalOpen = false;
      this.syncInventoryModalVisibility();
    });

    this.refs.attackButton.addEventListener('click', () => {
      if (!this.isGameplayMode()) return;
      toggleAttackMode(this.state);
      this.persistAll();
      this.renderAll();
    });

    this.refs.skillButton.addEventListener('click', () => {
      if (!this.isGameplayMode()) return;
      const used = useActiveHeroSkill(this.state);
      if (!used) return;
      this.persistAll();
      this.renderAll();
    });

    this.refs.castButton.addEventListener('click', () => {
      if (!this.isGameplayMode()) return;
      toggleCastMode(this.state);
      this.persistAll();
      this.renderAll();
    });

    this.refs.castMenu.addEventListener('click', (event) => {
      if (!this.isGameplayMode()) return;
      const target = event.target as HTMLElement | null;
      const spellId = target?.closest<HTMLElement>('[data-spell-id]')?.dataset.spellId;
      if (!spellId) return;
      if (spellId === 'cancel') {
        cancelCastMode(this.state);
      } else if (spellId === 'heal' || spellId === 'fireball' || spellId === 'ice') {
        selectActiveHeroSpell(this.state, spellId);
      }
      this.persistAll();
      renderCastMenu(this.state, { castMenu: this.refs.castMenu });
    });

    this.refs.useItemButton.addEventListener('click', () => {
      if (!this.isGameplayMode()) return;
      const toggled = toggleItemUseMode(this.state);
      if (!toggled && !this.state.itemUseModeHeroId) return;
      this.persistAll();
      this.renderAll();
    });

    this.refs.skipTurnButton.addEventListener('click', () => {
      if (!this.isGameplayMode()) return;
      passTurn(this.state);
      this.persistAll();
      this.renderAll();
    });

  }

  private bindOverlayEvents(): void {
    this.refs.screenOverlay.addEventListener('input', (event) => {
      if (this.appMode !== 'character-creation') return;
      const target = event.target as HTMLInputElement | HTMLSelectElement | null;
      const field = target?.dataset.draftField;
      const index = Number(target?.dataset.draftIndex);
      if (!field || !Number.isInteger(index)) return;

      const draft = this.creationDrafts[index];
      if (!draft) return;

      if (field === 'name') {
        draft.name = target.value.slice(0, 24);
      } else if (field === 'className' && (target.value === 'Warrior' || target.value === 'Ranger' || target.value === 'Mage')) {
        draft.className = target.value;
      } else if (field === 'raceName' && (target.value === 'Human' || target.value === 'Elf' || target.value === 'Orc')) {
        draft.raceName = target.value;
      }
    });

    this.refs.screenOverlay.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      const action = target?.closest<HTMLElement>('[data-screen-action]')?.dataset.screenAction;
      const safeAction = target?.closest<HTMLElement>('[data-safe-action]')?.dataset.safeAction;
      if (!action && !safeAction) return;

      if (action === 'new-game') {
        this.startNewGame();
        return;
      }
      if (action === 'manage-party') {
        this.appMode = this.profile ? 'safe-zone' : 'character-creation';
        this.overlayMode = null;
        this.renderAppMode();
        return;
      }
      if (action === 'load-game') {
        this.loadSavedGame();
        return;
      }
      if (action === 'finish-creation') {
        this.completeCharacterCreation();
        return;
      }
      if (action === 'launch-expedition') {
        this.launchExpedition();
        return;
      }
      if (action === 'resume-game') {
        this.overlayMode = null;
        this.renderAppMode();
        return;
      }
      if (action === 'retreat-run') {
        this.handleRetreatRun();
        return;
      }
      if (action === 'to-main-menu' || action === 'back-menu') {
        this.overlayMode = null;
        this.appMode = 'menu';
        this.renderAppMode();
        return;
      }

      if (safeAction) {
        this.handleSafeZoneAction(target, safeAction);
      }
    });
  }

  private completeCharacterCreation(): void {
    const sanitizedDrafts = this.creationDrafts.map((draft, index) => ({
      ...draft,
      name: draft.name.trim() || `Hero ${index + 1}`,
    }));

    this.profile = {
      heroes: createCampaignRoster(sanitizedDrafts),
      stash: createStarterPartyInventory(),
    };
    this.accountGold = STARTING_ACCOUNT_GOLD;
    this.safeZoneHeroIndex = 0;
    persistCampaignProfile(this.profile);
    persistAccountGold(this.accountGold);
    clearPersistedGameState();
    clearPersistedPartyInventory();
    this.appMode = 'safe-zone';
    this.renderAppMode();
  }

  private launchExpedition(): void {
    if (!this.profile) return;
    clearPersistedGameState();
    clearPersistedPartyInventory();
    this.state = createGameState(Date.now(), this.profile.heroes);
    this.partyInventory = this.profile.stash.map((entry) => ({ ...entry }));
    this.appMode = 'game';
    this.overlayMode = null;
    this.lastMoveStepAt = 0;
    this.resetCombatRollPresentation();
    this.renderAll();
    this.persistAll();
    this.renderAppMode();
  }

  private handleSafeZoneAction(target: HTMLElement | null, action: string): void {
    if (this.appMode !== 'safe-zone' || !this.profile) return;

    if (action === 'select-hero') {
      const heroIndex = Number(target?.closest<HTMLElement>('[data-hero-index]')?.dataset.heroIndex);
      if (!Number.isInteger(heroIndex)) return;
      this.safeZoneHeroIndex = heroIndex;
      this.renderAppMode();
      return;
    }

    if (action === 'buy-item') {
      const itemId = target?.closest<HTMLElement>('[data-item-id]')?.dataset.itemId;
      if (!itemId) return;
      this.buySafeZoneItem(itemId);
      return;
    }

    if (action === 'stash-equipped') {
      const button = target?.closest<HTMLElement>('[data-slot]');
      const heroIndex = Number(button?.dataset.heroIndex);
      const slot = button?.dataset.slot as 'armor' | 'leftHand' | 'rightHand' | 'relic' | undefined;
      if (!Number.isInteger(heroIndex) || !slot) return;
      this.moveEquippedItemToStash(heroIndex, slot);
      return;
    }

    if (action === 'stash-backpack') {
      const button = target?.closest<HTMLElement>('[data-backpack-index]');
      const heroIndex = Number(button?.dataset.heroIndex);
      const backpackIndex = Number(button?.dataset.backpackIndex);
      if (!Number.isInteger(heroIndex) || !Number.isInteger(backpackIndex)) return;
      this.moveBackpackItemToStash(heroIndex, backpackIndex);
      return;
    }

    const itemId = target?.closest<HTMLElement>('[data-item-id]')?.dataset.itemId;
    if (!itemId) return;

    if (action === 'equip-armor') this.equipSafeZoneItem(itemId, 'armor');
    if (action === 'equip-left') this.equipSafeZoneItem(itemId, 'leftHand');
    if (action === 'equip-right') this.equipSafeZoneItem(itemId, 'rightHand');
    if (action === 'equip-relic') this.equipSafeZoneItem(itemId, 'relic');
    if (action === 'equip-backpack') this.equipSafeZoneItem(itemId, 'backpack');
  }

  private buySafeZoneItem(itemId: string): void {
    if (!this.profile) return;
    const item = ITEM_DEFINITIONS.find((entry) => entry.id === itemId);
    const inventoryEntry = createInventoryEntry(itemId);
    if (!item || !inventoryEntry) return;
    const price = getShopPrice(itemId);
    if (this.accountGold < price) return;

    this.accountGold -= price;
    this.profile.stash.push(inventoryEntry);
    persistAccountGold(this.accountGold);
    persistCampaignProfile(this.profile);
    this.renderAppMode();
  }

  private equipSafeZoneItem(itemId: string, slot: 'armor' | 'leftHand' | 'rightHand' | 'relic' | 'backpack'): void {
    if (!this.profile) return;
    const hero = this.profile.heroes[this.safeZoneHeroIndex];
    const stashIndex = this.profile.stash.findIndex((entry) => entry.itemId === itemId);
    if (!hero || stashIndex < 0) return;

    const item = ITEM_DEFINITIONS.find((entry) => entry.id === itemId);
    if (!item) return;

    if (slot === 'armor' && !(item.category === 'armor' && item.id !== 'shield')) return;
    if ((slot === 'leftHand' || slot === 'rightHand') && !(item.category === 'weapon' || item.category === 'spellbook' || item.id === 'shield')) return;
    if (slot === 'relic' && item.category !== 'consumable') return;
    if (slot === 'backpack') {
      hero.equipment.backpack.push(itemId);
      this.profile.stash.splice(stashIndex, 1);
      persistCampaignProfile(this.profile);
      this.renderAppMode();
      return;
    }

    this.profile.stash.splice(stashIndex, 1);

    if (slot === 'leftHand' || slot === 'rightHand') {
      const displacedItems = equipHandItem(hero as HeroState, slot, itemId);
      for (const displacedItem of displacedItems) {
        const entry = createInventoryEntry(displacedItem);
        if (entry) this.profile.stash.push(entry);
      }
    } else {
      const previous = hero.equipment[slot];
      hero.equipment[slot] = itemId;
      if (previous) {
        const entry = createInventoryEntry(previous);
        if (entry) this.profile.stash.push(entry);
      }
    }

    persistCampaignProfile(this.profile);
    this.renderAppMode();
  }

  private moveEquippedItemToStash(heroIndex: number, slot: 'armor' | 'leftHand' | 'rightHand' | 'relic'): void {
    if (!this.profile) return;
    const hero = this.profile.heroes[heroIndex];
    if (!hero) return;

    if (slot === 'leftHand' || slot === 'rightHand') {
      const removedItems = takeHandItem(hero as HeroState, slot);
      if (!removedItems) return;
      for (const removedItem of removedItems) {
        const entry = createInventoryEntry(removedItem);
        if (entry) this.profile.stash.push(entry);
      }
    } else {
      const itemId = hero.equipment[slot];
      if (!itemId) return;
      hero.equipment[slot] = null;
      const entry = createInventoryEntry(itemId);
      if (entry) this.profile.stash.push(entry);
    }

    persistCampaignProfile(this.profile);
    this.renderAppMode();
  }

  private moveBackpackItemToStash(heroIndex: number, backpackIndex: number): void {
    if (!this.profile) return;
    const hero = this.profile.heroes[heroIndex];
    const itemId = hero?.equipment.backpack[backpackIndex];
    if (!hero || !itemId) return;

    hero.equipment.backpack.splice(backpackIndex, 1);
    const entry = createInventoryEntry(itemId);
    if (entry) this.profile.stash.push(entry);
    persistCampaignProfile(this.profile);
    this.renderAppMode();
  }

  private syncProfileFromRun(): void {
    if (!this.profile) return;
    this.profile.heroes = syncRosterFromHeroes(this.state.party.heroes);
    this.profile.stash = this.partyInventory.map((entry) => ({ ...entry }));
    persistCampaignProfile(this.profile);
  }

  private handleRetreatRun(): void {
    if (!this.isGameplayMode()) return;
    const confirmed = window.confirm('Retreating ends the current run as a defeat. Continue?');
    if (!confirmed) return;
    if (!retreatRun(this.state)) return;
    this.persistAll();
    this.renderAll();
    this.renderAppMode();
  }

  private bindCanvasEvents(): void {
    this.refs.canvas.addEventListener('mousemove', (event) => {
      if (!this.isGameplayMode()) return;
      const room = getCurrentRoom(this.state);
      const tileSize = getTileSize(this.state, this.refs.canvas, HUD_HEIGHT);
      const offset = getBoardOffset(this.state, this.refs.canvas, HUD_HEIGHT, tileSize);
      const rect = this.refs.canvas.getBoundingClientRect();
      const target = tileFromCanvas(event.clientX - rect.left, event.clientY - rect.top, offset.x, offset.y, tileSize);

      if (!inBounds(target, room.width, room.height) || this.state.runState !== 'active') {
        this.state.hoverPath = [];
        this.state.spellPreviewTiles = [];
        return;
      }

      const tile = getTileAt(room, target);
      if (tile === TileType.VOID_BLACK) {
        this.state.hoverPath = [];
        this.state.spellPreviewTiles = [];
        return;
      }

      if (this.state.skillModeHeroId && this.state.selectedSkillId === 'dash') {
        this.state.hoverPath = [];
        this.state.spellPreviewTiles = [];
        return;
      }

      if (this.state.selectedSpellId === 'fireball') {
        const activeHero = this.state.party.heroes[this.state.party.activeHeroIndex];
        const targetEnemy = getCurrentRoomEnemies(this.state).find(
          (enemy) => enemy.hp > 0 && enemy.tile.x === target.x && enemy.tile.y === target.y,
        );
        if (targetEnemy && canHeroCastSpellOnEnemy(this.state, activeHero.id, targetEnemy.id)) {
          this.state.hoverPath = [];
          this.state.spellPreviewTiles = getFireballAreaTiles(target).filter(
            (coord) => inBounds(coord, room.width, room.height) && getTileAt(room, coord) !== TileType.VOID_BLACK,
          );
          return;
        }

        this.state.hoverPath = [];
        this.state.spellPreviewTiles = [];
        return;
      }

      updateHoverPath(this.state, target);
    });

    this.refs.canvas.addEventListener('click', (event) => {
      if (!this.isGameplayMode()) return;
      const room = getCurrentRoom(this.state);
      const tileSize = getTileSize(this.state, this.refs.canvas, HUD_HEIGHT);
      const offset = getBoardOffset(this.state, this.refs.canvas, HUD_HEIGHT, tileSize);
      const rect = this.refs.canvas.getBoundingClientRect();
      const target = tileFromCanvas(event.clientX - rect.left, event.clientY - rect.top, offset.x, offset.y, tileSize);

      if (!inBounds(target, room.width, room.height) || this.state.runState !== 'active') return;
      if (
        tryHeroAttackAtTile(this.state, target) ||
        tryHeroCastSpellAtTile(this.state, target) ||
        tryHeroUseSkillAtTile(this.state, target)
      ) {
        this.persistAll();
        this.renderAll();
        return;
      }
      if (explainInvalidBasicAttackAtTile(this.state, target)) {
        this.persistAll();
        this.renderAll();
        return;
      }
      if (!canWalkTile(room, target)) return;

      updateHoverPath(this.state, target);
      commitMoveFromHover(this.state);
      this.persistAll();
    });
  }

  private bindKeyboardEvents(): void {
    window.addEventListener('keydown', (event) => {
      if (!this.isGameplayMode()) return;
      if (this.state.runState !== 'active' && event.key !== '1' && event.key !== '2' && event.key !== '3') return;
      if (event.key === '1') setActiveHeroIndex(this.state, 0);
      if (event.key === '2') setActiveHeroIndex(this.state, 1);
      if (event.key === '3') setActiveHeroIndex(this.state, 2);
      if (event.key === ' ' || event.key.toLowerCase() === 'e') {
        passTurn(this.state);
        this.persistAll();
        this.renderAll();
      }
      if (event.key === '1' || event.key === '2' || event.key === '3') {
        this.persistAll();
        this.renderAll();
      }
    });
  }

  private tick(): void {
    const now = performance.now();
    if (this.appMode === 'game' && this.overlayMode === null && this.state.pendingRoomEntry === null) {
      this.updateCombatRollAnimation(now);
      ensureActiveHeroIsLiving(this.state);
      const enemyAutomationBlocked = this.diceAnimation !== null && this.state.turn?.phase === 'enemies';
      const advancedTurn = enemyAutomationBlocked ? false : advanceAutomatedTurns(this.state, now);
      const moved = now - this.lastMoveStepAt >= MOVE_STEP_INTERVAL_MS ? stepMovement(this.state) : false;
      if (moved) {
        this.lastMoveStepAt = now;
      }
      this.updateCombatRollAnimation(now);
      if (advancedTurn || moved) {
        this.persistAll();
        this.renderAll();
      }
      if (this.state.runState !== 'active') {
        if (this.state.runState === 'won' && this.profile) {
          this.syncProfileFromRun();
          this.syncAccountGoldFromState();
          clearPersistedGameState();
          clearPersistedPartyInventory();
          this.safeZoneHeroIndex = 0;
          this.appMode = 'safe-zone';
          this.renderAppMode();
        } else {
          this.appMode = 'run-complete';
          this.persistAll();
          this.renderAppMode();
        }
      }
    }

    drawFrame({
      state: this.state,
      appMode: this.appMode,
      overlayMode: this.overlayMode,
      accountGold: this.accountGold,
      partyInventory: this.partyInventory,
      itemById: this.inventoryController.getItemById() as unknown as Map<string, unknown>,
      refs: this.refs,
      ctx: this.ctx,
      minimapCtx: this.minimapCtx,
      resultCtx: this.resultCtx,
      diceAnimation: this.diceAnimation,
      hudHeight: HUD_HEIGHT,
      nowMs: now,
      showFullDungeonMap: SHOW_FULL_DUNGEON_MAP,
      getItemTooltip: (itemId) => this.inventoryController.getItemTooltip(itemId),
    });
    requestAnimationFrame(() => this.tick());
  }

  private persistAll(): void {
    if (this.appMode !== 'game' && this.appMode !== 'run-complete') return;
    this.syncAccountGoldFromState();
    persistGameState(this.state);
    persistPartyInventory(this.partyInventory);
  }

  private syncAccountGoldFromState(): void {
    if (this.state.runState === 'active' || this.state.accountGoldApplied) return;
    this.accountGold += this.state.runGold;
    this.state.accountGoldApplied = true;
    persistAccountGold(this.accountGold);
    if (this.appMode !== 'menu') {
      persistGameState(this.state);
    }
  }

  private resetCombatRollPresentation(): void {
    this.lastObservedCombatRoll = this.state.lastCombatRoll;
    this.diceAnimation = null;
  }

  private updateCombatRollAnimation(now: number): void {
    const currentRoll = this.state.lastCombatRoll;
    if (currentRoll && currentRoll !== this.lastObservedCombatRoll) {
      this.lastObservedCombatRoll = currentRoll;
      this.diceAnimation = {
        roll: currentRoll,
        attackerLabel: this.getCombatantLabel(currentRoll.attackerId),
        defenderLabel: this.getCombatantLabel(currentRoll.defenderId),
        startedAt: now,
        endsAt: now + COMBAT_ROLL_ANIMATION_TOTAL_MS,
      };
      return;
    }

    if (!currentRoll) {
      this.lastObservedCombatRoll = null;
    }

    if (this.diceAnimation && now >= this.diceAnimation.endsAt) {
      this.diceAnimation = null;
    }
  }

  private getCombatantLabel(unitId: string): string {
    const hero = this.state.party.heroes.find((candidate) => candidate.id === unitId);
    if (hero) {
      return `${hero.name} (${hero.className})`;
    }

    for (const roomEnemies of this.state.dungeon.enemiesByRoomId.values()) {
      const enemy = roomEnemies.find((candidate) => candidate.id === unitId);
      if (enemy) {
        return enemy.kind
          .split('-')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
      }
    }

    return unitId;
  }

  private syncInventoryModalVisibility(): void {
    const isVisible = this.appMode === 'game' && this.inventoryModalOpen;
    this.refs.inventoryModal.style.display = isVisible ? 'block' : 'none';
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
