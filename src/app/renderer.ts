import type { Coord } from '../data/dungeonTypes.js';
import { TileType } from '../data/tileTypes.js';
import { SPELL_DEFINITIONS } from '../magic/spells.js';
import {
  canWalkTile,
  canHeroCastSpellOnHero,
  canUseActiveHeroConsumable,
  getActiveHeroCastActionView,
  getActiveHeroSkillActionView,
  getCurrentFloorNumber,
  getCurrentRoom,
  getCurrentRoomCoordId,
  getCurrentRoomEncounterView,
  getCurrentRoomEnemyViews,
  getHeroPanelViews,
  getSelectedSpellDefinition,
  isBackpackConsumableTargetable,
  isRoomObjectiveCleared,
  type GameState,
} from '../systems/gameSystem.js';
import { getTurnBannerView, isCurrentTurnHero } from '../systems/turnSystem.js';
import { getHeroAttackProfile, getHeroCastRequirementView } from '../systems/weaponSystem.js';
import { getPauseMenuOverlayHtml, getRunCompleteOverlayHtml, getStartMenuOverlayHtml } from '../ui/overlayViews.js';
import { renderCharacterPanelsHtml, renderCombatLogHtml, renderPartyInventoryHtml } from '../ui/sidebarViews.js';
import type { InventoryEntry } from '../items/inventory.js';
import { COMBAT_ROLL_ANIMATION_TOTAL_MS, type AppMode, type CombatRollAnimationState, type OverlayMode } from './types.js';
import { coordKey, neighbors4 } from '../utils/grid.js';

const COMBAT_ROLL_INTRO_MS = 250;
const COMBAT_ROLL_ATTACK_MS = 900;
const COMBAT_ROLL_ATTACK_PAUSE_MS = 250;
const COMBAT_ROLL_DEFENSE_MS = 900;
const COMBAT_ROLL_DEFENSE_PAUSE_MS = 250;
const COMBAT_ROLL_COMPARISON_MS = 450;
const COMBAT_ROLL_DAMAGE_MS = 600;
const ENEMY_MOVE_MS_PER_TILE = 420;
const ENEMY_MOVE_MAX_MS = 1400;
const enemyTokenAnimations = new Map<
  string,
  {
    from: Coord;
    to: Coord;
    startedAt: number;
    durationMs: number;
    lastTile: Coord;
  }
>();

export interface AppRenderRefs {
  canvas: HTMLCanvasElement;
  minimapCanvas: HTMLCanvasElement;
  resultCanvas: HTMLCanvasElement;
  gameRoot: HTMLDivElement;
  screenOverlay: HTMLDivElement;
  inventoryModal: HTMLDivElement;
  roomEntryModal: HTMLDivElement;
  inventoryModalGold: HTMLDivElement;
  inventoryModalList: HTMLDivElement;
  status: HTMLDivElement;
  controlsHint: HTMLDivElement;
  characterPanels: HTMLDivElement;
  goldValue: HTMLDivElement;
  combatLog: HTMLDivElement;
  partyInventoryList: HTMLDivElement;
  inventoryButton: HTMLButtonElement;
  attackButton: HTMLButtonElement;
  skillButton: HTMLButtonElement;
  castButton: HTMLButtonElement;
  castMenu: HTMLDivElement;
  useItemButton: HTMLButtonElement;
  skipTurnButton: HTMLButtonElement;
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
  resultCtx: CanvasRenderingContext2D;
  diceAnimation: CombatRollAnimationState | null;
  hudHeight: number;
  nowMs: number;
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
  refs: Pick<AppRenderRefs, 'goldValue' | 'inventoryButton' | 'inventoryModalGold' | 'inventoryModalList'>,
  getItemTooltip: (itemId: string) => string,
): void {
  refs.goldValue.textContent = `run gold: ${state.runGold} | account gold: ${accountGold}`;
  refs.inventoryButton.textContent = `inventory (${partyInventory.length})`;
  refs.inventoryModalGold.textContent = `run gold: ${state.runGold} | account gold: ${accountGold}`;
  refs.inventoryModalList.innerHTML = renderPartyInventoryHtml(partyInventory, getItemTooltip);
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
    drawTacticalPreviewOverlay(state, ctx, room, activeHero, tileSize, offset);
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
    if (hero.roomId !== room.id) return;
    const displayHp = getDisplayedHpDuringCombatRoll(hero.id, hero.hp, hero.maxHp, args);
    if (displayHp <= 0) return;
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
    drawTokenHealthBadge(ctx, {
      x: cx,
      y: cy + radius + 10,
      width: Math.max(32, tileSize * 0.62),
      hp: displayHp,
      maxHp: hero.maxHp,
      fill: '#22c55e',
      text: '#dcfce7',
    });
  });

  const roomEnemies = getCurrentRoomEnemyViews(state);
  roomEnemies.forEach((enemy) => {
    const displayHp = getDisplayedHpDuringCombatRoll(enemy.id, enemy.hp, enemy.maxHp, args);
    if (displayHp <= 0) return;

    const renderTile = getAnimatedEnemyTile(enemy.id, enemy.tile, args.nowMs);
    const cx = offset.x + renderTile.x * tileSize + tileSize / 2;
    const cy = offset.y + renderTile.y * tileSize + tileSize / 2;
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
    drawTokenHealthBadge(ctx, {
      x: cx,
      y: cy + radius + 10,
      width: Math.max(30, tileSize * 0.58),
      hp: displayHp,
      maxHp: enemy.maxHp,
      fill: '#fb7185',
      text: '#ffe4e6',
    });
  });

  drawHud(args);
  drawMinimap(args, minimapCtx);
  drawCombatResultPanel(args);
}

function getDisplayedHpDuringCombatRoll(
  unitId: string,
  actualHp: number,
  maxHp: number,
  args: Pick<FrameRenderArgs, 'diceAnimation' | 'nowMs'>,
): number {
  const animation = args.diceAnimation;
  if (!animation || animation.roll.defenderId !== unitId || args.nowMs >= animation.endsAt) {
    return actualHp;
  }

  return Math.min(maxHp, actualHp + animation.roll.finalDamage);
}

function getAnimatedEnemyTile(enemyId: string, tile: Coord, nowMs: number): Coord {
  const existing = enemyTokenAnimations.get(enemyId);
  if (!existing) {
    enemyTokenAnimations.set(enemyId, {
      from: { ...tile },
      to: { ...tile },
      startedAt: nowMs,
      durationMs: 0,
      lastTile: { ...tile },
    });
    return tile;
  }

  if (!sameRenderTile(existing.lastTile, tile)) {
    const distance = Math.abs(existing.lastTile.x - tile.x) + Math.abs(existing.lastTile.y - tile.y);
    existing.from = { ...existing.lastTile };
    existing.to = { ...tile };
    existing.startedAt = nowMs;
    existing.durationMs = Math.min(ENEMY_MOVE_MAX_MS, Math.max(ENEMY_MOVE_MS_PER_TILE, distance * ENEMY_MOVE_MS_PER_TILE));
    existing.lastTile = { ...tile };
  }

  if (existing.durationMs <= 0) return tile;

  const progress = Math.min(1, Math.max(0, (nowMs - existing.startedAt) / existing.durationMs));
  const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
  if (progress >= 1) return tile;

  return {
    x: existing.from.x + (existing.to.x - existing.from.x) * eased,
    y: existing.from.y + (existing.to.y - existing.from.y) * eased,
  };
}

function sameRenderTile(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

function drawTokenHealthBadge(
  ctx: CanvasRenderingContext2D,
  args: { x: number; y: number; width: number; hp: number; maxHp: number; fill: string; text: string },
): void {
  const height = 13;
  const left = args.x - args.width / 2;
  const top = args.y - height / 2;
  const percent = args.maxHp > 0 ? Math.max(0, Math.min(1, args.hp / args.maxHp)) : 0;

  ctx.fillStyle = 'rgba(2,6,23,0.82)';
  ctx.fillRect(left, top, args.width, height);
  ctx.strokeStyle = 'rgba(15,23,42,0.9)';
  ctx.lineWidth = 1;
  ctx.strokeRect(left + 0.5, top + 0.5, args.width - 1, height - 1);
  ctx.fillStyle = args.fill;
  ctx.fillRect(left + 2, top + 2, Math.max(0, (args.width - 4) * percent), height - 4);
  ctx.fillStyle = args.text;
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${args.hp}/${args.maxHp}`, args.x, args.y + 0.5);
}

function drawTacticalPreviewOverlay(
  state: GameState,
  ctx: CanvasRenderingContext2D,
  room: ReturnType<typeof getCurrentRoom>,
  hero: GameState['party']['heroes'][number],
  tileSize: number,
  offset: Coord,
): void {
  const moveTiles = getReachableMoveTiles(state, room, hero);
  const attackTiles = getAttackRangeTiles(room, hero.tile, getHeroAttackProfile(hero).range);

  if (moveTiles.size === 0 && attackTiles.size === 0) return;

  for (let y = 0; y < room.height; y += 1) {
    for (let x = 0; x < room.width; x += 1) {
      const tile = room.tiles[y][x];
      if (tile === TileType.VOID_BLACK) continue;
      if (x === hero.tile.x && y === hero.tile.y) continue;

      const px = offset.x + x * tileSize;
      const py = offset.y + y * tileSize;
      const key = coordKey({ x, y });
      const isMoveTile = moveTiles.has(key);
      const isAttackTile = attackTiles.has(key);
      if (!isMoveTile && !isAttackTile) continue;

      if (isMoveTile && isAttackTile) {
        ctx.fillStyle = 'rgba(168, 85, 247, 0.24)';
        ctx.strokeStyle = 'rgba(196, 181, 253, 0.55)';
      } else if (isMoveTile) {
        ctx.fillStyle = 'rgba(125, 211, 252, 0.24)';
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.48)';
      } else {
        ctx.fillStyle = 'rgba(248, 113, 113, 0.22)';
        ctx.strokeStyle = 'rgba(252, 165, 165, 0.45)';
      }

      ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 3.5, py + 3.5, tileSize - 7, tileSize - 7);
    }
  }
}

function getReachableMoveTiles(
  state: GameState,
  room: ReturnType<typeof getCurrentRoom>,
  hero: GameState['party']['heroes'][number],
): Set<string> {
  const turnResources =
    state.turn?.phase === 'heroes' && state.party.heroes[state.party.activeHeroIndex]?.id === hero.id
      ? state.turn.heroResourcesById[hero.id]
      : null;
  const movementRemaining = Math.max(0, turnResources?.movementRemaining ?? 0);
  if (movementRemaining <= 0 || state.readyByHeroId.has(hero.id)) {
    return new Set();
  }

  const visited = new Map<string, number>([[coordKey(hero.tile), 0]]);
  const reachable = new Set<string>();
  const queue: Array<{ coord: Coord; steps: number }> = [{ coord: hero.tile, steps: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    for (const next of neighbors4(current.coord)) {
      const nextSteps = current.steps + 1;
      const nextKey = coordKey(next);
      if (nextSteps > movementRemaining) continue;
      if (!canWalkTile(room, next)) continue;
      if (isPreviewTileOccupiedByOtherHero(state, room.id, next, hero.id)) continue;
      if (isPreviewTileOccupiedByEnemy(state, room.id, next)) continue;

      const knownSteps = visited.get(nextKey);
      if (knownSteps !== undefined && knownSteps <= nextSteps) continue;

      visited.set(nextKey, nextSteps);
      reachable.add(nextKey);
      queue.push({ coord: next, steps: nextSteps });
    }
  }

  return reachable;
}

function getAttackRangeTiles(
  room: ReturnType<typeof getCurrentRoom>,
  origin: Coord,
  range: number,
): Set<string> {
  const attackTiles = new Set<string>();
  if (range <= 0) return attackTiles;

  for (let y = 0; y < room.height; y += 1) {
    for (let x = 0; x < room.width; x += 1) {
      if (room.tiles[y][x] === TileType.VOID_BLACK) continue;

      const distance = Math.abs(origin.x - x) + Math.abs(origin.y - y);
      if (distance === 0 || distance > range) continue;

      attackTiles.add(coordKey({ x, y }));
    }
  }

  return attackTiles;
}

function isPreviewTileOccupiedByOtherHero(
  state: GameState,
  roomId: string,
  coord: Coord,
  currentHeroId: string,
): boolean {
  return state.party.heroes.some(
    (candidate) =>
      candidate.id !== currentHeroId &&
      candidate.hp > 0 &&
      !state.readyByHeroId.has(candidate.id) &&
      candidate.roomId === roomId &&
      candidate.tile.x === coord.x &&
      candidate.tile.y === coord.y,
  );
}

function isPreviewTileOccupiedByEnemy(
  state: GameState,
  roomId: string,
  coord: Coord,
): boolean {
  const roomEnemies = state.dungeon.enemiesByRoomId.get(roomId) ?? [];
  return roomEnemies.some((enemy) => enemy.hp > 0 && enemy.tile.x === coord.x && enemy.tile.y === coord.y);
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
  const activeResources = turn.heroResources;
  const hasAttackSlot = activeResources?.attackSlotAvailable !== false;
  refs.attackButton.disabled = state.runState !== 'active' || !turn.isCombatActive || !isCurrentTurnHero(state) || !hasAttackSlot;
  refs.attackButton.style.opacity = refs.attackButton.disabled ? '0.45' : '1';
  refs.attackButton.style.background = refs.attackButton.disabled ? 'rgba(15,23,42,0.72)' : 'rgba(120,53,15,0.45)';
  refs.attackButton.style.borderColor = refs.attackButton.disabled ? 'rgba(71,85,105,0.55)' : 'rgba(251,191,36,0.45)';
  refs.attackButton.style.color = refs.attackButton.disabled ? '#64748b' : '#fef3c7';
  refs.attackButton.style.cursor = refs.attackButton.disabled ? 'default' : 'pointer';
  refs.attackButton.textContent =
    state.attackModeHeroId === activeHero.id ? 'cancel attack' : hasAttackSlot || !turn.isCombatActive ? 'basic attack' : 'basic attack spent';

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

  refs.skipTurnButton.disabled = state.runState !== 'active' || !turn.isCombatActive || !isCurrentTurnHero(state);
  refs.skipTurnButton.style.opacity = refs.skipTurnButton.disabled ? '0.5' : '1';
  refs.skipTurnButton.textContent = 'end heroes phase';
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

function drawCombatRollSidebarPanel(
  args: FrameRenderArgs,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const roll = args.state.lastCombatRoll;
  if (!roll) return;

  const animation = args.diceAnimation?.roll === roll ? args.diceAnimation : null;
  const elapsed = animation ? Math.max(0, args.nowMs - animation.startedAt) : COMBAT_ROLL_ANIMATION_TOTAL_MS;
  const alpha = animation
    ? Math.max(0.45, Math.min(Math.min(1, elapsed / 120), Math.min(1, (COMBAT_ROLL_ANIMATION_TOTAL_MS - elapsed) / 220)))
    : 1;
  const attackStart = COMBAT_ROLL_INTRO_MS;
  const attackEnd = attackStart + COMBAT_ROLL_ATTACK_MS;
  const defenseStart = attackEnd + COMBAT_ROLL_ATTACK_PAUSE_MS;
  const defenseEnd = defenseStart + COMBAT_ROLL_DEFENSE_MS;
  const comparisonStart = defenseEnd + COMBAT_ROLL_DEFENSE_PAUSE_MS;
  const damageStart = comparisonStart + COMBAT_ROLL_COMPARISON_MS;
  const attackerLabel = animation?.attackerLabel ?? getCombatantLabel(args.state, roll.attackerId);
  const defenderLabel = animation?.defenderLabel ?? getCombatantLabel(args.state, roll.defenderId);

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(fitLabel(attackerLabel, 20), width / 2, 12);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`vs ${fitLabel(defenderLabel, 20)}`, width / 2, 29);
  ctx.fillText(
    animation ? getCombatRollStageLabel(elapsed, defenseStart, comparisonStart, damageStart) : 'Last combat roll',
    width / 2,
    46,
  );

  drawDiceRow(ctx, {
    x: 12,
    y: 74,
    label: 'Atk',
    rolls: roll.attackRolls,
    resolvedValues: roll.attackHits,
    color: '#f97316',
    stageProgress: getStageProgress(elapsed, attackStart, COMBAT_ROLL_ATTACK_MS),
    nowMs: args.nowMs,
    resolvedLabelPrefix: 'h',
    dieSize: 24,
    showResolvedLabels: false,
  });

  if (elapsed >= defenseStart - 120) {
    drawDiceRow(ctx, {
      x: 12,
      y: 110,
      label: 'Def',
      rolls: roll.defenseRolls,
      resolvedValues: roll.blockedHits,
      color: '#38bdf8',
      stageProgress: getStageProgress(elapsed, defenseStart, COMBAT_ROLL_DEFENSE_MS),
      nowMs: args.nowMs,
      resolvedLabelPrefix: 'b',
      dieSize: 24,
      showResolvedLabels: false,
    });
  }

  if (elapsed >= comparisonStart) {
    const summaryAlpha = Math.max(0.2, Math.min(1, (elapsed - comparisonStart) / COMBAT_ROLL_COMPARISON_MS));
    ctx.save();
    ctx.globalAlpha = summaryAlpha;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `Hits ${roll.totalAttackHits}  Blocks ${roll.totalBlockedHits}  Net ${roll.effectiveHits}`,
      12,
      156,
    );
    ctx.restore();
  }

  if (elapsed >= damageStart) {
    drawDamageBadge(
      ctx,
      12,
      172,
      roll.finalDamage,
      Math.min(1, (elapsed - damageStart) / COMBAT_ROLL_DAMAGE_MS),
      width - 24,
      34,
    );
  }

  ctx.restore();
}

function drawCombatResultPanel(args: FrameRenderArgs): void {
  const { resultCtx, refs } = args;
  resultCtx.clearRect(0, 0, refs.resultCanvas.width, refs.resultCanvas.height);
  if (args.appMode !== 'game' || !args.state.lastCombatRoll) {
    resultCtx.fillStyle = '#020617';
    resultCtx.fillRect(0, 0, refs.resultCanvas.width, refs.resultCanvas.height);
    resultCtx.fillStyle = '#64748b';
    resultCtx.font = '13px sans-serif';
    resultCtx.textAlign = 'center';
    resultCtx.textBaseline = 'middle';
    resultCtx.fillText('No combat result yet', refs.resultCanvas.width / 2, refs.resultCanvas.height / 2);
    return;
  }

  drawCombatRollSidebarPanel(args, resultCtx, refs.resultCanvas.width, refs.resultCanvas.height);
}

function drawDiceRow(
  ctx: CanvasRenderingContext2D,
  args: {
    x: number;
    y: number;
    label: string;
    rolls: readonly number[];
    resolvedValues: readonly number[];
    color: string;
    stageProgress: number;
    nowMs: number;
    resolvedLabelPrefix: string;
    dieSize?: number;
    showResolvedLabels?: boolean;
  },
): void {
  const dieSize = args.dieSize ?? 42;
  const gap = Math.max(10, Math.floor(dieSize * 0.24));
  const settleStart = 0.28;
  const settleSpan = 0.72;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#cbd5e1';
  ctx.font = `bold ${Math.max(14, Math.floor(dieSize * 0.33))}px sans-serif`;
  ctx.fillText(args.label, args.x, args.y + dieSize / 2);

  const diceStartX = args.x + Math.max(76, Math.floor(dieSize * 1.8));
  const safeCount = Math.max(1, args.rolls.length);

  for (let index = 0; index < args.rolls.length; index += 1) {
    const dieX = diceStartX + index * (dieSize + gap);
    const settleProgress = args.stageProgress <= settleStart
      ? 0
      : Math.min(1, (args.stageProgress - settleStart) / settleSpan);
    const revealThreshold = (index + 1) / safeCount;
    const isSettled = settleProgress >= revealThreshold;
    const displayValue = isSettled
      ? args.rolls[index]
      : ((Math.floor(args.nowMs / 65) + index * 2) % 6) + 1;
    const resolvedValue = args.resolvedValues[index] ?? 0;
    const didSucceed = resolvedValue > 0;
    const settledFill = didSucceed ? 'rgba(20, 83, 45, 0.9)' : 'rgba(127, 29, 29, 0.9)';
    const settledStroke = didSucceed ? '#22c55e' : '#ef4444';
    const settledText = didSucceed ? '#dcfce7' : '#fee2e2';

    ctx.fillStyle = isSettled ? settledFill : 'rgba(30, 41, 59, 0.88)';
    ctx.fillRect(dieX, args.y, dieSize, dieSize);
    ctx.strokeStyle = isSettled ? settledStroke : 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = isSettled ? 2 : 1.5;
    ctx.strokeRect(dieX + 0.5, args.y + 0.5, dieSize - 1, dieSize - 1);

    ctx.fillStyle = isSettled ? settledText : '#f8fafc';
    ctx.font = `bold ${Math.max(22, Math.floor(dieSize * 0.5))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(String(displayValue), dieX + dieSize / 2, args.y + dieSize / 2 + 1);

    if (isSettled && args.showResolvedLabels !== false) {
      ctx.fillStyle = didSucceed ? '#bbf7d0' : '#fecaca';
      ctx.font = `${Math.max(11, Math.floor(dieSize * 0.22))}px sans-serif`;
      ctx.fillText(`${args.resolvedLabelPrefix} ${resolvedValue}`, dieX + dieSize / 2, args.y + dieSize + Math.max(14, Math.floor(dieSize * 0.32)));
    }
  }
}

function drawDamageBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  damage: number,
  progress: number,
  width = 224,
  height = 46,
): void {
  const alpha = Math.max(0.25, progress);
  const scale = 0.9 + Math.min(1, progress) * 0.1;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(centerX, centerY);
  ctx.scale(scale, scale);
  ctx.translate(-centerX, -centerY);
  ctx.fillStyle = damage > 0 ? 'rgba(127, 29, 29, 0.92)' : 'rgba(30, 41, 59, 0.92)';
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = damage > 0 ? 'rgba(248, 113, 113, 0.8)' : 'rgba(148, 163, 184, 0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(damage > 0 ? 'Damage' : 'No Damage', centerX, y + 14);
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(String(damage), centerX, y + 31);
  ctx.restore();
}

function getCombatRollStageLabel(
  elapsed: number,
  defenseStart: number,
  comparisonStart: number,
  damageStart: number,
): string {
  if (elapsed < defenseStart) return 'Attack dice';
  if (elapsed < comparisonStart) return 'Defense dice';
  if (elapsed < damageStart) return 'Compare hits';
  if (elapsed >= damageStart + COMBAT_ROLL_DAMAGE_MS) return 'Result';
  return 'Final damage';
}

function getStageProgress(
  elapsed: number,
  stageStart: number,
  stageDuration: number,
): number {
  if (elapsed <= stageStart) return 0;
  if (elapsed >= stageStart + stageDuration) return 1;
  return (elapsed - stageStart) / stageDuration;
}

function getCombatantLabel(state: GameState, unitId: string): string {
  const hero = state.party.heroes.find((candidate) => candidate.id === unitId);
  if (hero) return hero.name;

  for (const roomEnemies of state.dungeon.enemiesByRoomId.values()) {
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

function fitLabel(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
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
  const bonus = roll.skillBonus > 0 ? ` + Skill Bonus ${roll.skillBonus}` : '';
  return `Last roll Attack Dice [${roll.attackRolls.join(',')}] | Blocked Hits ${roll.totalBlockedHits} | Effective Hits ${roll.effectiveHits} | Weapon Damage ${roll.weaponDamage}${bonus} | Final Damage ${roll.finalDamage}`;
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
