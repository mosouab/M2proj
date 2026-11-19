export type ErrorCode =
  | 'bad-password'
  | 'auth'
  | 'network'
  | 'not-allowed'
  | 'too-big'
  | 'bad-url'
  | 'category-not-empty'
  | 'rate-limited'
  | 'unknown';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'AppError';
  }
}

interface ErrorLike {
  code?: unknown;
  status?: unknown;
  message?: unknown;
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const err = (e ?? {}) as ErrorLike;
  const message = String(err.message ?? '');
  const code = String(err.code ?? '');
  const status = Number(err.status ?? 0);

  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return new AppError('network', message);
  }
  if (status === 429) return new AppError('rate-limited', message);
  if (code === 'PGRST301' || code === 'PGRST303' || status === 401 || /jwt expired|invalid jwt|refresh token/i.test(message)) {
    return new AppError('auth', message);
  }
  if (code === '42501' || status === 403 || /row-level security/i.test(message)) {
    return new AppError('not-allowed', message);
  }
  return new AppError('unknown', message);
}

/** RLS makes forbidden UPDATE/DELETE affect 0 rows without an error; call with `.select()` results. */
export function requireRows<T>(data: T[] | null): T[] {
  if (!data || data.length === 0) throw new AppError('not-allowed');
  return data;
}
