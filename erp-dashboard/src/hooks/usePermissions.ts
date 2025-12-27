/**
 * usePermissions Hook
 * React hook for permission checking
 */

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
    can,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    hasAllRoles,
    isAdmin,
    canAccessRoute,
    canBulkAction,
} from '@/lib/rbac/rbac.utils';
import type { PermissionCheck, PermissionCheckOptions } from '@/types/rbac.types';

export function usePermissions() {
    const { user } = useAuth();

    const permissions = useMemo(() => {
        const perms = user?.permissions?.effective || [];
        if (import.meta.env.DEV && perms.length > 0) {
            console.log('📋 Loaded permissions:', perms.length);
        }
        return perms;
    }, [user]);

    const roles = useMemo(() => {
        return user?.roles?.all || [];
    }, [user]);

    const blacklist = useMemo(() => {
        return user?.permissions?.blacklisted || [];
    }, [user]);

    const isRoot = useMemo(() => {
        return user?.can?.is_root || false;
    }, [user]);

    // Main permission check function
    const checkPermission = useCallback(
        (check: PermissionCheck, options?: PermissionCheckOptions): boolean => {
            // Root users have all permissions
            if (isRoot) return true;

            return can(permissions, check, {
                ...options,
                checkBlacklist: options?.checkBlacklist ?? false,
            });
        },
        [permissions, isRoot]
    );

    // Check single permission
    const has = useCallback(
        (permission: string): boolean => {
            if (isRoot) return true;
            return hasPermission(permissions, permission, blacklist);
        },
        [permissions, blacklist, isRoot]
    );

    // Check any permission
    const hasAny = useCallback(
        (permissionList: string[]): boolean => {
            if (isRoot) return true;
            return hasAnyPermission(permissions, permissionList, blacklist);
        },
        [permissions, blacklist, isRoot]
    );

    // Check all permissions
    const hasAll = useCallback(
        (permissionList: string[]): boolean => {
            if (isRoot) return true;
            return hasAllPermissions(permissions, permissionList, blacklist);
        },
        [permissions, blacklist, isRoot]
    );

    // Check role
    const hasRoleCheck = useCallback(
        (role: string): boolean => {
            if (isRoot) return true;
            return hasRole(roles, role);
        },
        [roles, isRoot]
    );

    // Check any role
    const hasAnyRoleCheck = useCallback(
        (roleList: string[]): boolean => {
            if (isRoot) return true;
            return hasAnyRole(roles, roleList);
        },
        [roles, isRoot]
    );

    // Check all roles
    const hasAllRolesCheck = useCallback(
        (roleList: string[]): boolean => {
            if (isRoot) return true;
            return hasAllRoles(roles, roleList);
        },
        [roles, isRoot]
    );

    // Check if admin
    const isAdminCheck = useCallback((): boolean => {
        return isAdmin(roles, isRoot);
    }, [roles, isRoot]);

    // Check route access
    const canAccessRouteCheck = useCallback(
        (routePermissions: string | string[] | undefined): boolean => {
            if (isRoot) return true;
            return canAccessRoute(permissions, routePermissions);
        },
        [permissions, isRoot]
    );

    // Check bulk action permission
    const canBulk = useCallback(
        (action: 'approve' | 'reject' | 'delete' | 'export'): boolean => {
            if (isRoot) return true;
            return canBulkAction(permissions, action);
        },
        [permissions, isRoot]
    );

    // Check if permission is blacklisted
    const isBlacklisted = useCallback(
        (permission: string): boolean => {
            return blacklist.includes(permission);
        },
        [blacklist]
    );

    // Get user capabilities
    const capabilities = useMemo(() => {
        return user?.can || {
            access_adv: false,
            validate_partners: false,
            manage_credit: false,
            approve_bc: false,
            bulk_approve_bc: false,
            access_dispatcher: false,
            access_magasinier: false,
            access_admin: false,
            is_root: false,
        };
    }, [user]);

    return {
        // Permission arrays
        permissions,
        roles,
        blacklist,
        isRoot,
        capabilities,

        // Check functions
        can: checkPermission,
        has,
        hasAny,
        hasAll,
        hasRole: hasRoleCheck,
        hasAnyRole: hasAnyRoleCheck,
        hasAllRoles: hasAllRolesCheck,
        isAdmin: isAdminCheck,
        canAccessRoute: canAccessRouteCheck,
        canBulk,
        isBlacklisted,

        // Convenience checks for common capabilities
        canAccessAdv: capabilities.access_adv,
        canValidatePartners: capabilities.validate_partners,
        canManageCredit: capabilities.manage_credit,
        canApproveBC: capabilities.approve_bc,
        canBulkApproveBC: capabilities.bulk_approve_bc,
        canAccessDispatcher: capabilities.access_dispatcher,
        canAccessMagasinier: capabilities.access_magasinier,
        canAccessAdmin: capabilities.access_admin,
    };
}
