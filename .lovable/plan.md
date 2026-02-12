

# Features Showcase Page

## Overview

Create a new `/features` route with a visually rich, categorized showcase of all app features. The page will use the existing Dark Odyssey aesthetic with glassmorphism cards, Cinzel typography, and category-colored accents. It serves as both a marketing/onboarding page and a reference guide.

---

## Structure

The page will be organized into **7 feature categories**, each with an icon, color theme, and expandable feature cards:

| Category | Color | Icon | Features Count |
|----------|-------|------|---------------|
| Character & Progression | Green | User | ~12 features |
| Combat & Fighting | Red | Swords | ~10 features |
| Arcana & Spellcasting | Indigo | Wand2 | ~10 features |
| Inventory & Gear | Amber | Backpack | ~10 features |
| AI & Intelligence | Purple | Sparkles | ~8 features |
| Multiplayer & Party | Sky | Users | ~8 features |
| Utility & Tools | Cyan | Wrench | ~8 features |

Each feature entry includes:
- Lucide icon
- Title
- 1-2 sentence description
- A "Go" button that navigates into the app (linking to the relevant tab via query parameter)

---

## Files to Create

### 1. `src/pages/Features.tsx`
The main page component:
- Sticky header with app logo, title "Feature Showcase", and a "Launch App" button linking to `/`
- Animated category sections using `framer-motion` stagger
- Each category is a glassmorphism card with colored border accent
- Feature items inside each category card with icon, name, description, and navigation link
- Responsive: single column on mobile, two columns on tablet/desktop
- Back-to-top floating button

### 2. `src/lib/features-showcase-data.ts`
Static data file defining all feature categories and items:
- Each category: `id`, `label`, `icon` (Lucide name), `color`, `description`, `features[]`
- Each feature: `id`, `name`, `description`, `iconName`, `navigateTo` (tab ID like `'combat'`, `'arcana'`, etc.)
- Approximately 65-70 feature entries total across all categories

## Files to Modify

### 3. `src/App.tsx`
- Add route: `<Route path="/features" element={<Features />} />`
- Import the new `Features` page

### 4. `src/components/home/HomeScreen.tsx` (minor)
- Add a small "Features Guide" link/button in the menus drawer or bottom of the home screen that navigates to `/features`

---

## Navigation Integration

Each feature's "Go" button will use `react-router-dom`'s `useNavigate` to go to `/?tab=combat` (or similar). The existing `Index.tsx` already reads `useSearchParams` (line 3), so we can leverage query params to deep-link into specific tabs. Features that map to specific sub-tabs will use the existing `getTabToCategoryMapping` function.

---

## Visual Design

- Dark background with subtle gradient matching the app theme
- Category headers use the same color coding as the navigation (red for Fighting, amber for Inventory, etc.)
- Cards use `bg-glass-subtle backdrop-blur-md border-glass` classes from the existing glassmorphism system
- Staggered fade-in animations via `framer-motion`
- Mobile-first layout with proper touch targets (min 44px)

