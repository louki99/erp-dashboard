/**
 * RBAC Type Definitions
 * Comprehensive type system for Role-Based Access Control
 */

export interface Permission {
    name: string;
    description?: string;
    category?: string;
}

export interface Role {
    id: number;
    name: string;
    guard_name: string;
    permissions_count: number;
}

export interface RoleDetails {
    all: string[];
    primary: string;
    count: number;
    details: Role[];
}

export interface PermissionSummary {
    total_from_roles: number;
    total_direct: number;
    total_all: number;
    total_blacklisted: number;
    total_effective: number;
}

export interface UserPermissions {
    from_roles: string[];
    direct: string[];
    all: string[];
    blacklisted: string[];
    effective: string[];
    summary: PermissionSummary;
}

export interface PermissionsGrouped {
    [category: string]: {
        [subcategory: string]: string[];
    };
}

export interface UserCapabilities {
    access_adv: boolean;
    validate_partners: boolean;
    manage_credit: boolean;
    approve_bc: boolean;
    bulk_approve_bc: boolean;
    access_dispatcher: boolean;
    access_magasinier: boolean;
    access_admin: boolean;
    is_root: boolean;
}

export interface UserPreferences {
    language: string;
    timezone: string;
}

export type PermissionCheck = string | string[] | ((permissions: string[]) => boolean);

export interface PermissionCheckOptions {
    requireAll?: boolean; // If true, user must have ALL permissions. If false, ANY permission is enough
    checkBlacklist?: boolean; // If true, also check if permission is blacklisted
}
