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
    access_gcom: boolean;
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

// ── RBAC Admin Module Types (backend facade) ──────────────────────────────────

export interface RbacRole {
  id: number;
  name: string;
  guard_name: string;
  users_count: number;
  permissions: string[];
  is_protected: boolean;
  is_root: boolean;
}

export interface RbacPermissionGroup {
  [module: string]: Array<{ id: number; name: string }>;
}

export interface RbacPermissionCatalog {
  total: number;
  modules: RbacPermissionGroup;
}

export interface RbacStats {
  total_roles: number;
  total_permissions: number;
  total_users_with_roles: number;
}

export interface RbacUserRow {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  branch_id: number | null;
  is_active: boolean;
  roles: string[];
  access_profile: { id: number; name: string } | null;
}

export interface RbacUserAccessUser {
  id: number;
  name: string;
  email: string;
  code?: string | null;
  company_id?: number | null;
  branch_id?: number | null;
  shop_id?: number | null;
  geo_area_id?: number | null;
  geo_area_code?: string | null;
  is_active: boolean;
  is_blocked?: boolean;
}

export interface RbacUserAccess {
  user: RbacUserAccessUser;
  roles: Array<{ id: number; name: string; is_protected: boolean }>;
  direct_permissions: string[];
  effective_permissions: string[];
  effective_count: number;
  blacklisted_permissions?: string[];
}

export interface RbacUserInfoPayload {
  branch_id?: number | null;
  geo_area_id?: number | null;
  shop_id?: number | null;
  company_id?: number | null;
  code?: string | null;
  is_blocked?: boolean;
  is_active?: boolean;
}

// POST /api/backend/rbac/users — `role` must be a real Spatie role name (see GET
// /rbac/roles), not a filter alias like "vendeur"/"salesperson". Cash journals are
// auto-provisioned server-side by an observer.
export interface RbacCreateUserPayload {
  name: string;
  email: string;
  password: string;
  code: string;
  branch_id: number;
  role: string;
  access_profile_id?: number | null;
  company_id?: number | null;
  phone?: string | null;
  is_active?: boolean;
}

// GET /api/backend/rbac/users/{identifier}/ready-to-work — {identifier} accepts a
// numeric id or a code/matricule/email/phone.
export interface RbacReadyToWorkCheck {
  check: string;
  status: 'ok' | 'error' | 'warning' | string;
  message: string;
}

export interface RbacReadyToWork {
  user: { id: number; name: string; code: string | null };
  status: 'ready' | 'not_ready' | string;
  diagnostics: RbacReadyToWorkCheck[];
}

// POST /api/backend/rbac/users/{id}/logistics — assigns the primary warehouse and
// (optionally) a vehicle. Storage location is derived server-side from the vehicle
// chain (Vehicle → vanWarehouse → vanStorageLocation), never set directly.
export interface RbacLogisticsPayload {
  primary_warehouse_id: number;
  vehicle_id?: number | null;
  role?: string;
  notes?: string;
}

// GET /api/backend/rbac/vehicles?branch_code=… — explicit branch scoping (unlike
// /dispatcher/vehicles which scopes to the logged-in admin's own branch).
export interface RbacVehicle {
  id: number;
  internal_code: string;
  plate_number: string;
  type: string;
  branch_code: string;
  // Already assigned to someone — informational only (grey/warn); POST /logistics
  // still handles reassignment (guarded server-side against vans holding stock).
  is_assigned: boolean;
}

export interface AccessProfile {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  users_count: number;
  settings?: Record<string, unknown>;
}
