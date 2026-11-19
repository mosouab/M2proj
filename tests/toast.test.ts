// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { toast } from '../src/ui/toast';

afterEach(() => {
  document.body.replaceChildren();
});

describe('toast', () => {
  it('shows the message on the page when no modal is open', () => {
    toast('saved');
    expect(document.querySelector('body > .toasts .toast')?.textContent).toBe('saved');
  });
  it('shows errors inside an open modal so they are not hidden behind it', () => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.append(dialog);
    toast('upload failed', 'error');
    expect(dialog.querySelector('.toast.error')?.textContent).toBe('upload failed');
  });
});
