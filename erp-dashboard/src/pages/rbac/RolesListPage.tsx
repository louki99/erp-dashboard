import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Lock, Plus, Shield, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { rbacApi } from '@/services/api/rbacApi';
import type { RbacRole, RbacStats } from '@/types/rbac.types';
import { RbacNav } from './RbacNav';

// ── Helpers ───────────────────────────────────────────────────────────────────

const StatChip = ({ label, value }: { label: string; value: number }) => (
  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
    <span className="font-bold">{value}</span>
    <span className="font-normal">{label}</span>
  </span>
);

const ProtectedDot = ({ value }: { value: boolean }) => (
  <span className="inline-flex items-center gap-1.5 text-xs">
    <span className={`w-2 h-2 rounded-full ${value ? 'bg-amber-500' : 'bg-gray-300'}`} />
    {value ? 'Oui' : 'Non'}
  </span>
);

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
      toast.success('Role created successfully');
      onCreated();
      onClose();
    } catch {
      toast.error('Error creating role');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Nouveau rôle</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du rôle</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="ex: manager-commercial"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
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

// ── Clone Role Modal ──────────────────────────────────────────────────────────

interface CloneModalProps {
  role: RbacRole;
  onClose: () => void;
  onCloned: () => void;
}

const CloneRoleModal = ({ role, onClose, onCloned }: CloneModalProps) => {
  const [name, setName] = useState(`${role.name}-copie`);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Veuillez saisir un nom'); return; }
    setSaving(true);
    try {
      await rbacApi.cloneRole(role.name, { name: name.trim() });
      toast.success('Rôle cloné avec succès');
      onCloned();
      onClose();
    } catch {
      toast.error('Erreur lors du clonage');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Cloner « {role.name} »</h2>
        <p className="text-sm text-gray-500 mb-4">
          {role.permissions.length} permission(s) seront copiées dans le nouveau rôle.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du nouveau rôle</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Clonage…' : 'Cloner'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Delete Confirm Modal ──────────────────────────────────────────────────────

interface DeleteModalProps {
  role: RbacRole;
  onClose: () => void;
  onDeleted: () => void;
}

const DeleteRoleModal = ({ role, onClose, onDeleted }: DeleteModalProps) => {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await rbacApi.deleteRole(role.name);
      toast.success('Rôle supprimé');
      onDeleted();
      onClose();
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string; error?: string } } };
      const msg =
        anyErr?.response?.data?.message ??
        anyErr?.response?.data?.error ??
        'Erreur lors de la suppression';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Supprimer « {role.name} » ?</h2>
        {role.users_count > 0 && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <strong>{role.users_count} utilisateur(s)</strong> ont ce rôle. Le backend rejettera
            la suppression si des utilisateurs y sont encore assignés.
          </div>
        )}
        <p className="text-sm text-gray-500 mb-4">Cette action est irréversible.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Annuler
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export function RolesListPage() {
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
      toast.error('Erreur lors du chargement des rôles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const columnDefs = useMemo(() => [
    {
      headerName: 'Nom',
      field: 'name',
      flex: 2,
      minWidth: 160,
      cellRenderer: (p: any) => {
        const row: RbacRole = p.data;
        if (!row) return null;
        return (
          <div className="flex items-center gap-2 h-full">
            {row.is_root && <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" title="Rôle root — lecture seule" />}
            {row.is_protected && !row.is_root && (
              <Shield className="w-3.5 h-3.5 text-amber-500 shrink-0" title="Rôle protégé" />
            )}
            <span className="font-medium text-gray-900">{row.name}</span>
          </div>
        );
      },
    },
    {
      headerName: 'Permissions',
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
      headerName: 'Utilisateurs',
      field: 'users_count',
      width: 120,
      flex: 0,
      cellRenderer: (p: any) => <span className="text-sm text-gray-600">{p.value}</span>,
    },
    {
      headerName: 'Protégé',
      field: 'is_protected',
      width: 110,
      flex: 0,
      cellRenderer: (p: any) => <ProtectedDot value={!!p.value} />,
    },
    {
      headerName: 'Actions',
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
            <button
              onClick={() => navigate(`/rbac/matrix?role=${encodeURIComponent(row.name)}`)}
              className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 border border-indigo-200"
            >
              Matrice
            </button>
            <button
              onClick={() => setCloneTarget(row)}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
              title="Cloner"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDeleteTarget(row)}
              disabled={row.is_protected}
              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md disabled:opacity-30 disabled:cursor-not-allowed"
              title={row.is_protected ? 'Rôle protégé — suppression impossible' : 'Supprimer'}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      },
    },
  ], [navigate, setCloneTarget, setDeleteTarget]);

  const leftPanel = (
    <RbacNav stats={stats ? {
      total_roles: stats.total_roles,
      total_permissions: stats.total_permissions,
      total_users: stats.total_users_with_roles,
    } : undefined} />
  );

  const mainPanel = (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Rôles</h1>
            <p className="text-xs text-gray-400">
              {stats ? `${stats.total_roles} rôles · ${stats.total_permissions} permissions` : 'Chargement…'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-3.5 h-3.5" />
          Nouveau rôle
        </button>
      </div>

      {/* DataGrid */}
      <div className="flex-1 overflow-hidden p-4">
        <DataGrid
          rowData={roles}
          columnDefs={columnDefs}
          loading={loading}
          pagination
          paginationPageSize={25}
          rowHeight={44}
        />
      </div>
    </div>
  );

  return (
    <>
      <MasterLayout leftContent={leftPanel} mainContent={mainPanel} />
      {showCreate && (
        <CreateRoleModal onClose={() => setShowCreate(false)} onCreated={fetchRoles} />
      )}
      {cloneTarget && (
        <CloneRoleModal role={cloneTarget} onClose={() => setCloneTarget(null)} onCloned={fetchRoles} />
      )}
      {deleteTarget && (
        <DeleteRoleModal role={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={fetchRoles} />
      )}
    </>
  );
}
