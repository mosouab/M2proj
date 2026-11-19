import type { Role } from '../lib/auth';
import type { Category, Item, Member, Task } from '../lib/types';

export interface AppState {
  role: Role;
  meId: string | null;
  members: Member[];
  categories: Category[];
  tasks: Task[];
  items: Item[];
}

export const state: AppState = { role: null, meId: null, members: [], categories: [], tasks: [], items: [] };

export function memberName(id: string | null): string {
  if (!id) return '';
  return state.members.find((m) => m.id === id)?.name ?? '?';
}
