import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Plus, RefreshCw, Shield, Sliders, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { rbacApi } from '@/services/api/rbacApi';
import type { RbacUserRow, RbacUserAccess, RbacRole, AccessProfile, RbacPermissionCatalog } from '@/types/rbac.types';
import { RbacNav } from './RbacNav';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ActiveDot = ({ active }: { active: boolean }) => (
  <span className="inline-flex items-center gap-1.5 text-xs">
    <span className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
    {active ? 'Actif' : 'Inactif'}
  </span>
);

const RolePill = ({ name, onRemove }: { name: string; onRemove?: () => void }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
    {name}
    {onRemove && (
      <button onClick={onRemove} className="hover:text-red-600">
        <X className="w-3 h-3" />
      </button>
    )}
  </span>
);

const PermPill = ({ name, onRemove, variant = 'gray' }: { name: string; onRemove?: () => void; variant?: 'gray' | 'red' | 'indigo' }) => {
  const colors = {
    gray: 'bg-gray-100 text-gray-700',
    red: 'bg-red-50 text-red-700 border border-red-200',
    indigo: 'bg-indigo-50 text-indigo-700',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono ${colors[variant]}`}>
      {name}
      {onRemove && (
        <button onClick={onRemove} className="hover:text-red-600">
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
};

// ── Effective Permissions Panel ───────────────────────────────────────────────

const EffectivePermissionsPanel = ({ access }: { access: RbacUserAccess }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700"
        onClick={() => setExpanded(v => !v)}
      >
        <span>Accès effectif ({access.effective_count})</span>
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {expanded && (
        <div className="px-4 py-3 flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
          {access.effective_permissions.map(p => (
            <PermPill key={p} name={p} variant="indigo" />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Tab: Rôles ────────────────────────────────────────────────────────────────

interface RolesTabProps {
  userId: number;
  access: RbacUserAccess;
  allRoles: RbacRole[];
  onRefresh: () => void;
}

const RolesTab = ({ userId, access, allRoles, onRefresh }: RolesTabProps) => {
  const currentRoleNames = access.roles.map(r => r.name);
  const [selected, setSelected] = useState<string[]>(currentRoleNames);
  const [saving, setSaving] = useState(false);

  // Sync selected with incoming access (e.g. after removal)
  useEffect(() => {
    setSelected(access.roles.map(r => r.name));
  }, [access]);

  const availableToAdd = allRoles.filter(r => !selected.includes(r.name));

  const removeRole = async (roleName: string) => {
    try {
      await rbacApi.removeRole(userId, roleName);
      toast.success(`Rôle « ${roleName} » retiré`);
      onRefresh();
    } catch {
      toast.error('Erreur lors du retrait du rôle');
    }
  };

  const addRole = (roleName: string) => {
    if (!selected.includes(roleName)) {
      setSelected(prev => [...prev, roleName]);
    }
  };

  const saveRoles = async () => {
    setSaving(true);
    try {
      await rbacApi.syncRoles(userId, selected);
      toast.success('Rôles synchronisés');
      onRefresh();
    } catch {
      toast.error('Erreur lors de la synchronisation des rôles');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-gray-500 mb-2">Rôles actuels</p>
        <div className="flex flex-wrap gap-1.5">
          {selected.length === 0 && <span className="text-xs text-gray-400">Aucun rôle</span>}
          {selected.map(r => (
            <RolePill key={r} name={r} onRemove={() => {
              setSelected(prev => prev.filter(x => x !== r));
            }} />
          ))}
        </div>
      </div>

      {availableToAdd.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Ajouter un rôle</p>
          <select
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onChange={e => { if (e.target.value) addRole(e.target.value); e.target.value = ''; }}
            value=""
          >
            <option value="">Sélectionner un rôle…</option>
            {availableToAdd.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
          </select>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={saveRoles}
          disabled={saving}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Sauvegarde…' : 'Sauvegarder les rôles'}
        </button>
        <button
          onClick={() => removeRole(selected[0])}
          className="hidden"
        />
      </div>

      <EffectivePermissionsPanel access={access} />
    </div>
  );
};

// ── Tab: Permissions individuelles ────────────────────────────────────────────

interface PermsTabProps {
  userId: number;
  access: RbacUserAccess;
  catalog: RbacPermissionCatalog | null;
  onRefresh: () => void;
}

const PermsTab = ({ userId, access, catalog, onRefresh }: PermsTabProps) => {
  const [addPermSearch, setAddPermSearch] = useState('');
  const [blacklistSearch, setBlacklistSearch] = useState('');
  const [addingDirect, setAddingDirect] = useState(false);
  const [addingBlacklist, setAddingBlacklist] = useState(false);

  // Flat permission list from catalog
  const allPerms = catalog
    ? Object.values(catalog.modules).flat().map(p => p.name)
    : [];

  const filteredDirectOptions = allPerms.filter(
    p => p.includes(addPermSearch) && !access.direct_permissions.includes(p)
  ).slice(0, 50);

  const filteredBlacklistOptions = allPerms.filter(
    p => p.includes(blacklistSearch) && !(access.blacklisted_permissions ?? []).includes(p)
  ).slice(0, 50);

  const revokePermission = async (perm: string) => {
    try {
      await rbacApi.revokePermission(userId, perm);
      toast.success(`Permission « ${perm} » révoquée`);
      onRefresh();
    } catch {
      toast.error('Erreur lors de la révocation');
    }
  };

  const grantPermission = async (perm: string) => {
    if (!perm) return;
    setAddingDirect(true);
    try {
      await rbacApi.grantPermission(userId, perm);
      toast.success(`Permission « ${perm} » accordée`);
      setAddPermSearch('');
      onRefresh();
    } catch {
      toast.error('Erreur lors de l\'accord');
    } finally {
      setAddingDirect(false);
    }
  };

  const addBlacklist = async (perm: string) => {
    if (!perm) return;
    setAddingBlacklist(true);
    try {
      await rbacApi.blacklistPermission(userId, perm);
      toast.success(`Permission « ${perm} » blacklistée`);
      setBlacklistSearch('');
      onRefresh();
    } catch {
      toast.error('Erreur lors du blacklistage');
    } finally {
      setAddingBlacklist(false);
    }
  };

  const removeBlacklist = async (perm: string) => {
    try {
      await rbacApi.removeBlacklist(userId, perm);
      toast.success(`Blacklist retirée pour « ${perm} »`);
      onRefresh();
    } catch {
      toast.error('Erreur lors du retrait de blacklist');
    }
  };

  return (
    <div className="space-y-6">
      {/* Direct permissions */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Permissions directes</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {access.direct_permissions.length === 0 && (
            <span className="text-xs text-gray-400">Aucune permission directe</span>
          )}
          {access.direct_permissions.map(p => (
            <PermPill key={p} name={p} onRemove={() => revokePermission(p)} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={addPermSearch}
              onChange={e => setAddPermSearch(e.target.value)}
              placeholder="Rechercher une permission…"
              list="direct-perm-options"
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            />
            <datalist id="direct-perm-options">
              {filteredDirectOptions.map(p => <option key={p} value={p} />)}
            </datalist>
          </div>
          <button
            onClick={() => grantPermission(addPermSearch)}
            disabled={addingDirect || !addPermSearch}
            className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {addingDirect ? '…' : 'Accorder'}
          </button>
        </div>
      </div>

      {/* Blacklist */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-sm font-semibold text-gray-700">Blacklist</p>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-red-50 text-red-700 border border-red-200">
            Prime sur les rôles
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(access.blacklisted_permissions ?? []).length === 0 && (
            <span className="text-xs text-gray-400">Aucune permission blacklistée</span>
          )}
          {(access.blacklisted_permissions ?? []).map(p => (
            <PermPill key={p} name={p} variant="red" onRemove={() => removeBlacklist(p)} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={blacklistSearch}
              onChange={e => setBlacklistSearch(e.target.value)}
              placeholder="Rechercher une permission…"
              list="blacklist-perm-options"
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400 w-64"
            />
            <datalist id="blacklist-perm-options">
              {filteredBlacklistOptions.map(p => <option key={p} value={p} />)}
            </datalist>
          </div>
          <button
            onClick={() => addBlacklist(blacklistSearch)}
            disabled={addingBlacklist || !blacklistSearch}
            className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {addingBlacklist ? '…' : 'Blacklister'}
          </button>
        </div>
      </div>

      <EffectivePermissionsPanel access={access} />
    </div>
  );
};

// ── Tab: Profil d'accès ───────────────────────────────────────────────────────

interface ProfileTabProps {
  userId: number;
  access: RbacUserAccess;
  profiles: AccessProfile[];
  currentProfileId: number | null;
  onRefresh: () => void;
}

const ProfileTab = ({ userId, access, profiles, currentProfileId, onRefresh }: ProfileTabProps) => {
  const navigate = useNavigate();
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(currentProfileId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelectedProfileId(currentProfileId);
  }, [currentProfileId]);

  const currentProfile = profiles.find(p => p.id === selectedProfileId);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await rbacApi.assignProfile(userId, selectedProfileId);
      toast.success(selectedProfileId ? 'Profil assigné' : 'Profil retiré');
      onRefresh();
    } catch {
      toast.error('Erreur lors de l\'assignation du profil');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {currentProfile && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <p className="text-sm font-semibold text-indigo-800">{currentProfile.name}</p>
          {currentProfile.description && (
            <p className="text-xs text-indigo-600 mt-1">{currentProfile.description}</p>
          )}
          <p className="text-xs text-indigo-500 mt-1">{currentProfile.users_count} utilisateur(s)</p>
        </div>
      )}

      <div>
        <p className="text-xs text-gray-500 mb-1">Changer de profil</p>
        <select
          value={selectedProfileId ?? ''}
          onChange={e => setSelectedProfileId(e.target.value ? Number(e.target.value) : null)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Aucun profil</option>
          {profiles.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={saveProfile}
          disabled={saving}
          className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Sauvegarde…' : 'Sauvegarder'}
        </button>
        <button
          onClick={() => navigate('/rbac/access-profiles')}
          className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
        >
          <Sliders className="w-3.5 h-3.5" />
          Gérer les profils
        </button>
      </div>

      <EffectivePermissionsPanel access={access} />
    </div>
  );
};

// ── User Detail Panel ─────────────────────────────────────────────────────────

interface UserDetailPanelProps {
  user: RbacUserRow;
  allRoles: RbacRole[];
  profiles: AccessProfile[];
  catalog: RbacPermissionCatalog | null;
  onClose: () => void;
}

const UserDetailPanel = ({ user, allRoles, profiles, catalog, onClose }: UserDetailPanelProps) => {
  const [tab, setTab] = useState<'roles' | 'perms' | 'profile'>('roles');
  const [access, setAccess] = useState<RbacUserAccess | null>(null);
  const [loadingAccess, setLoadingAccess] = useState(true);

  const fetchAccess = useCallback(async () => {
    setLoadingAccess(true);
    try {
      const res = await rbacApi.getUserAccess(user.id);
      if (res.success) setAccess(res.data);
    } catch {
      toast.error('Erreur lors du chargement de l\'accès utilisateur');
    } finally {
      setLoadingAccess(false);
    }
  }, [user.id]);

  useEffect(() => { fetchAccess(); }, [fetchAccess]);

  const currentProfileId = user.access_profile?.id ?? null;

  const TABS = [
    { id: 'roles' as const, label: 'Rôles', icon: Shield },
    { id: 'perms' as const, label: 'Permissions', icon: Plus },
    { id: 'profile' as const, label: "Profil d'accès", icon: Sliders },
  ];

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <div>
          <p className="font-semibold text-gray-900">{user.name}</p>
          <p className="text-xs text-gray-500">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAccess} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 px-4">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id
                ? 'text-indigo-700 border-indigo-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {loadingAccess ? (
          <div className="text-sm text-gray-400">Chargement…</div>
        ) : access ? (
          <>
            {tab === 'roles' && (
              <RolesTab userId={user.id} access={access} allRoles={allRoles} onRefresh={fetchAccess} />
            )}
            {tab === 'perms' && (
              <PermsTab userId={user.id} access={access} catalog={catalog} onRefresh={fetchAccess} />
            )}
            {tab === 'profile' && (
              <ProfileTab
                userId={user.id}
                access={access}
                profiles={profiles}
                currentProfileId={currentProfileId}
                onRefresh={fetchAccess}
              />
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">Impossible de charger l'accès</p>
        )}
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export function UsersAccessPage() {
  const [users, setUsers] = useState<RbacUserRow[]>([]);
  const [allRoles, setAllRoles] = useState<RbacRole[]>([]);
  const [profiles, setProfiles] = useState<AccessProfile[]>([]);
  const [catalog, setCatalog] = useState<RbacPermissionCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<RbacUserRow | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterProfile, setFilterProfile] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes, profilesRes, permRes] = await Promise.all([
        rbacApi.getUsers({ search: search || undefined, role: filterRole || undefined, access_profile_id: filterProfile ? Number(filterProfile) : undefined }),
        rbacApi.getRoles(),
        rbacApi.getAccessProfiles(),
        rbacApi.getPermissions(),
      ]);
      if (usersRes.success) setUsers(usersRes.data.data);
      if (rolesRes.success) setAllRoles(rolesRes.data.roles);
      if (profilesRes.success) setProfiles(profilesRes.data);
      if (permRes.success) setCatalog(permRes.data);
    } catch {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [search, filterRole, filterProfile]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const clearFilters = () => {
    setSearch('');
    setFilterRole('');
    setFilterProfile('');
  };

  const leftPanel = <RbacNav stats={{ total_users: users.length }} />;

  const mainPanel = (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="px-6 py-3 bg-white border-b border-gray-200 shrink-0">
        <h1 className="text-sm font-bold text-gray-900">Annuaire & Affectation</h1>
        <p className="text-[10px] text-gray-400">
          {loading ? 'Chargement…' : `${users.length} utilisateur${users.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 bg-white border-b border-gray-100 flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher (nom, email)…"
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
        />
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Tous les rôles</option>
          {allRoles.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
        </select>
        <select
          value={filterProfile}
          onChange={e => setFilterProfile(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Tous les profils</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {(search || filterRole || filterProfile) && (
          <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Effacer
          </button>
        )}
      </div>

      {/* Split panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* User list */}
        <div className={`flex flex-col overflow-hidden ${selectedUser ? 'w-2/5 border-r border-gray-200' : 'w-full'}`}>
          {loading ? (
            <div className="flex items-center justify-center flex-1 text-sm text-gray-400">Chargement…</div>
          ) : users.length === 0 ? (
            <div className="flex items-center justify-center flex-1 text-sm text-gray-400">Aucun utilisateur trouvé</div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {users.map(user => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-indigo-50/50 transition-colors ${
                    selectedUser?.id === user.id ? 'bg-indigo-50 border-l-2 border-l-indigo-600' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <ActiveDot active={user.is_active} />
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {user.roles.slice(0, 3).map(r => (
                      <span key={r} className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                        {r}
                      </span>
                    ))}
                    {user.roles.length > 3 && (
                      <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                        +{user.roles.length - 3}
                      </span>
                    )}
                    {user.access_profile && (
                      <span className="px-1.5 py-0.5 text-xs bg-indigo-50 text-indigo-600 rounded">
                        {user.access_profile.name}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User detail */}
        {selectedUser ? (
          <div className="flex-1 overflow-hidden">
            <UserDetailPanel
              user={selectedUser}
              allRoles={allRoles}
              profiles={profiles}
              catalog={catalog}
              onClose={() => setSelectedUser(null)}
            />
          </div>
        ) : (
          <div className="hidden" />
        )}

        {/* Empty state when no user selected and split is not active */}
        {!selectedUser && !loading && users.length > 0 && (
          <div className="hidden" />
        )}
      </div>
    </div>
  );

  return <MasterLayout leftContent={leftPanel} mainContent={mainPanel} />;
}
