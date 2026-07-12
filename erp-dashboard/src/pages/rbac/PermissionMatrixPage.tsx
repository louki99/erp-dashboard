import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Lock, Plus, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { rbacApi } from '@/services/api/rbacApi';
import type { RbacRole, RbacPermissionCatalog } from '@/types/rbac.types';
import { RbacNav } from './RbacNav';

// ── Create Role Modal ─────────────────────────────────────────────────────────

interface CreateRoleModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const CreateRoleModal = ({ onClose, onCreated }: CreateRoleModalProps) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Veuillez saisir un nom'); return; }
    setSaving(true);
    try {
      await rbacApi.createRole({ name: name.trim() });
      toast.success('Rôle créé');
      onCreated();
      onClose();
    } catch {
      toast.error('Erreur lors de la création du rôle');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Nouveau rôle</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="ex: manager-commercial"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export function PermissionMatrixPage() {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role') ?? '';

  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [catalog, setCatalog] = useState<RbacPermissionCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Per-role checked state: roleName -> Set<permissionName>
  const [checkedMap, setCheckedMap] = useState<Record<string, Set<string>>>({});
  // Track which roles have unsaved changes
  const [dirtyRoles, setDirtyRoles] = useState<Set<string>>(new Set());
  // Saving state per role
  const [savingRoles, setSavingRoles] = useState<Set<string>>(new Set());
  // Collapsed modules
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, permRes] = await Promise.all([
        rbacApi.getRoles(),
        rbacApi.getPermissions(),
      ]);
      if (rolesRes.success) {
        setRoles(rolesRes.data.roles);
        // Initialize checked map from backend state
        const map: Record<string, Set<string>> = {};
        for (const role of rolesRes.data.roles) {
          map[role.name] = new Set(role.permissions);
        }
        setCheckedMap(map);
        setDirtyRoles(new Set());
      }
      if (permRes.success) {
        setCatalog(permRes.data);
      }
    } catch {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Highlight the pre-selected role from query param
  const [highlightRole] = useState(initialRole);

  const togglePermission = (roleName: string, permName: string, isRoot: boolean) => {
    if (isRoot) return;
    setCheckedMap(prev => {
      const next = { ...prev };
      const set = new Set(next[roleName] ?? []);
      if (set.has(permName)) {
        set.delete(permName);
      } else {
        set.add(permName);
      }
      next[roleName] = set;
      return next;
    });
    setDirtyRoles(prev => {
      const next = new Set(prev);
      next.add(roleName);
      return next;
    });
  };

  const saveRole = async (roleName: string) => {
    setSavingRoles(prev => new Set(prev).add(roleName));
    try {
      const permissions = Array.from(checkedMap[roleName] ?? []);
      const res = await rbacApi.syncRolePermissions(roleName, permissions);
      toast.success(res.message ?? `Permissions de « ${roleName} » sauvegardées`);
      setDirtyRoles(prev => {
        const next = new Set(prev);
        next.delete(roleName);
        return next;
      });
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string; error?: string } } };
      toast.error(anyErr?.response?.data?.message ?? anyErr?.response?.data?.error ?? 'Erreur de sauvegarde');
    } finally {
      setSavingRoles(prev => {
        const next = new Set(prev);
        next.delete(roleName);
        return next;
      });
    }
  };

  const toggleModule = (module: string) => {
    setCollapsedModules(prev => {
      const next = new Set(prev);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  };

  // Filtered modules/permissions
  const filteredModules = useMemo(() => {
    if (!catalog) return {};
    const q = search.toLowerCase().trim();
    if (!q) return catalog.modules;
    const result: RbacPermissionCatalog['modules'] = {};
    for (const [mod, perms] of Object.entries(catalog.modules)) {
      const filtered = perms.filter(p => p.name.toLowerCase().includes(q) || mod.toLowerCase().includes(q));
      if (filtered.length > 0) result[mod] = filtered;
    }
    return result;
  }, [catalog, search]);

  const moduleNames = Object.keys(filteredModules);

  const mainPanel = (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Matrice des droits</h1>
          {catalog && (
            <p className="text-sm text-gray-500 mt-0.5">{catalog.total} permissions × {roles.length} rôles</p>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Nouveau rôle
        </button>
      </div>

      {/* Search bar */}
      <div className="px-6 py-3 bg-white border-b border-gray-100">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filtrer par permission ou module…"
          className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Matrix */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">Chargement…</div>
        ) : (
          <table className="min-w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr>
                <th className="text-left px-4 py-2 border-b border-gray-200 text-gray-700 font-semibold w-64 min-w-[16rem] bg-gray-50">
                  Permission
                </th>
                {roles.map(role => (
                  <th
                    key={role.name}
                    className={`px-3 py-2 border-b border-gray-200 text-center min-w-[9rem] ${
                      role.name === highlightRole ? 'bg-indigo-50' : 'bg-white'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        {role.is_root && <Lock className="w-3 h-3 text-gray-400" />}
                        <span className={`font-semibold ${role.is_root ? 'text-gray-400' : 'text-gray-800'}`}>
                          {role.name}
                        </span>
                      </div>
                      <span className="text-gray-400 font-normal">{role.users_count} user(s)</span>
                      {dirtyRoles.has(role.name) && !role.is_root && (
                        <button
                          onClick={() => saveRole(role.name)}
                          disabled={savingRoles.has(role.name)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 font-medium"
                        >
                          <Save className="w-3 h-3" />
                          {savingRoles.has(role.name) ? '…' : 'Sauvegarder'}
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {moduleNames.map(moduleName => {
                const perms = filteredModules[moduleName];
                const isCollapsed = collapsedModules.has(moduleName);
                return [
                  // Module header row
                  <tr key={`mod-${moduleName}`} className="bg-gray-100 cursor-pointer hover:bg-gray-150" onClick={() => toggleModule(moduleName)}>
                    <td colSpan={roles.length + 1} className="px-4 py-1.5 border-b border-gray-200">
                      <div className="flex items-center gap-2 font-semibold text-gray-700 uppercase tracking-wide text-xs">
                        {isCollapsed
                          ? <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                          : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                        {moduleName}
                        <span className="text-gray-400 font-normal normal-case tracking-normal">({perms.length})</span>
                      </div>
                    </td>
                  </tr>,
                  // Permission rows
                  ...(!isCollapsed
                    ? perms.map(perm => (
                        <tr key={perm.id} className="hover:bg-indigo-50/30 border-b border-gray-100">
                          <td className="px-4 py-1.5 text-gray-700 font-mono text-xs bg-gray-50/50 border-r border-gray-100">
                            {perm.name}
                          </td>
                          {roles.map(role => {
                            const checked = checkedMap[role.name]?.has(perm.name) ?? false;
                            if (role.is_root) {
                              return (
                                <td key={role.name} className="text-center px-3 py-1.5 bg-gray-50/50">
                                  <Lock className="w-3.5 h-3.5 text-gray-300 mx-auto" />
                                </td>
                              );
                            }
                            return (
                              <td key={role.name} className={`text-center px-3 py-1.5 ${role.name === highlightRole ? 'bg-indigo-50/40' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => togglePermission(role.name, perm.name, role.is_root)}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    : []),
                ];
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  return (
    <>
      <MasterLayout leftContent={<RbacNav />} mainContent={mainPanel} />
      {showCreate && (
        <CreateRoleModal onClose={() => setShowCreate(false)} onCreated={fetchData} />
      )}
    </>
  );
}
