// Bag discard bus — the character sheet asks the app owner (Index) to drop an item.
export const BAG_DISCARD_EVENT = 'odyssey-bag-discard';

export type BagDiscardKind = 'consumable' | 'loot';

export interface BagDiscardDetail {
  kind: BagDiscardKind;
  /** Item name as shown in the sheet. Resolved to an id by the owner. */
  name: string;
}

export function discardBagItem(detail: BagDiscardDetail) {
  window.dispatchEvent(new CustomEvent<BagDiscardDetail>(BAG_DISCARD_EVENT, { detail }));
}
