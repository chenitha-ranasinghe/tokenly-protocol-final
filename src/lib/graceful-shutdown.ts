import 'server-only';

import { closeDb } from '@/lib/db';
import { logger } from '@/lib/logger';

/** Register SIGTERM / SIGINT — Node server only (not Edge). */
export function attachGracefulShutdownHooks(): void {
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'graceful_shutdown_start');
    try {
      await closeDb();
    } catch (e) {
      logger.error({ err: e }, 'graceful_shutdown_db_error');
    }
    logger.info({ signal }, 'graceful_shutdown_complete');
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
