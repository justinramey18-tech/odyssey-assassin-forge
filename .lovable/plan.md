
# Feats, Stars, and Gear Tab Layout Refactor

## Problem
Currently, the **Gear**, **Stars**, and **Feats** screens use `fixed inset-0 z-50` positioning, making them full-screen overlays that cover the navigation header. The user wants these screens to populate **under the header tabs** like the Consumables screen does.

## Reference (Consumables Pattern)
The Consumables tab correctly displays under the header using:
- `BackgroundWrapper` for themed backgrounds
- Content wrapped in a container div with title + action button header
- No fixed positioning - flows naturally under the nav

## Current Issues
| Screen | Problem |
|--------|---------|
| **Gear** (`InventoryScreen.tsx`) | Uses `fixed inset-0 z-50`, has own back button/header |
| **Stars** (`ConstellationScreen.tsx`) | Uses `fixed inset-0 z-50`, has own back button/header |
| **Feats** (`AchievementsScreen.tsx`) | Uses `fixed inset-0 z-50`, has own back button/header |

---

## Solution

Refactor all three screens to:
1. Remove `fixed inset-0 z-50` positioning
2. Remove standalone headers with back buttons (no longer needed since nav tabs are visible)
3. Add title + action button row at the top (like Consumables)
4. Use `BackgroundWrapper` (or keep existing background approach but adjust height)
5. Adjust height to `min-h-[calc(100vh-10vh)]` to fill space below header

---

## Files to Modify

### 1. `src/components/inventory/InventoryScreen.tsx`

**Changes:**
- Remove `fixed inset-0 z-50` from main container
- Remove the header with back button
- Add Consumables-style title header with view toggle and action buttons
- Change to relative positioning with `min-h-[calc(100vh-10vh)]`
- Keep background image logic but adjust container structure
- Remove `onBack` prop (no longer needed)

**Before structure:**
```
<div className="fixed inset-0 bg-background z-50">
  <header>Back button + name + controls</header>
  <content>
```

**After structure:**
```
<div className="min-h-[calc(100vh-10vh)] relative">
  <Background layers>
  <div className="container">
    <header row>Title + action buttons</header>
    <content>
```

### 2. `src/components/constellation/ConstellationScreen.tsx`

**Changes:**
- Remove `fixed inset-0 z-50` from main container
- Remove header with back button
- Add title row: "Star Constellations" + character name badge
- Change to relative positioning filling available space
- Remove `onBack` prop

### 3. `src/components/achievements/AchievementsScreen.tsx`

**Changes:**
- Remove `fixed inset-0 z-50` from `BackgroundWrapper`
- Remove header with back button
- Add Consumables-style title row: "Feats & Achievements" + Import/Export buttons
- Change `className` to `min-h-[calc(100vh-10vh)]`
- Remove `onBack` prop

### 4. `src/pages/Index.tsx`

**Changes:**
- Remove `onBack` prop from all three components (lines 1052, 1065, 1075)
- Keep the component usage otherwise the same

---

## Visual Layout (After)

```
┌─────────────────────────────────────────┐
│  HOME  │ FIGHTING │ INVENTORY ▼│ UTILITY│  ← Main nav (visible)
├─────────────────────────────────────────┤
│                                         │
│  Gear Loadout              [⚙️] [👁]   │  ← New title row
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Equipment slots / content      │    │
│  │  (scrollable area)              │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [Stats footer bar]                     │
└─────────────────────────────────────────┘
```

---

## Technical Details

### InventoryScreen New Structure
```typescript
return (
  <div className="min-h-[calc(100vh-10vh)] relative flex flex-col">
    {/* Background Image Layer */}
    {backgroundImage && (
      <div className="absolute inset-0 z-0" style={{...}}>
        {/* overlays */}
      </div>
    )}
    
    {/* Default background */}
    {!backgroundImage && (
      <div className="absolute inset-0 z-0 bg-gradient-to-b..."/>
    )}
    
    {/* Content */}
    <div className="relative z-10 flex-1 flex flex-col">
      {/* Title Header Row */}
      <div className="flex items-center justify-between px-4 py-4">
        <h1 className="font-cinzel text-2xl text-foreground">
          Gear Loadout
        </h1>
        <div className="flex items-center gap-2">
          {/* View toggle + Set bonus button + Quick equip */}
        </div>
      </div>
      
      {/* Equipment content */}
      <ScrollArea>...</ScrollArea>
      
      {/* Stats footer */}
      <footer>...</footer>
    </div>
    
    {/* Sheets/Drawers */}
  </div>
);
```

### ConstellationScreen New Structure
```typescript
return (
  <div className="min-h-[calc(100vh-10vh)] relative flex flex-col bg-background">
    {/* Title Header Row */}
    <div className="flex items-center justify-between px-4 py-4 border-b border-amber-900/30">
      <h1 className="font-cinzel text-2xl text-amber-400">
        Star Constellations
      </h1>
      <span className="text-sm text-muted-foreground">{characterName}</span>
    </div>
    
    {/* Constellation Map */}
    <div className="flex-1 overflow-hidden">
      <ConstellationMap ... />
    </div>
  </div>
);
```

### AchievementsScreen New Structure
```typescript
return (
  <BackgroundWrapper 
    imagePath={featsBackground} 
    className="min-h-[calc(100vh-10vh)] flex flex-col"
  >
    {/* Title Header Row */}
    <div className="relative z-10 flex items-center justify-between px-4 py-4 border-b border-purple-900/50">
      <h1 className="font-cinzel text-2xl text-foreground">
        Feats & Achievements
      </h1>
      <div className="flex gap-2">
        <Button variant="ghost" size="icon" onClick={handleImport}>
          <Upload className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleExport}>
          <Download className="w-5 h-5" />
        </Button>
      </div>
    </div>
    
    {/* Stats Summary */}
    {/* Set Navigation */}
    {/* Pan Area */}
    ...
  </BackgroundWrapper>
);
```

---

## Props Cleanup

Remove `onBack` from interfaces:
- `InventoryScreenProps`: Remove `onBack: () => void`
- `ConstellationScreenProps`: Remove `onBack?: () => void`
- `AchievementsScreenProps`: Remove `onBack: () => void`

---

## Summary of Changes

| File | Action |
|------|--------|
| `src/components/inventory/InventoryScreen.tsx` | Remove fixed positioning, remove header, add title row |
| `src/components/constellation/ConstellationScreen.tsx` | Remove fixed positioning, remove header, add title row |
| `src/components/achievements/AchievementsScreen.tsx` | Remove fixed positioning, remove header, add title row |
| `src/pages/Index.tsx` | Remove `onBack` props from component calls |

All three screens will now display consistently with the Consumables pattern - flowing under the main navigation header with themed backgrounds and a title row with action buttons.
