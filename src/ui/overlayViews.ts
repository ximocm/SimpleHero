import type { RunState } from '../data/dungeonTypes.js';
import type { CampaignProfile, HeroDraft } from '../app/types.js';
import { ITEM_DEFINITIONS } from '../items/items.js';
import { SHOP_ITEMS } from '../items/shop.js';

export function getPauseMenuOverlayHtml(): string {
  return `
    <div style="max-width:460px; margin:96px auto; padding:28px; border:1px solid rgba(148,163,184,0.22); background:rgba(15,23,42,0.92);">
      <div style="font-size:24px; color:#f8fafc; margin-bottom:10px;">Menu</div>
      <div style="font-size:14px; color:#94a3b8; margin-bottom:24px;">Pause the run, retreat, or return to the main menu.</div>
      <div style="display:flex; flex-direction:column; gap:12px;">
        <button data-screen-action="resume-game" type="button" style="padding:12px 14px; border:1px solid rgba(96,165,250,0.45); background:rgba(30,64,175,0.45); color:#dbeafe; cursor:pointer;">resume</button>
        <button data-screen-action="retreat-run" type="button" style="padding:12px 14px; border:1px solid rgba(248,113,113,0.45); background:rgba(127,29,29,0.42); color:#fecaca; cursor:pointer;">retreat</button>
        <button data-screen-action="to-main-menu" type="button" style="padding:12px 14px; border:1px solid rgba(148,163,184,0.35); background:rgba(30,41,59,0.72); color:#e2e8f0; cursor:pointer;">main menu</button>
      </div>
    </div>
  `;
}

export function getStartMenuOverlayHtml(hasSave: boolean, hasProfile: boolean, accountGold: number): string {
  return `
    <div style="width:min(1180px, calc(100vw - 48px)); min-height:clamp(360px, 68vh, 640px); margin:24px auto; padding:40px 48px; border:1px solid rgba(148,163,184,0.22); background:linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.88)); display:grid; grid-template-columns:minmax(0, 1.4fr) minmax(360px, 0.9fr); gap:40px; align-items:stretch; box-sizing:border-box; overflow:hidden;">
      <div style="display:flex; flex-direction:column; justify-content:center;">
        <div style="font-size:44px; line-height:1; color:#f8fafc; margin-bottom:14px;">SimpleHero</div>
        <div style="font-size:18px; color:#cbd5e1; margin-bottom:12px;">Short tactical dungeon runs with a 3-hero party.</div>
        <div style="font-size:14px; color:#94a3b8; max-width:520px;">Create your heroes, prepare them in a safe zone, then launch expeditions into the dungeon.</div>
        <div style="font-size:14px; color:#fbbf24; margin-top:18px;">Account gold: ${accountGold}</div>
      </div>
      <div style="display:flex; flex-direction:column; justify-content:center; gap:14px; padding:28px; border:1px solid rgba(148,163,184,0.16); background:rgba(15,23,42,0.5);">
        <button data-screen-action="new-game" type="button" ${hasProfile ? '' : 'disabled'} style="padding:14px 16px; border:1px solid rgba(251,191,36,0.45); background:rgba(120,53,15,0.45); color:#fef3c7; cursor:${hasProfile ? 'pointer' : 'not-allowed'}; opacity:${hasProfile ? '1' : '0.5'}; font-size:16px;">start expedition</button>
        <button data-screen-action="manage-party" type="button" style="padding:14px 16px; border:1px solid rgba(96,165,250,0.45); background:rgba(30,64,175,0.45); color:#dbeafe; cursor:pointer; font-size:16px;">${hasProfile ? 'heroes and shop' : 'create heroes'}</button>
        <button data-screen-action="load-game" type="button" ${hasSave ? '' : 'disabled'} style="padding:14px 16px; border:1px solid rgba(96,165,250,0.45); background:rgba(30,64,175,0.45); color:#dbeafe; cursor:${hasSave ? 'pointer' : 'not-allowed'}; opacity:${hasSave ? '1' : '0.5'}; font-size:16px;">load game</button>
        <div style="font-size:12px; color:#94a3b8; margin-top:4px;">${hasProfile ? 'Party profile available.' : 'Create a party before the first expedition.'}</div>
        <div style="font-size:12px; color:#94a3b8;">${hasSave ? 'Autosave available.' : 'No autosave found.'}</div>
      </div>
    </div>
  `;
}

export function getCharacterCreationOverlayHtml(drafts: readonly HeroDraft[], startingGold: number): string {
  return `
    <div style="width:min(1220px, calc(100vw - 48px)); min-height:calc(100vh - 48px); margin:24px auto; padding:36px; border:1px solid rgba(148,163,184,0.22); background:linear-gradient(180deg, rgba(15,23,42,0.98), rgba(30,41,59,0.92)); box-sizing:border-box; overflow:auto;">
      <div style="display:flex; justify-content:space-between; gap:20px; align-items:flex-start; margin-bottom:26px;">
        <div>
          <div style="font-size:34px; color:#f8fafc; margin-bottom:10px;">Create your heroes</div>
          <div style="font-size:14px; color:#94a3b8; max-width:620px;">Choose names, classes and races for the three starting heroes. After this step you will enter the safe zone with ${startingGold} gold to buy starting gear.</div>
        </div>
        <div style="font-size:14px; color:#fbbf24;">Starting gold: ${startingGold}</div>
      </div>
      <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:18px; margin-bottom:26px;">
        ${drafts.map((draft, index) => `
          <div style="padding:18px; border:1px solid rgba(148,163,184,0.24); background:rgba(15,23,42,0.58);">
            <div style="font-size:18px; color:#f8fafc; margin-bottom:12px;">Hero ${index + 1}</div>
            <label style="display:block; font-size:12px; color:#94a3b8; margin-bottom:6px;">Name</label>
            <input data-draft-field="name" data-draft-index="${index}" type="text" maxlength="24" value="${escapeAttr(draft.name)}" style="width:100%; box-sizing:border-box; margin-bottom:14px; padding:10px 12px; border:1px solid rgba(148,163,184,0.28); background:rgba(2,6,23,0.6); color:#f8fafc;" />
            <label style="display:block; font-size:12px; color:#94a3b8; margin-bottom:6px;">Class</label>
            <select data-draft-field="className" data-draft-index="${index}" style="width:100%; box-sizing:border-box; margin-bottom:14px; padding:10px 12px; border:1px solid rgba(148,163,184,0.28); background:rgba(2,6,23,0.6); color:#f8fafc;">
              ${renderOptions(['Warrior', 'Ranger', 'Mage'], draft.className)}
            </select>
            <label style="display:block; font-size:12px; color:#94a3b8; margin-bottom:6px;">Race</label>
            <select data-draft-field="raceName" data-draft-index="${index}" style="width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid rgba(148,163,184,0.28); background:rgba(2,6,23,0.6); color:#f8fafc;">
              ${renderOptions(['Human', 'Elf', 'Orc'], draft.raceName)}
            </select>
          </div>
        `).join('')}
      </div>
      <div style="display:flex; gap:12px;">
        <button data-screen-action="back-menu" type="button" style="padding:12px 14px; border:1px solid rgba(148,163,184,0.35); background:rgba(30,41,59,0.72); color:#e2e8f0; cursor:pointer;">back to menu</button>
        <button data-screen-action="finish-creation" type="button" style="padding:12px 14px; border:1px solid rgba(251,191,36,0.45); background:rgba(120,53,15,0.45); color:#fef3c7; cursor:pointer;">continue to safe zone</button>
      </div>
    </div>
  `;
}

export function getSafeZoneOverlayHtml(args: {
  profile: CampaignProfile;
  accountGold: number;
  selectedHeroIndex: number;
}): string {
  const selectedHero = args.profile.heroes[args.selectedHeroIndex] ?? args.profile.heroes[0];
  const shopSections = getShopSections();

  return `
    <div style="width:min(1260px, calc(100vw - 48px)); min-height:calc(100vh - 48px); margin:24px auto; padding:30px; border:1px solid rgba(148,163,184,0.22); background:linear-gradient(180deg, rgba(15,23,42,0.98), rgba(30,41,59,0.92)); box-sizing:border-box; overflow:auto;">
      <div style="display:flex; justify-content:space-between; gap:20px; align-items:flex-start; margin-bottom:24px;">
        <div>
          <div style="font-size:34px; color:#f8fafc; margin-bottom:10px;">Safe zone</div>
          <div style="font-size:14px; color:#94a3b8; max-width:720px;">Manage your heroes, move gear from the stash and buy equipment before the next expedition.</div>
        </div>
        <div style="display:flex; gap:12px; align-items:center;">
          <div style="font-size:14px; color:#fbbf24;">Gold: ${args.accountGold}</div>
          <button data-screen-action="back-menu" type="button" style="padding:10px 12px; border:1px solid rgba(148,163,184,0.35); background:rgba(30,41,59,0.72); color:#e2e8f0; cursor:pointer;">menu</button>
          <button data-screen-action="launch-expedition" type="button" style="padding:10px 12px; border:1px solid rgba(251,191,36,0.45); background:rgba(120,53,15,0.45); color:#fef3c7; cursor:pointer;">start expedition</button>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:minmax(0, 1.15fr) minmax(280px, 0.9fr) minmax(360px, 1.05fr); gap:18px; align-items:start;">
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${args.profile.heroes.map((hero, index) => {
            const selected = index === args.selectedHeroIndex;
            return `
              <button data-safe-action="select-hero" data-hero-index="${index}" type="button" style="text-align:left; padding:16px; border:1px solid ${selected ? 'rgba(251,191,36,0.55)' : 'rgba(148,163,184,0.25)'}; background:${selected ? 'rgba(120,53,15,0.32)' : 'rgba(15,23,42,0.55)'}; color:#e2e8f0; cursor:pointer;">
                <div style="font-size:18px; color:#f8fafc; margin-bottom:4px;">${escapeHtml(hero.name)}</div>
                <div style="font-size:13px; color:#94a3b8; margin-bottom:10px;">${hero.className} · ${hero.raceName}</div>
                <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px; font-size:12px;">
                  <div>Armor: ${formatItemName(hero.equipment.armor)}</div>
                  <div>Left: ${formatItemName(hero.equipment.leftHand)}</div>
                  <div>Right: ${formatItemName(hero.equipment.rightHand)}</div>
                  <div>Backpack: ${hero.equipment.backpack.length}</div>
                </div>
              </button>
            `;
          }).join('')}
        </div>
        <div style="padding:18px; border:1px solid rgba(148,163,184,0.24); background:rgba(15,23,42,0.58);">
          <div style="font-size:20px; color:#f8fafc; margin-bottom:12px;">${escapeHtml(selectedHero.name)}</div>
          <div style="font-size:13px; color:#94a3b8; margin-bottom:18px;">${selectedHero.className} · ${selectedHero.raceName}</div>
          ${renderHeroSlot(args.selectedHeroIndex, 'armor', 'Armor', selectedHero.equipment.armor)}
          ${renderHeroSlot(args.selectedHeroIndex, 'leftHand', 'Left hand', selectedHero.equipment.leftHand)}
          ${renderHeroSlot(args.selectedHeroIndex, 'rightHand', 'Right hand', selectedHero.equipment.rightHand)}
          ${renderHeroSlot(args.selectedHeroIndex, 'relic', 'Relic', selectedHero.equipment.relic)}
          <div style="margin-top:16px;">
            <div style="font-size:13px; color:#94a3b8; margin-bottom:8px;">Backpack</div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${selectedHero.equipment.backpack.length > 0 ? selectedHero.equipment.backpack.map((itemId, backpackIndex) => `
                <div style="display:flex; justify-content:space-between; gap:8px; align-items:center; padding:8px 10px; background:rgba(2,6,23,0.45); border:1px solid rgba(148,163,184,0.18);">
                  <span>${formatItemName(itemId)}</span>
                  <button data-safe-action="stash-backpack" data-hero-index="${args.selectedHeroIndex}" data-backpack-index="${backpackIndex}" type="button" style="padding:6px 8px; border:1px solid rgba(96,165,250,0.35); background:rgba(30,64,175,0.3); color:#dbeafe; cursor:pointer;">to stash</button>
                </div>
              `).join('') : '<div style="color:#64748b;">No backpack items</div>'}
            </div>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:18px; max-height:calc(100vh - 180px); overflow:auto; padding-right:6px;">
          <div style="padding:18px; border:1px solid rgba(148,163,184,0.24); background:rgba(15,23,42,0.58);">
            <div style="font-size:20px; color:#f8fafc; margin-bottom:12px;">Stash</div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${args.profile.stash.length > 0 ? args.profile.stash.map((entry) => `
                <div style="padding:10px; border:1px solid rgba(148,163,184,0.18); background:rgba(2,6,23,0.45);">
                  <div style="font-size:14px; color:#f8fafc; margin-bottom:8px;">${escapeHtml(entry.name)}</div>
                  <div style="display:flex; flex-wrap:wrap; gap:6px;">
                    ${renderStashActions(entry.itemId)}
                  </div>
                </div>
              `).join('') : '<div style="color:#64748b;">No shared gear yet</div>'}
            </div>
          </div>
          <div style="padding:18px; border:1px solid rgba(148,163,184,0.24); background:rgba(15,23,42,0.58);">
            <div style="font-size:20px; color:#f8fafc; margin-bottom:12px;">Shop</div>
            <div style="display:flex; flex-direction:column; gap:14px;">
              ${shopSections.map((section) => `
                <div style="padding:12px; border:1px solid rgba(148,163,184,0.18); background:rgba(2,6,23,0.38);">
                  <div style="font-size:13px; color:#fbbf24; letter-spacing:0.04em; text-transform:uppercase; margin-bottom:10px;">${section.label}</div>
                  <div style="display:flex; flex-direction:column; gap:8px;">
                    ${section.items.map((entry) => `
                      <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; padding:10px; border:1px solid rgba(148,163,184,0.18); background:rgba(2,6,23,0.45);">
                        <div>
                          <div style="font-size:14px; color:#f8fafc;">${escapeHtml(entry.name)}</div>
                          <div style="font-size:12px; color:#94a3b8;">${entry.detail}</div>
                        </div>
                        <button data-safe-action="buy-item" data-item-id="${entry.itemId}" type="button" style="padding:6px 8px; border:1px solid rgba(74,222,128,0.35); background:rgba(20,83,45,0.35); color:#dcfce7; cursor:pointer;">buy ${entry.price}g</button>
                      </div>
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
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
  runGold: number;
  accountGold: number;
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
        <div>Run gold: ${summary.runGold}</div>
        <div>Account gold: ${summary.accountGold}</div>
      </div>
      <div style="display:flex; flex-direction:column; gap:12px;">
        <button data-screen-action="back-menu" type="button" style="padding:12px 14px; border:1px solid rgba(148,163,184,0.35); background:rgba(30,41,59,0.72); color:#e2e8f0; cursor:pointer;">back to menu</button>
        <button data-screen-action="new-game" type="button" style="padding:12px 14px; border:1px solid rgba(251,191,36,0.45); background:rgba(120,53,15,0.45); color:#fef3c7; cursor:pointer;">new game</button>
      </div>
    </div>
  `;
}

function renderOptions(options: readonly string[], selected: string): string {
  return options
    .map((option) => `<option value="${option}" ${option === selected ? 'selected' : ''}>${option}</option>`)
    .join('');
}

function renderHeroSlot(heroIndex: number, slot: 'armor' | 'leftHand' | 'rightHand' | 'relic', label: string, itemId: string | null): string {
  return `
    <div style="display:flex; justify-content:space-between; gap:8px; align-items:center; padding:8px 10px; background:rgba(2,6,23,0.45); border:1px solid rgba(148,163,184,0.18); margin-bottom:8px;">
      <div>
        <div style="font-size:13px; color:#94a3b8;">${label}</div>
        <div style="font-size:14px; color:#f8fafc;">${formatItemName(itemId)}</div>
      </div>
      ${itemId ? `<button data-safe-action="stash-equipped" data-hero-index="${heroIndex}" data-slot="${slot}" type="button" style="padding:6px 8px; border:1px solid rgba(96,165,250,0.35); background:rgba(30,64,175,0.3); color:#dbeafe; cursor:pointer;">to stash</button>` : ''}
    </div>
  `;
}

function renderStashActions(itemId: string): string {
  const item = ITEM_DEFINITIONS.find((entry) => entry.id === itemId);
  if (!item) return '';
  const actions: string[] = [];

  if (item.category === 'armor' && item.id !== 'shield') {
    actions.push(renderStashActionButton(itemId, 'equip-armor', 'equip armor'));
  }
  if (item.category === 'weapon' || item.category === 'spellbook' || item.id === 'shield') {
    actions.push(renderStashActionButton(itemId, 'equip-left', 'left hand'));
    actions.push(renderStashActionButton(itemId, 'equip-right', 'right hand'));
  }
  if (item.category === 'consumable') {
    actions.push(renderStashActionButton(itemId, 'equip-relic', 'relic'));
    actions.push(renderStashActionButton(itemId, 'equip-backpack', 'backpack'));
  }

  return actions.join('');
}

function renderStashActionButton(itemId: string, action: string, label: string): string {
  return `<button data-safe-action="${action}" data-item-id="${itemId}" type="button" style="padding:6px 8px; border:1px solid rgba(96,165,250,0.35); background:rgba(30,64,175,0.3); color:#dbeafe; cursor:pointer;">${label}</button>`;
}

function getShopSections(): Array<{
  label: string;
  items: Array<{ itemId: string; name: string; price: number; detail: string }>;
}> {
  const labels: Record<string, string> = {
    weapon: 'Weapons',
    armor: 'Armor',
    spellbook: 'Spellbooks',
    consumable: 'Consumables',
  };

  const grouped = new Map<string, Array<{ itemId: string; name: string; price: number; detail: string }>>();

  for (const shopEntry of SHOP_ITEMS) {
    const item = ITEM_DEFINITIONS.find((candidate) => candidate.id === shopEntry.itemId);
    if (!item) continue;

    const detail =
      item.category === 'weapon'
        ? `Range ${item.range} · Damage ${item.damage}`
        : item.category === 'armor'
          ? `Defense +${item.defenseDiceBonus}`
          : item.category === 'spellbook'
            ? `${item.spellIds.length} spells`
            : `Heal ${item.value}`;

    const existing = grouped.get(item.category) ?? [];
    existing.push({
      itemId: item.id,
      name: item.name,
      price: shopEntry.price,
      detail,
    });
    grouped.set(item.category, existing);
  }

  return ['weapon', 'armor', 'spellbook', 'consumable']
    .map((category) => ({
      label: labels[category],
      items: grouped.get(category) ?? [],
    }))
    .filter((section) => section.items.length > 0);
}

function formatItemName(itemId: string | null): string {
  if (!itemId) return 'Empty';
  const item = ITEM_DEFINITIONS.find((entry) => entry.id === itemId);
  return item?.name ?? itemId;
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
