import type { SupabaseClient } from '@supabase/supabase-js';
import { requireRows } from './errors';
import { planMove } from './transitions';
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
