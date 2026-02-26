/**
 * VAPID public key for Web Push subscription.
 * Generated via the vapid-setup edge function.
 * This is a PUBLIC key — safe to include in client code.
 */
export const VAPID_PUBLIC_KEY = 'BFHR7XKLP5Yu7-WEZkbcW06XI53kBMnROx-MxymTjG-ZsM8PQ-ilPuLwO9QxJYO32ZpQytBaDQC10omcNqihGx4';

/**
 * Convert a URL-safe base64 string to a Uint8Array.
 * Required by PushManager.subscribe() for applicationServerKey.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
