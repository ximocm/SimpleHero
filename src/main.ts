import type { Coord } from './data/dungeonTypes.js';
import { TileType } from './data/tileTypes.js';
import {
  canHeroBasicAttackEnemy,
  canUseActiveHeroConsumable,
  canWalkTile,
  commitMoveFromHover,
  createGameState,
  getActiveHeroConsumableActionView,
  getCurrentRoomEncounterView,
  getCurrentRoomEnemyViews,
  getCurrentRoomEnemies,
  getCurrentFloorNumber,
  ensureActiveHeroIsLiving,
  getHeroPanelViews,
  getCurrentRoom,
  getCurrentRoomCoordId,
  getTileAt,
  isBackpackConsumableTargetable,
  setActiveHeroIndex,
  stepMovement,
  toggleAttackMode,
  toggleItemUseMode,
  tryHeroAttackAtTile,
  updateHoverPath,
  useActiveHeroBackpackConsumable,
} from './systems/gameSystem.js';
import { getHeroAttackProfile } from './systems/combatSystem.js';
import { advanceAutomatedTurns, getTurnBannerView, isCurrentTurnHero, passTurn } from './systems/turnSystem.js';
import {
  clearPersistedGameState,
  clearPersistedPartyInventory,
  loadPersistedGameState,
  loadPersistedPartyInventory,
  persistGameState,
  persistPartyInventory,
} from './systems/persistenceSystem.js';
import { inBounds, tileFromCanvas } from './utils/grid.js';
import { createStarterPartyInventory, ITEM_DEFINITIONS } from './items/index.js';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 720;
const HUD_HEIGHT = 64;
const MOVE_STEP_INTERVAL_MS = 180;
const SHOW_FULL_DUNGEON_MAP = true;
const state = loadPersistedGameState() ?? createGameState(Date.now());
const partyInventory = loadPersistedPartyInventory() ?? createStarterPartyInventory();
const itemById = new Map<string, (typeof ITEM_DEFINITIONS)[number]>(
  ITEM_DEFINITIONS.map((item) => [item.id, item]),
);
let lastMoveStepAt = 0;
persistAll();

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing #app root');
}

/**
 * Queries a required DOM element and throws when missing.
 * @param selector CSS selector for the target element.
 * @returns Matched DOM element.
 */
function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

/**
 * Retrieves 2D canvas rendering context.
 * @param canvasElement Canvas element.
 * @returns 2D rendering context.
 */
function requireContext(canvasElement: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvasElement.getContext('2d');
  if (!context) {
    throw new Error('Canvas context unavailable');
  }
  return context;
}

app.innerHTML = `
  <!-- App Layout -->
  <div style="display:flex; gap:18px; align-items:flex-start; width:100%; font-family: sans-serif; color:#cbd5e1;">
    <!-- Left Sidebar: Character Panels -->
    <div id="characterPanels" style="display:flex; flex-direction:column; gap:10px; width:380px; flex:0 0 380px;"></div>

    <!-- Center: Dungeon View -->
    <div style="flex:1 1 auto; display:flex; justify-content:center;">
      <div style="width:${CANVAS_WIDTH}px;">
        <!-- Main Dungeon Canvas -->
        <canvas id="gameCanvas" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" style="background:transparent"></canvas>
        <!-- Status Line -->
        <div id="status" style="margin-top:8px; color:#cbd5e1; font-size:14px;"></div>
        <!-- Controls Hint -->
        <div id="controlsHint" style="margin-top:8px; color:#94a3b8; font-size:12px;"></div>
        <!-- Combat Log -->
        <div style="margin-top:10px; font-size:14px; color:#94a3b8;">combat log</div>
        <div id="combatLog" style="display:flex; flex-direction:column; gap:6px; font-size:12px; color:#e2e8f0; margin-top:6px;"></div>
      </div>
    </div>

    <!-- Right Sidebar: Map and Party Resources -->
    <div style="display:flex; flex-direction:column; gap:12px; width:280px; flex:0 0 280px;">
      <!-- Minimap -->
      <canvas id="minimapCanvas" width="220" height="220" style="background:transparent"></canvas>
      <!-- Gold + Inventory Panel -->
      <div style="min-height:420px; padding:14px; background:rgba(15,23,42,0.55);">
        <button
          id="resetStateButton"
          type="button"
          style="width:100%; margin-bottom:12px; padding:8px 10px; border:1px solid rgba(248,113,113,0.5); background:rgba(127,29,29,0.55); color:#fee2e2; cursor:pointer;"
        >
          reset saved state
        </button>
        <button
          id="attackButton"
          type="button"
          style="width:100%; margin-bottom:12px; padding:8px 10px; border:1px solid rgba(251,191,36,0.45); background:rgba(120,53,15,0.45); color:#fef3c7; cursor:pointer;"
        >
          basic attack
        </button>
        <button
          id="useItemButton"
          type="button"
          style="width:100%; margin-bottom:12px; padding:8px 10px; border:1px solid rgba(74,222,128,0.45); background:rgba(20,83,45,0.45); color:#dcfce7; cursor:pointer;"
        >
          use item
        </button>
        <button
          id="endTurnButton"
          type="button"
          style="width:100%; margin-bottom:12px; padding:8px 10px; border:1px solid rgba(96,165,250,0.45); background:rgba(30,64,175,0.45); color:#dbeafe; cursor:pointer;"
        >
          end heroes turn
        </button>
        <!-- Gold Section -->
        <div id="goldValue" style="margin-bottom:12px;">gold: 0</div>
        <!-- Party Inventory Section -->
        <div style="font-size:14px; color:#94a3b8; margin-bottom:10px;">party inventory</div>
        <div id="partyInventoryList" style="display:flex; flex-direction:column; gap:6px;"></div>
      </div>
    </div>
  </div>
`;

const canvas = requireElement<HTMLCanvasElement>('#gameCanvas');
const minimapCanvas = requireElement<HTMLCanvasElement>('#minimapCanvas');
const status = requireElement<HTMLDivElement>('#status');
const controlsHint = requireElement<HTMLDivElement>('#controlsHint');
const characterPanels = requireElement<HTMLDivElement>('#characterPanels');
const goldValue = requireElement<HTMLDivElement>('#goldValue');
const combatLog = requireElement<HTMLDivElement>('#combatLog');
const partyInventoryList = requireElement<HTMLDivElement>('#partyInventoryList');
const resetStateButton = requireElement<HTMLButtonElement>('#resetStateButton');
const attackButton = requireElement<HTMLButtonElement>('#attackButton');
const useItemButton = requireElement<HTMLButtonElement>('#useItemButton');
const endTurnButton = requireElement<HTMLButtonElement>('#endTurnButton');

const ctx = requireContext(canvas);
const minimapCtx = requireContext(minimapCanvas);

type EquipSlot = 'armor' | 'leftHand' | 'rightHand' | 'relic' | 'backpack';
type DragPayload =
  | { source: 'inventory'; itemId: string }
  | { source: 'slot'; itemId: string; heroIndex: number; slot: Exclude<EquipSlot, 'backpack'> }
  | { source: 'backpack'; itemId: string; heroIndex: number; backpackIndex: number };

characterPanels.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;

  const backpackItem = target.closest<HTMLElement>('[data-backpack-item-id]');
  if (backpackItem) {
    const heroIndex = Number(backpackItem.dataset.heroIndex);
    const itemId = backpackItem.dataset.backpackItemId;
    if (Number.isInteger(heroIndex) && itemId) {
      setActiveHeroIndex(state, heroIndex);
      const used = useActiveHeroBackpackConsumable(state, itemId);
      if (used) {
        persistAll();
        renderCharacterPanels();
        renderPartyInventory();
        renderCombatLog();
        return;
      }
    }
  }

  const panel = target.closest<HTMLElement>('[data-hero-index]');
  if (!panel) return;

  const raw = panel.dataset.heroIndex;
  const index = Number(raw);
  if (!Number.isInteger(index)) return;

  setActiveHeroIndex(state, index);
  persistAll();
  renderCharacterPanels();
});

characterPanels.addEventListener('dragstart', (event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const draggable = target.closest<HTMLElement>('[data-drag-source]');
  if (!draggable) return;

  const source = draggable.dataset.dragSource;
  if (source === 'slot') {
    const heroIndex = Number(draggable.dataset.heroIndex);
    const slot = draggable.dataset.slot as Exclude<EquipSlot, 'backpack'> | undefined;
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

characterPanels.addEventListener('dragover', (event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  if (!target.closest<HTMLElement>('[data-drop-slot]')) return;
  event.preventDefault();
});

characterPanels.addEventListener('drop', (event) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const dropZone = target.closest<HTMLElement>('[data-drop-slot]');
  if (!dropZone) return;
  event.preventDefault();

  const payload = readDragPayload(event);
  if (!payload) return;

  const heroIndex = Number(dropZone.dataset.heroIndex);
  const slot = dropZone.dataset.dropSlot as EquipSlot | undefined;
  if (!Number.isInteger(heroIndex) || !slot) return;

  if (!movePayloadToSlot(payload, heroIndex, slot)) return;
  persistAll();
  renderCharacterPanels();
  renderPartyInventory();
});

partyInventoryList.addEventListener('dragstart', (event) => {
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

partyInventoryList.addEventListener('dragover', (event) => {
  event.preventDefault();
});

partyInventoryList.addEventListener('drop', (event) => {
  event.preventDefault();
  const payload = readDragPayload(event);
  if (!payload) return;

  const removed = removeFromSource(payload);
  if (!removed) return;
  addInventory(payload.itemId);
  persistAll();
  renderCharacterPanels();
  renderPartyInventory();
});

resetStateButton.addEventListener('click', () => {
  clearPersistedGameState();
  clearPersistedPartyInventory();
  window.location.reload();
});

attackButton.addEventListener('click', () => {
  toggleAttackMode(state);
  persistAll();
  renderCharacterPanels();
  renderCombatLog();
});

useItemButton.addEventListener('click', () => {
  const toggled = toggleItemUseMode(state);
  if (!toggled && !state.itemUseModeHeroId) return;
  persistAll();
  renderCharacterPanels();
  renderCombatLog();
});

endTurnButton.addEventListener('click', () => {
  passTurn(state);
  persistAll();
  renderCharacterPanels();
  renderCombatLog();
});

/**
 * Computes tile size that fits current room into canvas viewport.
 * @returns Tile size in pixels.
 */
function getTileSize(): number {
  const room = getCurrentRoom(state);
  const maxW = canvas.width;
  const maxH = canvas.height - HUD_HEIGHT;
  return Math.floor(Math.min(maxW / room.width, maxH / room.height));
}

/**
 * Computes top-left board offset used to center room in canvas.
 * @param tileSize Tile size in pixels.
 * @returns Board offset coordinate.
 */
function getBoardOffset(tileSize: number): Coord {
  const room = getCurrentRoom(state);
  const boardW = room.width * tileSize;
  const boardH = room.height * tileSize;
  return {
    x: Math.floor((canvas.width - boardW) / 2),
    y: Math.floor((canvas.height - HUD_HEIGHT - boardH) / 2),
  };
}

canvas.addEventListener('mousemove', (event) => {
  const room = getCurrentRoom(state);
  const tileSize = getTileSize();
  const offset = getBoardOffset(tileSize);
  const rect = canvas.getBoundingClientRect();
  const target = tileFromCanvas(
    event.clientX - rect.left,
    event.clientY - rect.top,
    offset.x,
    offset.y,
    tileSize,
  );

  if (!inBounds(target, room.width, room.height)) {
    state.hoverPath = [];
    return;
  }
  if (state.runState !== 'active') {
    state.hoverPath = [];
    return;
  }

  const tile = getTileAt(room, target);
  if (tile === TileType.VOID_BLACK) {
    state.hoverPath = [];
    return;
  }

  updateHoverPath(state, target);
});

canvas.addEventListener('click', (event) => {
  const room = getCurrentRoom(state);
  const tileSize = getTileSize();
  const offset = getBoardOffset(tileSize);
  const rect = canvas.getBoundingClientRect();
  const target = tileFromCanvas(
    event.clientX - rect.left,
    event.clientY - rect.top,
    offset.x,
    offset.y,
    tileSize,
  );

  if (!inBounds(target, room.width, room.height)) return;
  if (state.runState !== 'active') return;
  if (tryHeroAttackAtTile(state, target)) {
    persistAll();
    renderCharacterPanels();
    renderCombatLog();
    return;
  }
  if (!canWalkTile(room, target)) return;

  updateHoverPath(state, target);
  commitMoveFromHover(state);
  persistAll();
});

window.addEventListener('keydown', (event) => {
  if (state.runState !== 'active' && event.key !== '1' && event.key !== '2' && event.key !== '3') return;
  if (event.key === '1') setActiveHeroIndex(state, 0);
  if (event.key === '2') setActiveHeroIndex(state, 1);
  if (event.key === '3') setActiveHeroIndex(state, 2);
  if (event.key === ' ' || event.key.toLowerCase() === 'e') {
    passTurn(state);
    persistAll();
    renderCharacterPanels();
    renderCombatLog();
  }
  if (event.key === '1' || event.key === '2' || event.key === '3') {
    persistAll();
    renderCharacterPanels();
    renderCombatLog();
  }
});

/**
 * Draws one full frame: room, path preview, heroes, HUD and minimap.
 * @returns Nothing.
 */
function draw(): void {
  const room = getCurrentRoom(state);
  const tileSize = getTileSize();
  const offset = getBoardOffset(tileSize);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

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

  for (const step of state.hoverPath) {
    const px = offset.x + step.x * tileSize;
    const py = offset.y + step.y * tileSize;
    ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
    ctx.fillRect(px + 3, py + 3, tileSize - 6, tileSize - 6);
  }

  state.party.heroes.forEach((hero, index) => {
    if (hero.hp <= 0) return;
    if (state.readyByHeroId.has(hero.id)) return;

    const cx = offset.x + hero.tile.x * tileSize + tileSize / 2;
    const cy = offset.y + hero.tile.y * tileSize + tileSize / 2;
    const radius = tileSize * 0.3;

    ctx.fillStyle = index === state.party.activeHeroIndex ? '#fbbf24' : '#e2e8f0';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
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
    ctx.strokeStyle = enemy.isAttackTargetable ? '#fde68a' : '#3f0d16';
    ctx.lineWidth = enemy.isAttackTargetable ? 3 : 2;
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

  drawHud();
  drawMinimap();
}

/**
 * Draws bottom HUD strip with room/floor and readiness info.
 * @returns Nothing.
 */
function drawHud(): void {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, canvas.height - HUD_HEIGHT, canvas.width, HUD_HEIGHT);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const active = state.party.heroes[state.party.activeHeroIndex];
  const ready = `${state.readyByHeroId.size}/3`;
  const encounter = getCurrentRoomEncounterView(state);
  const turn = getTurnBannerView(state);
  const encounterLabel =
    encounter.roomType === 'combat'
      ? encounter.isBlockingExit
        ? `Combat Locked`
        : `Combat Clear`
      : encounter.roomType === 'treasure'
        ? 'Treasure'
        : 'Exit';
  ctx.fillText(
    `Floor ${getCurrentFloorNumber(state)}/${state.dungeon.totalFloors} | Room ${getCurrentRoomCoordId(state)} | ${encounterLabel} | Round ${turn.round || '-'} | Enemies ${encounter.enemyCount} | Active ${active.classLetter} | Exit Ready ${ready}`,
    12,
    canvas.height - HUD_HEIGHT / 2,
  );

  const heroResources = turn.heroResources;
  const heroResourcesText = heroResources
    ? ` | Move ${heroResources.movementRemaining} | AP ${heroResources.actionPointsRemaining} | Attack ${heroResources.attackSlotAvailable ? 'ready' : 'spent'}`
    : '';
  const weaponText = getSelectedHeroWeaponSummary();
  const lastRollText = getLastRollSummary();
  status.textContent = `Discovered rooms: ${state.dungeon.discoveredRoomIds.size} | Seed: ${state.dungeon.seed} | Room type: ${encounter.roomType} | Turn: ${turn.activeLabel}${heroResourcesText} | Weapon: ${weaponText}${lastRollText ? ` | ${lastRollText}` : ''}`;
  if (state.runState === 'won') {
    status.textContent = `Run won | Reached the exit room with surviving heroes | Weapon: ${weaponText}${lastRollText ? ` | ${lastRollText}` : ''}`;
  } else if (state.runState === 'lost') {
    status.textContent = `Run lost | All heroes defeated${lastRollText ? ` | ${lastRollText}` : ''}`;
  }
  controlsHint.textContent =
    state.runState === 'won'
      ? 'Run complete. Use reset saved state to start a new run.'
      : state.runState === 'lost'
        ? 'Run failed. Use reset saved state to start a new run.'
      : state.attackModeHeroId
      ? 'Attack mode: click a highlighted enemy to attack | 1/2/3 or click card = active hero'
      : state.itemUseModeHeroId
        ? 'Item mode: click a highlighted consumable in the active hero backpack'
      : 'Mouse hover = A* preview | Click = move/attack target | 1/2/3 or click card = active hero';
  const activeHero = state.party.heroes[state.party.activeHeroIndex];
  const hasAttackTarget =
    state.turn?.phase === 'heroes' &&
    getCurrentRoomEnemies(state).some((enemy) => canHeroBasicAttackEnemy(state, activeHero.id, enemy.id));
  attackButton.disabled = state.runState !== 'active' || !turn.isCombatActive || !isCurrentTurnHero(state);
  attackButton.style.opacity = attackButton.disabled ? '0.5' : '1';
  attackButton.textContent = state.attackModeHeroId === activeHero.id ? 'cancel attack' : hasAttackTarget ? 'basic attack' : 'basic attack';
  const consumableAction = getActiveHeroConsumableActionView(state);
  useItemButton.disabled = state.runState !== 'active' || !canUseActiveHeroConsumable(state);
  useItemButton.style.opacity = useItemButton.disabled ? '0.5' : '1';
  useItemButton.textContent =
    state.itemUseModeHeroId === activeHero.id ? 'cancel item' : 'use item';
  endTurnButton.disabled = state.runState !== 'active' || !turn.isCombatActive || !isCurrentTurnHero(state);
  endTurnButton.style.opacity = endTurnButton.disabled ? '0.5' : '1';
  endTurnButton.textContent = turn.isCombatActive && isCurrentTurnHero(state) ? 'end heroes turn' : 'enemy turn running';
}

function getSelectedHeroWeaponSummary(): string {
  const hero = state.party.heroes[state.party.activeHeroIndex];
  if (!hero) return 'none';
  const profile = getHeroAttackProfile(hero);
  return `${profile.label} | dice ${profile.attackDice} | damage ${profile.damage} | range ${profile.range}`;
}

function getLastRollSummary(): string {
  const roll = state.lastCombatRoll;
  if (!roll) return '';
  return `Last roll atk[${roll.attackRolls.join(',')}] def[${roll.defenseRolls.join(',')}] dmg ${roll.finalDamage}`;
}

/**
 * Draws dungeon minimap using either discovered rooms or full map.
 * @returns Nothing.
 */
function drawMinimap(): void {
  minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
  minimapCtx.fillStyle = '#020617';
  minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);

  const roomIds = SHOW_FULL_DUNGEON_MAP
    ? Array.from(state.dungeon.rooms.keys())
    : Array.from(state.dungeon.discoveredRoomIds);

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
  const cell = Math.floor(Math.min(minimapCanvas.width / spanX, minimapCanvas.height / spanY) * 0.8);
  const offsetX = Math.floor((minimapCanvas.width - spanX * cell) / 2);
  const offsetY = Math.floor((minimapCanvas.height - spanY * cell) / 2);

  coords.forEach((coord) => {
    const px = offsetX + (coord.x - minX) * cell;
    const py = offsetY + (coord.y - minY) * cell;
    minimapCtx.fillStyle = coord.id === state.dungeon.currentRoomId ? '#fbbf24' : '#334155';
    minimapCtx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
  });
}

/**
 * Renders the left sidebar hero panels with live state.
 * @returns Nothing.
 */
function renderCharacterPanels(): void {
  const heroes = getHeroPanelViews(state);
  characterPanels.innerHTML = heroes
    .map((hero, index) => {
      const hpPercent = hero.maxHp > 0 ? Math.max(0, Math.min(100, (hero.hp / hero.maxHp) * 100)) : 0;
      const border = hero.isDefeated ? 'rgba(239,68,68,0.7)' : hero.isActive ? '#fbbf24' : 'rgba(148,163,184,0.25)';
      const badgeLabel = hero.isDefeated ? 'Defeated' : hero.isReadyAtExit ? 'Ready' : hero.isActive ? 'Active' : 'Idle';
      const badgeColor = hero.isDefeated ? '#f87171' : hero.isReadyAtExit ? '#22c55e' : hero.isActive ? '#fbbf24' : '#94a3b8';
      const turnEconomy =
        hero.isDefeated
          ? 'Defeated'
          : hero.movementRemaining !== null
          ? `Move ${hero.movementRemaining} · AP ${hero.actionPointsRemaining ?? 0} · Attack ${
              hero.attackSlotAvailable ? 'Ready' : 'Spent'
            }`
          : 'Move - · AP - · Attack -';

      return `
        <div
          data-hero-index="${index}"
          style="cursor:${hero.isDefeated ? 'default' : 'pointer'}; border:1px solid ${border}; min-height:118px; padding:12px; background:${hero.isDefeated ? 'rgba(69,10,10,0.45)' : 'rgba(15,23,42,0.55)'};"
        >
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <div style="font-size:15px; font-weight:600;">${hero.classLetter} · ${hero.className}</div>
            <div style="font-size:12px; color:${badgeColor};">${badgeLabel}</div>
          </div>
          <div style="font-size:12px; color:#94a3b8; margin-bottom:6px;">${hero.raceName}</div>
          <div style="font-size:12px; margin-bottom:4px;">HP ${hero.hp}/${hero.maxHp}</div>
          <div style="height:8px; background:rgba(148,163,184,0.25); margin-bottom:8px;">
            <div style="width:${hpPercent}%; height:100%; background:#22c55e;"></div>
          </div>
          <div style="font-size:12px; color:#cbd5e1; margin-bottom:6px;">Body ${hero.body} · Mind ${hero.mind}</div>
          <div style="font-size:11px; color:#93c5fd; margin-bottom:8px;">${turnEconomy}</div>
          <div style="display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:6px; margin-bottom:6px;">
            ${renderEquipSlot(index, 'armor', 'A', hero.armor)}
            ${renderEquipSlot(index, 'leftHand', 'L', hero.leftHand)}
            ${renderEquipSlot(index, 'rightHand', 'R', hero.rightHand)}
            ${renderEquipSlot(index, 'relic', 'Rel', hero.relic)}
          </div>
          <div
            data-drop-slot="backpack"
            data-hero-index="${index}"
            style="min-height:30px; border:1px dashed rgba(148,163,184,0.4); padding:6px; font-size:11px; color:#cbd5e1; margin-bottom:2px;"
          >
            <div style="color:#94a3b8; margin-bottom:4px;">Backpack (${hero.backpackCount})</div>
            ${renderBackpackItems(index)}
          </div>
          <div style="font-size:11px; color:#94a3b8; margin-top:4px;">Floor ${hero.floorNumber} · Room ${hero.roomId}</div>
        </div>
      `;
    })
    .join('');
}

/**
 * Renders party inventory list with one entry per item.
 * @returns Nothing.
 */
function renderPartyInventory(): void {
  goldValue.textContent = 'gold: chest rewards not implemented';
  partyInventoryList.innerHTML = partyInventory
    .map(
      (entry) => `
        <div
          data-drag-source="inventory"
          data-item-id="${entry.itemId}"
          draggable="true"
          title="${escapeAttr(getItemTooltip(entry.itemId))}"
          style="display:flex; align-items:center; gap:10px; font-size:14px; cursor:grab;"
        >
          <img
            src="/${entry.file}"
            alt="${entry.name}"
            width="34"
            height="34"
            style="image-rendering:pixelated; background:rgba(148,163,184,0.18); border:1px solid rgba(148,163,184,0.35);"
          />
          <span style="flex:1;">${entry.name}</span>
        </div>
      `,
    )
    .join('');
}

function renderCombatLog(): void {
  if (state.recentCombatLog.length === 0) {
    combatLog.innerHTML = '<div style="color:#64748b;">No combat rolls yet</div>';
    return;
  }

  combatLog.innerHTML = state.recentCombatLog
    .map(
      (entry) =>
        `<div style="padding:6px; background:rgba(15,23,42,0.45); border:1px solid rgba(148,163,184,0.15);">${entry}</div>`,
    )
    .join('');
}

function renderEquipSlot(
  heroIndex: number,
  slot: Exclude<EquipSlot, 'backpack'>,
  label: string,
  itemId: string | null,
): string {
  const item = itemId ? itemById.get(itemId) : null;
  const dragAttrs = itemId
    ? `data-drag-source="slot" data-item-id="${itemId}" data-hero-index="${heroIndex}" data-slot="${slot}" draggable="true" style="cursor:grab; display:inline-block;"`
    : 'style="display:inline-block;"';
  const slotContent = itemId && item
    ? `<img src="/${item.file}" alt="${item.name}" width="22" height="22" title="${escapeAttr(
        getItemTooltip(itemId),
      )}" style="image-rendering:pixelated; border:1px solid rgba(148,163,184,0.35); background:rgba(148,163,184,0.14);" />`
    : `<span style="font-size:11px; color:#64748b;">-</span>`;

  return `
    <div
      data-drop-slot="${slot}"
      data-hero-index="${heroIndex}"
      style="min-height:30px; border:1px dashed rgba(148,163,184,0.4); padding:5px; font-size:10px; color:#94a3b8;"
    >
      <div>${label}</div>
      <div ${dragAttrs}>${slotContent}</div>
    </div>
  `;
}

function renderBackpackItems(heroIndex: number): string {
  const hero = state.party.heroes[heroIndex];
  if (!hero || hero.equipment.backpack.length === 0) {
    return '<span style="color:#64748b;">Drop item here</span>';
  }

  return hero.equipment.backpack
    .map((itemId, backpackIndex) => {
      const item = itemById.get(itemId);
      if (!item) return '';
      const hero = state.party.heroes[heroIndex];
      const isTargetable = hero ? isBackpackConsumableTargetable(state, hero.id, itemId) : false;
      return `<span data-drag-source="backpack" data-item-id="${itemId}" data-hero-index="${heroIndex}" data-backpack-index="${backpackIndex}" draggable="true" title="${escapeAttr(
        getItemTooltip(itemId),
      )}" data-backpack-item-id="${itemId}" style="display:inline-block; margin-right:6px; cursor:${
        isTargetable ? 'pointer' : 'grab'
      };"><img src="/${
        item.file
      }" alt="${item.name}" width="20" height="20" style="image-rendering:pixelated; border:1px solid ${
        isTargetable ? 'rgba(74,222,128,0.9)' : 'rgba(148,163,184,0.35)'
      }; background:${isTargetable ? 'rgba(20,83,45,0.45)' : 'rgba(148,163,184,0.14)'};" /></span>`;
    })
    .join('');
}

function readDragPayload(event: DragEvent): DragPayload | null {
  const raw = event.dataTransfer?.getData('application/x-simplehero-item');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}

function movePayloadToSlot(payload: DragPayload, heroIndex: number, slot: EquipSlot): boolean {
  const item = itemById.get(payload.itemId);
  if (!item) return false;
  if (payload.source === 'slot' && payload.heroIndex === heroIndex && payload.slot === slot) return true;
  if (!canEquipItemToSlot(payload.itemId, slot)) return false;

  const removed = removeFromSource(payload);
  if (!removed) return false;

  const hero = state.party.heroes[heroIndex];
  if (!hero) {
    returnToSource(payload);
    return false;
  }

  if (slot === 'backpack') {
    hero.equipment.backpack.push(payload.itemId);
    return true;
  }

  if (slot === 'leftHand' || slot === 'rightHand') {
    equipInHandSlot(hero, slot, payload.itemId);
    return true;
  }

  const previous = hero.equipment[slot] as string | null;
  if (previous) addInventory(previous);
  hero.equipment[slot] = payload.itemId;
  return true;
}

function removeFromSource(payload: DragPayload): boolean {
  if (payload.source === 'inventory') {
    return removeInventory(payload.itemId);
  }

  const hero = state.party.heroes[payload.heroIndex];
  if (!hero) return false;

  if (payload.source === 'slot') {
    if (hero.equipment[payload.slot] !== payload.itemId) return false;
    hero.equipment[payload.slot] = null;
    if (
      (payload.slot === 'leftHand' || payload.slot === 'rightHand') &&
      getHandsRequired(payload.itemId) === 2
    ) {
      const other = payload.slot === 'leftHand' ? 'rightHand' : 'leftHand';
      if (hero.equipment[other] === payload.itemId) {
        hero.equipment[other] = null;
      }
    }
    return true;
  }

  if (payload.backpackIndex < 0 || payload.backpackIndex >= hero.equipment.backpack.length) return false;
  if (hero.equipment.backpack[payload.backpackIndex] !== payload.itemId) return false;
  hero.equipment.backpack.splice(payload.backpackIndex, 1);
  return true;
}

function returnToSource(payload: DragPayload): void {
  if (payload.source === 'inventory') {
    addInventory(payload.itemId);
    return;
  }

  const hero = state.party.heroes[payload.heroIndex];
  if (!hero) return;

  if (payload.source === 'slot') {
    hero.equipment[payload.slot] = payload.itemId;
    return;
  }

  hero.equipment.backpack.splice(payload.backpackIndex, 0, payload.itemId);
}

function addInventory(itemId: string): void {
  const item = itemById.get(itemId);
  if (!item) return;
  partyInventory.push({
    itemId: item.id,
    name: item.name,
    file: item.file,
    category: item.category,
  });
  persistPartyInventory(partyInventory);
}

function removeInventory(itemId: string): boolean {
  const index = partyInventory.findIndex((item) => item.itemId === itemId);
  if (index < 0) return false;
  partyInventory.splice(index, 1);
  persistPartyInventory(partyInventory);
  return true;
}

function canEquipItemToSlot(itemId: string, slot: EquipSlot): boolean {
  const item = itemById.get(itemId);
  if (!item) return false;

  if (slot === 'backpack') return true;
  if (slot === 'armor') return item.category === 'armor' && item.id !== 'shield';
  if (slot === 'leftHand' || slot === 'rightHand') {
    return item.category === 'weapon' || item.id === 'shield';
  }
  if (slot === 'relic') return item.category === 'consumable';
  return false;
}

function equipInHandSlot(
  hero: (typeof state.party.heroes)[number],
  slot: 'leftHand' | 'rightHand',
  itemId: string,
): void {
  const handsRequired = getHandsRequired(itemId);
  const other = slot === 'leftHand' ? 'rightHand' : 'leftHand';

  if (handsRequired === 2) {
    clearHandSlot(hero, 'leftHand', itemId);
    clearHandSlot(hero, 'rightHand', itemId);
    hero.equipment.leftHand = itemId;
    hero.equipment.rightHand = itemId;
    return;
  }

  const otherItem = hero.equipment[other];
  if (otherItem && getHandsRequired(otherItem) === 2) {
    clearHandSlot(hero, 'leftHand');
    clearHandSlot(hero, 'rightHand');
  }

  clearHandSlot(hero, slot);
  hero.equipment[slot] = itemId;
}

function clearHandSlot(
  hero: (typeof state.party.heroes)[number],
  slot: 'leftHand' | 'rightHand',
  ignoreItemId?: string,
): void {
  const current = hero.equipment[slot];
  if (!current) return;
  hero.equipment[slot] = null;
  if (ignoreItemId && current === ignoreItemId) return;
  addInventory(current);
}

function getHandsRequired(itemId: string): number {
  const item = itemById.get(itemId);
  if (!item) return 1;
  if (item.category === 'weapon') return item.handsRequired;
  if (item.id === 'shield') return item.handsRequired ?? 1;
  return 0;
}

function getItemTooltip(itemId: string): string {
  const item = itemById.get(itemId);
  if (!item) return itemId;

  if (item.category === 'weapon') {
    return `${item.name}\nRange: ${item.range}\nAttack dice: ${item.attackDice}\nDamage: ${item.damage}\nHands: ${item.handsRequired}`;
  }

  if (item.category === 'armor') {
    const hands = item.handsRequired ? `\nHands: ${item.handsRequired}` : '';
    return `${item.name}\nDefense dice bonus: ${item.defenseDiceBonus}\nMovement modifier: ${item.movementModifier}${hands}`;
  }

  return `${item.name}\nEffect: ${item.effect}\nValue: ${item.value}`;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Computes triangle vertices used as hero facing indicator.
 * @param cx Hero center x.
 * @param cy Hero center y.
 * @param r Hero radius.
 * @param facing Hero facing direction.
 * @returns Three vertices for the direction triangle.
 */
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

/**
 * Main animation loop.
 * @returns Nothing.
 */
function tick(): void {
  const now = performance.now();
  ensureActiveHeroIsLiving(state);
  const advancedTurn = advanceAutomatedTurns(state, now);
  const moved = now - lastMoveStepAt >= MOVE_STEP_INTERVAL_MS ? stepMovement(state) : false;
  if (moved) {
    lastMoveStepAt = now;
  }
  if (advancedTurn || moved) {
    persistAll();
    renderCharacterPanels();
    renderPartyInventory();
    renderCombatLog();
  }
  draw();
  requestAnimationFrame(tick);
}

window.setInterval(() => {
  persistAll();
}, 3000);

window.addEventListener('beforeunload', () => {
  persistAll();
});

renderCharacterPanels();
renderPartyInventory();
renderCombatLog();
tick();

/**
 * Persists both gameplay and party inventory snapshot.
 * @returns Nothing.
 */
function persistAll(): void {
  persistGameState(state);
  persistPartyInventory(partyInventory);
}
