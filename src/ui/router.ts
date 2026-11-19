import type { Role } from '../lib/auth';

export type Route = 'board' | 'files' | 'admin';

export function parseRoute(hash: string, role: Role): Route {
  const route = hash.replace(/^#/, '');
  if (route === 'files') return 'files';
  if (route === 'admin' && role === 'admin') return 'admin';
  return 'board';
}
