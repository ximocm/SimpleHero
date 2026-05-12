import type { HeroState } from '../data/dungeonTypes.js';
import type { HeroPanelView } from '../systems/gameSystem.js';
import type { InventoryEntry } from '../items/inventory.js';
import type { ItemDefinition } from '../items/items.js';

export function renderCharacterPanelsHtml(args: {
  heroes: HeroPanelView[];
  heroStates: readonly HeroState[];
  itemById: Map<string, ItemDefinition>;
  isBackpackConsumableTargetable: (heroId: string, itemId: string) => boolean;
  getItemTooltip: (itemId: string) => string;
}): string {
  const { heroes, heroStates, itemById, isBackpackConsumableTargetable, getItemTooltip } = args;

  return heroes
    .map((hero, index) => {
      const hpPercent = hero.maxHp > 0 ? Math.max(0, Math.min(100, (hero.hp / hero.maxHp) * 100)) : 0;
      const border = hero.isDefeated ? 'rgba(239,68,68,0.7)' : hero.isActive ? '#fbbf24' : 'rgba(148,163,184,0.25)';
      const badgeLabel = hero.isDefeated ? 'Defeated' : hero.isReadyAtExit ? 'Ready' : hero.isActive ? 'Active' : 'Idle';
      const badgeColor = hero.isDefeated ? '#f87171' : hero.isReadyAtExit ? '#22c55e' : hero.isActive ? '#fbbf24' : '#94a3b8';
      const skillStatus =
        hero.className === 'Warrior' && hero.powerStrikeArmed
          ? 'Skill: Power Strike armed'
          : hero.skillCooldownRemaining > 0
            ? `Skill CD ${hero.skillCooldownRemaining}`
            : 'Skill ready';

      return `
        <div
          data-hero-index="${index}"
          style="cursor:${hero.isDefeated ? 'default' : 'pointer'}; border:1px solid ${border}; min-height:118px; padding:12px; background:${hero.isDefeated ? 'rgba(69,10,10,0.45)' : 'rgba(15,23,42,0.55)'};"
        >
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <div style="font-size:15px; font-weight:600;">${hero.name}</div>
            <div style="font-size:12px; color:${badgeColor};">${badgeLabel}</div>
          </div>
          <div style="font-size:12px; color:#94a3b8; margin-bottom:6px;">${hero.classLetter} · ${hero.className} · ${hero.raceName}</div>
          <div style="font-size:12px; margin-bottom:4px;">HP ${hero.hp}/${hero.maxHp}</div>
          <div style="height:8px; background:rgba(148,163,184,0.25); margin-bottom:8px;">
            <div style="width:${hpPercent}%; height:100%; background:#22c55e;"></div>
          </div>
          <div style="font-size:12px; color:#cbd5e1; margin-bottom:6px;">Body ${hero.body} · Mind ${hero.mind}</div>
          ${renderActionIcons(hero)}
          <div style="font-size:11px; color:#fbbf24; margin-bottom:8px;">${skillStatus}</div>
          <div style="display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:6px; margin-bottom:6px;">
            ${renderEquipSlot(index, 'armor', 'A', hero.armor, itemById, getItemTooltip)}
            ${renderEquipSlot(index, 'leftHand', 'L', hero.leftHand, itemById, getItemTooltip)}
            ${renderEquipSlot(index, 'rightHand', 'R', hero.rightHand, itemById, getItemTooltip)}
            ${renderEquipSlot(index, 'relic', 'Rel', hero.relic, itemById, getItemTooltip)}
          </div>
          <div
            data-drop-slot="backpack"
            data-hero-index="${index}"
            style="min-height:30px; border:1px dashed rgba(148,163,184,0.4); padding:6px; font-size:11px; color:#cbd5e1; margin-bottom:2px;"
          >
            <div style="color:#94a3b8; margin-bottom:4px;">Backpack (${hero.backpackCount})</div>
            ${renderBackpackItems(index, heroStates, itemById, isBackpackConsumableTargetable, getItemTooltip)}
          </div>
          <div style="font-size:11px; color:#94a3b8; margin-top:4px;">Floor ${hero.floorNumber} · Room ${hero.roomId}</div>
        </div>
      `;
    })
    .join('');
}

function renderActionIcons(hero: HeroPanelView): string {
  if (hero.isDefeated) {
    return '<div style="font-size:11px; color:#f87171; margin-bottom:8px;">Defeated</div>';
  }

  const hasTurnResources = hero.movementRemaining !== null;
  const moveReady = hasTurnResources && (hero.movementRemaining ?? 0) > 0;
  const apReady = hasTurnResources && (hero.actionPointsRemaining ?? 0) > 0;
  const attackReady = hasTurnResources && hero.attackSlotAvailable === true;
  const skillReady = hasTurnResources && hero.skillCooldownRemaining === 0;

  return `
    <div style="display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:5px; margin-bottom:8px;">
      ${renderActionIcon('MOV', hasTurnResources ? `${hero.movementRemaining ?? 0}` : '-', moveReady)}
      ${renderActionIcon('AP', hasTurnResources ? `${hero.actionPointsRemaining ?? 0}` : '-', apReady)}
      ${renderActionIcon('ATK', hero.attackSlotAvailable === null ? '-' : hero.attackSlotAvailable ? 'ready' : 'spent', attackReady)}
      ${renderActionIcon('SKL', hero.skillCooldownRemaining > 0 ? `${hero.skillCooldownRemaining}` : 'ready', skillReady)}
    </div>
  `;
}

function renderActionIcon(label: string, value: string, isReady: boolean): string {
  const border = isReady ? 'rgba(251,191,36,0.75)' : 'rgba(71,85,105,0.55)';
  const background = isReady ? 'rgba(120,53,15,0.54)' : 'rgba(15,23,42,0.75)';
  const labelColor = isReady ? '#fef3c7' : '#64748b';
  const valueColor = isReady ? '#fde68a' : '#475569';

  return `
    <div title="${escapeAttr(`${label} ${value}`)}" style="min-height:34px; border:1px solid ${border}; background:${background}; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px;">
      <div style="font-size:10px; font-weight:700; color:${labelColor}; line-height:1;">${label}</div>
      <div style="font-size:9px; color:${valueColor}; line-height:1; text-transform:uppercase;">${value}</div>
    </div>
  `;
}

export function renderPartyInventoryHtml(
  partyInventory: readonly InventoryEntry[],
  getItemTooltip: (itemId: string) => string,
): string {
  return partyInventory
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
            draggable="false"
            style="image-rendering:pixelated; background:rgba(148,163,184,0.18); border:1px solid rgba(148,163,184,0.35);"
          />
          <span style="flex:1;">${entry.name}</span>
        </div>
      `,
    )
    .join('');
}

export function renderCombatLogHtml(entries: readonly string[]): string {
  if (entries.length === 0) {
    return '<div style="color:#64748b;">No combat rolls yet</div>';
  }

  return entries
    .slice(0, 3)
    .map(
      (entry) =>
        `<div style="padding:6px; background:rgba(15,23,42,0.45); border:1px solid rgba(148,163,184,0.15);">${entry}</div>`,
    )
    .join('');
}

function renderEquipSlot(
  heroIndex: number,
  slot: 'armor' | 'leftHand' | 'rightHand' | 'relic',
  label: string,
  itemId: string | null,
  itemById: Map<string, ItemDefinition>,
  getItemTooltip: (itemId: string) => string,
): string {
  const item = itemId ? itemById.get(itemId) : null;
  const dragAttrs = itemId
    ? `data-drag-source="slot" data-item-id="${itemId}" data-hero-index="${heroIndex}" data-slot="${slot}" draggable="true" style="cursor:grab; display:inline-block;"`
    : 'style="display:inline-block;"';
  const slotContent =
    itemId && item
      ? `<img src="/${item.file}" alt="${item.name}" width="22" height="22" title="${escapeAttr(
          getItemTooltip(itemId),
        )}" draggable="false" style="image-rendering:pixelated; border:1px solid rgba(148,163,184,0.35); background:rgba(148,163,184,0.14);" />`
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

function renderBackpackItems(
  heroIndex: number,
  heroStates: readonly HeroState[],
  itemById: Map<string, ItemDefinition>,
  isBackpackConsumableTargetable: (heroId: string, itemId: string) => boolean,
  getItemTooltip: (itemId: string) => string,
): string {
  const hero = heroStates[heroIndex];
  if (!hero || hero.equipment.backpack.length === 0) {
    return '<span style="color:#64748b;">Drop item here</span>';
  }

  return hero.equipment.backpack
    .map((itemId, backpackIndex) => {
      const item = itemById.get(itemId);
      if (!item) return '';
      const isTargetable = isBackpackConsumableTargetable(hero.id, itemId);
      return `<span data-drag-source="backpack" data-item-id="${itemId}" data-hero-index="${heroIndex}" data-backpack-index="${backpackIndex}" draggable="true" title="${escapeAttr(
        getItemTooltip(itemId),
      )}" data-backpack-item-id="${itemId}" style="display:inline-block; margin-right:6px; cursor:${
        isTargetable ? 'pointer' : 'grab'
      };"><img src="/${
        item.file
      }" alt="${item.name}" width="20" height="20" draggable="false" style="image-rendering:pixelated; border:1px solid ${
        isTargetable ? 'rgba(74,222,128,0.9)' : 'rgba(148,163,184,0.35)'
      }; background:${isTargetable ? 'rgba(20,83,45,0.45)' : 'rgba(148,163,184,0.14)'};" /></span>`;
    })
    .join('');
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
