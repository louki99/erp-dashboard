import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Lock, Plus, Shield, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { rbacApi } from '@/services/api/rbacApi';
import type { RbacRole, RbacStats } from '@/types/rbac.types';
import { RbacNav } from './RbacNav';

const ProtectedDot = ({ value }: { value: boolean }) => {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`w-2 h-2 rounded-full ${value ? 'bg-amber-500' : 'bg-gray-300'}`} />
      {value ? t('common.yes') : t('common.no')}
    </span>
  );
};

// ── Create Role Modal ─────────────────────────────────────────────────────────
const CreateRoleModal = ({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error(t('errors.validationError')); return; }
    setSaving(true);
    try {
      await rbacApi.createRole({ name: name.trim() });
      toast.success(t('rbac.roles.created'));
      onCreated();
      onClose();
    } catch {
      toast.error(t('rbac.roles.createError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('modules.rbac.newRole')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('rbac.roles.nameLabel')}</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder={t('rbac.roles.namePlaceholder')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? t('common.creating') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Clone Role Modal ──────────────────────────────────────────────────────────
const CloneRoleModal = ({ role, onClose, onCloned }: { role: RbacRole; onClose: () => void; onCloned: () => void }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(`${role.name}-copie`);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error(t('errors.validationError')); return; }
    setSaving(true);
    try {
      await rbacApi.cloneRole(role.name, { name: name.trim() });
      toast.success(t('rbac.roles.created'));
      onCloned();
      onClose();
    } catch {
      toast.error(t('rbac.roles.createError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('rbac.roles.cloneTitle')} « {role.name} »</h2>
        <p className="text-sm text-gray-500 mb-4">
          {role.permissions.length} {t('rbac.roles.permsCopied')}.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('rbac.roles.newNameLabel')}</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? t('common.cloning') : t('common.clone')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Delete Confirm Modal ──────────────────────────────────────────────────────
const DeleteRoleModal = ({ role, onClose, onDeleted }: { role: RbacRole; onClose: () => void; onDeleted: () => void }) => {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await rbacApi.deleteRole(role.name);
      toast.success(t('common.delete') + ' ✓');
      onDeleted();
      onClose();
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string; error?: string } } };
      toast.error(anyErr?.response?.data?.message ?? t('errors.generic'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('rbac.roles.deleteTitle')} « {role.name} » ?</h2>
        {role.users_count > 0 && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <strong>{role.users_count}</strong> {t('rbac.roles.usersHaveRole')}
          </div>
        )}
        <p className="text-sm text-gray-500 mb-4">{t('rbac.roles.irreversible')}</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            {t('common.cancel')}
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
            {deleting ? t('common.deleting') : t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export function RolesListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [stats, setStats] = useState<RbacStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [cloneTarget, setCloneTarget] = useState<RbacRole | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RbacRole | null>(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await rbacApi.getRoles();
      if (res.success) {
        setRoles(res.data.roles);
        setStats(res.data.stats);
      }
    } catch {
      toast.error(t('rbac.roles.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const columnDefs = useMemo(() => [
    {
      headerName: t('rbac.roles.col.name'),
      field: 'name',
      flex: 2,
      minWidth: 160,
      cellRenderer: (p: any) => {
        const row: RbacRole = p.data;
        if (!row) return null;
        return (
          <div className="flex items-center gap-2 h-full">
            {row.is_root && <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" title={t('rbac.roles.rootTooltip')} />}
            {row.is_protected && !row.is_root && <Shield className="w-3.5 h-3.5 text-amber-500 shrink-0" title={t('rbac.roles.protectedTooltip')} />}
            <span className="font-medium text-gray-900">{row.name}</span>
          </div>
        );
      },
    },
    {
      headerName: t('rbac.roles.col.permissions'),
      field: 'permissions',
      width: 130,
      flex: 0,
      cellRenderer: (p: any) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
          {(p.value ?? []).length}
        </span>
      ),
    },
    {
      headerName: t('rbac.roles.col.users'),
      field: 'users_count',
      width: 120,
      flex: 0,
      cellRenderer: (p: any) => <span className="text-sm text-gray-600">{p.value}</span>,
    },
    {
      headerName: t('rbac.roles.col.protected'),
      field: 'is_protected',
      width: 110,
      flex: 0,
      cellRenderer: (p: any) => <ProtectedDot value={!!p.value} />,
    },
    {
      headerName: t('rbac.roles.col.actions'),
      field: 'id',
      width: 180,
      flex: 0,
      sortable: false,
      filter: false,
      cellRenderer: (p: any) => {
        const row: RbacRole = p.data;
        if (!row) return null;
        return (
          <div className="flex items-center gap-1.5 h-full">
            <button onClick={() => navigate(`/rbac/matrix?role=${encodeURIComponent(row.name)}`)}
              className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 border border-indigo-200">
              {t('rbac.roles.goToMatrix')}
            </button>
            <button onClick={() => setCloneTarget(row)}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md" title={t('common.clone')}>
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setDeleteTarget(row)} disabled={row.is_protected}
              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md disabled:opacity-30 disabled:cursor-not-allowed"
              title={row.is_protected ? t('rbac.roles.protectedTooltip') : t('common.delete')}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      },
    },
  ], [navigate, t]);

  const leftPanel = (
    <RbacNav stats={stats ? {
      total_roles: stats.total_roles,
      total_permissions: stats.total_permissions,
      total_users: stats.total_users_with_roles,
    } : undefined} />
  );

  const mainPanel = (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{t('modules.rbac.roles')}</h1>
          <p className="text-xs text-gray-400">
            {stats ? `${stats.total_roles} ${t('rbac.roles.subtitle').replace('·', '·')} ${stats.total_permissions} ${t('modules.rbac.permissions').toLowerCase()}` : t('common.loading')}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
          <Plus className="w-3.5 h-3.5" />
          {t('modules.rbac.newRole')}
        </button>
      </div>
      <div className="flex-1 overflow-hidden p-4">
        <DataGrid rowData={roles} columnDefs={columnDefs} loading={loading} pagination paginationPageSize={25} rowHeight={44} />
      </div>
    </div>
  );

  return (
    <>
      <MasterLayout leftContent={leftPanel} mainContent={mainPanel} />
      {showCreate && <CreateRoleModal onClose={() => setShowCreate(false)} onCreated={fetchRoles} />}
      {cloneTarget && <CloneRoleModal role={cloneTarget} onClose={() => setCloneTarget(null)} onCloned={fetchRoles} />}
      {deleteTarget && <DeleteRoleModal role={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={fetchRoles} />}
    </>
  );
}
