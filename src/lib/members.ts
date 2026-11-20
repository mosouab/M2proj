import type { SupabaseClient } from '@supabase/supabase-js';
import type { Role } from './auth';
import { requireRows } from './errors';
import type { Member } from './types';

const COLS = 'id,name,active';

export async function listMembers(db: SupabaseClient): Promise<Member[]> {
  const { data, error } = await db.from('members').select(COLS).order('name');
  if (error) throw error;
  return data as Member[];
}

export async function addMember(db: SupabaseClient, name: string): Promise<Member> {
  const { data, error } = await db.from('members').insert({ name: name.trim() }).select(COLS).single();
  if (error) throw error;
  return data as Member;
}

export async function renameMember(db: SupabaseClient, id: string, name: string): Promise<void> {
  const { data, error } = await db.from('members').update({ name: name.trim() }).eq('id', id).select('id');
  if (error) throw error;
  requireRows(data);
}

export async function setMemberActive(db: SupabaseClient, id: string, active: boolean): Promise<void> {
  const { data, error } = await db.from('members').update({ active }).eq('id', id).select('id');
  if (error) throw error;
  requireRows(data);
}

/** The admin is always the same person: their saved member wins over whatever this browser picked last. */
export function chooseMember(role: Role, adminMember: string | null, stored: string | null, members: Member[]): string | null {
  if (role === 'admin') {
    const saved = pickValidMember(adminMember, members);
    if (saved) return saved;
  }
  return pickValidMember(stored, members);
}

export function pickValidMember(storedId: string | null, members: Member[]): string | null {
  return members.some((m) => m.id === storedId && m.active) ? storedId : null;
}
