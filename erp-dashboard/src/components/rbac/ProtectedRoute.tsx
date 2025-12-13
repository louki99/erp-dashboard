/**
 * ProtectedRoute Component
 * Route wrapper that checks permissions before rendering
 */

import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { AlertTriangle } from 'lucide-react';

interface ProtectedRouteProps {
    children: ReactNode;
    requiredPermission?: string | string[];
    requiredRole?: string | string[];
    requireAll?: boolean;
    fallbackPath?: string;
    showUnauthorized?: boolean;
}

export function ProtectedRoute({
    children,
    requiredPermission,
    requiredRole,
    requireAll = false,
    fallbackPath = '/unauthorized',
    showUnauthorized = true,
}: ProtectedRouteProps) {
    const { isAuthenticated, loading } = useAuth();
    const { hasAny, hasAll, hasAnyRole, hasAllRoles } = usePermissions();

    // Show loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sage-600"></div>
            </div>
        );
    }

    // Check authentication
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Check permissions
    if (requiredPermission) {
        const hasPermission = requireAll
            ? (Array.isArray(requiredPermission) ? hasAll(requiredPermission) : hasAny([requiredPermission]))
            : (Array.isArray(requiredPermission) ? hasAny(requiredPermission) : hasAny([requiredPermission]));

        if (!hasPermission) {
            if (showUnauthorized) {
                return <UnauthorizedView />;
            }
            return <Navigate to={fallbackPath} replace />;
        }
    }

    // Check roles
    if (requiredRole) {
        const hasRole = requireAll
            ? (Array.isArray(requiredRole) ? hasAllRoles(requiredRole) : hasAnyRole([requiredRole]))
            : (Array.isArray(requiredRole) ? hasAnyRole(requiredRole) : hasAnyRole([requiredRole]));

        if (!hasRole) {
            if (showUnauthorized) {
                return <UnauthorizedView />;
            }
            return <Navigate to={fallbackPath} replace />;
        }
    }

    return <>{children}</>;
}

function UnauthorizedView() {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="text-center p-8 max-w-md">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
                    <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Accès Refusé
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Vous n'avez pas les permissions nécessaires pour accéder à cette page.
                </p>
                <a
                    href="/"
                    className="inline-flex items-center px-4 py-2 bg-sage-600 hover:bg-sage-700 text-white rounded-lg transition-colors"
                >
                    Retour à l'accueil
                </a>
            </div>
        </div>
    );
}
