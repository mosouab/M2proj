import type { SupabaseClient } from '@supabase/supabase-js';
import { requireRows } from './errors';
import { planAssign, planMove } from './transitions';
import type { Status, Task } from './types';

const COLS = 'id,title,description,deadline,status,taken_by,created_by,created_at,updated_at,finished_at';

export interface TaskFields {
  title: string;
  description: string;
  deadline: string | null;
}

export interface NewTask extends TaskFields {
  created_by: string;
}

export type MoveResult = { ok: true } | { ok: false; current: Task | null };

export async function listTasks(db: SupabaseClient): Promise<Task[]> {
  const { data, error } = await db.from('tasks').select(COLS);
  if (error) throw error;
  return data as Task[];
}

export async function createTask(db: SupabaseClient, input: NewTask): Promise<Task> {
  const { data, error } = await db.from('tasks').insert(input).select(COLS).single();
  if (error) throw error;
  return data as Task;
}

export async function updateTaskFields(db: SupabaseClient, id: string, fields: TaskFields): Promise<Task> {
  const { data, error } = await db.from('tasks').update(fields).eq('id', id).select(COLS);
  if (error) throw error;
  return requireRows(data)[0] as Task;
}

/** Conditional on the status the client saw: if someone moved it first, nothing changes and we return the current row. */
export async function moveTask(
  db: SupabaseClient,
  task: Task,
  to: Status,
  me: string,
  now: Date = new Date(),
): Promise<MoveResult> {
  const plan = planMove(task, to, me, now.toISOString());
  if (!plan) return { ok: true };
  const { data, error } = await db
    .from('tasks')
    .update(plan.patch)
    .eq('id', task.id)
    .eq('status', plan.from)
    .select('id');
  if (error) throw error;
  if (data && data.length > 0) return { ok: true };
  const { data: current, error: readError } = await db.from('tasks').select(COLS).eq('id', task.id).maybeSingle();
  if (readError) throw readError;
  return { ok: false, current: (current as Task | null) ?? null };
}

export async function deleteTask(db: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await db.from('tasks').delete().eq('id', id).select('id');
  if (error) throw error;
  requireRows(data);
}

export interface BulkResult {
  /** Tasks actually changed. */
  done: number;
  /** Tasks someone else changed since they were loaded; left as they are. */
  skipped: number;
}

/** Same rules as dragging, one task at a time; tasks already in `to` are left alone and not counted. */
export async function moveTasks(db: SupabaseClient, tasks: Task[], to: Status, me: string): Promise<BulkResult> {
  const result: BulkResult = { done: 0, skipped: 0 };
  for (const task of tasks) {
    if (task.status === to) continue;
    const r = await moveTask(db, task, to, me);
    if (r.ok) result.done++;
    else result.skipped++;
  }
  return result;
}

/** Make a task "taken" by a teammate, only if its status and owner are still what the client saw. */
export async function assignTask(db: SupabaseClient, task: Task, memberId: string): Promise<MoveResult> {
  const plan = planAssign(task, memberId);
  if (!plan) return { ok: true };
  let query = db.from('tasks').update(plan.patch).eq('id', task.id).eq('status', plan.from);
  query = plan.fromOwner === null ? query.is('taken_by', null) : query.eq('taken_by', plan.fromOwner);
  const { data, error } = await query.select('id');
  if (error) throw error;
  if (data && data.length > 0) return { ok: true };
  const { data: current, error: readError } = await db.from('tasks').select(COLS).eq('id', task.id).maybeSingle();
  if (readError) throw readError;
  return { ok: false, current: (current as Task | null) ?? null };
}

/** Tasks already taken by that teammate are left alone and not counted. */
export async function assignTasks(db: SupabaseClient, tasks: Task[], memberId: string): Promise<BulkResult> {
  const result: BulkResult = { done: 0, skipped: 0 };
  for (const task of tasks) {
    if (task.status === 'taken' && task.taken_by === memberId) continue;
    const r = await assignTask(db, task, memberId);
    if (r.ok) result.done++;
    else result.skipped++;
  }
  return result;
}

/** Admin only (RLS): the team gets "not allowed" because nothing is deleted. Returns how many were deleted. */
export async function deleteTasks(db: SupabaseClient, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { data, error } = await db.from('tasks').delete().in('id', ids).select('id');
  if (error) throw error;
  return requireRows(data).length;
}
