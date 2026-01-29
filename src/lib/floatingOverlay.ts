/**
 * Floating Overlay Service
 * Handles permissions and state for floating drawer overlays on mobile
 * 
 * Note: Full floating overlay functionality requires native Android/iOS implementation.
 * This module provides the web-side configuration and state management.
 */

import { App } from '@capacitor/app';

export interface FloatingOverlaySettings {
  enabled: boolean;
  overlayPermissionGranted: boolean;
  backgroundModeEnabled: boolean;
  autoLaunchOnBoot: boolean;
}

const STORAGE_KEY = 'floating-overlay-settings';

const defaultSettings: FloatingOverlaySettings = {
  enabled: false,
  overlayPermissionGranted: false,
  backgroundModeEnabled: false,
  autoLaunchOnBoot: false,
};

export function getFloatingOverlaySettings(): FloatingOverlaySettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load floating overlay settings:', e);
  }
  return defaultSettings;
}

export function saveFloatingOverlaySettings(settings: Partial<FloatingOverlaySettings>): FloatingOverlaySettings {
  const current = getFloatingOverlaySettings();
  const updated = { ...current, ...settings };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save floating overlay settings:', e);
  }
  return updated;
}

/**
 * Check if we're running in a Capacitor native environment
 */
export function isNativeApp(): boolean {
  return typeof (window as any).Capacitor !== 'undefined' && 
         (window as any).Capacitor.isNativePlatform?.();
}

/**
 * Get the current platform
 */
export function getPlatform(): 'android' | 'ios' | 'web' {
  if (!isNativeApp()) return 'web';
  const platform = (window as any).Capacitor?.getPlatform?.();
  return platform || 'web';
}

/**
 * Request overlay permission (Android only)
 * This will open the system settings for overlay permission
 * 
 * Note: Actual implementation requires a custom Capacitor plugin
 * that calls Settings.canDrawOverlays() and opens ACTION_MANAGE_OVERLAY_PERMISSION
 */
export async function requestOverlayPermission(): Promise<boolean> {
  if (!isNativeApp()) {
    console.log('Overlay permissions only available in native app');
    return false;
  }

  const platform = getPlatform();
  
  if (platform === 'ios') {
    // iOS doesn't support arbitrary overlays
    console.log('iOS does not support floating overlays outside the app');
    return false;
  }

  if (platform === 'android') {
    // This would trigger the native overlay permission request
    // Requires custom native implementation
    try {
      // Placeholder - actual implementation needs native bridge
      console.log('Requesting Android overlay permission...');
      
      // In a real implementation, this would call:
      // AndroidOverlayPlugin.requestPermission()
      
      return true;
    } catch (e) {
      console.error('Failed to request overlay permission:', e);
      return false;
    }
  }

  return false;
}

/**
 * Enable background mode to keep the app running
 * 
 * Note: Requires @capacitor-community/background-mode plugin
 * or custom native implementation for foreground service
 */
export async function enableBackgroundMode(): Promise<boolean> {
  if (!isNativeApp()) {
    console.log('Background mode only available in native app');
    return false;
  }

  try {
    // Placeholder - actual implementation needs native bridge
    console.log('Enabling background mode...');
    
    // In a real implementation, this would start a foreground service
    // BackgroundMode.enable({ title: 'Deadpool Companion', text: 'Floating drawer active' })
    
    return true;
  } catch (e) {
    console.error('Failed to enable background mode:', e);
    return false;
  }
}

/**
 * Disable background mode
 */
export async function disableBackgroundMode(): Promise<void> {
  if (!isNativeApp()) return;
  
  try {
    console.log('Disabling background mode...');
    // BackgroundMode.disable()
  } catch (e) {
    console.error('Failed to disable background mode:', e);
  }
}

/**
 * Start the floating overlay service
 */
export async function startFloatingOverlay(): Promise<boolean> {
  const settings = getFloatingOverlaySettings();
  
  if (!settings.overlayPermissionGranted) {
    console.log('Overlay permission not granted');
    return false;
  }

  if (!isNativeApp()) {
    console.log('Floating overlay only available in native app');
    return false;
  }

  try {
    console.log('Starting floating overlay service...');
    
    // Enable background mode first
    if (settings.backgroundModeEnabled) {
      await enableBackgroundMode();
    }
    
    // Start the overlay service
    // FloatingOverlayPlugin.start({ drawers: ['combat', 'stats', 'setbonus', 'prompts', 'abilities', 'scribe'] })
    
    return true;
  } catch (e) {
    console.error('Failed to start floating overlay:', e);
    return false;
  }
}

/**
 * Stop the floating overlay service
 */
export async function stopFloatingOverlay(): Promise<void> {
  if (!isNativeApp()) return;
  
  try {
    console.log('Stopping floating overlay service...');
    // FloatingOverlayPlugin.stop()
    await disableBackgroundMode();
  } catch (e) {
    console.error('Failed to stop floating overlay:', e);
  }
}

/**
 * Set up app lifecycle listeners for background handling
 */
export function setupAppLifecycleListeners(): void {
  if (!isNativeApp()) return;

  App.addListener('appStateChange', ({ isActive }) => {
    const settings = getFloatingOverlaySettings();
    
    if (!isActive && settings.enabled && settings.overlayPermissionGranted) {
      // App went to background - start floating overlay if enabled
      startFloatingOverlay();
    } else if (isActive) {
      // App came to foreground - could stop overlay or keep it
      // Depending on user preference
    }
  });
}
