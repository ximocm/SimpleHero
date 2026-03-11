export type SpellbookId = 'basic-spellbook';

export interface SpellbookDefinition {
  id: SpellbookId;
  name: string;
  file: string;
  handsRequired: 1;
  spellIds: readonly ['heal', 'fireball', 'ice'];
}

export const SPELLBOOK_DEFINITIONS: Record<SpellbookId, SpellbookDefinition> = {
  'basic-spellbook': {
    id: 'basic-spellbook',
    name: 'Basic Spellbook',
    file: 'assets/images/items/book.png',
    handsRequired: 1,
    spellIds: ['heal', 'fireball', 'ice'],
  },
};
