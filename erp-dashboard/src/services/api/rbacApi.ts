import apiClient from './client';
import type {
  RbacRole,
  RbacPermissionCatalog,
  RbacStats,
  RbacUserRow,
  RbacUserAccess,
  AccessProfile,
  RbacUserInfoPayload,
} from '@/types/rbac.types';

const RBAC_BASE = '/api/backend/rbac';
const ROLES_BASE = '/api/backend/roles';
const USER_PERMS_BASE = '/api/backend/user-permissions';

// ── RBAC Facade (read) ────────────────────────────────────────────────────────

export const rbacApi = {
  // GET /api/backend/rbac/roles
  getRoles: async () => {
    const response = await apiClient.get<{
      success: boolean;
      data: { roles: RbacRole[]; protected_roles: string[]; stats: RbacStats };
    }>(`${RBAC_BASE}/roles`);
    return response.data;
  },

  // GET /api/backend/rbac/permissions?search=
  getPermissions: async (params?: { search?: string }) => {
    const response = await apiClient.get<{
      success: boolean;
      data: RbacPermissionCatalog;
    }>(`${RBAC_BASE}/permissions`, { params });
    return response.data;
  },

  // GET /api/backend/rbac/users
  getUsers: async (params?: {
    search?: string;
    role?: string;
    access_profile_id?: number;
    branch_id?: number;
    per_page?: number;
  }) => {
    const response = await apiClient.get<{
      success: boolean;
      data: { data: RbacUserRow[]; total: number };
    }>(`${RBAC_BASE}/users`, { params });
    return response.data;
  },

  // GET /api/backend/rbac/users/{id}/access
  getUserAccess: async (userId: number) => {
    const response = await apiClient.get<{
      success: boolean;
      data: RbacUserAccess;
    }>(`${RBAC_BASE}/users/${userId}/access`);
    return response.data;
  },

  // PUT /api/backend/rbac/users/{id}/info
  updateUserInfo: async (userId: number, payload: RbacUserInfoPayload) => {
    const response = await apiClient.put<{
      success: boolean;
      message?: string;
      data?: RbacUserAccess['user'];
      error?: string;
      error_code?: string;
    }>(`${RBAC_BASE}/users/${userId}/info`, payload);
    return response.data;
  },

  // GET /api/backend/rbac/access-profiles
  getAccessProfiles: async (params?: { active_only?: boolean }) => {
    const response = await apiClient.get<{
      success: boolean;
      data: AccessProfile[];
    }>(`${RBAC_BASE}/access-profiles`, { params });
    return response.data;
  },

  // POST /api/backend/rbac/users/{id}/assign-profile
  assignProfile: async (userId: number, access_profile_id: number | null) => {
    const response = await apiClient.post<{ success: boolean; message?: string }>(
      `${RBAC_BASE}/users/${userId}/assign-profile`,
      { access_profile_id }
    );
    return response.data;
  },

  // POST /api/backend/rbac/access-profiles
  createAccessProfile: async (payload: {
    name: string;
    description?: string;
    settings?: Record<string, unknown>;
    is_active?: boolean;
  }) => {
    const response = await apiClient.post<{
      success: boolean;
      data: AccessProfile;
      message?: string;
    }>(`${RBAC_BASE}/access-profiles`, payload);
    return response.data;
  },

  // GET /api/backend/rbac/access-profiles/{id}
  getAccessProfile: async (id: number) => {
    const response = await apiClient.get<{
      success: boolean;
      data: AccessProfile;
    }>(`${RBAC_BASE}/access-profiles/${id}`);
    return response.data;
  },

  // PUT /api/backend/rbac/access-profiles/{id}
  updateAccessProfile: async (
    id: number,
    payload: {
      name?: string;
      description?: string;
      settings?: Record<string, unknown>;
      is_active?: boolean;
    }
  ) => {
    const response = await apiClient.put<{
      success: boolean;
      data: AccessProfile;
      message?: string;
      error?: string;
      error_code?: string;
    }>(`${RBAC_BASE}/access-profiles/${id}`, payload);
    return response.data;
  },

  // POST /api/backend/rbac/access-profiles/{id}/clone
  cloneAccessProfile: async (id: number, payload: { name: string; description?: string }) => {
    const response = await apiClient.post<{
      success: boolean;
      data: AccessProfile;
      message?: string;
    }>(`${RBAC_BASE}/access-profiles/${id}/clone`, payload);
    return response.data;
  },

  // ── Roles Mutations (/api/backend/roles) ─────────────────────────────────────

  listRoles: async () => {
    const response = await apiClient.get<{
      success: boolean;
      data: { roles: RbacRole[]; protected_roles: string[]; stats: RbacStats };
    }>(`${ROLES_BASE}`);
    return response.data;
  },

  createRole: async (payload: { name: string; default_permissions?: string[] }) => {
    const response = await apiClient.post<{
      success: boolean;
      data: RbacRole;
      message?: string;
    }>(`${ROLES_BASE}`, payload);
    return response.data;
  },

  updateRole: async (role: string, payload: { name: string }) => {
    const response = await apiClient.put<{
      success: boolean;
      data: RbacRole;
      message?: string;
      error?: string;
      error_code?: string;
    }>(`${ROLES_BASE}/${role}`, payload);
    return response.data;
  },

  deleteRole: async (role: string) => {
    const response = await apiClient.delete<{
      success: boolean;
      message?: string;
      error?: string;
      error_code?: string;
    }>(`${ROLES_BASE}/${role}`);
    return response.data;
  },

  getRolePermissions: async (role: string) => {
    const response = await apiClient.get<{
      success: boolean;
      data: { role: RbacRole; all_permissions: RbacPermissionCatalog };
    }>(`${ROLES_BASE}/${role}/permissions`);
    return response.data;
  },

  // POST /api/backend/roles/{role}/permissions — SYNC (full list)
  syncRolePermissions: async (role: string, permissions: string[]) => {
    const response = await apiClient.post<{
      success: boolean;
      message?: string;
      error?: string;
    }>(`${ROLES_BASE}/${role}/permissions`, { permissions });
    return response.data;
  },

  cloneRole: async (role: string, payload: { name: string }) => {
    const response = await apiClient.post<{
      success: boolean;
      data: RbacRole;
      message?: string;
    }>(`${ROLES_BASE}/${role}/clone`, payload);
    return response.data;
  },

  getRoleStatistics: async (role: string) => {
    const response = await apiClient.get<{ success: boolean; data: Record<string, unknown> }>(
      `${ROLES_BASE}/${role}/statistics`
    );
    return response.data;
  },

  // ── User Permission Mutations (/api/backend/user-permissions) ─────────────────

  getUserPermissions: async (userId: number) => {
    const response = await apiClient.get<{
      success: boolean;
      data: RbacUserAccess;
    }>(`${USER_PERMS_BASE}/${userId}`);
    return response.data;
  },

  assignRole: async (userId: number, role: string) => {
    const response = await apiClient.post<{ success: boolean; message?: string }>(
      `${USER_PERMS_BASE}/${userId}/assign-role`,
      { role }
    );
    return response.data;
  },

  removeRole: async (userId: number, role: string) => {
    const response = await apiClient.post<{ success: boolean; message?: string }>(
      `${USER_PERMS_BASE}/${userId}/remove-role`,
      { role }
    );
    return response.data;
  },

  // POST — SYNC (full list)
  syncRoles: async (userId: number, roles: string[]) => {
    const response = await apiClient.post<{ success: boolean; message?: string }>(
      `${USER_PERMS_BASE}/${userId}/sync-roles`,
      { roles }
    );
    return response.data;
  },

  grantPermission: async (userId: number, permission: string) => {
    const response = await apiClient.post<{ success: boolean; message?: string }>(
      `${USER_PERMS_BASE}/${userId}/grant-permission`,
      { permission }
    );
    return response.data;
  },

  revokePermission: async (userId: number, permission: string) => {
    const response = await apiClient.post<{ success: boolean; message?: string }>(
      `${USER_PERMS_BASE}/${userId}/revoke-permission`,
      { permission }
    );
    return response.data;
  },

  blacklistPermission: async (userId: number, permission: string) => {
    const response = await apiClient.post<{ success: boolean; message?: string }>(
      `${USER_PERMS_BASE}/${userId}/blacklist-permission`,
      { permission }
    );
    return response.data;
  },

  removeBlacklist: async (userId: number, permission: string) => {
    const response = await apiClient.post<{ success: boolean; message?: string }>(
      `${USER_PERMS_BASE}/${userId}/remove-blacklist`,
      { permission }
    );
    return response.data;
  },

  // POST — SYNC (full list)
  syncPermissions: async (userId: number, permissions: string[]) => {
    const response = await apiClient.post<{ success: boolean; message?: string }>(
      `${USER_PERMS_BASE}/${userId}/sync-permissions`,
      { permissions }
    );
    return response.data;
  },

  getEffectivePermissions: async (userId: number) => {
    const response = await apiClient.get<{
      success: boolean;
      data: { permissions: string[]; count: number };
    }>(`${USER_PERMS_BASE}/${userId}/effective`);
    return response.data;
  },
};
