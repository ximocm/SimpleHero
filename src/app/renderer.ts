import type { Coord } from '../data/dungeonTypes.js';
import { TileType } from '../data/tileTypes.js';
import { SPELL_DEFINITIONS } from '../magic/spells.js';
import {
  canHeroBasicAttackEnemy,
  canHeroCastSpellOnHero,
  canUseActiveHeroConsumable,
  getActiveHeroCastActionView,
  getActiveHeroSkillActionView,
  getCurrentFloorNumber,
  getCurrentRoom,
  getCurrentRoomCoordId,
  getCurrentRoomEncounterView,
  getCurrentRoomEnemies,
  getCurrentRoomEnemyViews,
  getHeroPanelViews,
  getSelectedSpellDefinition,
  isBackpackConsumableTargetable,
  isRoomObjectiveCleared,
  type GameState,
} from '../systems/gameSystem.js';
import { getFireballAreaTiles } from '../systems/combatSystem.js';
import { getTurnBannerView, isCurrentTurnHero } from '../systems/turnSystem.js';
import { getHeroAttackProfile, getHeroCastRequirementView } from '../systems/weaponSystem.js';
import { getPauseMenuOverlayHtml, getRunCompleteOverlayHtml, getStartMenuOverlayHtml } from '../ui/overlayViews.js';
import { renderCharacterPanelsHtml, renderCombatLogHtml, renderPartyInventoryHtml } from '../ui/sidebarViews.js';
import type { InventoryEntry } from '../items/inventory.js';
import type { AppMode, OverlayMode } from './types.js';

export interface AppRenderRefs {
  canvas: HTMLCanvasElement;
  minimapCanvas: HTMLCanvasElement;
  gameRoot: HTMLDivElement;
  screenOverlay: HTMLDivElement;
  status: HTMLDivElement;
  controlsHint: HTMLDivElement;
  characterPanels: HTMLDivElement;
  goldValue: HTMLDivElement;
  combatLog: HTMLDivElement;
  partyInventoryList: HTMLDivElement;
  attackButton: HTMLButtonElement;
  skillButton: HTMLButtonElement;
  castButton: HTMLButtonElement;
  castMenu: HTMLDivElement;
  useItemButton: HTMLButtonElement;
}

export interface FrameRenderArgs {
  state: GameState;
  appMode: AppMode;
  overlayMode: OverlayMode;
  accountGold: number;
  partyInventory: readonly InventoryEntry[];
  itemById: Map<string, unknown>;
  refs: AppRenderRefs;
  ctx: CanvasRenderingContext2D;
  minimapCtx: CanvasRenderingContext2D;
  hudHeight: number;
  showFullDungeonMap: boolean;
  getItemTooltip: (itemId: string) => string;
}

export function renderAppMode(
  appMode: AppMode,
  overlayMode: OverlayMode,
  state: GameState,
  accountGold: number,
  hasProfile: boolean,
  refs: Pick<AppRenderRefs, 'gameRoot' | 'screenOverlay'>,
): void {
  refs.gameRoot.style.display = appMode === 'game' ? 'flex' : 'none';

  if (appMode === 'game') {
    if (overlayMode === 'pause-menu') {
      refs.screenOverlay.style.display = 'block';
      refs.screenOverlay.innerHTML = getPauseMenuOverlayHtml();
      return;
    }

    refs.screenOverlay.style.display = 'none';
    refs.screenOverlay.innerHTML = '';
    return;
  }

  if (appMode === 'menu') {
    refs.screenOverlay.style.display = 'block';
    refs.screenOverlay.innerHTML = getStartMenuOverlayHtml(true, hasProfile, accountGold);
    return;
  }

  refs.screenOverlay.style.display = 'block';
  refs.screenOverlay.innerHTML = getRunCompleteOverlayHtml({
    ...getRunSummaryView(state),
    accountGold,
  });
}

function getRunSummaryView(state: GameState) {
  const highestFloorReached = state.party.heroes.reduce((maxFloor, hero) => {
    const floor = state.dungeon.floorByRoomId.get(hero.roomId) ?? 1;
    return Math.max(maxFloor, floor);
  }, 1);

  return {
    result: state.runState,
    seed: state.dungeon.seed,
    discoveredRooms: state.dungeon.discoveredRoomIds.size,
    floorsReached: highestFloorReached,
    survivingHeroes: state.party.heroes.filter((hero) => hero.hp > 0).length,
    runGold: state.runGold,
  };
}

export function renderCharacterPanels(
  state: GameState,
  refs: Pick<AppRenderRefs, 'characterPanels'>,
  itemById: Map<string, unknown>,
  getItemTooltip: (itemId: string) => string,
): void {
  refs.characterPanels.innerHTML = renderCharacterPanelsHtml({
    heroes: getHeroPanelViews(state),
    heroStates: state.party.heroes,
    itemById: itemById as never,
    isBackpackConsumableTargetable: (heroId, itemId) => isBackpackConsumableTargetable(state, heroId, itemId),
    getItemTooltip,
  });
}

export function renderPartyInventory(
  state: GameState,
  partyInventory: readonly InventoryEntry[],
  accountGold: number,
  refs: Pick<AppRenderRefs, 'goldValue' | 'partyInventoryList'>,
  getItemTooltip: (itemId: string) => string,
): void {
  refs.goldValue.textContent = `run gold: ${state.runGold} | account gold: ${accountGold}`;
  refs.partyInventoryList.innerHTML = renderPartyInventoryHtml(partyInventory, getItemTooltip);
}

export function renderCombatLog(
  state: GameState,
  refs: Pick<AppRenderRefs, 'combatLog'>,
): void {
  refs.combatLog.innerHTML = renderCombatLogHtml(state.recentCombatLog);
}

export function renderCastMenu(
  state: GameState,
  refs: Pick<AppRenderRefs, 'castMenu'>,
): void {
  const hero = state.party.heroes[state.party.activeHeroIndex];
  if (!hero || state.castModeHeroId !== hero.id) {
    refs.castMenu.style.display = 'none';
    refs.castMenu.innerHTML = '';
    return;
  }

  const castAction = getActiveHeroCastActionView(state);
  if (!castAction.isAvailable || castAction.spellIds.length === 0) {
    refs.castMenu.style.display = 'none';
    refs.castMenu.innerHTML = '';
    return;
  }

  refs.castMenu.style.display = 'block';
  refs.castMenu.innerHTML = `
    <div style="padding:10px; border:1px solid rgba(167,139,250,0.28); background:rgba(46,16,101,0.72); display:flex; flex-direction:column; gap:8px;">
      ${castAction.spellIds
        .map((spellId) => {
          const spell = SPELL_DEFINITIONS[spellId];
          const isSelected = state.selectedSpellId === spellId;
          return `<button data-spell-id="${spellId}" type="button" style="padding:8px 10px; text-align:left; border:1px solid ${
            isSelected ? 'rgba(221,214,254,0.9)' : 'rgba(196,181,253,0.25)'
          }; background:${isSelected ? 'rgba(109,40,217,0.7)' : 'rgba(76,29,149,0.42)'}; color:#ede9fe; cursor:pointer;">${spell?.name ?? spellId}</button>`;
        })
        .join('')}
      <button data-spell-id="cancel" type="button" style="padding:8px 10px; text-align:left; border:1px solid rgba(148,163,184,0.28); background:rgba(30,41,59,0.72); color:#cbd5e1; cursor:pointer;">cancel</button>
    </div>
  `;
}

export function drawFrame(args: FrameRenderArgs): void {
  const { state, refs, ctx, minimapCtx } = args;
  const room = getCurrentRoom(state);
  const tileSize = getTileSize(state, refs.canvas, args.hudHeight);
  const offset = getBoardOffset(state, refs.canvas, args.hudHeight, tileSize);
  const activeHero = state.party.heroes[state.party.activeHeroIndex];

  ctx.clearRect(0, 0, refs.canvas.width, refs.canvas.height);

  for (let y = 0; y < room.height; y += 1) {
    for (let x = 0; x < room.width; x += 1) {
      const tile = room.tiles[y][x];
      if (tile === TileType.VOID_BLACK) continue;
      const px = offset.x + x * tileSize;
      const py = offset.y + y * tileSize;

      if (tile === TileType.FLOOR) ctx.fillStyle = '#6b7280';
      if (tile === TileType.EXIT) ctx.fillStyle = '#1d4ed8';

      ctx.fillRect(px, py, tileSize, tileSize);
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, tileSize - 1, tileSize - 1);
    }
  }

  if (args.appMode === 'game' && args.overlayMode === null && state.runState === 'active' && activeHero && activeHero.hp > 0) {
    drawAttackRangeOverlay(ctx, room, activeHero.tile, getHeroAttackProfile(activeHero).range, tileSize, offset);
  }

  for (const step of state.hoverPath) {
    const px = offset.x + step.x * tileSize;
    const py = offset.y + step.y * tileSize;
    ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
    ctx.fillRect(px + 3, py + 3, tileSize - 6, tileSize - 6);
  }

  for (const tile of state.spellPreviewTiles) {
    const px = offset.x + tile.x * tileSize;
    const py = offset.y + tile.y * tileSize;
    ctx.fillStyle = 'rgba(249, 115, 22, 0.3)';
    ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 3, py + 3, tileSize - 6, tileSize - 6);
  }

  state.party.heroes.forEach((hero, index) => {
    if (hero.hp <= 0) return;
    if (state.readyByHeroId.has(hero.id)) return;

    const cx = offset.x + hero.tile.x * tileSize + tileSize / 2;
    const cy = offset.y + hero.tile.y * tileSize + tileSize / 2;
    const radius = tileSize * 0.3;
    const isHealTargetable =
      state.selectedSpellId === 'heal' &&
      canHeroCastSpellOnHero(state, state.party.heroes[state.party.activeHeroIndex].id, hero.id);

    ctx.fillStyle = index === state.party.activeHeroIndex ? '#fbbf24' : '#e2e8f0';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isHealTargetable ? '#86efac' : '#0f172a';
    ctx.lineWidth = isHealTargetable ? 3 : 2;
    ctx.stroke();

    const tri = facingTriangle(cx, cy, radius, hero.facing);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(tri[0].x, tri[0].y);
    ctx.lineTo(tri[1].x, tri[1].y);
    ctx.lineTo(tri[2].x, tri[2].y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = `${Math.max(12, Math.floor(tileSize * 0.28))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hero.classLetter, cx, cy);
  });

  const roomEnemies = getCurrentRoomEnemyViews(state);
  roomEnemies.forEach((enemy) => {
    if (enemy.hp <= 0) return;

    const cx = offset.x + enemy.tile.x * tileSize + tileSize / 2;
    const cy = offset.y + enemy.tile.y * tileSize + tileSize / 2;
    const radius = tileSize * 0.26;

    ctx.fillStyle = enemy.kind === 'skeleton-archer' ? '#fb7185' : '#ef4444';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = enemy.isSpellTargetable ? '#c4b5fd' : enemy.isAttackTargetable ? '#fde68a' : '#3f0d16';
    ctx.lineWidth = enemy.isSpellTargetable || enemy.isAttackTargetable ? 3 : 2;
    ctx.stroke();

    ctx.fillStyle = '#fff7ed';
    ctx.font = `${Math.max(10, Math.floor(tileSize * 0.24))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(enemy.kind === 'skeleton-archer' ? 'A' : 'S', cx, cy);

    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.max(9, Math.floor(tileSize * 0.2))}px sans-serif`;
    ctx.fillText(`${enemy.hp}/${enemy.maxHp}`, cx, cy + radius + 10);
  });

  drawHud(args);
  drawMinimap(args, minimapCtx);
}

function drawAttackRangeOverlay(
  ctx: CanvasRenderingContext2D,
  room: ReturnType<typeof getCurrentRoom>,
  origin: Coord,
  range: number,
  tileSize: number,
  offset: Coord,
): void {
  if (range <= 0) return;

  for (let y = 0; y < room.height; y += 1) {
    for (let x = 0; x < room.width; x += 1) {
      const tile = room.tiles[y][x];
      if (tile === TileType.VOID_BLACK) continue;

      const distance = Math.abs(origin.x - x) + Math.abs(origin.y - y);
      if (distance === 0 || distance > range) continue;

      const px = offset.x + x * tileSize;
      const py = offset.y + y * tileSize;
      const intensity = 1 - (distance - 1) / Math.max(range, 1);

      ctx.fillStyle = `rgba(251, 191, 36, ${0.08 + intensity * 0.12})`;
      ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
      ctx.strokeStyle = `rgba(253, 224, 71, ${0.1 + intensity * 0.2})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 3.5, py + 3.5, tileSize - 7, tileSize - 7);
    }
  }
}

export function getTileSize(state: GameState, canvas: HTMLCanvasElement, hudHeight: number): number {
  const room = getCurrentRoom(state);
  const maxW = canvas.width;
  const maxH = canvas.height - hudHeight;
  return Math.floor(Math.min(maxW / room.width, maxH / room.height));
}

export function getBoardOffset(
  state: GameState,
  canvas: HTMLCanvasElement,
  hudHeight: number,
  tileSize: number,
): Coord {
  const room = getCurrentRoom(state);
  const boardW = room.width * tileSize;
  const boardH = room.height * tileSize;
  return {
    x: Math.floor((canvas.width - boardW) / 2),
    y: Math.floor((canvas.height - hudHeight - boardH) / 2),
  };
}

function drawHud(args: FrameRenderArgs): void {
  const { state, refs, ctx, hudHeight } = args;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, refs.canvas.height - hudHeight, refs.canvas.width, hudHeight);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const active = state.party.heroes[state.party.activeHeroIndex];
  const ready = `${state.readyByHeroId.size}/3`;
  const encounter = getCurrentRoomEncounterView(state);
  const turn = getTurnBannerView(state);
  const encounterLabel =
    encounter.roomType === 'combat' ? (encounter.isBlockingExit ? 'Combat Locked' : 'Combat Clear') : encounter.roomType === 'treasure' ? 'Treasure' : 'Exit';
  ctx.fillText(
    `Floor ${getCurrentFloorNumber(state)}/${state.dungeon.totalFloors} | Room ${getCurrentRoomCoordId(state)} | ${encounterLabel} | Round ${turn.round || '-'} | Enemies ${encounter.enemyCount} | Active ${active.classLetter} | Exit Ready ${ready}`,
    12,
    refs.canvas.height - hudHeight / 2,
  );

  const heroResources = turn.heroResources;
  const heroResourcesText = heroResources
    ? ` | Move ${heroResources.movementRemaining} | AP ${heroResources.actionPointsRemaining} | Attack ${heroResources.attackSlotAvailable ? 'ready' : 'spent'}`
    : '';
  const weaponText = getSelectedHeroWeaponSummary(state);
  const castText = getSelectedHeroCastingSummary(state);
  const selectedSpell = getSelectedSpellDefinition(state);
  const lastRollText = getLastRollSummary(state);
  refs.status.textContent = `Discovered rooms: ${state.dungeon.discoveredRoomIds.size} | Seed: ${state.dungeon.seed} | Room type: ${encounter.roomType} | Turn: ${turn.activeLabel}${heroResourcesText} | Weapon: ${weaponText} | ${castText}${selectedSpell ? ` | Spell: ${selectedSpell.name}` : ''}${lastRollText ? ` | ${lastRollText}` : ''}`;
  if (state.runState === 'won') {
    refs.status.textContent = `Run won | All required rooms cleared and exit reached | Weapon: ${weaponText}${lastRollText ? ` | ${lastRollText}` : ''}`;
  } else if (state.runState === 'lost') {
    refs.status.textContent = `Run lost | All heroes defeated${lastRollText ? ` | ${lastRollText}` : ''}`;
  }
  refs.controlsHint.textContent =
    state.runState === 'won'
      ? 'Run complete. Use reset saved state to start a new run.'
      : state.runState === 'lost'
        ? 'Run failed. Use reset saved state to start a new run.'
        : state.castModeHeroId && !state.selectedSpellId
          ? 'Cast mode: choose a spell from the spell menu'
          : state.selectedSpellId
            ? `Spell mode: ${selectedSpell?.name ?? state.selectedSpellId} | click a valid target`
            : state.attackModeHeroId
              ? 'Attack mode: click a highlighted enemy to attack | 1/2/3 or click card = active hero'
              : state.itemUseModeHeroId
                ? 'Item mode: click a highlighted consumable in the active hero backpack'
                : 'Mouse hover = A* preview | Click = move/attack target | 1/2/3 or click card = active hero';

  const activeHero = state.party.heroes[state.party.activeHeroIndex];
  const hasAttackTarget =
    state.turn?.phase === 'heroes' &&
    getCurrentRoomEnemies(state).some((enemy) => canHeroBasicAttackEnemy(state, activeHero.id, enemy.id));
  refs.attackButton.disabled = state.runState !== 'active' || !turn.isCombatActive || !isCurrentTurnHero(state);
  refs.attackButton.style.opacity = refs.attackButton.disabled ? '0.5' : '1';
  refs.attackButton.textContent = state.attackModeHeroId === activeHero.id ? 'cancel attack' : hasAttackTarget ? 'basic attack' : 'basic attack';

  const skillAction = getActiveHeroSkillActionView(state);
  refs.skillButton.disabled = state.runState !== 'active' || activeHero.className === 'Mage' || !skillAction.isAvailable;
  refs.skillButton.style.opacity = refs.skillButton.disabled ? '0.5' : '1';
  refs.skillButton.textContent =
    skillAction.cooldownRemaining > 0 ? `${skillAction.label} (${skillAction.cooldownRemaining})` : skillAction.label.toLowerCase();

  const castAction = getActiveHeroCastActionView(state);
  refs.castButton.disabled = !turn.isCombatActive || !isCurrentTurnHero(state) || !castAction.isAvailable;
  refs.castButton.style.opacity = refs.castButton.disabled ? '0.5' : '1';
  refs.castButton.textContent =
    state.castModeHeroId === activeHero.id
      ? state.selectedSpellId
        ? `cancel ${selectedSpell?.name ?? 'spell'}`
        : 'cancel cast'
      : 'cast';
  refs.useItemButton.disabled = state.runState !== 'active' || !canUseActiveHeroConsumable(state);
  refs.useItemButton.style.opacity = refs.useItemButton.disabled ? '0.5' : '1';
  refs.useItemButton.textContent = state.itemUseModeHeroId === activeHero.id ? 'cancel item' : 'use item';
}

function drawMinimap(args: FrameRenderArgs, minimapCtx: CanvasRenderingContext2D): void {
  const { state, refs, showFullDungeonMap } = args;
  minimapCtx.clearRect(0, 0, refs.minimapCanvas.width, refs.minimapCanvas.height);
  minimapCtx.fillStyle = '#020617';
  minimapCtx.fillRect(0, 0, refs.minimapCanvas.width, refs.minimapCanvas.height);

  const roomIds = showFullDungeonMap ? Array.from(state.dungeon.rooms.keys()) : Array.from(state.dungeon.discoveredRoomIds);
  const coords = roomIds.map((id) => {
    const [x, y] = id.split(',').map(Number);
    return { id, x, y };
  });
  if (coords.length === 0) return;

  const minX = Math.min(...coords.map((c) => c.x));
  const maxX = Math.max(...coords.map((c) => c.x));
  const minY = Math.min(...coords.map((c) => c.y));
  const maxY = Math.max(...coords.map((c) => c.y));
  const spanX = Math.max(1, maxX - minX + 1);
  const spanY = Math.max(1, maxY - minY + 1);
  const cell = Math.floor(Math.min(refs.minimapCanvas.width / spanX, refs.minimapCanvas.height / spanY) * 0.8);
  const offsetX = Math.floor((refs.minimapCanvas.width - spanX * cell) / 2);
  const offsetY = Math.floor((refs.minimapCanvas.height - spanY * cell) / 2);

  coords.forEach((coord) => {
    const px = offsetX + (coord.x - minX) * cell;
    const py = offsetY + (coord.y - minY) * cell;
    const room = state.dungeon.rooms.get(coord.id);
    const isCleared = room ? isRoomObjectiveCleared(room) : false;
    minimapCtx.fillStyle =
      coord.id === state.dungeon.currentRoomId ? '#fbbf24' : isCleared ? '#22c55e' : '#334155';
    minimapCtx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
  });
}

function getSelectedHeroWeaponSummary(state: GameState): string {
  const hero = state.party.heroes[state.party.activeHeroIndex];
  if (!hero) return 'none';
  const profile = getHeroAttackProfile(hero);
  return `${profile.label} | dice ${profile.attackDice} | damage ${profile.damage} | range ${profile.range}`;
}

function getSelectedHeroCastingSummary(state: GameState): string {
  const hero = state.party.heroes[state.party.activeHeroIndex];
  if (!hero) return 'Book: none | Focus: none';
  const requirements = getHeroCastRequirementView(hero);
  return `Book: ${requirements.spellbookName ?? 'none'} | Focus: ${requirements.focusName ?? 'none'}`;
}

function getLastRollSummary(state: GameState): string {
  const roll = state.lastCombatRoll;
  if (!roll) return '';
  return `Last roll atk[${roll.attackRolls.join(',')}] def[${roll.defenseRolls.join(',')}] dmg ${roll.finalDamage}`;
}

function facingTriangle(
  cx: number,
  cy: number,
  r: number,
  facing: 'N' | 'E' | 'S' | 'W',
): Coord[] {
  if (facing === 'N') {
    return [
      { x: cx, y: cy - r - 2 },
      { x: cx - r * 0.45, y: cy - r * 0.25 },
      { x: cx + r * 0.45, y: cy - r * 0.25 },
    ];
  }
  if (facing === 'S') {
    return [
      { x: cx, y: cy + r + 2 },
      { x: cx - r * 0.45, y: cy + r * 0.25 },
      { x: cx + r * 0.45, y: cy + r * 0.25 },
    ];
  }
  if (facing === 'E') {
    return [
      { x: cx + r + 2, y: cy },
      { x: cx + r * 0.25, y: cy - r * 0.45 },
      { x: cx + r * 0.25, y: cy + r * 0.45 },
    ];
  }
  return [
    { x: cx - r - 2, y: cy },
    { x: cx - r * 0.25, y: cy - r * 0.45 },
    { x: cx - r * 0.25, y: cy + r * 0.45 },
  ];
}
