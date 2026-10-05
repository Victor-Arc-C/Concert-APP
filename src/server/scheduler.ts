import { automaticConcertChecks } from './env';
import { runConcertChecks } from './jobs';
const state = globalThis as typeof globalThis & { encoreTimer?: ReturnType<typeof setInterval> };
export function startConcertScheduler() {
  if (!automaticConcertChecks() || state.encoreTimer) return;
  const tick = () => {
    void runConcertChecks().catch(() => {
      console.warn('Concert checks could not finish; the next scheduled check will retry.');
    });
  };
  state.encoreTimer = setInterval(tick, 5 * 60 * 1000);
  state.encoreTimer.unref();
  // Start shortly after boot without delaying server readiness.
  setTimeout(tick, 15000).unref();
}
