import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/styles/app.css', import.meta.url), 'utf8');

/** Rules inside every `@media (max-width: 560px) { ... }` block, flattened. */
function phoneRules(): string {
  const out: string[] = [];
  const re = /@media \(max-width: 560px\) \{/g;
  for (let m = re.exec(css); m; m = re.exec(css)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (depth > 0 && i < css.length) {
      if (css[i] === '{') depth++;
      if (css[i] === '}') depth--;
      i++;
    }
    out.push(css.slice(start, i - 1));
  }
  return out.join('\n');
}

describe('phone stylesheet', () => {
  it('keeps every form control at 16px so iOS Safari does not zoom the page on focus', () => {
    const rule = phoneRules()
      .split('}')
      .find((r) => /font-size:\s*16px/.test(r));
    expect(rule, 'no 16px font-size rule in the 560px media query').toBeDefined();
    for (const selector of ["input[type='text']", "input[type='password']", "input[type='date']", 'textarea', 'select', '.card .move']) {
      expect(rule, selector).toContain(selector);
    }
  });
});
