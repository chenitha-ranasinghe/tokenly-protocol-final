import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  base: { service: 'tokenly' },
});

export function withCorrelation(correlationId: string | undefined) {
  return correlationId ? logger.child({ correlationId }) : logger;
}
