// Miscellaneous Items Types

export interface MiscItem {
  id: string;
  name: string;
  category: string; // Tool, Kit, Component, Trinket, etc.
  description?: string;
  quantity: number;
  goldValue?: number;
  notes?: string;
  addedAt: string;
}
