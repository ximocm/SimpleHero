export function getAppLayoutHtml(canvasWidth: number, canvasHeight: number): string {
  return `
    <div style="position:relative; width:100%; min-height:100vh; font-family: sans-serif; color:#cbd5e1; overflow:hidden;">
      <div
        id="screenOverlay"
        style="display:none; position:absolute; inset:0; z-index:20; background:rgba(2,6,23,0.94); padding:24px; overflow:hidden;"
      ></div>
      <div id="gameRoot" style="display:flex; gap:18px; align-items:flex-start; width:100%;">
        <div id="characterPanels" style="display:flex; flex-direction:column; gap:10px; width:380px; flex:0 0 380px;"></div>
        <div style="flex:1 1 auto; display:flex; justify-content:center;">
          <div style="width:${canvasWidth}px;">
            <canvas id="gameCanvas" width="${canvasWidth}" height="${canvasHeight}" style="background:transparent"></canvas>
            <div id="status" style="margin-top:8px; color:#cbd5e1; font-size:14px;"></div>
            <div id="controlsHint" style="margin-top:8px; color:#94a3b8; font-size:12px;"></div>
            <div style="margin-top:10px; font-size:14px; color:#94a3b8;">combat log</div>
            <div id="combatLog" style="display:flex; flex-direction:column; gap:6px; font-size:12px; color:#e2e8f0; margin-top:6px;"></div>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:12px; width:280px; flex:0 0 280px;">
          <canvas id="minimapCanvas" width="220" height="220" style="background:transparent"></canvas>
          <div style="min-height:420px; padding:14px; background:rgba(15,23,42,0.55);">
            <button
              id="menuButton"
              type="button"
              style="width:100%; margin-bottom:12px; padding:8px 10px; border:1px solid rgba(148,163,184,0.45); background:rgba(30,41,59,0.72); color:#e2e8f0; cursor:pointer;"
            >
              menu
            </button>
            <button
              id="resetStateButton"
              type="button"
              style="width:100%; margin-bottom:12px; padding:8px 10px; border:1px solid rgba(248,113,113,0.5); background:rgba(127,29,29,0.55); color:#fee2e2; cursor:pointer;"
            >
              reboot
            </button>
            <button
              id="attackButton"
              type="button"
              style="width:100%; margin-bottom:12px; padding:8px 10px; border:1px solid rgba(251,191,36,0.45); background:rgba(120,53,15,0.45); color:#fef3c7; cursor:pointer;"
            >
              basic attack
            </button>
            <button
              id="castButton"
              type="button"
              style="width:100%; margin-bottom:12px; padding:8px 10px; border:1px solid rgba(167,139,250,0.45); background:rgba(76,29,149,0.42); color:#ede9fe; cursor:pointer;"
            >
              cast
            </button>
            <div id="castMenu" style="display:none; margin:-4px 0 12px 0;"></div>
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
            <div id="goldValue" style="margin-bottom:12px;">gold: 0</div>
            <div style="font-size:14px; color:#94a3b8; margin-bottom:10px;">party inventory</div>
            <div id="partyInventoryList" style="display:flex; flex-direction:column; gap:6px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

export function requireContext(canvasElement: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvasElement.getContext('2d');
  if (!context) {
    throw new Error('Canvas context unavailable');
  }
  return context;
}
