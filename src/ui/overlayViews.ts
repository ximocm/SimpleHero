import type { RunState } from '../data/dungeonTypes.js';

export function getPauseMenuOverlayHtml(): string {
  return `
    <div style="max-width:460px; margin:96px auto; padding:28px; border:1px solid rgba(148,163,184,0.22); background:rgba(15,23,42,0.92);">
      <div style="font-size:24px; color:#f8fafc; margin-bottom:10px;">Menu</div>
      <div style="font-size:14px; color:#94a3b8; margin-bottom:24px;">Pause the run or return to the main menu.</div>
      <div style="display:flex; flex-direction:column; gap:12px;">
        <button data-screen-action="resume-game" type="button" style="padding:12px 14px; border:1px solid rgba(96,165,250,0.45); background:rgba(30,64,175,0.45); color:#dbeafe; cursor:pointer;">resume</button>
        <button data-screen-action="to-main-menu" type="button" style="padding:12px 14px; border:1px solid rgba(148,163,184,0.35); background:rgba(30,41,59,0.72); color:#e2e8f0; cursor:pointer;">main menu</button>
      </div>
    </div>
  `;
}

export function getStartMenuOverlayHtml(hasSave: boolean): string {
  return `
    <div style="width:min(1180px, calc(100vw - 48px)); min-height:clamp(360px, 68vh, 640px); margin:24px auto; padding:40px 48px; border:1px solid rgba(148,163,184,0.22); background:linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.88)); display:grid; grid-template-columns:minmax(0, 1.4fr) minmax(360px, 0.9fr); gap:40px; align-items:stretch; box-sizing:border-box; overflow:hidden;">
      <div style="display:flex; flex-direction:column; justify-content:center;">
        <div style="font-size:44px; line-height:1; color:#f8fafc; margin-bottom:14px;">SimpleHero</div>
        <div style="font-size:18px; color:#cbd5e1; margin-bottom:12px;">Short tactical dungeon runs with a 3-hero party.</div>
        <div style="font-size:14px; color:#94a3b8; max-width:520px;">Start a fresh run from the menu, or load the last saved dungeon state if one exists.</div>
      </div>
      <div style="display:flex; flex-direction:column; justify-content:center; gap:14px; padding:28px; border:1px solid rgba(148,163,184,0.16); background:rgba(15,23,42,0.5);">
        <button data-screen-action="new-game" type="button" style="padding:14px 16px; border:1px solid rgba(251,191,36,0.45); background:rgba(120,53,15,0.45); color:#fef3c7; cursor:pointer; font-size:16px;">new game</button>
        <button data-screen-action="load-game" type="button" ${hasSave ? '' : 'disabled'} style="padding:14px 16px; border:1px solid rgba(96,165,250,0.45); background:rgba(30,64,175,0.45); color:#dbeafe; cursor:${hasSave ? 'pointer' : 'not-allowed'}; opacity:${hasSave ? '1' : '0.5'}; font-size:16px;">load game</button>
        <div style="font-size:12px; color:#94a3b8; margin-top:4px;">${hasSave ? 'Autosave available.' : 'No autosave found.'}</div>
      </div>
    </div>
  `;
}

export function getRunCompleteOverlayHtml(summary: {
  result: RunState;
  seed: number;
  discoveredRooms: number;
  floorsReached: number;
  survivingHeroes: number;
}): string {
  const resultLabel = summary.result === 'won' ? 'Victory' : 'Defeat';
  const resultColor = summary.result === 'won' ? '#fbbf24' : '#f87171';

  return `
    <div style="max-width:560px; margin:48px auto; padding:28px; border:1px solid rgba(148,163,184,0.22); background:rgba(15,23,42,0.9);">
      <div style="font-size:28px; color:${resultColor}; margin-bottom:10px;">${resultLabel}</div>
      <div style="font-size:14px; color:#cbd5e1; margin-bottom:18px;">Seed ${summary.seed}</div>
      <div style="display:flex; flex-direction:column; gap:8px; font-size:14px; color:#e2e8f0; margin-bottom:22px;">
        <div>Discovered rooms: ${summary.discoveredRooms}</div>
        <div>Floors reached: ${summary.floorsReached}</div>
        <div>Surviving heroes: ${summary.survivingHeroes}</div>
      </div>
      <div style="display:flex; flex-direction:column; gap:12px;">
        <button data-screen-action="back-menu" type="button" style="padding:12px 14px; border:1px solid rgba(148,163,184,0.35); background:rgba(30,41,59,0.72); color:#e2e8f0; cursor:pointer;">back to menu</button>
        <button data-screen-action="new-game" type="button" style="padding:12px 14px; border:1px solid rgba(251,191,36,0.45); background:rgba(120,53,15,0.45); color:#fef3c7; cursor:pointer;">new game</button>
      </div>
    </div>
  `;
}
