import { t } from '../i18n';
import { AppError, toAppError } from '../lib/errors';
import { toast } from './toast';

export type RunResult<T> = { ok: true; value: T } | { ok: false; error: AppError };

let onAuthLost: () => void = () => {};
let hasSession: () => Promise<boolean> = async () => true;

export function setAuthLostHandler(fn: () => void): void {
  onAuthLost = fn;
}

/** How run() tells a real "admin only" refusal from a dead session (which makes requests anonymous). */
export function setSessionCheck(fn: () => Promise<boolean>): void {
  hasSession = fn;
}

/** Runs a data call; shows a translated toast on failure, sends the user to login if the session is gone. */
export async function run<T>(fn: () => Promise<T>): Promise<RunResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    console.error(e);
    let error = toAppError(e);
    if (error.code === 'not-allowed' && !(await hasSession().catch(() => true))) {
      error = new AppError('auth', error.message);
    }
    if (error.code === 'auth') onAuthLost();
    else toast(t(`error.${error.code}`), 'error');
    return { ok: false, error };
  }
}
