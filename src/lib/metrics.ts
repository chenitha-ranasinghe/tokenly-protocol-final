import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

const register = new Registry();

const g = globalThis as unknown as { __tokenly_metrics_init?: boolean };
if (!g.__tokenly_metrics_init) {
  collectDefaultMetrics({ register, prefix: 'tokenly_' });
  g.__tokenly_metrics_init = true;
}

export const wisdomEngineCallsTotal = new Counter({
  name: 'tokenly_wisdom_engine_calls_total',
  help: 'Total Wisdom Engine invocations',
  labelNames: ['result'],
  registers: [register],
});

export const aiVisionConfidenceHistogram = new Histogram({
  name: 'tokenly_ai_vision_confidence',
  help: 'AI vision confidence scores (0-1)',
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  registers: [register],
});

export const apiRequestDurationSeconds = new Histogram({
  name: 'tokenly_api_request_duration_seconds',
  help: 'API route duration in seconds',
  labelNames: ['route', 'method', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const apiErrorsTotal = new Counter({
  name: 'tokenly_api_errors_total',
  help: 'API error responses',
  labelNames: ['route', 'code'],
  registers: [register],
});

export const activeDbConnections = new Counter({
  name: 'tokenly_db_pool_acquires_total',
  help: 'Times a DB client was checked out from the pool',
  registers: [register],
});

export function getMetricsRegister(): Registry {
  return register;
}
