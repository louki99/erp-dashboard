import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SearchableSelect from '@/components/common/SearchableSelect';
import type {
    CreateDeviceKeyPayload,
    DeviceKey,
    UpdateDeviceKeyPayload,
} from '@/types/tokenSeries.types';
import { Save, X } from 'lucide-react';
import {
    useBranchesOptions,
    useTokenSeriesOptions,
    useUsersOptions,
} from '@/hooks/tokenSeries/useEntitySelectors';
import { cn } from '@/lib/utils';

interface DeviceKeyFormProps {
    device?: DeviceKey | null;
    onSubmit: (payload: CreateDeviceKeyPayload | UpdateDeviceKeyPayload) => void;
    onCancel: () => void;
    loading?: boolean;
    formRef?: React.RefObject<HTMLFormElement>;
    hideFooter?: boolean;
}

const DEVICE_TYPE_OPTIONS = [
    { value: 'android', label: 'Android' },
    { value: 'ios', label: 'iOS' },
    { value: 'tablet', label: 'Tablette' },
    { value: 'unknown', label: 'Inconnu' },
];

const emptyForm: CreateDeviceKeyPayload = {
    user_id: 0,
    device_type: 'android',
    branch_code: '',
    token_series_code: '',
    hardware_serial: '',
    device_model_code: '',
    push_token: '',
    app_version: '',
    os_version: '',
    peripherals: {},
    metadata: {},
};

function safeJsonStringify(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') {
        try {
            JSON.parse(value);
            return value;
        } catch {
            return value;
        }
    }
    return JSON.stringify(value, null, 2);
}

function safeJsonParse(value: string): Record<string, unknown> | null {
    if (!value.trim()) return null;
    try {
        return JSON.parse(value) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function getInitialForm(device: DeviceKey | null | undefined): CreateDeviceKeyPayload {
    if (!device) return emptyForm;
    return {
        user_id: device.user_id,
        device_type: device.device_type ?? 'android',
        branch_code: device.branch?.code ?? '',
        token_series_code: device.token_series_code ?? '',
        hardware_serial: device.hardware_serial ?? '',
        device_model_code: device.device_model_code ?? '',
        push_token: device.push_token ?? '',
        app_version: device.app_version ?? '',
        os_version: device.os_version ?? '',
        peripherals: device.peripherals ?? {},
        metadata: device.metadata ?? {},
    };
}

export function DeviceKeyForm({ device, onSubmit, onCancel, loading, formRef, hideFooter }: DeviceKeyFormProps) {
    const [form, setForm] = useState<CreateDeviceKeyPayload>(() => getInitialForm(device));
    const [activeTab, setActiveTab] = useState<'general' | 'json' | 'key'>('general');
    const [peripheralsJson, setPeripheralsJson] = useState(() => safeJsonStringify(form.peripherals));
    const [metadataJson, setMetadataJson] = useState(() => safeJsonStringify(form.metadata));
    const [jsonError, setJsonError] = useState<string | null>(null);
    const isEdit = Boolean(device);

    const { data: users = [], isLoading: isLoadingUsers } = useUsersOptions();
    const { data: branches = [], isLoading: isLoadingBranches } = useBranchesOptions();
    const { data: tokenSeries = [], isLoading: isLoadingSeries } = useTokenSeriesOptions();

    const update = <K extends keyof CreateDeviceKeyPayload>(key: K, value: CreateDeviceKeyPayload[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const userOptions = useMemo(
        () => users.map((u) => ({ value: u.value, label: u.label, description: u.description })),
        [users]
    );
    const branchOptions = useMemo(
        () => branches.map((b) => ({ value: b.value, label: b.label, description: b.description })),
        [branches]
    );
    const seriesOptions = useMemo(
        () => tokenSeries.map((s) => ({ value: s.value, label: s.label, description: s.description })),
        [tokenSeries]
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const peripherals = safeJsonParse(peripheralsJson);
        const metadata = safeJsonParse(metadataJson);
        if (peripheralsJson.trim() && peripherals === null) {
            setJsonError('JSON peripherals invalide');
            return;
        }
        if (metadataJson.trim() && metadata === null) {
            setJsonError('JSON metadata invalide');
            return;
        }
        setJsonError(null);

        const payload = {
            ...form,
            peripherals: peripherals ?? {},
            metadata: metadata ?? {},
        };

        if (isEdit) {
            const updatePayload = { ...payload } as unknown as UpdateDeviceKeyPayload;
            onSubmit(updatePayload);
        } else {
            onSubmit(payload);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{isEdit ? 'Modifier le device' : 'Nouveau device key'}</CardTitle>
            </CardHeader>
            <CardContent>
                <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex gap-2 border-b pb-2">
                        {(['general', 'json', 'key'] as const).map((tab) => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setActiveTab(tab)}
                                className={cn(
                                    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                                    activeTab === tab ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                                )}
                            >
                                {tab === 'general' ? 'Général' : tab === 'json' ? 'JSON' : 'Clé'}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'general' && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="user_id">Utilisateur *</Label>
                                <SearchableSelect
                                    options={userOptions}
                                    value={form.user_id}
                                    onChange={(value) => update('user_id', Number(value))}
                                    placeholder={isLoadingUsers ? 'Chargement…' : 'Sélectionner'}
                                    disabled={isEdit || isLoadingUsers}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="device_type">Type de device</Label>
                                <SearchableSelect
                                    options={DEVICE_TYPE_OPTIONS}
                                    value={form.device_type}
                                    onChange={(value) => update('device_type', String(value))}
                                    placeholder="Sélectionner"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="branch_code">Branche</Label>
                                <SearchableSelect
                                    options={branchOptions}
                                    value={form.branch_code}
                                    onChange={(value) => update('branch_code', String(value))}
                                    placeholder={isLoadingBranches ? 'Chargement…' : 'Sélectionner'}
                                    disabled={isLoadingBranches}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="token_series_code">Série de numérotation</Label>
                                <SearchableSelect
                                    options={seriesOptions}
                                    value={form.token_series_code}
                                    onChange={(value) => update('token_series_code', String(value))}
                                    placeholder={isLoadingSeries ? 'Chargement…' : 'Sélectionner'}
                                    disabled={isLoadingSeries}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="hardware_serial">N° série hardware</Label>
                                <Input
                                    id="hardware_serial"
                                    value={form.hardware_serial}
                                    onChange={(e) => update('hardware_serial', e.target.value)}
                                    placeholder="R52N8002ABC"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="device_model_code">Modèle</Label>
                                <Input
                                    id="device_model_code"
                                    value={form.device_model_code}
                                    onChange={(e) => update('device_model_code', e.target.value)}
                                    placeholder="SM-T505"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="app_version">Version app</Label>
                                <Input
                                    id="app_version"
                                    value={form.app_version}
                                    onChange={(e) => update('app_version', e.target.value)}
                                    placeholder="2.4.1"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="os_version">Version OS</Label>
                                <Input
                                    id="os_version"
                                    value={form.os_version}
                                    onChange={(e) => update('os_version', e.target.value)}
                                    placeholder="Android 13"
                                />
                            </div>

                            <div className="space-y-1.5 sm:col-span-2">
                                <Label htmlFor="push_token">Push token</Label>
                                <Input
                                    id="push_token"
                                    value={form.push_token}
                                    onChange={(e) => update('push_token', e.target.value)}
                                    placeholder="FCM/APNs token"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'json' && (
                        <div className="grid gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="peripherals">Périphériques (JSON)</Label>
                                <textarea
                                    id="peripherals"
                                    value={peripheralsJson}
                                    onChange={(e) => setPeripheralsJson(e.target.value)}
                                    rows={5}
                                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                    placeholder='{"printer": {"model": "Bluetooth-58mm", "ip": null}}'
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="metadata">Métadonnées (JSON)</Label>
                                <textarea
                                    id="metadata"
                                    value={metadataJson}
                                    onChange={(e) => setMetadataJson(e.target.value)}
                                    rows={5}
                                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                    placeholder='{}'
                                />
                            </div>
                            {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
                        </div>
                    )}

                    {activeTab === 'key' && (
                        <div className="space-y-4">
                            {!isEdit ? (
                                <>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="key">Clé personnalisée (optionnel)</Label>
                                        <Input
                                            id="key"
                                            value={(form as unknown as Record<string, unknown>).key as string ?? ''}
                                            onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value }))}
                                            placeholder="adm-xxx... (laisser vide pour génération auto)"
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Si aucune clé n'est fournie, le backend génère automatiquement une clé au format adm-{'{random32chars}'}.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-muted-foreground">
                                        La clé n'est pas modifiable depuis ce formulaire. Utilisez l'action "Tourner la clé" dans la liste.
                                    </p>
                                    <div className="rounded-md bg-muted p-3 font-mono text-xs break-all">
                                        {device?.key}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {!hideFooter && (
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={onCancel}>
                                <X className="mr-1.5 h-4 w-4" />
                                Annuler
                            </Button>
                            <Button type="submit" disabled={loading || !form.user_id}>
                                <Save className="mr-1.5 h-4 w-4" />
                                {isEdit ? 'Mettre à jour' : 'Créer'}
                            </Button>
                        </div>
                    )}
                </form>
            </CardContent>
        </Card>
    );
}
