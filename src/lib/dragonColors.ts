export const DRAGON_COLORS = [
  { id: 'deep-red',     label: 'Deep Red',     hex: '#8B2232' },
  { id: 'deep-blue',    label: 'Deep Blue',    hex: '#2A4F8B' },
  { id: 'deep-purple',  label: 'Deep Purple',  hex: '#5B2D8B' },
  { id: 'deep-gold',    label: 'Deep Gold',    hex: '#8B7425' },
  { id: 'onyx',         label: 'Onyx',         hex: '#2C2C2E' },
  { id: 'dark-green',   label: 'Dark Green',   hex: '#2D5A3D' },
  { id: 'silver',       label: 'Silver',       hex: '#7A8B99' },
  { id: 'dark-orange',  label: 'Dark Orange',  hex: '#8B4A1F' },
  { id: 'brown',        label: 'Brown',        hex: '#6B4A3A' },
] as const;

export type DragonColorId = typeof DRAGON_COLORS[number]['id'];

export function getDragonColorHex(colorId: string | undefined): string {
  const found = DRAGON_COLORS.find(c => c.id === colorId);
  return found?.hex ?? '#7a8fa6';
}
