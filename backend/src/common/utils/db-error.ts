/** Minimal shape of a PostgreSQL / NativeCommandError object. */
export interface PgError {
  code?: string;
  message?: string;
  detail?: string;
  constraint?: string;
}

/** Safely cast an unknown thrown value to PgError for code/message inspection. */
export function asPgError(err: unknown): PgError {
  if (err !== null && typeof err === 'object') return err as PgError;
  return {};
}
