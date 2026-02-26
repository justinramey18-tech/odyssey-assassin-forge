/**
 * @deprecated Use useOneSignal instead. This hook is kept as a no-op shim
 * so existing imports don't break during migration.
 */
export function usePushSubscription() {
  return {
    subscribe: async () => true,
    unsubscribe: async () => {},
    isSubscribed: true,
  };
}
