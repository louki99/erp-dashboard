import type { User } from '@/context/AuthContext';

/**
 * Landing route for a user with no explicit "came from" page — e.g. root "/",
 * an unmatched route, or straight after login. Most roles land on the generic
 * /dashboard, but roles with no access to it (PERMISSIONS.DASHBOARD.VIEW isn't
 * granted to télévendeur) need their own home instead, or they bounce into
 * "Accès Refusé" every time.
 */
export function getDefaultRoute(user?: User | null): string {
    const roles = user?.roles?.all ?? [];
    const isAdmin = !!user?.can?.is_root || roles.includes('admin') || roles.includes('root');
    if (!isAdmin && roles.includes('televendeur')) return '/telesales/dashboard';
    return '/dashboard';
}
