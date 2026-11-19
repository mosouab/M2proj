import type { Status, Task } from './types';

export const STATUSES: readonly Status[] = ['waiting', 'taken', 'finished'];

export type MovePatch = Partial<Pick<Task, 'status' | 'taken_by' | 'finished_at'>>;

export interface MovePlan {
  /** Status the client saw; the update only applies if the row still has it. */
  from: Status;
  to: Status;
  patch: MovePatch;
}

export function planMove(
  task: Pick<Task, 'status' | 'taken_by'>,
  to: Status,
  me: string,
  nowIso: string,
): MovePlan | null {
  const from = task.status;
  if (from === to) return null;
  const plan = (patch: MovePatch): MovePlan => ({ from, to, patch });
  switch (`${from}>${to}`) {
    case 'waiting>taken':
      return plan({ status: 'taken', taken_by: me });
    case 'waiting>finished':
      return plan({ status: 'finished', taken_by: me, finished_at: nowIso });
    case 'taken>finished':
      return plan({ status: 'finished', finished_at: nowIso });
    case 'taken>waiting':
      return plan({ status: 'waiting', taken_by: null });
    case 'finished>waiting':
      return plan({ status: 'waiting', taken_by: null, finished_at: null });
    case 'finished>taken':
      return plan({ status: 'taken', taken_by: task.taken_by ?? me, finished_at: null });
    default:
      return null;
  }
}

export function todayLocal(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function isLate(task: Pick<Task, 'deadline' | 'status'>, today: string): boolean {
  return task.deadline !== null && task.status !== 'finished' && task.deadline < today;
}

export function sortColumn(tasks: readonly Task[], status: Status): Task[] {
  const column = tasks.filter((t) => t.status === status);
  if (status === 'finished') {
    return column.sort((a, b) => (b.finished_at ?? '').localeCompare(a.finished_at ?? ''));
  }
  return column.sort((a, b) => {
    if (a.deadline !== b.deadline) {
      if (a.deadline === null) return 1;
      if (b.deadline === null) return -1;
      return a.deadline.localeCompare(b.deadline);
    }
    return a.created_at.localeCompare(b.created_at);
  });
}

export function groupByStatus(tasks: readonly Task[]): Record<Status, Task[]> {
  return {
    waiting: sortColumn(tasks, 'waiting'),
    taken: sortColumn(tasks, 'taken'),
    finished: sortColumn(tasks, 'finished'),
  };
}
