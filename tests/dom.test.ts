// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { h } from '../src/ui/dom';

describe('h', () => {
  it('renders strings as text, never as HTML', () => {
    const el = h('p', {}, '<img src=x onerror=alert(1)>');
    expect(el.children).toHaveLength(0);
    expect(el.textContent).toBe('<img src=x onerror=alert(1)>');
  });
  it('skips false/null/undefined attributes and sets true as empty', () => {
    const el = h('button', { disabled: true, hidden: false, title: null, 'data-x': undefined });
    expect(el.hasAttribute('disabled')).toBe(true);
    expect(el.hasAttribute('hidden')).toBe(false);
    expect(el.hasAttribute('title')).toBe(false);
  });
  it('attaches event handlers', () => {
    const onClick = vi.fn();
    const el = h('button', { onclick: onClick });
    el.click();
    expect(onClick).toHaveBeenCalledOnce();
  });
  it('flattens arrays and skips empty children', () => {
    const el = h('ul', {}, [h('li', {}, 'a'), null, false], undefined, h('li', {}, 'b'), 3);
    expect(el.textContent).toBe('ab3');
  });
});
