import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import {
  Truck, Search, RefreshCw, Power,
  PackageX, Plus, X, UserCircle2, Pencil, Wrench, UserX,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { DataGrid } from '@/components/common/DataGrid';
import { ConfirmModal } from '@/components/common/Modal';
import { useAuth } from '@/context/AuthContext';
import {
  useRidersWithVehicles,
  useFleetVehicles,
  useToggleRiderActive,
  useUnassignVehicle,
  useRetireVehicle,
} from '@/hooks/dispatcher/useDispatcherFleet';
import { VehicleForm } from '@/components/dispatcher/fleet/VehicleForm';
import { VehicleDetailCard } from '@/components/dispatcher/fleet/VehicleDetailCard';
import { RiderDetailCard } from '@/components/dispatcher/fleet/RiderDetailCard';
import { AssignVehiclePanel } from '@/components/dispatcher/fleet/AssignVehiclePanel';
import { AssignRiderPanel } from '@/components/dispatcher/fleet/AssignRiderPanel';
import { EditAssignmentPanel } from '@/components/dispatcher/fleet/EditAssignmentPanel';
import type { RiderWithVehicles, Vehicle } from '@/types/dispatcher.types';

const VEHICLE_CREATE_ROLES = ['root', 'admin', 'supervisor'];

type CenterMode = 'detail' | 'createVehicle' | 'editVehicle' | 'assignVehicle' | 'assignRider' | 'editAssignment';

const extractErrorMessage = (err: unknown): string => {
  const data = err && typeof err === 'object' && 'response' in err
    ? (err.response as { data?: { violations?: Array<{ constraint?: string; reason: string; context?: unknown }>; message?: string } })?.data
    : undefined;
  const violations = data?.violations;
  if (violations?.length) return violations.map((v) => v.reason).join(' · ');
  return data?.message ?? "Échec de l'action";
};

const initials = (name?: string) =>
  (name ?? '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

// ─── Main page ────────────────────────────────────────────────────────────────

export const DispatcherFleetPage = () => {
  const [viewMode, setViewMode] = useState<'riders' | 'vehicles'>('riders');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [centerMode, setCenterMode] = useState<CenterMode>('detail');
  const [confirmUnassign, setConfirmUnassign] = useState<{ vehicle: Vehicle; riderName: string } | null>(null);
  const [confirmRetire, setConfirmRetire] = useState<Vehicle | null>(null);

  const { user } = useAuth();
  // Same root/admin/supervisor gate as creation covers update + retire (per backend).
  const canManageVehicle = useMemo(() => (user?.roles?.all ?? []).some((r) => VEHICLE_CREATE_ROLES.includes(r.toLowerCase())), [user]);

  const { data: riders, loading, refetch } = useRidersWithVehicles({ search: search || undefined, status: statusFilter || undefined });
  const { data: vehicles, loading: vehiclesLoading, refetch: refetchVehicles } = useFleetVehicles();

  const { toggle, loading: toggling } = useToggleRiderActive();
  const { unassign, loading: unassigning } = useUnassignVehicle();
  const { retire, loading: retiring } = useRetireVehicle();

  const selectedRider = useMemo(() => riders.find((r) => r.id === selectedId) ?? null, [riders, selectedId]);
  const riderByVehicleId = useMemo(() => {
    const map = new Map<number, RiderWithVehicles>();
    riders.forEach((r) => r.vehicles?.forEach((v) => map.set(v.id, r)));
    return map;
  }, [riders]);
  const selectedVehicle = useMemo(() => vehicles.find((v) => v.id === selectedVehicleId) ?? null, [vehicles, selectedVehicleId]);
  const selectedVehicleRider = selectedVehicleId != null ? riderByVehicleId.get(selectedVehicleId) : undefined;

  const assignedVehicleIds = useMemo(() => new Set(riders.flatMap((r) => r.vehicles?.map((v) => v.id) ?? [])), [riders]);
  const availableVehicles = useMemo(() => vehicles.filter((v) => !assignedVehicleIds.has(v.id)), [vehicles, assignedVehicleIds]);
  const ridersWithoutVehicle = useMemo(() => riders.filter((r) => !r.vehicles?.length), [riders]);

  const branchOptions = useMemo(() => {
    const map = new Map<string, string>();
    riders.forEach((r) => { if (r.branch?.code) map.set(r.branch.code, r.branch.name ?? r.branch.code); });
    vehicles.forEach((v) => { if (v.branch_code && !map.has(v.branch_code)) map.set(v.branch_code, v.branch_code); });
    return [...map.entries()].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [riders, vehicles]);

  const filteredVehicles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) => [v.plate_number, v.plate, v.internal_code, v.make, v.model].some((f) => f?.toLowerCase().includes(q)));
  }, [vehicles, search]);

  const backToDetail = () => setCenterMode('detail');
  const afterMutation = () => { refetch(); refetchVehicles(); backToDetail(); };

  const handleToggleActive = async () => {
    if (!selectedRider) return;
    try {
      const res = await toggle(selectedRider.id);
      if (res.success) { toast.success(res.message || (res.is_active ? 'Livreur activé' : 'Livreur désactivé')); refetch(); }
      else toast.error(res.message || "Échec de l'action");
    } catch (err: unknown) { toast.error(extractErrorMessage(err)); }
  };

  const performUnassign = async () => {
    if (!confirmUnassign) return;
    try {
      const res = await unassign(confirmUnassign.vehicle.id);
      if (res.success) { toast.success(res.message || 'Véhicule retiré'); refetch(); refetchVehicles(); setConfirmUnassign(null); }
      else toast.error(res.message || 'Échec du retrait');
    } catch (err: unknown) { toast.error(extractErrorMessage(err), { duration: 6000 }); }
  };

  const performRetire = async () => {
    if (!confirmRetire) return;
    try {
      const res = await retire(confirmRetire.id);
      if (res.success) {
        toast.success(res.message || 'Véhicule retiré de la flotte.');
        setSelectedVehicleId(null);
        setCenterMode('detail');
        refetch(); refetchVehicles(); setConfirmRetire(null);
      } else toast.error(res.message || 'Échec du retrait');
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err.response as { data?: { error_code?: string; message?: string } })?.data
        : undefined;
      // 422 DISPATCHER_VEHICLE_ASSIGNED → vehicle still assigned, must unassign first.
      if (data?.error_code === 'DISPATCHER_VEHICLE_ASSIGNED') {
        toast.error(data.message || "Ce véhicule est affecté à un livreur — désaffectez-le d'abord.", { duration: 7000 });
      } else {
        toast.error(extractErrorMessage(err), { duration: 6000 });
      }
      setConfirmRetire(null);
    }
  };

  // The vehicle backing an "edit assignment" — depends on which side we're viewing.
  const editVehicle = viewMode === 'riders' ? selectedRider?.vehicles?.[0] ?? null : selectedVehicle;

  // ── Left (DataGrid) ────────────────────────────────────────────────────────

  const riderColumns = useMemo<ColDef<RiderWithVehicles>[]>(() => [
    {
      headerName: '', width: 52, sortable: false, suppressMovable: true,
      cellRenderer: ({ data }: { data?: RiderWithVehicles }) => {
        const r = data!;
        return <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${r.is_active ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gray-300'}`}>{initials(r.name)}</div>;
      },
    },
    {
      headerName: 'Code', width: 110,
      valueGetter: ({ data }: { data?: RiderWithVehicles }) => data?.code ?? '—',
      cellRenderer: ({ data }: { data?: RiderWithVehicles }) => <span className="font-mono text-[11px] text-gray-500">{data?.code ?? '—'}</span>,
    },
    {
      headerName: 'Nom', width: 160,
      valueGetter: ({ data }: { data?: RiderWithVehicles }) => data?.name ?? '',
      cellRenderer: ({ data }: { data?: RiderWithVehicles }) => <span className="text-xs font-semibold text-gray-800">{data?.name}</span>,
    },
    {
      headerName: 'Téléphone', width: 130,
      cellRenderer: ({ data }: { data?: RiderWithVehicles }) => <span className="text-xs text-gray-600">{data?.phone || '—'}</span>,
    },
    {
      headerName: 'Véhicule', width: 120, sortable: false,
      cellRenderer: ({ data }: { data?: RiderWithVehicles }) => {
        const v = data?.vehicles?.[0];
        return v
          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold"><Truck size={11} /> {v.plate_number ?? v.plate}</span>
          : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-bold"><PackageX size={11} /> Sans</span>;
      },
    },
    {
      headerName: 'Statut', width: 100,
      valueGetter: ({ data }: { data?: RiderWithVehicles }) => (data?.is_active ? 'Actif' : 'Inactif'),
      cellRenderer: ({ data }: { data?: RiderWithVehicles }) => {
        const active = data?.is_active ?? false;
        return <span className="inline-flex items-center gap-1.5 text-xs"><span className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-300'}`} />{active ? 'Actif' : 'Inactif'}</span>;
      },
    },
  ], []);

  const vehicleColumns = useMemo<ColDef<Vehicle>[]>(() => [
    {
      headerName: '', width: 52, sortable: false, suppressMovable: true,
      cellRenderer: () => <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center"><Truck size={13} className="text-gray-500" /></div>,
    },
    {
      headerName: 'Code', width: 120,
      valueGetter: ({ data }: { data?: Vehicle }) => data?.internal_code ?? '—',
      cellRenderer: ({ data }: { data?: Vehicle }) => <span className="font-mono text-[11px] text-gray-500">{data?.internal_code || '—'}</span>,
    },
    {
      headerName: 'Plaque', width: 130,
      valueGetter: ({ data }: { data?: Vehicle }) => data?.plate_number ?? data?.plate ?? '',
      cellRenderer: ({ data }: { data?: Vehicle }) => <span className="text-xs font-semibold text-gray-800">{data?.plate_number ?? data?.plate ?? '—'}</span>,
    },
    {
      headerName: 'Type', width: 100,
      cellRenderer: ({ data }: { data?: Vehicle }) => <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">{data?.type ?? '—'}</span>,
    },
    {
      headerName: 'Livreur', width: 150, sortable: false,
      cellRenderer: ({ data }: { data?: Vehicle }) => {
        const r = data ? riderByVehicleId.get(data.id) : undefined;
        return r
          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold max-w-[130px] truncate"><UserCircle2 size={11} className="shrink-0" /><span className="truncate">{r.name}</span></span>
          : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 text-[10px] font-bold"><UserX size={11} /> Disponible</span>;
      },
    },
    {
      headerName: 'Statut', width: 120,
      valueGetter: ({ data }: { data?: Vehicle }) => data?.status ?? '',
      cellRenderer: ({ data }: { data?: Vehicle }) => {
        const s = data?.status ?? 'active';
        const cls = s === 'active' ? 'bg-emerald-50 text-emerald-700' : s === 'maintenance' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500';
        const label = s === 'active' ? 'Actif' : s === 'maintenance' ? 'Maintenance' : s === 'retired' ? 'Retiré' : s;
        return <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold capitalize ${cls}`}>{label}</span>;
      },
    },
  ], [riderByVehicleId]);

  const leftContent = (
    <div className="h-full bg-white flex flex-col">
      <div className="p-4 border-b border-gray-100 shrink-0">
        <h1 className="text-sm font-bold text-gray-900 flex items-center gap-2"><UserCircle2 size={18} className="text-sage-600" /> Flotte & Livreurs</h1>
        <div className="flex gap-1 mt-3 p-1 bg-gray-100 rounded-lg">
          <button onClick={() => { setViewMode('riders'); setCenterMode('detail'); setSelectedVehicleId(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${viewMode === 'riders' ? 'bg-white text-sage-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <UserCircle2 size={13} /> Livreurs ({riders.length})
          </button>
          <button onClick={() => { setViewMode('vehicles'); setCenterMode('detail'); setSelectedId(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${viewMode === 'vehicles' ? 'bg-white text-sage-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Truck size={13} /> Véhicules ({vehicles.length})
          </button>
        </div>
        <div className="relative mt-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={viewMode === 'riders' ? 'Rechercher un livreur...' : 'Rechercher un véhicule...'}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-sage-200 focus:border-sage-400 outline-none" />
        </div>
        {viewMode === 'riders' && (
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full mt-2 px-3 py-1.5 text-xs border border-gray-200 rounded-lg">
            <option value="">Tous les statuts</option>
            <option value="approved">Actifs</option>
          </select>
        )}
      </div>

      <div className="flex-1 min-h-0 p-2">
        <div className="h-full rounded-lg border border-gray-200 overflow-hidden">
          {viewMode === 'riders' ? (
            <DataGrid rowData={riders} columnDefs={riderColumns} loading={loading} rowSelection="single" rowHeight={48} suppressAutoFit
              onRowSelected={(row: RiderWithVehicles) => { setSelectedId(row.id); setCenterMode('detail'); }} />
          ) : (
            <DataGrid rowData={filteredVehicles} columnDefs={vehicleColumns} loading={vehiclesLoading} rowSelection="single" rowHeight={48} suppressAutoFit
              onRowSelected={(row: Vehicle) => { setSelectedVehicleId(row.id); setCenterMode('detail'); }} />
          )}
        </div>
      </div>
    </div>
  );

  // ── Center ─────────────────────────────────────────────────────────────────

  const emptyState = (icon: React.ReactNode, title: string, hint: string) => (
    <div className="h-full flex flex-col items-center justify-center text-center">
      {icon}
      <h3 className="text-lg font-semibold text-gray-700 mb-1 mt-4">{title}</h3>
      <p className="text-sm text-gray-500">{hint}</p>
    </div>
  );

  let mainContent: React.ReactNode;
  if (centerMode === 'createVehicle') {
    mainContent = <VehicleForm mode="create" branches={branchOptions} defaultBranchCode={user?.branch_code} onBack={backToDetail} onSuccess={afterMutation} />;
  } else if (centerMode === 'editVehicle' && selectedVehicle) {
    mainContent = <VehicleForm mode="edit" vehicle={selectedVehicle} branches={branchOptions} onBack={backToDetail} onSuccess={afterMutation} />;
  } else if (centerMode === 'assignVehicle' && selectedRider) {
    mainContent = <AssignVehiclePanel rider={selectedRider} vehicles={availableVehicles} vehiclesLoading={vehiclesLoading} onBack={backToDetail} onAssigned={afterMutation} />;
  } else if (centerMode === 'assignRider' && selectedVehicle) {
    mainContent = <AssignRiderPanel vehicle={selectedVehicle} riders={ridersWithoutVehicle} ridersLoading={loading} onBack={backToDetail} onAssigned={afterMutation} />;
  } else if (centerMode === 'editAssignment' && editVehicle) {
    mainContent = <EditAssignmentPanel vehicle={editVehicle} onBack={backToDetail} onUpdated={afterMutation} />;
  } else {
    mainContent = (
      <div className="h-full overflow-y-auto bg-slate-50 p-6">
        {viewMode === 'vehicles'
          ? (selectedVehicle ? <VehicleDetailCard vehicle={selectedVehicle} assignedRider={selectedVehicleRider} /> : emptyState(<Truck size={56} className="text-gray-300" />, 'Aucun véhicule sélectionné', 'Sélectionnez un véhicule pour voir ses détails et son livreur'))
          : (selectedRider ? <RiderDetailCard rider={selectedRider} /> : emptyState(<UserCircle2 size={56} className="text-gray-300" />, 'Aucun livreur sélectionné', 'Sélectionnez un livreur pour voir ses détails et son véhicule'))}
      </div>
    );
  }

  // ── Right (ActionPanel) ────────────────────────────────────────────────────

  const inForm = centerMode !== 'detail';
  const actionGroups: { items: { icon: React.ElementType; label: string; variant?: 'primary' | 'sage' | 'default' | 'danger'; onClick: () => void; disabled?: boolean }[] }[] = [];

  const contextItems: { icon: React.ElementType; label: string; variant?: 'primary' | 'sage' | 'default' | 'danger'; onClick: () => void; disabled?: boolean }[] = [];
  if (!inForm && viewMode === 'riders' && selectedRider) {
    const veh = selectedRider.vehicles?.[0];
    if (!veh) contextItems.push({ icon: Plus, label: 'Assigner un véhicule', variant: 'sage', onClick: () => setCenterMode('assignVehicle') });
    else {
      contextItems.push({ icon: Pencil, label: "Modifier l'assignation", onClick: () => setCenterMode('editAssignment') });
      contextItems.push({ icon: X, label: 'Retirer le véhicule', variant: 'danger', disabled: unassigning || veh.has_active_shipments, onClick: () => setConfirmUnassign({ vehicle: veh, riderName: selectedRider.name }) });
    }
    contextItems.push({ icon: Power, label: selectedRider.is_active ? 'Désactiver' : 'Activer', disabled: toggling, onClick: handleToggleActive });
  }
  if (!inForm && viewMode === 'vehicles' && selectedVehicle) {
    if (!selectedVehicleRider) contextItems.push({ icon: Plus, label: 'Assigner un livreur', variant: 'sage', onClick: () => setCenterMode('assignRider') });
    else {
      contextItems.push({ icon: Pencil, label: "Modifier l'assignation", onClick: () => setCenterMode('editAssignment') });
      contextItems.push({ icon: X, label: 'Désaffecter', variant: 'danger', disabled: unassigning || selectedVehicle.has_active_shipments, onClick: () => setConfirmUnassign({ vehicle: selectedVehicle, riderName: selectedVehicleRider.name }) });
    }
    if (canManageVehicle) {
      contextItems.push({ icon: Wrench, label: 'Modifier le véhicule', onClick: () => setCenterMode('editVehicle') });
      contextItems.push({ icon: PackageX, label: 'Retirer de la flotte', variant: 'danger', disabled: retiring || !!selectedVehicleRider, onClick: () => setConfirmRetire(selectedVehicle) });
    }
  }
  if (contextItems.length) actionGroups.push({ items: contextItems });

  const generalItems: { icon: React.ElementType; label: string; variant?: 'primary' | 'sage' | 'default' | 'danger'; onClick: () => void; disabled?: boolean }[] = [];
  if (canManageVehicle) generalItems.push({ icon: Plus, label: 'Ajouter un véhicule', variant: 'primary', onClick: () => { setCenterMode('createVehicle'); } });
  generalItems.push({ icon: RefreshCw, label: 'Rafraîchir', variant: 'sage', onClick: () => { refetch(); refetchVehicles(); } });
  actionGroups.push({ items: generalItems });

  const rightContent = <ActionPanel groups={actionGroups} />;

  return (
    <>
      <MasterLayout leftContent={leftContent} mainContent={mainContent} rightContent={rightContent} />
      <ConfirmModal
        isOpen={confirmUnassign !== null}
        onClose={() => setConfirmUnassign(null)}
        onConfirm={performUnassign}
        title="Retirer le véhicule"
        message={confirmUnassign ? (
          <>Retirer <strong>{confirmUnassign.vehicle.plate_number ?? confirmUnassign.vehicle.plate}</strong> de <strong>{confirmUnassign.riderName}</strong> ? Le véhicule redeviendra disponible pour être assigné à un autre livreur.</>
        ) : ''}
        confirmText="Désaffecter"
        cancelText="Annuler"
        variant="danger"
        loading={unassigning}
      />
      <ConfirmModal
        isOpen={confirmRetire !== null}
        onClose={() => setConfirmRetire(null)}
        onConfirm={performRetire}
        title="Retirer de la flotte"
        message={confirmRetire ? (
          <>Retirer <strong>{confirmRetire.plate_number ?? confirmRetire.plate}</strong> de la flotte&nbsp;? Ce n'est pas une suppression&nbsp;: le véhicule passe en statut <strong>« retiré »</strong>, disparaît des listes actives mais reste consultable dans l'historique. Vous pourrez le réactiver via « Modifier le véhicule ».</>
        ) : ''}
        confirmText="Retirer de la flotte"
        cancelText="Annuler"
        variant="danger"
        loading={retiring}
      />
    </>
  );
};

export default DispatcherFleetPage;
