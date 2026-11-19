// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { renderPicker } from '../src/ui/picker-view';

const noop = () => {};

describe('renderPicker', () => {
  it('lets the admin add a name when there are no members yet (first login)', () => {
    const root = document.createElement('div');
    renderPicker(root, { members: [], canAdd: true, onPick: noop, onAdd: async () => {} });
    expect(root.querySelector('form input')).not.toBeNull();
  });
  it('shows the team a message and no form when there are no members', () => {
    const root = document.createElement('div');
    renderPicker(root, { members: [], canAdd: false, onPick: noop, onAdd: async () => {} });
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('.picker-empty')).not.toBeNull();
  });
  it('sends the trimmed name to onAdd', async () => {
    const root = document.createElement('div');
    const onAdd = vi.fn(async () => {});
    renderPicker(root, { members: [], canAdd: true, onPick: noop, onAdd });
    const input = root.querySelector('form input') as HTMLInputElement;
    input.value = '  Mo  ';
    root.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await Promise.resolve();
    expect(onAdd).toHaveBeenCalledWith('Mo');
  });
  it('picks a member by clicking their name', () => {
    const root = document.createElement('div');
    const onPick = vi.fn();
    renderPicker(root, { members: [{ id: 'a', name: 'Léa', active: true }], canAdd: false, onPick, onAdd: async () => {} });
    (root.querySelector('.picker button') as HTMLButtonElement).click();
    expect(onPick).toHaveBeenCalledWith('a');
  });
});
