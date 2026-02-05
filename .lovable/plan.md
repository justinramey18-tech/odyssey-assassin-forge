# Codebase Cleanup Plan: Remove Unused Files

## Overview
This plan documents unused files identified for deletion to reduce bundle size and code complexity.

---

## Phase 1: Unused Components (2 files)

### 1.1 `src/components/combat/CombatHUDScreen.tsx`
- **Lines**: 504
- **Status**: ✅ Safe to delete
- **Reason**: Replaced by `CombatTabScreen.tsx`. Not imported anywhere in the codebase.
- **Bundle savings**: ~15KB unminified

### 1.2 `src/components/NavLink.tsx`
- **Lines**: 28
- **Status**: ✅ Safe to delete
- **Reason**: Custom React Router wrapper that is never imported.
- **Bundle savings**: ~1KB

---

## Phase 2: Redundant Re-export (1 file)

### 2.1 `src/components/ui/use-toast.ts`
- **Lines**: 3
- **Status**: ✅ Safe to delete
- **Reason**: Simply re-exports from `src/hooks/use-toast.ts`. All imports should use the hooks directory directly.
- **Action required**: Before deleting, update any imports from `@/components/ui/use-toast` to `@/hooks/use-toast`

---

## Phase 3: Unused Image Assets (11 files, ~25-30MB)

### Generated images (not referenced):
| File | Path | Safe to Delete |
|------|------|----------------|
| deadpool-assassin-hero.jpg | src/assets/generated/ | ✅ |
| deadpool-assassin-hero-v2.jpg | src/assets/generated/ | ✅ |
| deadpool-assassin-hero-v3.jpg | src/assets/generated/ | ✅ |
| deadpool-assassin-hero-v4.jpg | src/assets/generated/ | ✅ |
| deadpool-assassin-hero-v5.jpg | src/assets/generated/ | ✅ |
| deadpool-assassin-hero-v6.jpg | src/assets/generated/ | ✅ |
| deadpool-assassin-leap-of-faith.jpg | src/assets/generated/ | ✅ |
| deadpool-assassin-swan-dive.jpg | src/assets/generated/ | ✅ |

### Root assets (not referenced):
| File | Path | Safe to Delete |
|------|------|----------------|
| skills-background.jpg | src/assets/ | ✅ |
| home-assassins-wide.jpg | src/assets/ | ✅ |
| home-background.jpg | src/assets/ | ✅ |

---

## Execution Order

1. **Search for imports** - Verify no files import the components
2. **Update toast imports** - Change any `@/components/ui/use-toast` → `@/hooks/use-toast`
3. **Delete components** - Remove CombatHUDScreen.tsx and NavLink.tsx
4. **Delete re-export** - Remove use-toast.ts from components/ui
5. **Delete images** - Remove all 11 unused image files
6. **Verify build** - Run build to confirm no broken imports

---

## Summary

| Category | Files | Est. Savings |
|----------|-------|--------------|
| Components | 2 | ~16KB |
| Re-exports | 1 | <1KB |
| Images | 11 | ~25-30MB |
| **Total** | **14 files** | **~25-30MB** |

---

## Status: Ready for Execution

Say "Execute cleanup plan" to proceed with deletions.
