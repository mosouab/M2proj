import { t } from '../i18n';
import { toAppError, type AppError } from '../lib/errors';
import { toast } from './toast';

export type RunResult<T> = { ok: true; value: T } | { ok: false; error: AppError };

let onAuthLost: () => void = () => {};

export function setAuthLostHandler(fn: () => void): void {
  onAuthLost = fn;
}

/** Runs a data call; shows a translated toast on failure, sends the user to login if the session is gone. */
export async function run<T>(fn: () => Promise<T>): Promise<RunResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    console.error(e);
    const error = toAppError(e);
    if (error.code === 'auth') onAuthLost();
    else toast(t(`error.${error.code}`), 'error');
    return { ok: false, error };
  }
}
