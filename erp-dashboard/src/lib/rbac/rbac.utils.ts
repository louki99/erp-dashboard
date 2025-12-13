/**
 * RBAC Utility Functions
 * Core permission checking and validation logic
 */

import type { PermissionCheck, PermissionCheckOptions } from '@/types/rbac.types';

/**
 * Check if user has a specific permission
 */
export function hasPermission(
    userPermissions: string[],
    permission: string,
    checkBlacklist: string[] = []
): boolean {
    if (checkBlacklist.includes(permission)) {
        return false;
    }
    return userPermissions.includes(permission);
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(
    userPermissions: string[],
    permissions: string[],
    checkBlacklist: string[] = []
): boolean {
    return permissions.some(permission => 
        hasPermission(userPermissions, permission, checkBlacklist)
    );
}

/**
 * Check if user has all of the specified permissions
 */
export function hasAllPermissions(
    userPermissions: string[],
    permissions: string[],
    checkBlacklist: string[] = []
): boolean {
    return permissions.every(permission => 
        hasPermission(userPermissions, permission, checkBlacklist)
    );
}

/**
 * Universal permission checker
 * Supports string, array, or custom function checks
 */
export function can(
    userPermissions: string[],
    check: PermissionCheck,
    options: PermissionCheckOptions = {}
): boolean {
    const { requireAll = false, checkBlacklist = false } = options;
    const blacklist = checkBlacklist ? [] : []; // Get from context if needed

    // Function check
    if (typeof check === 'function') {
        return check(userPermissions);
    }

    // String check
    if (typeof check === 'string') {
        return hasPermission(userPermissions, check, blacklist);
    }

    // Array check
    if (Array.isArray(check)) {
        return requireAll
            ? hasAllPermissions(userPermissions, check, blacklist)
            : hasAnyPermission(userPermissions, check, blacklist);
    }

    return false;
}

/**
 * Check if user has a specific role
 */
export function hasRole(userRoles: string[], role: string): boolean {
    return userRoles.includes(role);
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(userRoles: string[], roles: string[]): boolean {
    return roles.some(role => userRoles.includes(role));
}

/**
 * Check if user has all of the specified roles
 */
export function hasAllRoles(userRoles: string[], roles: string[]): boolean {
    return roles.every(role => userRoles.includes(role));
}

/**
 * Check if user is admin (has admin role or is_root)
 */
export function isAdmin(userRoles: string[], isRoot: boolean = false): boolean {
    return isRoot || hasRole(userRoles, 'admin');
}

/**
 * Check if user can access a specific route
 */
export function canAccessRoute(
    userPermissions: string[],
    routePermissions: string | string[] | undefined
): boolean {
    if (!routePermissions) {
        return true; // No permissions required
    }

    if (typeof routePermissions === 'string') {
        return hasPermission(userPermissions, routePermissions);
    }

    // For array, user needs ANY of the permissions
    return hasAnyPermission(userPermissions, routePermissions);
}

/**
 * Filter permissions by category
 */
export function filterPermissionsByCategory(
    permissions: string[],
    category: string
): string[] {
    const prefix = `admin.${category}.`;
    return permissions.filter(p => p.startsWith(prefix));
}

/**
 * Group permissions by category and subcategory
 */
export function groupPermissions(permissions: string[]): Record<string, Record<string, string[]>> {
    const grouped: Record<string, Record<string, string[]>> = {};

    permissions.forEach(permission => {
        const parts = permission.split('.');
        if (parts.length < 3) return;

        const [prefix, category, ...rest] = parts;
        if (prefix !== 'admin') return;

        if (!grouped[category]) {
            grouped[category] = {};
        }

        const subcategory = rest[0] || 'general';
        if (!grouped[category][subcategory]) {
            grouped[category][subcategory] = [];
        }

        grouped[category][subcategory].push(permission);
    });

    return grouped;
}

/**
 * Get permission label from permission string
 */
export function getPermissionLabel(permission: string): string {
    const parts = permission.split('.');
    const action = parts[parts.length - 1];
    
    return action
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Check if permission is blacklisted
 */
export function isBlacklisted(
    permission: string,
    blacklist: string[]
): boolean {
    return blacklist.includes(permission);
}

/**
 * Get effective permissions (all permissions minus blacklisted)
 */
export function getEffectivePermissions(
    allPermissions: string[],
    blacklist: string[]
): string[] {
    return allPermissions.filter(p => !blacklist.includes(p));
}

/**
 * Validate permission format
 */
export function isValidPermissionFormat(permission: string): boolean {
    const pattern = /^[a-z]+(\.[a-z-]+)+$/;
    return pattern.test(permission);
}

/**
 * Get permission category
 */
export function getPermissionCategory(permission: string): string | null {
    const parts = permission.split('.');
    return parts.length >= 2 ? parts[1] : null;
}

/**
 * Get permission action
 */
export function getPermissionAction(permission: string): string | null {
    const parts = permission.split('.');
    return parts.length >= 2 ? parts[parts.length - 1] : null;
}

/**
 * Check if user can perform bulk actions
 */
export function canBulkAction(
    userPermissions: string[],
    action: 'approve' | 'reject' | 'delete' | 'export'
): boolean {
    const bulkPermissions = [
        `admin.adv.bc.bulk-${action}`,
        `admin.adv.bc.batch-${action}`,
    ];
    return hasAnyPermission(userPermissions, bulkPermissions);
}

/**
 * Debug helper: Log permission check
 */
export function debugPermissionCheck(
    userPermissions: string[],
    requiredPermission: string | string[],
    result: boolean
): void {
    if (import.meta.env.DEV) {
        console.group('🔐 Permission Check');
        console.log('Required:', requiredPermission);
        console.log('User has:', userPermissions.length, 'permissions');
        console.log('Result:', result ? '✅ ALLOWED' : '❌ DENIED');
        console.groupEnd();
    }
}
