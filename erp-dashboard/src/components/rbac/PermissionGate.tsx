/**
 * PermissionGate Component
 * Higher-order component for permission-based rendering
 */

import type { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionGateProps {
    children: ReactNode;
    permissions?: string | string[];
    roles?: string | string[];
    requireAll?: boolean;
    fallback?: ReactNode;
    onUnauthorized?: () => void;
}

export function PermissionGate({
    children,
    permissions,
    roles,
    requireAll = false,
    fallback = null,
    onUnauthorized,
}: PermissionGateProps) {
    const { hasAny, hasAll, hasAnyRole, hasAllRoles } = usePermissions();

    let hasAccess = true;

    // Check permissions
    if (permissions) {
        const permArray = Array.isArray(permissions) ? permissions : [permissions];
        hasAccess = requireAll ? hasAll(permArray) : hasAny(permArray);
    }

    // Check roles
    if (hasAccess && roles) {
        const roleArray = Array.isArray(roles) ? roles : [roles];
        hasAccess = requireAll ? hasAllRoles(roleArray) : hasAnyRole(roleArray);
    }

    if (!hasAccess) {
        if (onUnauthorized) {
            onUnauthorized();
        }
        return <>{fallback}</>;
    }

    return <>{children}</>;
}
