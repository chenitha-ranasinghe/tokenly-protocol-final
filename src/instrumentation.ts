/**
 * Next.js instrumentation — must stay Edge-safe at parse time.
 * Node-only shutdown hooks live in `@/lib/graceful-shutdown` and load only when
 * `NEXT_RUNTIME` is `nodejs`.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }
  const { attachGracefulShutdownHooks } = await import('@/lib/graceful-shutdown');
  attachGracefulShutdownHooks();
}
