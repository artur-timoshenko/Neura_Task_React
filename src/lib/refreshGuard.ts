/**
 * Small helper that keeps background refreshes cheap:
 * - collapses bursts (focus + visibilitychange fire together) into one request
 * - polls rarely while the realtime channel is healthy, often when it is not
 */
export function createRefreshGuard(
  fetchFn: () => void | Promise<void>,
  minIntervalMs = 10_000,
  // Treat the data as just-fetched (mount already loaded it) so the first
  // SUBSCRIBED/focus event does not immediately duplicate that request.
  primed = false,
) {
  let last = primed ? Date.now() : 0;
  return async (force = false) => {
    const now = Date.now();
    if (!force && now - last < minIntervalMs) return;
    last = now;
    await fetchFn();
  };
}

export const POLL_HEALTHY_MS = 120_000;
export const POLL_DEGRADED_MS = 20_000;
