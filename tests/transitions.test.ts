import { describe, expect, it } from 'vitest';
import { groupByStatus, isLate, planMove, sortColumn, STATUSES, todayLocal } from '../src/lib/transitions';
import type { Status, Task } from '../src/lib/types';

const NOW = '2026-11-19T10:00:00.000Z';
const ME = 'me-id';
const SAMI = 'sami-id';

function task(over: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'T',
    description: '',
    deadline: null,
    status: 'waiting',
    taken_by: null,
    created_by: SAMI,
    created_at: '2026-11-01T00:00:00+00:00',
    updated_at: '2026-11-01T00:00:00+00:00',
    finished_at: null,
    ...over,
  };
}

const VALID: Record<Status, Task> = {
  waiting: task(),
  taken: task({ status: 'taken', taken_by: SAMI }),
  finished: task({ status: 'finished', taken_by: SAMI, finished_at: '2026-11-10T00:00:00+00:00' }),
};

describe('planMove', () => {
  it('returns null when the status does not change', () => {
    expect(planMove(VALID.waiting, 'waiting', ME, NOW)).toBeNull();
  });

  it('waiting → taken assigns me', () => {
    expect(planMove(VALID.waiting, 'taken', ME, NOW)).toEqual({
      from: 'waiting',
      to: 'taken',
      patch: { status: 'taken', taken_by: ME },
    });
  });

  it('waiting → finished assigns me and stamps finished_at', () => {
    expect(planMove(VALID.waiting, 'finished', ME, NOW)?.patch).toEqual({
      status: 'finished',
      taken_by: ME,
      finished_at: NOW,
    });
  });

  it('taken → finished keeps the owner', () => {
    expect(planMove(VALID.taken, 'finished', ME, NOW)?.patch).toEqual({ status: 'finished', finished_at: NOW });
  });

  it('taken → waiting gives the task back', () => {
    expect(planMove(VALID.taken, 'waiting', ME, NOW)?.patch).toEqual({ status: 'waiting', taken_by: null });
  });

  it('finished → waiting clears owner and finished_at', () => {
    expect(planMove(VALID.finished, 'waiting', ME, NOW)?.patch).toEqual({
      status: 'waiting',
      taken_by: null,
      finished_at: null,
    });
  });

  it('finished → taken keeps the previous owner', () => {
    expect(planMove(VALID.finished, 'taken', ME, NOW)?.patch).toEqual({
      status: 'taken',
      taken_by: SAMI,
      finished_at: null,
    });
  });

  it('finished → taken assigns me when the owner is missing', () => {
    expect(planMove({ status: 'finished', taken_by: null }, 'taken', ME, NOW)?.patch.taken_by).toBe(ME);
  });

  it('the guard is always the status the client saw', () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        if (from !== to) expect(planMove(VALID[from], to, ME, NOW)?.from).toBe(from);
      }
    }
  });

  it('every move keeps the database invariants (waiting ⇔ no owner, finished ⇔ finished_at)', () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        const plan = planMove(VALID[from], to, ME, NOW);
        if (!plan) continue;
        const after = { ...VALID[from], ...plan.patch };
        expect(after.status === 'waiting', `${from}→${to}`).toBe(after.taken_by === null);
        expect(after.status === 'finished', `${from}→${to}`).toBe(after.finished_at !== null);
      }
    }
  });
});

describe('isLate', () => {
  const today = '2026-11-19';
  it('is late when the deadline was yesterday and the task is open', () => {
    expect(isLate({ deadline: '2026-11-18', status: 'waiting' }, today)).toBe(true);
    expect(isLate({ deadline: '2026-11-18', status: 'taken' }, today)).toBe(true);
  });
  it('is not late on the deadline day itself', () => {
    expect(isLate({ deadline: '2026-11-19', status: 'waiting' }, today)).toBe(false);
  });
  it('is never late without a deadline', () => {
    expect(isLate({ deadline: null, status: 'waiting' }, today)).toBe(false);
  });
  it('is never late once finished', () => {
    expect(isLate({ deadline: '2026-01-01', status: 'finished' }, today)).toBe(false);
  });
});

describe('todayLocal', () => {
  it('formats the local calendar date, not the UTC one', () => {
    expect(todayLocal(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

describe('sortColumn / groupByStatus', () => {
  it('sorts open tasks by deadline, no deadline last, then by creation', () => {
    const tasks = [
      task({ id: 'none', deadline: null }),
      task({ id: 'late', deadline: '2026-12-01' }),
      task({ id: 'soon-b', deadline: '2026-11-20', created_at: '2026-11-02T00:00:00+00:00' }),
      task({ id: 'soon-a', deadline: '2026-11-20', created_at: '2026-11-01T00:00:00+00:00' }),
      task({ id: 'other', status: 'taken', taken_by: SAMI }),
    ];
    expect(sortColumn(tasks, 'waiting').map((t) => t.id)).toEqual(['soon-a', 'soon-b', 'late', 'none']);
  });

  it('sorts finished tasks newest first', () => {
    const tasks = [
      task({ id: 'old', status: 'finished', taken_by: SAMI, finished_at: '2026-11-01T00:00:00+00:00' }),
      task({ id: 'new', status: 'finished', taken_by: SAMI, finished_at: '2026-11-15T00:00:00+00:00' }),
    ];
    expect(sortColumn(tasks, 'finished').map((t) => t.id)).toEqual(['new', 'old']);
  });

  it('puts every task in exactly one column', () => {
    const groups = groupByStatus([VALID.waiting, VALID.taken, VALID.finished]);
    expect(groups.waiting).toHaveLength(1);
    expect(groups.taken).toHaveLength(1);
    expect(groups.finished).toHaveLength(1);
  });
});
