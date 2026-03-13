let lastCheck = 0;
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export async function checkForUpdate(force = false): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  if (!force && Date.now() - lastCheck < CHECK_INTERVAL) return false;
  lastCheck = Date.now();

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;

    await registration.update();

    if (registration.waiting) {
      // New version is ready — activate and reload
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
      return true;
    }
  } catch (err) {
    console.warn('[AutoUpdate] Check failed:', err);
  }
  return false;
}
