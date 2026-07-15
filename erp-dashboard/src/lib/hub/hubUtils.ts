import type { User } from '@/context/AuthContext';
import { QUICK_ACTIONS_BY_ROLE, BUSINESS_DOMAINS, type HubRole, type QuickAction, type BusinessDomain } from './hubData';

// ─── Permission Helpers ───────────────────────────────────────────────────────

function isAdminUser(user: User | null, roles: string[]): boolean {
    return !!(user?.can?.is_root || roles.includes('admin') || roles.includes('root'));
}

/**
 * Returns a copy of `domain` with processes and actions filtered to what
 * `permissions` / `roles` allow. Admins always see everything.
 */
export function filterDomainContent(
    domain: BusinessDomain,
    permissions: string[],
    roles: string[],
    user: User | null = null,
): BusinessDomain {
    if (isAdminUser(user, roles)) return domain;

    const filteredProcesses = domain.processes
        .filter(p => {
            if (p.requiredRole?.length && !p.requiredRole.some(r => roles.includes(r))) return false;
            if (p.permission && !permissions.includes(p.permission)) return false;
            return true;
        })
        .map(p => ({
            ...p,
            actions: p.actions.filter(a => !a.permission || permissions.includes(a.permission)),
        }));

    return { ...domain, processes: filteredProcesses };
}

// ─── Role Detection ────────────────────────────────────────────────────────────

export function detectUserRole(user: User | null): HubRole {
    if (!user) return 'management';

    const primary = user.roles?.primary?.toLowerCase() ?? '';

    if (primary === 'dispatcher') return 'dispatcher';
    if (primary === 'magasinier') return 'magasinier';
    if (primary === 'adv') return 'finance';
    if (primary === 'routing') return 'management';

    if (user.can?.is_root || primary === 'root') return 'admin';
    if (primary === 'admin') return 'admin';

    if (user.can?.access_adv) return 'finance';
    if (user.can?.access_dispatcher) return 'dispatcher';
    if (user.can?.access_magasinier) return 'magasinier';

    return 'management';
}

// ─── Quick Actions ─────────────────────────────────────────────────────────────

export function getQuickActions(role: HubRole, permissions: string[] = []): QuickAction[] {
    const actions = QUICK_ACTIONS_BY_ROLE[role] ?? QUICK_ACTIONS_BY_ROLE.management;
    if (!permissions.length) return actions;
    return actions.filter(a => !a.permission || permissions.includes(a.permission));
}

// ─── Domain Filtering by Role ─────────────────────────────────────────────────

export function getVisibleDomains(user: User | null, permissions: string[], roles: string[]): BusinessDomain[] {
    if (!user) return [];

    const isAdmin = user.can?.is_root || roles.includes('admin') || roles.includes('root');

    return BUSINESS_DOMAINS.filter(domain => {
        if (isAdmin) return true;

        if (domain.requiredRole) {
            return domain.requiredRole.some(r => roles.includes(r));
        }

        if (domain.permission) {
            return permissions.includes(domain.permission);
        }

        return true;
    });
}

// ─── Greeting ─────────────────────────────────────────────────────────────────

export function getGreeting(name: string | undefined): string {
    const hour = new Date().getHours();
    const firstName = name?.split(' ')[0] ?? 'là';

    if (hour < 12) return `Bonjour, ${firstName}`;
    if (hour < 18) return `Bon après-midi, ${firstName}`;
    return `Bonsoir, ${firstName}`;
}

// ─── Role Label ────────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<HubRole, string> = {
    admin: 'Administrateur',
    dispatcher: 'Dispatcher',
    magasinier: 'Magasinier',
    finance: 'ADV / Finance',
    management: 'Management',
    sales: 'Commercial',
};

export function getRoleLabel(role: HubRole): string {
    return ROLE_LABELS[role] ?? 'Utilisateur';
}

// ─── Active domain from pathname ──────────────────────────────────────────────

export function getActiveDomainFromPath(pathname: string): string | null {
    const map: Record<string, string> = {
        // DISPATCHER workspace
        '/dispatcher':               'dispatcher',
        '/routing':                  'dispatcher',
        // ADV workspace
        '/partners':                 'adv',
        '/orders':                   'adv',
        '/promotions':               'adv',
        '/pricing':                  'adv',
        '/adv':                      'adv',
        '/finance':                  'adv',
        '/reporting':                'adv',
        '/document-studio':          'adv',
        '/products':                 'adv',
        // MAGASINIER workspace
        '/magasinier':               'magasinier',
        '/stock':                    'magasinier',
        '/import-export':            'magasinier',
        // ADMINISTRATION workspace
        '/rbac':                     'administration',
        '/settings':                 'administration',
        '/custom-fields':            'administration',
        '/workflows':                'administration',
        '/data-rules':               'administration',
        '/token-series':             'administration',
        '/device-keys':              'administration',
        '/translations':             'administration',
    };

    for (const [prefix, domain] of Object.entries(map)) {
        if (pathname.startsWith(prefix)) return domain;
    }

    return null;
}
