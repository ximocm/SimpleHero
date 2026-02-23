import type { Coord } from './data/dungeonTypes.js';
import { TileType } from './data/tileTypes.js';
import {
  canWalkTile,
  commitMoveFromHover,
  createGameState,
  getCurrentFloorNumber,
  getCurrentRoom,
  getCurrentRoomCoordId,
  getTileAt,
  setActiveHeroIndex,
  stepMovement,
  updateHoverPath,
} from './systems/gameSystem.js';
import { inBounds, tileFromCanvas } from './utils/grid.js';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 720;
const HUD_HEIGHT = 64;
const SHOW_FULL_DUNGEON_MAP = true;

const state = createGameState(Date.now());

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing #app root');
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

function requireContext(canvasElement: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvasElement.getContext('2d');
  if (!context) {
    throw new Error('Canvas context unavailable');
  }
  return context;
}

app.innerHTML = `
  <!-- App Layout -->
  <div style="display:flex; gap:18px; align-items:flex-start; font-family: sans-serif; color:#cbd5e1;">
    <!-- Left Sidebar: Character Panels -->
    <div style="display:flex; flex-direction:column; gap:12px; width:210px;">
      <!-- Character Slot 1 -->
      <div style="min-height:120px; padding:12px; background:rgba(15,23,42,0.55);">char1</div>
      <!-- Character Slot 2 -->
      <div style="min-height:120px; padding:12px; background:rgba(15,23,42,0.55);">char2</div>
      <!-- Character Slot 3 -->
      <div style="min-height:120px; padding:12px; background:rgba(15,23,42,0.55);">char3</div>
      <!-- Character Slot 4 -->
      <div style="min-height:120px; padding:12px; background:rgba(15,23,42,0.55);">char4 (when available)</div>
    </div>

    <!-- Center: Dungeon View -->
    <div>
      <!-- Main Dungeon Canvas -->
      <canvas id="gameCanvas" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" style="background:transparent"></canvas>
      <!-- Status Line -->
      <div id="status" style="margin-top:8px; color:#cbd5e1; font-size:14px;"></div>
      <!-- Controls Hint -->
      <div style="margin-top:8px; color:#94a3b8; font-size:12px;">Mouse hover = A* preview | Click = move | 1/2/3 = active hero</div>
    </div>

    <!-- Right Sidebar: Map and Party Resources -->
    <div style="display:flex; flex-direction:column; gap:12px; width:220px;">
      <!-- Minimap -->
      <canvas id="minimapCanvas" width="220" height="220" style="background:transparent"></canvas>
      <!-- Gold + Inventory Panel -->
      <div style="min-height:320px; padding:12px; background:rgba(15,23,42,0.55);">
        <!-- Gold Section -->
        <div style="margin-bottom:12px;">gold</div>
        <!-- Party Inventory Section -->
        <div>party inventory</div>
      </div>
    </div>
  </div>
`;

const canvas = requireElement<HTMLCanvasElement>('#gameCanvas');
const minimapCanvas = requireElement<HTMLCanvasElement>('#minimapCanvas');
const status = requireElement<HTMLDivElement>('#status');

const ctx = requireContext(canvas);
const minimapCtx = requireContext(minimapCanvas);

function getTileSize(): number {
  const room = getCurrentRoom(state);
  const maxW = canvas.width;
  const maxH = canvas.height - HUD_HEIGHT;
  return Math.floor(Math.min(maxW / room.width, maxH / room.height));
}

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
  if (!canWalkTile(room, target)) return;

  updateHoverPath(state, target);
  commitMoveFromHover(state);
});

window.addEventListener('keydown', (event) => {
  if (event.key === '1') setActiveHeroIndex(state, 0);
  if (event.key === '2') setActiveHeroIndex(state, 1);
  if (event.key === '3') setActiveHeroIndex(state, 2);
});

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

  drawHud();
  drawMinimap();
}

function drawHud(): void {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, canvas.height - HUD_HEIGHT, canvas.width, HUD_HEIGHT);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const active = state.party.heroes[state.party.activeHeroIndex];
  const ready = `${state.readyByHeroId.size}/3`;
  ctx.fillText(
    `Floor ${getCurrentFloorNumber(state)}/${state.dungeon.totalFloors} | Room ${getCurrentRoomCoordId(state)} | Active ${active.classLetter} | Exit Ready ${ready}`,
    12,
    canvas.height - HUD_HEIGHT / 2,
  );

  status.textContent = `Discovered rooms: ${state.dungeon.discoveredRoomIds.size}`;
}

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

function tick(): void {
  stepMovement(state);
  draw();
  requestAnimationFrame(tick);
}

tick();
