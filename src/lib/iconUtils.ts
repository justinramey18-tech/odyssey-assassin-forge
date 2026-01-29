import { icons, LucideIcon, HelpCircle } from 'lucide-react';

// Helper function to get icon component by name
export function getIconByName(name: string): LucideIcon {
  const icon = icons[name as keyof typeof icons];
  return icon || HelpCircle;
}
