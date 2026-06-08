/**
 * Database adapter type definitions.
 * All query results are typed at the call site via explicit casts,
 * keeping the low-level adapter flexible while routes stay type-safe.
 */

export type SQLParams = (string | number | boolean | null | Buffer)[];

export interface PreparedStatement {
  get: (...args: SQLParams) => Promise<unknown>;
  all: (...args: SQLParams) => Promise<unknown[]>;
  run: (...args: SQLParams) => Promise<unknown>;
}

/** Passed to `db.transaction(async (tx) => { ... })` callbacks */
export type TransactionClient = {
  exec: (sql: string) => Promise<unknown> | unknown;
  prepare: (sql: string) => PreparedStatement;
};

export interface DbAdapter {
  exec: (sql: string) => Promise<unknown> | unknown;
  prepare: (sql: string) => PreparedStatement;
  transaction: (fn: (txDb: TransactionClient) => Promise<void>) => Promise<void>;
}

export interface MigrationDb {
  prepare?: (sql: string) => { run: (...args: SQLParams) => unknown };
  exec: (sql: string) => Promise<unknown> | unknown;
}

export interface RateLimitRecord {
  key: string;
  count: number;
  window_start: number;
}
