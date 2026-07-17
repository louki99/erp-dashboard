import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

import SearchableSelect from '@/components/common/SearchableSelect';
import { DetailCard } from '@/components/common/DetailCard';
import { DeviceKeyForm, DeviceKeysTable } from '@/components/device-keys';
import {
    useCreateDeviceKey,
    useDeleteDeviceKey,
    useDeviceKeys,
    useRestoreDeviceKey,
    useRevokeDeviceKey,
    useRotateDeviceKey,
    useSetDevicePin,
    useResetDevicePin,
    useUpdateDeviceKey,
} from '@/hooks/tokenSeries/useDeviceKeys';
import {
    useBranchesOptions,
    useTokenSeriesOptions,
    useUsersOptions,
} from '@/hooks/tokenSeries/useEntitySelectors';
import type {
    CreateDeviceKeyPayload,
    DeviceKey,
    DeviceKeyFilters,
    UpdateDeviceKeyPayload,
} from '@/types/tokenSeries.types';
import {
    Plus,
    Smartphone,
    AlertTriangle,
    Lock,
    Edit2,
    Trash2,
    RotateCcw,
    Key,
    KeyRound,
    ArrowLeft,
    SlidersHorizontal,
    User,
    Building2,
    Hash,
    Activity,
    ShieldCheck,
    Unlock,
    Save,
    X,
} from 'lucide-react';
import { isAxiosError } from 'axios';

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) {
        return error.response?.data?.message ?? error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'Une erreur est survenue.';
}

const DEFAULT_FILTERS: DeviceKeyFilters = { per_page: 50, page: 1 };

function DeviceKeyDetail({ device }: { device: DeviceKey }) {
    const isRevoked = !!device.revoked_at;
    const isLocked = !!device.locked_until && new Date(device.locked_until) > new Date();
    const statusAccent = isRevoked ? 'red' : isLocked ? 'amber' : device.activated_at ? 'green' : 'blue';
    const StatusIcon = isRevoked ? Lock : isLocked ? AlertTriangle : device.activated_at ? ShieldCheck : Unlock;
    const statusLabel = isRevoked ? 'Révoqué' : isLocked ? 'Verrouillé' : device.activated_at ? 'Activé' : 'Actif';

    return (
        <div className="h-full bg-slate-50/60 flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sage-500 to-sage-600">
                        <User className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-gray-900">
                            {device.user?.name ?? `Utilisateur #${device.user_id}`}
                        </h1>
                        <p className="text-xs text-gray-500">{device.user?.email}</p>
                    </div>
                </div>
                <div className={[
                    'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                    isRevoked ? 'bg-red-100 text-red-700' : isLocked ? 'bg-amber-100 text-amber-700' : device.activated_at ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700',
                ].join(' ')}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {statusLabel}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DetailCard title="Statut & Sécurité" icon={StatusIcon} accent={statusAccent}>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Tentatives échouées</span>
                                <span className="font-mono font-medium">{device.failed_attempts}</span>
                            </div>
                            {isLocked && device.locked_until && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Verrouillé jusqu'à</span>
                                    <span className="font-medium">{new Date(device.locked_until).toLocaleString('fr-FR')}</span>
                                </div>
                            )}
                        </div>
                    </DetailCard>

                    <DetailCard title="Matériel" icon={Smartphone} accent="sage">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Type</span>
                                <span className="font-medium capitalize">{device.device_type ?? '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Modèle</span>
                                <span className="font-medium">{device.device_model_code ?? '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">N° série</span>
                                <span className="font-mono text-xs">{device.hardware_serial ?? '-'}</span>
                            </div>
                        </div>
                    </DetailCard>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DetailCard title="Assignation" icon={Building2} accent="blue">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Branche</span>
                                <span className="font-medium">{device.branch?.name ?? device.branch_id ?? '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Série</span>
                                <span className="font-mono">{device.token_series_code ?? '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Versions</span>
                                <span className="font-medium">App {device.app_version ?? '-'} / OS {device.os_version ?? '-'}</span>
                            </div>
                        </div>
                    </DetailCard>

                    <DetailCard title="Dernière activité" icon={Activity} accent="default">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Vu</span>
                                <span className="font-medium">{device.last_seen_at ? new Date(device.last_seen_at).toLocaleString('fr-FR') : '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Sync réussie</span>
                                <span className="font-medium">{device.last_successful_sync_at ? new Date(device.last_successful_sync_at).toLocaleString('fr-FR') : '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">IP</span>
                                <span className="font-mono text-xs">{device.last_known_ip ?? '-'}</span>
                            </div>
                        </div>
                    </DetailCard>
                </div>

                <DetailCard title="Clé d'authentification" icon={Hash} accent="amber">
                    <div className="flex items-center justify-between gap-3">
                        <code className="flex-1 rounded-lg bg-gray-900 px-4 py-3 text-xs text-emerald-400 break-all font-mono">
                            {device.key}
                        </code>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                navigator.clipboard.writeText(device.key);
                                toast.success('Clé copiée');
                            }}
                        >
                            Copier
                        </Button>
                    </div>
                </DetailCard>
            </div>
        </div>
    );
}

export function DeviceKeysPage() {
    const [filters, setFilters] = useState<DeviceKeyFilters>(DEFAULT_FILTERS);
    const [pendingFilters, setPendingFilters] = useState<DeviceKeyFilters>(DEFAULT_FILTERS);
    const { data, isLoading, refetch } = useDeviceKeys(filters);

    const [viewSelected, setViewSelected] = useState<DeviceKey | null>(null);
    const [formMode, setFormMode] = useState<'view' | 'create' | 'edit'>('view');
    const [editTarget, setEditTarget] = useState<DeviceKey | null>(null);
    const formRef = useRef<HTMLFormElement>(null);

    const [showFilters, setShowFilters] = useState(false);
    const [deviceToDelete, setDeviceToDelete] = useState<DeviceKey | null>(null);
    const [forceDelete, setForceDelete] = useState(false);
    const [pinDevice, setPinDevice] = useState<DeviceKey | null>(null);
    const [pinValue, setPinValue] = useState('');

    const { data: users = [] } = useUsersOptions();
    const { data: branches = [] } = useBranchesOptions();
    const { data: series = [] } = useTokenSeriesOptions();

    const createDevice = useCreateDeviceKey();
    const updateDevice = useUpdateDeviceKey(editTarget?.id ?? 0);
    const deleteDevice = useDeleteDeviceKey();
    const revokeDevice = useRevokeDeviceKey();
    const restoreDevice = useRestoreDeviceKey();
    const rotateDevice = useRotateDeviceKey();
    const resetDevicePin = useResetDevicePin();
    const setDevicePin = useSetDevicePin();

    const openCreate = () => { setFormMode('create'); setEditTarget(null); };
    const openEdit = (device: DeviceKey) => { setFormMode('edit'); setEditTarget(device); };
    const cancelForm = () => setFormMode('view');

    const handleSelect = (device: DeviceKey) => {
        setViewSelected(device);
        if (formMode === 'view') return;
    };

    const handleFormSubmit = async (payload: CreateDeviceKeyPayload | UpdateDeviceKeyPayload) => {
        try {
            if (formMode === 'edit' && editTarget) {
                await updateDevice.mutateAsync(payload as UpdateDeviceKeyPayload);
                toast.success('Device mis à jour.');
            } else {
                const result = await createDevice.mutateAsync(payload as CreateDeviceKeyPayload);
                toast.success(
                    <div className="space-y-1">
                        <p>Device créé.</p>
                        <p className="font-mono text-xs break-all">Clé : {result.key}</p>
                    </div>,
                    { duration: 8000 }
                );
            }
            cancelForm();
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleDelete = async () => {
        if (!deviceToDelete) return;
        try {
            await deleteDevice.mutateAsync({ id: deviceToDelete.id, force: forceDelete });
            toast.success('Device supprimé.');
            setDeviceToDelete(null);
            setForceDelete(false);
            if (viewSelected?.id === deviceToDelete.id) setViewSelected(null);
        } catch (error) {
            if (isAxiosError(error) && error.response?.status === 409) {
                toast.error(error.response.data.message ?? 'Device actif. Cochez "Forcer" ou révoquez-le d\'abord.');
            } else {
                toast.error(getErrorMessage(error));
            }
        }
    };

    const handleRevoke = async () => {
        if (!viewSelected) return;
        try {
            await revokeDevice.mutateAsync(viewSelected.id);
            toast.success('Device révoqué.');
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleRestore = async () => {
        if (!viewSelected) return;
        try {
            await restoreDevice.mutateAsync(viewSelected.id);
            toast.success('Device restauré.');
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleRotate = async () => {
        if (!viewSelected) return;
        try {
            const result = await rotateDevice.mutateAsync({ id: viewSelected.id });
            toast.success(
                <div className="space-y-1">
                    <p>Clé tournée.</p>
                    <p className="font-mono text-xs break-all">Nouvelle clé : {result.data.key}</p>
                </div>,
                { duration: 8000 }
            );
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleResetPin = async () => {
        if (!viewSelected) return;
        try {
            await resetDevicePin.mutateAsync(viewSelected.id);
            toast.success('PIN réinitialisé.');
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleSetPin = async () => {
        if (!pinDevice || !/^\d{4,8}$/.test(pinValue)) {
            toast.error('Le PIN doit contenir entre 4 et 8 chiffres.');
            return;
        }
        try {
            await setDevicePin.mutateAsync({ id: pinDevice.id, payload: { pin: pinValue } });
            toast.success('PIN défini.');
            setPinDevice(null);
            setPinValue('');
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handlePageChange = (page: number) => setFilters((prev) => ({ ...prev, page }));

    const applyFilters = () => {
        setFilters({ ...pendingFilters, page: 1 });
        setShowFilters(false);
    };

    const resetFilters = () => {
        setPendingFilters(DEFAULT_FILTERS);
        setFilters(DEFAULT_FILTERS);
        setShowFilters(false);
    };

    const activeFilterCount = [filters.user_id, filters.branch_code, filters.token_series_code, filters.revoked]
        .filter((v) => v !== undefined && v !== null && v !== '').length;

    const userOptions = users.map((u) => ({ value: u.value, label: u.label }));
    const branchOptions = branches.map((b) => ({ value: b.value, label: b.label }));
    const seriesOptions = series.map((s) => ({ value: s.value, label: s.label }));

    const isRevoked = !!viewSelected?.revoked_at;

    const actionGroups = formMode !== 'view'
        ? [
            {
                items: [
                    {
                        icon: Save,
                        label: 'Enregistrer',
                        variant: 'primary' as const,
                        onClick: () => formRef.current?.requestSubmit(),
                    },
                    {
                        icon: X,
                        label: 'Annuler',
                        variant: 'default' as const,
                        onClick: cancelForm,
                    },
                ],
            },
        ]
        : [
            {
                items: [
                    {
                        icon: Plus,
                        label: 'Nouveau device',
                        variant: 'primary' as const,
                        onClick: openCreate,
                    },
                    {
                        icon: RotateCcw,
                        label: 'Rafraîchir',
                        variant: 'default' as const,
                        onClick: () => refetch(),
                    },
                ],
            },
            ...(viewSelected
                ? [
                    {
                        items: [
                            {
                                icon: Edit2,
                                label: 'Éditer',
                                variant: 'default' as const,
                                onClick: () => openEdit(viewSelected),
                            },
                            ...(isRevoked
                                ? [{
                                    icon: RotateCcw,
                                    label: 'Restaurer',
                                    variant: 'success' as const,
                                    onClick: handleRestore,
                                }]
                                : [{
                                    icon: Lock,
                                    label: 'Révoquer',
                                    variant: 'warning' as const,
                                    onClick: handleRevoke,
                                }]),
                            {
                                icon: Key,
                                label: 'Tourner la clé',
                                variant: 'primary' as const,
                                onClick: handleRotate,
                            },
                            {
                                icon: KeyRound,
                                label: 'Reset PIN',
                                variant: 'default' as const,
                                onClick: handleResetPin,
                            },
                            {
                                icon: Lock,
                                label: 'Définir PIN',
                                variant: 'sage' as const,
                                onClick: () => setPinDevice(viewSelected),
                            },
                            {
                                icon: Trash2,
                                label: 'Supprimer',
                                variant: 'danger' as const,
                                onClick: () => setDeviceToDelete(viewSelected),
                            },
                        ],
                    },
                ]
                : []),
        ];

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                    <div className="p-3 border-b border-gray-100 shrink-0 space-y-2">
                        <div className="flex items-center gap-2">
                            <Smartphone className="h-4 w-4 text-sage-600 shrink-0" />
                            <h1 className="text-sm font-semibold text-gray-900">Clés devices</h1>
                            {data?.meta?.total !== undefined && (
                                <span className="text-[10px] text-muted-foreground">({data.meta.total})</span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => { setPendingFilters(filters); setShowFilters(true); }}
                            className="relative flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            <SlidersHorizontal className="h-3 w-3" />
                            Filtres
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-sage-600 text-[9px] font-bold text-white">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                    </div>

                    <div className="flex-1 min-h-0 p-2">
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full">
                            <DeviceKeysTable
                                response={data}
                                loading={isLoading}
                                selected={viewSelected}
                                onSelect={handleSelect}
                                onPageChange={handlePageChange}
                            />
                        </div>
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full flex flex-col">
                    {/* Filter modal */}
                    <Dialog open={showFilters} onOpenChange={setShowFilters}>
                        <DialogContent className="max-w-sm">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <SlidersHorizontal className="h-4 w-4" />
                                    Filtres
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3 py-2">
                                <div className="space-y-1">
                                    <Label className="text-xs">Utilisateur</Label>
                                    <SearchableSelect
                                        options={[{ value: '', label: 'Tous les utilisateurs' }, ...userOptions]}
                                        value={pendingFilters.user_id ?? ''}
                                        onChange={(value) => setPendingFilters((prev) => ({ ...prev, user_id: value ? Number(value) : undefined }))}
                                        placeholder="Utilisateur"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Branche</Label>
                                    <SearchableSelect
                                        options={[{ value: '', label: 'Toutes les branches' }, ...branchOptions]}
                                        value={pendingFilters.branch_code ?? ''}
                                        onChange={(value) => setPendingFilters((prev) => ({ ...prev, branch_code: value ? String(value) : undefined }))}
                                        placeholder="Branche"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Série</Label>
                                    <SearchableSelect
                                        options={[{ value: '', label: 'Toutes les séries' }, ...seriesOptions]}
                                        value={pendingFilters.token_series_code ?? ''}
                                        onChange={(value) => setPendingFilters((prev) => ({ ...prev, token_series_code: value ? String(value) : undefined }))}
                                        placeholder="Série"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Statut</Label>
                                    <SearchableSelect
                                        options={[
                                            { value: '', label: 'Tous les statuts' },
                                            { value: 'true', label: 'Révoqués' },
                                            { value: 'false', label: 'Actifs' },
                                        ]}
                                        value={pendingFilters.revoked === undefined ? '' : String(pendingFilters.revoked)}
                                        onChange={(value) => setPendingFilters((prev) => ({ ...prev, revoked: value === '' ? undefined : value === 'true' }))}
                                        placeholder="Statut"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={resetFilters}>Réinitialiser</Button>
                                <Button onClick={applyFilters}>Appliquer</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Delete dialog */}
                    <Dialog open={!!deviceToDelete} onOpenChange={(open) => { if (!open) { setDeviceToDelete(null); setForceDelete(false); } }}>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-destructive">
                                    <AlertTriangle className="h-5 w-5" />
                                    Supprimer le device ?
                                </DialogTitle>
                                <DialogDescription>
                                    {deviceToDelete && (
                                        <>
                                            Vous allez supprimer le device{' '}
                                            <Badge variant="outline">#{deviceToDelete.id}</Badge> de{' '}
                                            <strong>{deviceToDelete.user?.name ?? `User #${deviceToDelete.user_id}`}</strong>.
                                            <br /><br />
                                            {deviceToDelete.revoked_at ? (
                                                'Cette action est irréversible.'
                                            ) : (
                                                <>
                                                    Le device est encore actif. La suppression définitive retirera la ligne.
                                                    <div className="flex items-center gap-2 mt-3">
                                                        <Checkbox
                                                            id="force-delete"
                                                            checked={forceDelete}
                                                            onCheckedChange={(checked) => setForceDelete(checked === true)}
                                                        />
                                                        <Label htmlFor="force-delete" className="font-normal text-xs">
                                                            Forcer la suppression (?force=1)
                                                        </Label>
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    )}
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => { setDeviceToDelete(null); setForceDelete(false); }}>Annuler</Button>
                                <Button variant="destructive" onClick={handleDelete} disabled={deleteDevice.isPending}>Supprimer</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Set PIN dialog */}
                    <Dialog open={!!pinDevice} onOpenChange={(open) => { if (!open) { setPinDevice(null); setPinValue(''); } }}>
                        <DialogContent className="max-w-sm">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Lock className="h-5 w-5" />
                                    Définir le PIN
                                </DialogTitle>
                                <DialogDescription>
                                    Device #{pinDevice?.id} — {pinDevice?.user?.name}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2 py-2">
                                <Label htmlFor="pin">PIN (4 à 8 chiffres)</Label>
                                <Input
                                    id="pin"
                                    type="password"
                                    inputMode="numeric"
                                    pattern="\d{4,8}"
                                    value={pinValue}
                                    onChange={(e) => setPinValue(e.target.value)}
                                    placeholder="1234"
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => { setPinDevice(null); setPinValue(''); }}>Annuler</Button>
                                <Button onClick={handleSetPin} disabled={setDevicePin.isPending}>Définir</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Inline form */}
                    {formMode !== 'view' ? (
                        <div className="h-full flex flex-col">
                            <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-6 py-4 shrink-0">
                                <button
                                    type="button"
                                    onClick={cancelForm}
                                    className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                </button>
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sage-500 to-sage-600 shrink-0">
                                    <Smartphone className="h-4 w-4 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-base font-bold text-gray-900 leading-tight">
                                        {formMode === 'create' ? 'Nouveau device key' : 'Éditer le device'}
                                    </h2>
                                    {formMode === 'edit' && editTarget && (
                                        <p className="text-xs text-gray-500 truncate">
                                            {editTarget.user?.name ?? `User #${editTarget.user_id}`}
                                        </p>
                                    )}
                                </div>
                                <span className={[
                                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                    formMode === 'create'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-amber-100 text-amber-700',
                                ].join(' ')}>
                                    {formMode === 'create' ? 'Nouveau' : 'Édition'}
                                </span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6">
                                <DeviceKeyForm
                                    key={editTarget ? `edit-${editTarget.id}` : 'create'}
                                    device={editTarget}
                                    onSubmit={handleFormSubmit}
                                    onCancel={cancelForm}
                                    loading={createDevice.isPending || updateDevice.isPending}
                                    formRef={formRef}
                                    hideFooter
                                />
                            </div>
                        </div>
                    ) : viewSelected ? (
                        <DeviceKeyDetail device={viewSelected} />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sage-100 to-sage-200 mb-4">
                                <Smartphone className="w-8 h-8 text-sage-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">Clés devices</h3>
                            <p className="text-sm text-gray-500 max-w-md mb-4">
                                Sélectionnez un device dans la liste pour voir ses détails et effectuer des actions.
                            </p>
                            <Button variant="outline" size="sm" onClick={openCreate}>
                                <Plus className="mr-1.5 h-4 w-4" />
                                Nouveau device
                            </Button>
                        </div>
                    )}
                </div>
            }
            rightContent={<ActionPanel groups={actionGroups} />}
        />
    );
}
