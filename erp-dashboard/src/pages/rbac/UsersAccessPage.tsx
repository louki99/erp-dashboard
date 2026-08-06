import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Plus, RefreshCw, Shield, Sliders, User, X, UserPlus, Activity, CheckCircle2, AlertTriangle, Loader2, Truck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { rbacApi } from '@/services/api/rbacApi';
import { getBranches, getCompanies, getShops } from '@/services/api/configApi';
import { getWarehouses } from '@/services/api/warehouseApi';
import { getGeoAreas } from '@/services/api/routingApi';
import type { RbacUserRow, RbacUserAccess, RbacRole, AccessProfile, RbacPermissionCatalog, RbacUserInfoPayload, RbacCreateUserPayload, RbacReadyToWork, RbacVehicle } from '@/types/rbac.types';
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

// ── Ready-to-work tab ─────────────────────────────────────────────────────────

const READY_CHECK_STYLE: Record<string, { icon: typeof CheckCircle2; cls: string }> = {
  ok: { icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  warning: { icon: AlertTriangle, cls: 'text-amber-600 bg-amber-50 border-amber-100' },
  error: { icon: AlertTriangle, cls: 'text-red-600 bg-red-50 border-red-100' },
};

const ReadyToWorkTab = ({ user }: { user: RbacUserRow }) => {
  const { t } = useTranslation();
  const [data, setData] = useState<RbacReadyToWork | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await rbacApi.getUserReadyToWork(user.id);
      if (res.success) setData(res.data);
    } catch { toast.error(t('rbac.users.readyLoadError')); }
    finally { setLoading(false); }
  }, [user.id, t]);

  useEffect(() => { load(); }, [load]);

  const ready = data?.status === 'ready';
  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> {t('common.loading')}</div>
      ) : !data ? (
        <p className="text-sm text-gray-400">{t('rbac.users.readyLoadError')}</p>
      ) : (
        <>
          <div className={`flex items-center justify-between rounded-xl border p-4 ${ready ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ready ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                {ready ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-amber-600" />}
              </div>
              <div>
                <p className={`text-sm font-bold ${ready ? 'text-emerald-800' : 'text-amber-800'}`}>
                  {ready ? t('rbac.users.readyStatusReady') : t('rbac.users.readyStatusNotReady')}
                </p>
                <p className="text-xs text-gray-500">{data.user.name}{data.user.code ? ` · ${data.user.code}` : ''}</p>
              </div>
            </div>
            <button onClick={load} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-white/60" title={t('common.refresh')}>
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {data.diagnostics.length === 0 ? (
              <p className="text-sm text-gray-400">{t('rbac.users.readyNoChecks')}</p>
            ) : (
              data.diagnostics.map((d, i) => {
                const style = READY_CHECK_STYLE[d.status] ?? READY_CHECK_STYLE.error;
                const Icon = style.icon;
                return (
                  <div key={`${d.check}-${i}`} className={`flex items-start gap-2.5 rounded-lg border p-3 ${style.cls}`}>
                    <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide">{d.check}</p>
                      <p className="text-sm text-gray-700 mt-0.5">{d.message}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ── Logistics assignment (warehouse + vehicle) ────────────────────────────────

const LOGISTICS_ROLES = ['van_seller', 'van_delivery'];

// Role → logistics relevance. Van-selling / delivery roles get the full tab
// (warehouse + vehicle); pre-selling roles get the tab but no vehicle (they don't
// drive a van, just need a primary warehouse); everyone else has no Logistique tab.
const VAN_ROLE_HINTS = ['vanselling', 'van_selling', 'van_seller', 'delivery', 'van_delivery', 'livraison', 'livreur'];
const PRESELL_ROLE_HINTS = ['preselling', 'pre_selling', 'prevente', 'pre_vente'];
const matchesRoleHint = (roles: string[] | undefined, hints: string[]) =>
  (roles ?? []).some(r => { const l = r.toLowerCase(); return hints.some(h => l.includes(h)); });

const LogisticsConfig = ({ user, vehicleEnabled = true, onSaved }: { user: RbacUserRow; vehicleEnabled?: boolean; onSaved: () => void }) => {
  const { t } = useTranslation();
  const [warehouses, setWarehouses] = useState<{ id: number; name: string; code: string; branch_code: string }[]>([]);
  const [vehicles, setVehicles] = useState<RbacVehicle[]>([]);
  const [branchCode, setBranchCode] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [role, setRole] = useState('van_seller');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Load the user's branch warehouses; derive branch_code from them, then vehicles.
  // Only central warehouses are eligible as a user's primary warehouse.
  useEffect(() => {
    if (!user.branch_id) return;
    let cancelled = false;
    getWarehouses({ branch_id: user.branch_id, active_only: true, type: 'central' })
      .then((res) => {
        if (cancelled) return;
        const list = (res.warehouses?.data ?? []).map(w => ({ id: w.id, name: w.name, code: w.code, branch_code: w.branch_code }));
        setWarehouses(list);
        const bc = list[0]?.branch_code ?? null;
        setBranchCode(bc);
        if (bc && vehicleEnabled) {
          rbacApi.getRbacVehicles({ branch_code: bc })
            .then(v => { if (!cancelled) setVehicles(v.data ?? []); })
            .catch(() => {});
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user.branch_id, vehicleEnabled]);

  const save = async () => {
    if (!warehouseId) { toast.error(t('rbac.users.logisticsWarehouseRequired')); return; }
    setSaving(true);
    try {
      const res = await rbacApi.assignUserLogistics(user.id, {
        primary_warehouse_id: Number(warehouseId),
        vehicle_id: vehicleId ? Number(vehicleId) : undefined,
        role,
        notes: notes.trim() || undefined,
      });
      if (res.success) {
        toast.success(res.message || t('rbac.users.logisticsSaved'));
        onSaved();
      } else {
        toast.error(res.error || t('rbac.users.logisticsError'));
      }
    } catch (err: any) {
      // 422 RBAC_VAN_REASSIGN_BLOCKED — van still holds stock, surface the message.
      toast.error(err?.response?.data?.message ?? t('rbac.users.logisticsError'));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  if (!user.branch_id) {
    return (
      <div className="rounded-xl border border-gray-200 p-4 text-xs text-gray-500 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        {t('rbac.users.logisticsNeedBranch')}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Truck className="w-4 h-4 text-indigo-600" />
        <h4 className="text-sm font-bold text-gray-800">{t('rbac.users.logisticsTitle')}</h4>
      </div>
      <div>
        <label className={labelCls}>{t('rbac.users.logisticsWarehouse')} *</label>
        <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className={inputCls}>
          <option value="">{t('common.selectPlaceholder')}</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>{t('rbac.users.logisticsVehicle')}</label>
        <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className={`${inputCls} disabled:bg-gray-100 disabled:text-gray-400`} disabled={!vehicleEnabled || !branchCode}>
          <option value="">{t('rbac.users.logisticsNoVehicle')}</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>
              {v.internal_code} · {v.plate_number}{v.is_assigned ? ` — ${t('rbac.users.logisticsAssigned')}` : ''}
            </option>
          ))}
        </select>
        {!vehicleEnabled && <p className="text-[10px] text-gray-400 mt-1">{t('rbac.users.logisticsVehicleNa')}</p>}
      </div>
      <div>
        <label className={labelCls}>{t('rbac.users.logisticsRole')}</label>
        <select value={role} onChange={e => setRole(e.target.value)} className={inputCls}>
          {LOGISTICS_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>{t('rbac.users.logisticsNotes')}</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} />
      </div>
      <div className="flex justify-end">
        <button onClick={save} disabled={saving || !warehouseId} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
          {t('rbac.users.logisticsAssign')}
        </button>
      </div>
    </div>
  );
};

// ── Create User Form (inline, in the detail area) ─────────────────────────────

const CreateUserForm = ({ allRoles, profiles, onCancel, onCreated }: {
  allRoles: RbacRole[]; profiles: AccessProfile[]; onCancel: () => void; onCreated: (createdId?: number) => void;
}) => {
  const { t } = useTranslation();
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RbacCreateUserPayload>({
    name: '', email: '', password: '', code: '', branch_id: 0, role: '',
    access_profile_id: null, phone: '', is_active: true,
  });

  useEffect(() => {
    getBranches().then(bs => setBranches(bs.map(b => ({ id: b.id, name: b.name })))).catch(() => {});
  }, []);

  const update = <K extends keyof RbacCreateUserPayload>(k: K, v: RbacCreateUserPayload[K]) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password || !form.code.trim() || !form.branch_id || !form.role) {
      toast.error(t('rbac.users.createRequired'));
      return;
    }
    setSaving(true);
    try {
      const res = await rbacApi.createUser({
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        code: form.code.trim(),
        phone: form.phone?.trim() || undefined,
        access_profile_id: form.access_profile_id || undefined,
      });
      if (res.success) {
        toast.success(res.message || t('rbac.users.createSuccess'));
        onCreated(res.data?.id);
      } else {
        toast.error(res.error || t('rbac.users.createError'));
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t('rbac.users.createError'));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center"><UserPlus className="w-4 h-4 text-indigo-600" /></div>
          <p className="font-semibold text-gray-900">{t('rbac.users.createTitle')}</p>
        </div>
        <button onClick={onCancel} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
      </div>
      <form onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t('rbac.users.fieldName')} *</label>
            <input value={form.name} onChange={e => update('name', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('rbac.users.fieldCode')} *</label>
            <input value={form.code} onChange={e => update('code', e.target.value)} placeholder="0099" className={`${inputCls} font-mono`} />
          </div>
        </div>
        <div>
          <label className={labelCls}>{t('rbac.users.fieldEmail')} *</label>
          <input type="email" value={form.email} onChange={e => update('email', e.target.value)} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t('rbac.users.fieldPassword')} *</label>
            <input type="password" value={form.password} onChange={e => update('password', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('rbac.users.fieldPhone')}</label>
            <input value={form.phone ?? ''} onChange={e => update('phone', e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t('rbac.users.fieldBranch')} *</label>
            <select value={form.branch_id || ''} onChange={e => update('branch_id', Number(e.target.value))} className={inputCls}>
              <option value="">{t('common.selectPlaceholder')}</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('rbac.users.fieldRole')} *</label>
            <select value={form.role} onChange={e => update('role', e.target.value)} className={inputCls}>
              <option value="">{t('common.selectPlaceholder')}</option>
              {allRoles.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>{t('rbac.users.fieldAccessProfile')}</label>
          <select value={form.access_profile_id ?? ''} onChange={e => update('access_profile_id', e.target.value ? Number(e.target.value) : null)} className={inputCls}>
            <option value="">{t('rbac.users.noProfile')}</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.is_active ?? true} onChange={e => update('is_active', e.target.checked)}
            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
          {t('rbac.users.infoActive')}
        </label>
        <p className="text-[11px] text-gray-400">{t('rbac.users.createRoleHint')}</p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">{t('common.cancel')}</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {saving ? t('common.creating') : t('common.create')}
          </button>
        </div>
      </form>
    </div>
  );
};

// ── User Detail Panel ─────────────────────────────────────────────────────────

const UserDetailPanel = ({ user, allRoles, profiles, catalog, onClose }: {
  user: RbacUserRow; allRoles: RbacRole[]; profiles: AccessProfile[]; catalog: RbacPermissionCatalog | null; onClose: () => void;
}) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'roles' | 'perms' | 'profile' | 'info' | 'logistics' | 'ready'>('roles');
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

  // Logistics only concerns field-sales roles: van/delivery (full) or pre-selling
  // (warehouse only, vehicle disabled). Hidden for everyone else (cashier, télévendeur…).
  const isVanRole = matchesRoleHint(user.roles, VAN_ROLE_HINTS);
  const isPresellRole = matchesRoleHint(user.roles, PRESELL_ROLE_HINTS);
  const showLogistics = isVanRole || isPresellRole;
  // Guard against a stale 'logistics' tab when switching to a user that hides it.
  const activeTab = tab === 'logistics' && !showLogistics ? 'roles' : tab;

  const TABS = [
    { id: 'roles' as const, labelKey: 'rbac.users.tabs.roles', icon: Shield },
    { id: 'perms' as const, labelKey: 'rbac.users.tabs.permissions', icon: Plus },
    { id: 'profile' as const, labelKey: 'rbac.users.tabs.profile', icon: Sliders },
    { id: 'info' as const, labelKey: 'rbac.users.tabs.info', icon: User },
    ...(showLogistics ? [{ id: 'logistics' as const, labelKey: 'rbac.users.tabs.logistics', icon: Truck }] : []),
    { id: 'ready' as const, labelKey: 'rbac.users.tabs.ready', icon: Activity },
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

      <div className="flex border-b border-gray-200 px-4 overflow-x-auto">
        {TABS.map(({ id, labelKey, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors shrink-0 whitespace-nowrap ${
              activeTab === id ? 'text-indigo-700 border-indigo-600' : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}>
            <Icon className="w-3.5 h-3.5 shrink-0" />
            {t(labelKey)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'ready' ? (
          <ReadyToWorkTab user={user} />
        ) : activeTab === 'logistics' ? (
          <LogisticsConfig user={user} vehicleEnabled={isVanRole} onSaved={() => setTab('ready')} />
        ) : loadingAccess ? (
          <div className="text-sm text-gray-400">{t('common.loading')}</div>
        ) : access ? (
          <>
            {activeTab === 'roles' && <RolesTab userId={user.id} access={access} allRoles={allRoles} onRefresh={fetchAccess} />}
            {activeTab === 'perms' && <PermsTab userId={user.id} access={access} catalog={catalog} onRefresh={fetchAccess} />}
            {activeTab === 'profile' && <ProfileTab userId={user.id} access={access} profiles={profiles} currentProfileId={currentProfileId} onRefresh={fetchAccess} />}
            {activeTab === 'info' && access && <UserInfoTab user={access.user} onRefresh={fetchAccess} />}
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
  const [creating, setCreating] = useState(false);

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
      <div className="px-6 py-3 bg-white border-b border-gray-200 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-gray-900">{t('rbac.users.title')}</h1>
          <p className="text-[10px] text-gray-400">
            {loading ? t('common.loading') : `${users.length} ${t('rbac.users.title').toLowerCase()}`}
          </p>
        </div>
        <button
          onClick={() => { setCreating(true); setSelectedUser(null); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          <UserPlus className="w-3.5 h-3.5" /> {t('rbac.users.createTitle')}
        </button>
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
        <div className={`flex flex-col overflow-hidden ${(selectedUser || creating) ? 'w-2/5 border-r border-gray-200' : 'w-full'}`}>
          {loading ? (
            <div className="flex items-center justify-center flex-1 text-sm text-gray-400">{t('common.loading')}</div>
          ) : users.length === 0 ? (
            <div className="flex items-center justify-center flex-1 text-sm text-gray-400">{t('rbac.users.noUsers')}</div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {users.map(user => (
                <button key={user.id} onClick={() => { setSelectedUser(user); setCreating(false); }}
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

        {creating ? (
          <div className="flex-1 overflow-hidden">
            <CreateUserForm
              allRoles={allRoles}
              profiles={profiles}
              onCancel={() => setCreating(false)}
              onCreated={() => { setCreating(false); fetchData(); }}
            />
          </div>
        ) : selectedUser ? (
          <div className="flex-1 overflow-hidden">
            <UserDetailPanel user={selectedUser} allRoles={allRoles} profiles={profiles} catalog={catalog} onClose={() => setSelectedUser(null)} />
          </div>
        ) : <div className="hidden" />}
      </div>
    </div>
  );

  return <MasterLayout leftContent={leftPanel} mainContent={mainPanel} />;
}
