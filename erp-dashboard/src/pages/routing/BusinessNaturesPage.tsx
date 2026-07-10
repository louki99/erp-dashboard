import { useState } from 'react';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import {
    Briefcase,
    Plus,
    Edit2,
    Trash2,
    RotateCcw,
    X,
    ShieldAlert,
    ListChecks,
    Code2,
} from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { DetailCard } from '@/components/common/DetailCard';
import { DataGrid } from '@/components/common/DataGrid';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/usePermissions';

import {
    useBusinessNatures,
    useCreateBusinessNature,
    useUpdateBusinessNature,
    useDeleteBusinessNature,
} from '@/hooks/routing/useRouting';
import type {
    ItineraryBusinessNature,
    CreateBusinessNaturePayload,
    BusinessNatureActionRules,
} from '@/types/routing.types';

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) return error.response?.data?.message ?? error.message;
    if (error instanceof Error) return error.message;
    return 'Une erreur est survenue.';
}

// ─── Detail view — action_rules rendered as readable badges ──────────────────

function BusinessNatureDetail({
    nature,
    onBack,
}: {
    nature: ItineraryBusinessNature;
    onBack?: () => void;
}) {
    const actions = nature.action_rules?.actions ?? [];

    return (
        <div className="h-full bg-slate-50/60 flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                        <Briefcase className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">{nature.label}</h1>
                        <p className="text-sm font-mono text-gray-500">{nature.code}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {nature.is_active !== false ? (
                        <Badge variant="success" className="text-[10px]">Actif</Badge>
                    ) : (
                        <Badge variant="secondary" className="text-[10px]">Inactif</Badge>
                    )}
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
                    <DetailCard title="Informations" icon={Briefcase} accent="sage">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Code</span>
                                <span className="font-mono font-medium">{nature.code}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Types de tournée liés</span>
                                <span className="font-medium">{nature.itinerary_types_count ?? '—'}</span>
                            </div>
                        </div>
                    </DetailCard>

                    <DetailCard title="Playbook" icon={ListChecks} accent="blue">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Actions définies</span>
                                <span className="font-medium">{actions.length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Obligatoires</span>
                                <span className="font-medium">{actions.filter((a) => a.required).length}</span>
                            </div>
                        </div>
                    </DetailCard>
                </div>

                {nature.description && (
                    <DetailCard title="Description" accent="default">
                        <p className="text-sm text-gray-700 leading-relaxed">{nature.description}</p>
                    </DetailCard>
                )}

                {/* Action rules — read-only badges (business JSON, not freely editable) */}
                <DetailCard title="Règles d'action (lecture seule)" icon={ListChecks} accent="default">
                    {actions.length === 0 ? (
                        <p className="text-sm text-gray-400">Aucune action définie dans ce playbook.</p>
                    ) : (
                        <div className="space-y-2">
                            {actions.map((action, idx) => (
                                <div
                                    key={`${action.visit_action_code}-${idx}`}
                                    className="flex items-center gap-2 p-2.5 border border-gray-200 rounded-lg bg-white"
                                >
                                    <Badge variant="secondary" className="font-mono text-[10px]">
                                        {action.visit_action_code}
                                    </Badge>
                                    {action.required && (
                                        <span className="text-xs text-red-500 font-medium">Obligatoire</span>
                                    )}
                                    <span className="text-xs text-gray-500 ml-auto">
                                        Déclencheur : {action.gates_any?.[0]?.[0] ?? 'always'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </DetailCard>

                {/* Raw JSON for auditing */}
                {nature.action_rules && (
                    <DetailCard title="JSON brut" icon={Code2} accent="default">
                        <pre className="text-[11px] font-mono bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto max-h-64">
                            {JSON.stringify(nature.action_rules, null, 2)}
                        </pre>
                    </DetailCard>
                )}
            </div>
        </div>
    );
}

// ─── Form — action_rules edited as validated raw JSON (admin only) ───────────

function BusinessNatureForm({
    nature,
    canEditRules,
    onSubmit,
    onCancel,
    loading,
}: {
    nature?: ItineraryBusinessNature | null;
    canEditRules: boolean;
    onSubmit: (payload: CreateBusinessNaturePayload) => void;
    onCancel: () => void;
    loading?: boolean;
}) {
    const [form, setForm] = useState({
        code: nature?.code ?? '',
        label: nature?.label ?? '',
        description: nature?.description ?? '',
        is_active: nature?.is_active !== false,
    });
    const [rulesJson, setRulesJson] = useState(
        nature?.action_rules ? JSON.stringify(nature.action_rules, null, 2) : ''
    );
    const [jsonError, setJsonError] = useState<string | null>(null);

    const validateJson = (value: string): BusinessNatureActionRules | null | 'invalid' => {
        if (!value.trim()) return null;
        try {
            const parsed = JSON.parse(value);
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                return 'invalid';
            }
            return parsed as BusinessNatureActionRules;
        } catch {
            return 'invalid';
        }
    };

    const handleRulesChange = (value: string) => {
        setRulesJson(value);
        setJsonError(validateJson(value) === 'invalid' ? 'JSON invalide — vérifiez la syntaxe.' : null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const rules = validateJson(rulesJson);
        if (rules === 'invalid') {
            setJsonError('JSON invalide — vérifiez la syntaxe.');
            return;
        }
        onSubmit({
            code: form.code,
            label: form.label,
            description: form.description || null,
            is_active: form.is_active,
            ...(canEditRules ? { action_rules: rules } : {}),
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="bn-code">Code</Label>
                    <Input
                        id="bn-code"
                        value={form.code}
                        onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                        placeholder="VAN_SALES"
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="bn-label">Libellé</Label>
                    <Input
                        id="bn-label"
                        value={form.label}
                        onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                        placeholder="Vente directe (Van Sales)"
                        required
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="bn-description">Description</Label>
                <Input
                    id="bn-description"
                    value={form.description ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
            </div>

            {canEditRules ? (
                <div className="space-y-2">
                    <Label htmlFor="bn-rules" className="flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                        Règles d'action (JSON métier — modification sensible)
                    </Label>
                    <textarea
                        id="bn-rules"
                        value={rulesJson}
                        onChange={(e) => handleRulesChange(e.target.value)}
                        rows={8}
                        spellCheck={false}
                        className={`w-full rounded-md border px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 ${
                            jsonError
                                ? 'border-red-300 focus:ring-red-200 bg-red-50/40'
                                : 'border-gray-200 focus:ring-sage-200'
                        }`}
                        placeholder={'{\n  "actions": [\n    { "visit_action_code": "CHECKIN", "required": true }\n  ]\n}'}
                    />
                    {jsonError && <p className="text-xs text-red-500">{jsonError}</p>}
                </div>
            ) : (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    Les règles d'action (JSON métier) ne sont modifiables que par un administrateur.
                </div>
            )}

            <div className="flex items-center gap-2">
                <Checkbox
                    id="bn-active"
                    checked={form.is_active}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, is_active: checked === true }))}
                />
                <Label htmlFor="bn-active" className="cursor-pointer">Actif</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                    Annuler
                </Button>
                <Button type="submit" disabled={loading || !!jsonError}>
                    {nature ? 'Mettre à jour' : 'Créer'}
                </Button>
            </div>
        </form>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function BusinessNaturesPage() {
    const { data: natures, isLoading, refetch } = useBusinessNatures();
    const { isAdminUser } = usePermissions();

    const [selected, setSelected] = useState<ItineraryBusinessNature | null>(null);
    const [showDetailPanel, setShowDetailPanel] = useState(false);
    const [editing, setEditing] = useState<ItineraryBusinessNature | null | undefined>(undefined);
    const [toDelete, setToDelete] = useState<ItineraryBusinessNature | null>(null);

    const createNature = useCreateBusinessNature();
    const updateNature = useUpdateBusinessNature();
    const deleteNature = useDeleteBusinessNature();

    const handleSelect = (nature: ItineraryBusinessNature) => {
        setSelected(nature);
        setShowDetailPanel(true);
    };

    const handleFormSubmit = async (payload: CreateBusinessNaturePayload) => {
        try {
            if (editing) {
                await updateNature.mutateAsync({ id: editing.id, ...payload });
                toast.success('Nature business mise à jour.');
            } else {
                await createNature.mutateAsync(payload);
                toast.success('Nature business créée.');
            }
            setEditing(undefined);
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleDelete = async () => {
        if (!toDelete) return;
        try {
            await deleteNature.mutateAsync(toDelete.id);
            toast.success('Nature business supprimée.');
            setToDelete(null);
            if (selected?.id === toDelete.id) {
                setSelected(null);
                setShowDetailPanel(false);
            }
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const columnDefs = [
        { field: 'code', headerName: 'Code', flex: 1 },
        { field: 'label', headerName: 'Libellé', flex: 2 },
        {
            field: 'action_rules',
            headerName: 'Actions',
            flex: 0.7,
            cellRenderer: (params: { value: BusinessNatureActionRules | null }) => (
                <span className="text-xs text-gray-500">
                    {params.value?.actions?.length ?? 0} action(s)
                </span>
            ),
        },
    ];

    const actionGroups = [
        {
            items: [
                ...(isAdminUser
                    ? [{ icon: Plus, label: 'Nouvelle nature', variant: 'primary' as const, onClick: () => setEditing(null) }]
                    : []),
                { icon: RotateCcw, label: 'Rafraîchir', variant: 'default' as const, onClick: () => refetch() },
            ],
        },
        ...(selected && isAdminUser
            ? [
                {
                    items: [
                        { icon: Edit2, label: 'Éditer', variant: 'sage' as const, onClick: () => setEditing(selected) },
                        { icon: Trash2, label: 'Supprimer', variant: 'danger' as const, onClick: () => setToDelete(selected) },
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
                        <div className="flex items-center gap-2">
                            <Briefcase className="h-5 w-5 text-indigo-600" />
                            <h1 className="text-sm font-semibold text-gray-900">Business Natures</h1>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">
                            Playbooks de visite — configuration quasi-statique.
                        </p>
                    </div>
                    <div className="flex-1 min-h-0 p-2">
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full">
                            <DataGrid
                                rowData={natures ?? []}
                                columnDefs={columnDefs}
                                onRowSelected={handleSelect}
                                loading={isLoading}
                            />
                        </div>
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full flex flex-col">
                    <Dialog open={editing !== undefined} onOpenChange={(open) => !open && setEditing(undefined)}>
                        <DialogContent className="max-w-xl">
                            <DialogHeader>
                                <DialogTitle>
                                    {editing ? 'Modifier la nature business' : 'Nouvelle nature business'}
                                </DialogTitle>
                                <DialogDescription>
                                    Playbook de visite appliqué aux types de tournée liés.
                                </DialogDescription>
                            </DialogHeader>
                            <BusinessNatureForm
                                key={editing ? `edit-${editing.id}` : 'create'}
                                nature={editing ?? null}
                                canEditRules={isAdminUser}
                                onSubmit={handleFormSubmit}
                                onCancel={() => setEditing(undefined)}
                                loading={createNature.isPending || updateNature.isPending}
                            />
                        </DialogContent>
                    </Dialog>

                    <Dialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-destructive">
                                    <Trash2 className="h-5 w-5" />
                                    Supprimer la nature business ?
                                </DialogTitle>
                                <DialogDescription>
                                    Vous allez supprimer <strong>{toDelete?.label}</strong> ({toDelete?.code}).
                                    Les types de tournée liés perdront leur playbook. Cette action est irréversible.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setToDelete(null)}>
                                    Annuler
                                </Button>
                                <Button variant="destructive" onClick={handleDelete} disabled={deleteNature.isPending}>
                                    Supprimer
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {showDetailPanel && selected ? (
                        <BusinessNatureDetail nature={selected} onBack={() => setShowDetailPanel(false)} />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                            <Briefcase className="w-16 h-16 text-gray-300 mb-4" />
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">Business Natures</h3>
                            <p className="text-sm text-gray-500 max-w-md">
                                Sélectionnez un playbook de visite pour voir ses règles d'action.
                            </p>
                        </div>
                    )}
                </div>
            }
            rightContent={<ActionPanel groups={actionGroups} />}
        />
    );
}
