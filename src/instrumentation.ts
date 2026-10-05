export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.NEXT_PHASE !== 'phase-production-build'
  ) {
    const { startConcertScheduler } = await import('./server/scheduler');
    startConcertScheduler();
  }
}
