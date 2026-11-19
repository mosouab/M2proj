import { createClient } from '@supabase/supabase-js';
import { AUTH_STORAGE_KEY } from './constants';

const env = import.meta.env;

if (!env.PUBLIC_SUPABASE_URL || !env.PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('M2proj: PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY are missing (see README → Setup).');
}

export const config = {
  teamEmail: env.PUBLIC_TEAM_EMAIL,
  adminEmail: env.PUBLIC_ADMIN_EMAIL,
};

export const db = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: AUTH_STORAGE_KEY },
});
