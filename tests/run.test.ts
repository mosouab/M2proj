// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translate } from '../src/i18n';
import { run, setAuthLostHandler, setSessionCheck } from '../src/ui/run';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  document.body.replaceChildren();
  setSessionCheck(async () => true);
  vi.restoreAllMocks();
});

describe('run', () => {
  it('treats "permission denied" as a lost session when the session is gone (revoked or expired)', async () => {
    const lost = vi.fn();
    setAuthLostHandler(lost);
    setSessionCheck(async () => false);
    const r = await run(() => Promise.reject({ code: '42501', message: 'permission denied for table tasks' }));
    expect(r.ok).toBe(false);
    expect(lost).toHaveBeenCalledOnce();
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('keeps "only the admin can do that" for a real permission error while logged in', async () => {
    const lost = vi.fn();
    setAuthLostHandler(lost);
    setSessionCheck(async () => true);
    await run(() => Promise.reject({ code: '42501', message: 'permission denied for table tasks' }));
    expect(lost).not.toHaveBeenCalled();
    const text = document.querySelector('.toast.error')?.textContent;
    expect([translate('fr', 'error.not-allowed'), translate('en', 'error.not-allowed')]).toContain(text);
  });
});
