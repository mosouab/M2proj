import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError, requireRows } from './errors';
import type { Category } from './types';

const COLS = 'id,name,position';

export async function listCategories(db: SupabaseClient): Promise<Category[]> {
  const { data, error } = await db.from('categories').select(COLS).order('position').order('name');
  if (error) throw error;
  return data as Category[];
}

export async function addCategory(db: SupabaseClient, name: string, existing: Category[]): Promise<Category> {
  const position = existing.reduce((max, c) => Math.max(max, c.position), -1) + 1;
  const { data, error } = await db.from('categories').insert({ name: name.trim(), position }).select(COLS).single();
  if (error) throw error;
  return data as Category;
}

export async function renameCategory(db: SupabaseClient, id: string, name: string): Promise<void> {
  const { data, error } = await db.from('categories').update({ name: name.trim() }).eq('id', id).select('id');
  if (error) throw error;
  requireRows(data);
}

export async function swapCategoryPositions(db: SupabaseClient, a: Category, b: Category): Promise<void> {
  for (const [id, position] of [
    [a.id, b.position],
    [b.id, a.position],
  ] as const) {
    const { data, error } = await db.from('categories').update({ position }).eq('id', id).select('id');
    if (error) throw error;
    requireRows(data);
  }
}

export async function deleteCategory(db: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await db.from('categories').delete().eq('id', id).select('id');
  if (error) {
    if (error.code === '23503') throw new AppError('category-not-empty', error.message);
    throw error;
  }
  requireRows(data);
}
