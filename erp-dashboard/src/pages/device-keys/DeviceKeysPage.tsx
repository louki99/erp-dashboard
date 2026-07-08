import { useState } from 'react';
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
    X,
    User,
    Building2,
    Hash,
    Activity,
    ShieldCheck,
    Unlock,
} from 'lucide-react';
import { isAxiosError } from 'axios';
import { cn } from '@/lib/utils';

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

function DeviceKeyDetail({
    device,
    onBack,
}: {
    device: DeviceKey;
    onBack?: () => void;
}) {
    const isRevoked = !!device.revoked_at;
    const isLocked = !!device.locked_until && new Date(device.locked_until) > new Date();
    const statusAccent = isRevoked ? 'red' : isLocked ? 'amber' : device.activated_at ? 'green' : 'blue';
    const StatusIcon = isRevoked ? Lock : isLocked ? AlertTriangle : device.activated_at ? ShieldCheck : Unlock;
    const statusLabel = isRevoked ? 'Révoqué' : isLocked ? 'Verrouillé' : device.activated_at ? 'Activé' : 'Actif';

    return (
        <div className="h-full bg-slate-50/60 flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sage-100 text-sage-700">
                        <User className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">
                            {device.user?.name ?? `Utilisateur #${device.user_id}`}
                        </h1>
                        <p className="text-sm text-gray-500">{device.user?.email}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className={cn(
                        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                        isRevoked ? 'bg-red-100 text-red-700' : isLocked ? 'bg-amber-100 text-amber-700' : device.activated_at ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                    )}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {statusLabel}
                    </div>
                    {onBack && (
                        <Button variant="outline" size="sm" onClick={onBack} className="ml-2">
                            <X className="mr-1.5 h-4 w-4" />
                            Fermer
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DetailCard title="Statut & Sécurité" icon={StatusIcon} accent={statusAccent}>
                        <div className="flex items-center gap-2 mb-3">
                            <StatusIcon className="h-5 w-5 text-gray-500" />
                            <span className="font-semibold text-lg">{statusLabel}</span>
                        </div>
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
    const { data, isLoading, refetch } = useDeviceKeys(filters);

    const [selectedDevice, setSelectedDevice] = useState<DeviceKey | null>(null);
    const [showDetailPanel, setShowDetailPanel] = useState(false);
    const [editingDevice, setEditingDevice] = useState<DeviceKey | null | undefined>(undefined);
    const [deviceToDelete, setDeviceToDelete] = useState<DeviceKey | null>(null);
    const [forceDelete, setForceDelete] = useState(false);
    const [pinDevice, setPinDevice] = useState<DeviceKey | null>(null);
    const [pinValue, setPinValue] = useState('');

    const { data: users = [] } = useUsersOptions();
    const { data: branches = [] } = useBranchesOptions();
    const { data: series = [] } = useTokenSeriesOptions();

    const createDevice = useCreateDeviceKey();
    const updateDevice = useUpdateDeviceKey(editingDevice?.id ?? 0);
    const deleteDevice = useDeleteDeviceKey();
    const revokeDevice = useRevokeDeviceKey();
    const restoreDevice = useRestoreDeviceKey();
    const rotateDevice = useRotateDeviceKey();
    const resetDevicePin = useResetDevicePin();
    const setDevicePin = useSetDevicePin();

    const handleSelect = (device: DeviceKey) => {
        setSelectedDevice(device);
        setShowDetailPanel(true);
    };

    const handleFormSubmit = async (payload: CreateDeviceKeyPayload | UpdateDeviceKeyPayload) => {
        try {
            if (editingDevice) {
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
            setEditingDevice(undefined);
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
            if (selectedDevice?.id === deviceToDelete.id) {
                setSelectedDevice(null);
                setShowDetailPanel(false);
            }
        } catch (error) {
            if (isAxiosError(error) && error.response?.status === 409) {
                toast.error(error.response.data.message ?? 'Device actif. Cochez "Forcer" ou révoquez-le d\'abord.');
            } else {
                toast.error(getErrorMessage(error));
            }
        }
    };

    const handleRevoke = async () => {
        if (!selectedDevice) return;
        try {
            await revokeDevice.mutateAsync(selectedDevice.id);
            toast.success('Device révoqué.');
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleRestore = async () => {
        if (!selectedDevice) return;
        try {
            await restoreDevice.mutateAsync(selectedDevice.id);
            toast.success('Device restauré.');
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleRotate = async () => {
        if (!selectedDevice) return;
        try {
            const result = await rotateDevice.mutateAsync({ id: selectedDevice.id });
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
        if (!selectedDevice) return;
        try {
            await resetDevicePin.mutateAsync(selectedDevice.id);
            toast.success('PIN réinitialisé. L\'utilisateur doit définir un nouveau PIN.');
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

    const handlePageChange = (page: number) => {
        setFilters((prev) => ({ ...prev, page }));
    };

    const userOptions = users.map((u) => ({ value: u.value, label: u.label }));
    const branchOptions = branches.map((b) => ({ value: b.value, label: b.label }));
    const seriesOptions = series.map((s) => ({ value: s.value, label: s.label }));

    const isRevoked = !!selectedDevice?.revoked_at;

    const actionGroups = [
        {
            items: [
                {
                    icon: Plus,
                    label: 'Nouveau device',
                    variant: 'primary' as const,
                    onClick: () => setEditingDevice(null),
                },
                {
                    icon: RotateCcw,
                    label: 'Rafraîchir',
                    variant: 'default' as const,
                    onClick: () => refetch(),
                },
            ],
        },
        ...(selectedDevice
            ? [
                {
                    items: [
                        {
                            icon: Edit2,
                            label: 'Éditer',
                            variant: 'default' as const,
                            onClick: () => setEditingDevice(selectedDevice),
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
                            onClick: () => setPinDevice(selectedDevice),
                        },
                        {
                            icon: Trash2,
                            label: 'Supprimer',
                            variant: 'danger' as const,
                            onClick: () => setDeviceToDelete(selectedDevice),
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
                    <div className="p-4 border-b border-gray-100 shrink-0">
                        <div className="flex items-center gap-2 mb-3">
                            <Smartphone className="h-5 w-5 text-sage-600" />
                            <h1 className="text-sm font-semibold text-gray-900">Clés devices</h1>
                        </div>
                        <div className="space-y-2">
                            <SearchableSelect
                                options={[{ value: '', label: 'Tous les utilisateurs' }, ...userOptions]}
                                value={filters.user_id ?? ''}
                                onChange={(value) => setFilters((prev) => ({ ...prev, user_id: value ? Number(value) : undefined, page: 1 }))}
                                placeholder="Utilisateur"
                            />
                            <SearchableSelect
                                options={[{ value: '', label: 'Toutes les branches' }, ...branchOptions]}
                                value={filters.branch_code ?? ''}
                                onChange={(value) => setFilters((prev) => ({ ...prev, branch_code: value ? String(value) : undefined, page: 1 }))}
                                placeholder="Branche"
                            />
                            <SearchableSelect
                                options={[{ value: '', label: 'Toutes les séries' }, ...seriesOptions]}
                                value={filters.token_series_code ?? ''}
                                onChange={(value) => setFilters((prev) => ({ ...prev, token_series_code: value ? String(value) : undefined, page: 1 }))}
                                placeholder="Série"
                            />
                            <SearchableSelect
                                options={[
                                    { value: '', label: 'Tous les statuts' },
                                    { value: 'true', label: 'Révoqués' },
                                    { value: 'false', label: 'Actifs' },
                                ]}
                                value={filters.revoked === undefined ? '' : String(filters.revoked)}
                                onChange={(value) => setFilters((prev) => ({ ...prev, revoked: value === '' ? undefined : value === 'true', page: 1 }))}
                                placeholder="Statut"
                            />
                        </div>
                    </div>
                    <div className="flex-1 min-h-0 p-2">
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full">
                            <DeviceKeysTable
                                response={data}
                                loading={isLoading}
                                selected={selectedDevice}
                                onSelect={handleSelect}
                                onPageChange={handlePageChange}
                            />
                        </div>
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full flex flex-col">
                    <Dialog open={editingDevice !== undefined} onOpenChange={(open) => !open && setEditingDevice(undefined)}>
                        <DialogContent className="max-w-2xl">
                            <DeviceKeyForm
                                key={editingDevice ? `edit-${editingDevice.id}` : 'create'}
                                device={editingDevice ?? null}
                                onSubmit={handleFormSubmit}
                                onCancel={() => setEditingDevice(undefined)}
                                loading={createDevice.isPending || updateDevice.isPending}
                            />
                        </DialogContent>
                    </Dialog>

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
                                            <br />
                                            <br />
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
                                <Button variant="outline" onClick={() => { setDeviceToDelete(null); setForceDelete(false); }}>
                                    Annuler
                                </Button>
                                <Button variant="destructive" onClick={handleDelete} disabled={deleteDevice.isPending}>
                                    Supprimer
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

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
                                <Button variant="outline" onClick={() => { setPinDevice(null); setPinValue(''); }}>
                                    Annuler
                                </Button>
                                <Button onClick={handleSetPin} disabled={setDevicePin.isPending}>
                                    Définir
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {showDetailPanel && selectedDevice ? (
                        <DeviceKeyDetail
                            device={selectedDevice}
                            onBack={() => setShowDetailPanel(false)}
                        />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                            <Smartphone className="w-16 h-16 text-gray-300 mb-4" />
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">Clés devices</h3>
                            <p className="text-sm text-gray-500 max-w-md">
                                Cliquez sur un device dans la liste pour voir ses détails et actions.
                            </p>
                        </div>
                    )}
                </div>
            }
            rightContent={<ActionPanel groups={actionGroups} />}
        />
    );
}
