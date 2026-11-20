import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from './errors';

export type Role = 'team' | 'admin' | null;

export function roleOf(user: { app_metadata?: Record<string, unknown> } | null | undefined): Role {
  const role = user?.app_metadata?.m2proj_role;
  return role === 'team' || role === 'admin' ? role : null;
}

/** The member the admin account picked once; stored on the account so every device knows it's the same person. */
export function adminMemberOf(user: { user_metadata?: Record<string, unknown> } | null | undefined): string | null {
  const id = user?.user_metadata?.m2proj_member;
  return typeof id === 'string' ? id : null;
}

export async function currentAdminMember(db: SupabaseClient): Promise<string | null> {
  const { data } = await db.auth.getSession();
  return adminMemberOf(data.session?.user);
}

export async function rememberAdminMember(db: SupabaseClient, memberId: string): Promise<void> {
  const { error } = await db.auth.updateUser({ data: { m2proj_member: memberId } });
  if (error) throw error;
}

export async function currentRole(db: SupabaseClient): Promise<Role> {
  const { data } = await db.auth.getSession();
  return roleOf(data.session?.user);
}

export async function signIn(db: SupabaseClient, email: string, password: string): Promise<'team' | 'admin'> {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    if (/invalid login credentials/i.test(error.message)) throw new AppError('bad-password');
    throw error;
  }
  const role = roleOf(data.user);
  if (!role) {
    await signOut(db);
    throw new AppError('not-allowed');
  }
  return role;
}

/** Local only: the team shares one account, a global sign-out would log everybody out. */
export async function signOut(db: SupabaseClient): Promise<void> {
  await db.auth.signOut({ scope: 'local' });
}
