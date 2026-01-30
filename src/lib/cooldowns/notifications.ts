import { toast } from 'sonner';
import { CooldownSettings } from './types';

/**
 * Request notification permission from the browser
 * @returns The permission status
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported in this browser');
    return 'denied';
  }
  
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  
  if (Notification.permission === 'denied') {
    return 'denied';
  }
  
  // Request permission
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return 'denied';
  }
}

/**
 * Send a browser push notification when a cooldown is ready
 * Also shows an in-app toast
 */
export async function sendCooldownReadyNotification(abilityName: string): Promise<void> {
  // Always show in-app toast
  toast.success(`⚡ ${abilityName} is ready!`, {
    duration: 5000,
    icon: '⚡',
  });
  
  // Send browser notification if permitted
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('Odyssey Assassin', {
        body: `⚡ ${abilityName} is ready!`,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: `cooldown-${abilityName.toLowerCase().replace(/\s+/g, '-')}`,
        requireInteraction: false,
        silent: false,
      });
    } catch (error) {
      console.warn('Failed to show notification:', error);
    }
  }
}

/**
 * Play a sound effect when a cooldown completes
 * Gracefully handles autoplay blocks
 */
export async function playCooldownReadySound(settings: CooldownSettings): Promise<void> {
  if (!settings.soundEffects) return;
  
  try {
    // Use a simple tone instead of a file (more reliable)
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create a simple "ready" chime
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Two-tone chime
    oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
    oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
    
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    // Fail silently if audio is blocked
    console.warn('Audio playback blocked:', error);
  }
}

/**
 * Format remaining time for display based on settings
 */
export function formatRemainingTime(
  seconds: number,
  format: CooldownSettings['timeFormat'] = 'mm:ss'
): string {
  if (seconds <= 0) return 'Ready';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  switch (format) {
    case 'descriptive':
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
      } else {
        return `${secs}s`;
      }
    
    case 'short':
      if (hours > 0) {
        return `${hours}h`;
      } else if (minutes > 0) {
        return `${minutes}m`;
      } else {
        return `${secs}s`;
      }
    
    case 'mm:ss':
    default:
      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

/**
 * Format session duration for display
 */
export function formatSessionDuration(
  startTime: number | null,
  pausedTime: number = 0
): string {
  if (!startTime) return '0:00';
  
  const now = Date.now();
  const totalMs = now - startTime - pausedTime;
  const totalSeconds = Math.floor(totalMs / 1000);
  
  return formatRemainingTime(totalSeconds, 'descriptive');
}
