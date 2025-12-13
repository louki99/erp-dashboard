/**
 * Can Component
 * Conditionally render children based on permissions
 */

import type { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { PermissionCheck, PermissionCheckOptions } from '@/types/rbac.types';

interface CanProps {
    permission: PermissionCheck;
    options?: PermissionCheckOptions;
    children: ReactNode;
    fallback?: ReactNode;
}

export function Can({ permission, options, children, fallback = null }: CanProps) {
    const { can } = usePermissions();

    if (!can(permission, options)) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

interface CannotProps {
    permission: PermissionCheck;
    options?: PermissionCheckOptions;
    children: ReactNode;
}

export function Cannot({ permission, options, children }: CannotProps) {
    const { can } = usePermissions();

    if (can(permission, options)) {
        return null;
    }

    return <>{children}</>;
}
