import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Plus, RefreshCw, Shield, Sliders, User, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { rbacApi } from '@/services/api/rbacApi';
import { getBranches, getCompanies, getShops } from '@/services/api/configApi';
import { getGeoAreas } from '@/services/api/routingApi';
import type { RbacUserRow, RbacUserAccess, RbacRole, AccessProfile, RbacPermissionCatalog, RbacUserInfoPayload } from '@/types/rbac.types';
import { RbacNav } from './RbacNav';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ActiveDot = ({ active }: { active: boolean }) => {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
      {active ? t('common.active') : t('common.inactive')}
    </span>
  );
};

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
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
      <button className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700"
        onClick={() => setExpanded(v => !v)}>
        <span>{t('rbac.users.effectiveAccess')} ({access.effective_count})</span>
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {expanded && (
        <div className="px-4 py-3 flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
          {access.effective_permissions.map(p => <PermPill key={p} name={p} variant="indigo" />)}
        </div>
      )}
    </div>
  );
};

// ── Tab: Rôles ────────────────────────────────────────────────────────────────

const RolesTab = ({ userId, access, allRoles, onRefresh }: { userId: number; access: RbacUserAccess; allRoles: RbacRole[]; onRefresh: () => void }) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>(access.roles.map(r => r.name));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setSelected(access.roles.map(r => r.name)); }, [access]);

  const availableToAdd = allRoles.filter(r => !selected.includes(r.name));

  const saveRoles = async () => {
    setSaving(true);
    try {
      await rbacApi.syncRoles(userId, selected);
      toast.success(t('rbac.users.rolesSynced'));
      onRefresh();
    } catch {
      toast.error(t('rbac.users.rolesSyncError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-gray-500 mb-2">{t('rbac.users.currentRoles')}</p>
        <div className="flex flex-wrap gap-1.5">
          {selected.length === 0 && <span className="text-xs text-gray-400">{t('rbac.users.noRoles')}</span>}
          {selected.map(r => <RolePill key={r} name={r} onRemove={() => setSelected(prev => prev.filter(x => x !== r))} />)}
        </div>
      </div>

      {availableToAdd.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1">{t('rbac.users.addRole')}</p>
          <select className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onChange={e => { if (e.target.value) { if (!selected.includes(e.target.value)) setSelected(prev => [...prev, e.target.value]); } e.target.value = ''; }} value="">
            <option value="">{t('rbac.users.selectRolePlaceholder')}</option>
            {availableToAdd.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
          </select>
        </div>
      )}

      <button onClick={saveRoles} disabled={saving}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
        {saving ? t('rbac.users.saving') : t('rbac.users.saveRoles')}
      </button>

      <EffectivePermissionsPanel access={access} />
    </div>
  );
};

// ── Tab: Permissions individuelles ────────────────────────────────────────────

const PermsTab = ({ userId, access, catalog, onRefresh }: { userId: number; access: RbacUserAccess; catalog: RbacPermissionCatalog | null; onRefresh: () => void }) => {
  const { t } = useTranslation();
  const [addPermSearch, setAddPermSearch] = useState('');
  const [blacklistSearch, setBlacklistSearch] = useState('');
  const [addingDirect, setAddingDirect] = useState(false);
  const [addingBlacklist, setAddingBlacklist] = useState(false);

  const allPerms = catalog ? Object.values(catalog.modules).flat().map(p => p.name) : [];
  const filteredDirectOptions = allPerms.filter(p => p.includes(addPermSearch) && !access.direct_permissions.includes(p)).slice(0, 50);
  const filteredBlacklistOptions = allPerms.filter(p => p.includes(blacklistSearch) && !(access.blacklisted_permissions ?? []).includes(p)).slice(0, 50);

  const revokePermission = async (perm: string) => {
    try {
      await rbacApi.revokePermission(userId, perm);
      toast.success(t('rbac.users.revokeMsg', { perm }));
      onRefresh();
    } catch { toast.error(t('errors.generic')); }
  };

  const grantPermission = async (perm: string) => {
    if (!perm) return;
    setAddingDirect(true);
    try {
      await rbacApi.grantPermission(userId, perm);
      toast.success(t('rbac.users.grantMsg', { perm }));
      setAddPermSearch('');
      onRefresh();
    } catch { toast.error(t('rbac.users.grantError')); }
    finally { setAddingDirect(false); }
  };

  const addBlacklist = async (perm: string) => {
    if (!perm) return;
    setAddingBlacklist(true);
    try {
      await rbacApi.blacklistPermission(userId, perm);
      toast.success(t('rbac.users.blacklistMsg', { perm }));
      setBlacklistSearch('');
      onRefresh();
    } catch { toast.error(t('rbac.users.blacklistError')); }
    finally { setAddingBlacklist(false); }
  };

  const removeBlacklist = async (perm: string) => {
    try {
      await rbacApi.removeBlacklist(userId, perm);
      toast.success(t('rbac.users.removeBlacklistMsg', { perm }));
      onRefresh();
    } catch { toast.error(t('rbac.users.removeBlacklistError')); }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">{t('rbac.users.directPerms')}</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {access.direct_permissions.length === 0 && <span className="text-xs text-gray-400">{t('rbac.users.noDirectPerms')}</span>}
          {access.direct_permissions.map(p => <PermPill key={p} name={p} onRemove={() => revokePermission(p)} />)}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input type="text" value={addPermSearch} onChange={e => setAddPermSearch(e.target.value)}
              placeholder={t('rbac.users.searchPermPlaceholder')}
              list="direct-perm-options"
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64" />
            <datalist id="direct-perm-options">
              {filteredDirectOptions.map(p => <option key={p} value={p} />)}
            </datalist>
          </div>
          <button onClick={() => grantPermission(addPermSearch)} disabled={addingDirect || !addPermSearch}
            className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {addingDirect ? '…' : t('rbac.users.grant')}
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-sm font-semibold text-gray-700">{t('rbac.users.blacklist')}</p>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-red-50 text-red-700 border border-red-200">
            {t('rbac.users.blacklistPriority')}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(access.blacklisted_permissions ?? []).length === 0 && <span className="text-xs text-gray-400">{t('rbac.users.noBlacklist')}</span>}
          {(access.blacklisted_permissions ?? []).map(p => <PermPill key={p} name={p} variant="red" onRemove={() => removeBlacklist(p)} />)}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input type="text" value={blacklistSearch} onChange={e => setBlacklistSearch(e.target.value)}
              placeholder={t('rbac.users.searchPermPlaceholder')}
              list="blacklist-perm-options"
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400 w-64" />
            <datalist id="blacklist-perm-options">
              {filteredBlacklistOptions.map(p => <option key={p} value={p} />)}
            </datalist>
          </div>
          <button onClick={() => addBlacklist(blacklistSearch)} disabled={addingBlacklist || !blacklistSearch}
            className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
            {addingBlacklist ? '…' : t('rbac.users.blacklist')}
          </button>
        </div>
      </div>

      <EffectivePermissionsPanel access={access} />
    </div>
  );
};

// ── Tab: Profil d'accès ───────────────────────────────────────────────────────

const ProfileTab = ({ userId, access, profiles, currentProfileId, onRefresh }: {
  userId: number; access: RbacUserAccess; profiles: AccessProfile[]; currentProfileId: number | null; onRefresh: () => void;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(currentProfileId);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setSelectedProfileId(currentProfileId); }, [currentProfileId]);

  const currentProfile = profiles.find(p => p.id === selectedProfileId);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await rbacApi.assignProfile(userId, selectedProfileId);
      toast.success(selectedProfileId ? t('rbac.users.profileSaved') : t('rbac.users.profileSaved'));
      onRefresh();
    } catch { toast.error(t('rbac.users.profileSaveError')); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {currentProfile && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <p className="text-sm font-semibold text-indigo-800">{currentProfile.name}</p>
          {currentProfile.description && <p className="text-xs text-indigo-600 mt-1">{currentProfile.description}</p>}
          <p className="text-xs text-indigo-500 mt-1">{currentProfile.users_count} {t('common.contact').toLowerCase()}(s)</p>
        </div>
      )}
      <div>
        <p className="text-xs text-gray-500 mb-1">{t('rbac.users.changeProfile')}</p>
        <select value={selectedProfileId ?? ''} onChange={e => setSelectedProfileId(e.target.value ? Number(e.target.value) : null)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">{t('rbac.users.noProfile')}</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={saveProfile} disabled={saving}
          className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {saving ? t('common.saving') : t('common.save')}
        </button>
        <button onClick={() => navigate('/rbac/access-profiles')}
          className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800">
          <Sliders className="w-3.5 h-3.5" />
          {t('rbac.users.manageProfiles')}
        </button>
      </div>
      <EffectivePermissionsPanel access={access} />
    </div>
  );
};

// ── Tab: Informations utilisateur ─────────────────────────────────────────────

const UserInfoTab = ({ user, onRefresh }: { user: RbacUserAccess['user']; onRefresh: () => void }) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<RbacUserInfoPayload>({
    code: user.code ?? '',
    company_id: user.company_id ?? null,
    branch_id: user.branch_id ?? null,
    shop_id: user.shop_id ?? null,
    geo_area_id: user.geo_area_id ?? null,
    is_active: user.is_active,
    is_blocked: user.is_blocked ?? false,
  });

  const [options, setOptions] = useState<{
    companies: { id: number; name: string }[];
    branches: { id: number; name: string }[];
    shops: { id: number; name: string }[];
    geoAreas: { id: number; name: string }[];
  }>({ companies: [], branches: [], shops: [], geoAreas: [] });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getCompanies(),
      getBranches(),
      getShops(),
      getGeoAreas({ per_page: 500 }),
    ])
      .then(([companies, branches, shops, geoRes]) => {
        if (cancelled) return;
        setOptions({
          companies: companies.map(c => ({ id: c.id, name: c.name })),
          branches: branches.map(b => ({ id: b.id, name: b.name })),
          shops: shops.map(s => ({ id: s.id, name: s.name })),
          geoAreas: (geoRes.geoAreas?.data ?? []).map((g: { id: number; name: string }) => ({ id: g.id, name: g.name })),
        });
      })
      .catch(() => toast.error(t('rbac.users.infoLoadError')))
      .finally(() => setLoading(false));
    return () => { cancelled = true; };
  }, [t]);

  const update = <K extends keyof RbacUserInfoPayload>(key: K, value: RbacUserInfoPayload[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: RbacUserInfoPayload = {
        ...form,
        code: form.code?.trim() || null,
      };
      const res = await rbacApi.updateUserInfo(user.id, payload);
      if (res.success) {
        toast.success(res.message || t('rbac.users.infoSaved'));
        onRefresh();
      } else {
        toast.error(res.error || t('rbac.users.infoSaveError'));
      }
    } catch {
      toast.error(t('rbac.users.infoSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const SelectField = ({
    label,
    value,
    options: opts,
    onChange,
    disabled = false,
  }: {
    label: string;
    value: number | null | undefined;
    options: { id: number; name: string }[];
    onChange: (id: number | null) => void;
    disabled?: boolean;
  }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
        disabled={disabled || loading}
        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
      >
        <option value="">{t('common.selectPlaceholder')}</option>
        {opts.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-4">
      {loading && <p className="text-xs text-gray-400">{t('common.loading')}</p>}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{t('rbac.users.infoCode')}</label>
        <input
          type="text"
          value={form.code ?? ''}
          onChange={e => update('code', e.target.value)}
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder={t('rbac.users.infoCodePlaceholder')}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SelectField
          label={t('rbac.users.infoCompany')}
          value={form.company_id}
          options={options.companies}
          onChange={v => update('company_id', v)}
        />
        <SelectField
          label={t('rbac.users.infoBranch')}
          value={form.branch_id}
          options={options.branches}
          onChange={v => update('branch_id', v)}
        />
        <SelectField
          label={t('rbac.users.infoShop')}
          value={form.shop_id}
          options={options.shops}
          onChange={v => update('shop_id', v)}
        />
        <SelectField
          label={t('rbac.users.infoGeoArea')}
          value={form.geo_area_id}
          options={options.geoAreas}
          onChange={v => update('geo_area_id', v)}
        />
      </div>

      <div className="flex items-center gap-6 pt-1">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={e => update('is_active', e.target.checked)}
            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          />
          {t('rbac.users.infoActive')}
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.is_blocked}
            onChange={e => update('is_blocked', e.target.checked)}
            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          />
          {t('rbac.users.infoBlocked')}
        </label>
      </div>

      <div className="pt-2">
        <button
          onClick={save}
          disabled={saving || loading}
          className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>

      <p className="text-[10px] text-gray-400">{t('rbac.users.infoGeoAreaHint')}</p>
    </div>
  );
};

// ── User Detail Panel ─────────────────────────────────────────────────────────

const UserDetailPanel = ({ user, allRoles, profiles, catalog, onClose }: {
  user: RbacUserRow; allRoles: RbacRole[]; profiles: AccessProfile[]; catalog: RbacPermissionCatalog | null; onClose: () => void;
}) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'roles' | 'perms' | 'profile' | 'info'>('roles');
  const [access, setAccess] = useState<RbacUserAccess | null>(null);
  const [loadingAccess, setLoadingAccess] = useState(true);

  const fetchAccess = useCallback(async () => {
    setLoadingAccess(true);
    try {
      const res = await rbacApi.getUserAccess(user.id);
      if (res.success) setAccess(res.data);
    } catch { toast.error(t('rbac.users.loadAccessError')); }
    finally { setLoadingAccess(false); }
  }, [user.id, t]);

  useEffect(() => { fetchAccess(); }, [fetchAccess]);

  const currentProfileId = user.access_profile?.id ?? null;

  const TABS = [
    { id: 'roles' as const, labelKey: 'rbac.users.tabs.roles', icon: Shield },
    { id: 'perms' as const, labelKey: 'rbac.users.tabs.permissions', icon: Plus },
    { id: 'profile' as const, labelKey: 'rbac.users.tabs.profile', icon: Sliders },
    { id: 'info' as const, labelKey: 'rbac.users.tabs.info', icon: User },
  ];

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
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

      <div className="flex border-b border-gray-200 px-4">
        {TABS.map(({ id, labelKey, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id ? 'text-indigo-700 border-indigo-600' : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}>
            <Icon className="w-3.5 h-3.5" />
            {t(labelKey)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {loadingAccess ? (
          <div className="text-sm text-gray-400">{t('common.loading')}</div>
        ) : access ? (
          <>
            {tab === 'roles' && <RolesTab userId={user.id} access={access} allRoles={allRoles} onRefresh={fetchAccess} />}
            {tab === 'perms' && <PermsTab userId={user.id} access={access} catalog={catalog} onRefresh={fetchAccess} />}
            {tab === 'profile' && <ProfileTab userId={user.id} access={access} profiles={profiles} currentProfileId={currentProfileId} onRefresh={fetchAccess} />}
            {tab === 'info' && access && <UserInfoTab user={access.user} onRefresh={fetchAccess} />}
          </>
        ) : (
          <p className="text-sm text-gray-400">{t('rbac.users.loadAccessError')}</p>
        )}
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export function UsersAccessPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<RbacUserRow[]>([]);
  const [allRoles, setAllRoles] = useState<RbacRole[]>([]);
  const [profiles, setProfiles] = useState<AccessProfile[]>([]);
  const [catalog, setCatalog] = useState<RbacPermissionCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<RbacUserRow | null>(null);

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
    } catch { toast.error(t('rbac.users.loadError')); }
    finally { setLoading(false); }
  }, [search, filterRole, filterProfile, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const clearFilters = () => { setSearch(''); setFilterRole(''); setFilterProfile(''); };

  const leftPanel = <RbacNav stats={{ total_users: users.length }} />;

  const mainPanel = (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50">
      <div className="px-6 py-3 bg-white border-b border-gray-200 shrink-0">
        <h1 className="text-sm font-bold text-gray-900">{t('rbac.users.title')}</h1>
        <p className="text-[10px] text-gray-400">
          {loading ? t('common.loading') : `${users.length} ${t('rbac.users.title').toLowerCase()}`}
        </p>
      </div>

      <div className="px-6 py-3 bg-white border-b border-gray-100 flex items-center gap-3 flex-wrap">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('rbac.users.searchPlaceholder')}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56" />
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">{t('rbac.users.allRoles')}</option>
          {allRoles.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
        </select>
        <select value={filterProfile} onChange={e => setFilterProfile(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">{t('rbac.users.allProfiles')}</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {(search || filterRole || filterProfile) && (
          <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> {t('rbac.users.clearFilters')}
          </button>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className={`flex flex-col overflow-hidden ${selectedUser ? 'w-2/5 border-r border-gray-200' : 'w-full'}`}>
          {loading ? (
            <div className="flex items-center justify-center flex-1 text-sm text-gray-400">{t('common.loading')}</div>
          ) : users.length === 0 ? (
            <div className="flex items-center justify-center flex-1 text-sm text-gray-400">{t('rbac.users.noUsers')}</div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {users.map(user => (
                <button key={user.id} onClick={() => setSelectedUser(user)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-indigo-50/50 transition-colors ${
                    selectedUser?.id === user.id ? 'bg-indigo-50 border-l-2 border-l-indigo-600' : ''
                  }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <ActiveDot active={user.is_active} />
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {user.roles.slice(0, 3).map(r => (
                      <span key={r} className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">{r}</span>
                    ))}
                    {user.roles.length > 3 && (
                      <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">+{user.roles.length - 3}</span>
                    )}
                    {user.access_profile && (
                      <span className="px-1.5 py-0.5 text-xs bg-indigo-50 text-indigo-600 rounded">{user.access_profile.name}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedUser ? (
          <div className="flex-1 overflow-hidden">
            <UserDetailPanel user={selectedUser} allRoles={allRoles} profiles={profiles} catalog={catalog} onClose={() => setSelectedUser(null)} />
          </div>
        ) : <div className="hidden" />}
      </div>
    </div>
  );

  return <MasterLayout leftContent={leftPanel} mainContent={mainPanel} />;
}
