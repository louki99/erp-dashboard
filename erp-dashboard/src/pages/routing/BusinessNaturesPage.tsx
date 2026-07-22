import { useState, useMemo } from 'react';
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
    Search,
    Tag,
    Hash,
    AlertTriangle,
    ChevronRight,
    Loader2,
    CheckCircle2,
} from 'lucide-react';

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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

// ─── List item ────────────────────────────────────────────────────────────────

function NatureListItem({
    nature,
    selected,
    onClick,
}: {
    nature: ItineraryBusinessNature;
    selected: boolean;
    onClick: () => void;
}) {
    const actions = nature.action_rules?.actions ?? [];
    return (
        <button
            onClick={onClick}
            className={[
                'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors relative',
                selected ? 'bg-indigo-50' : 'hover:bg-gray-50',
            ].join(' ')}
        >
            {selected && <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r bg-indigo-500" />}
            <span className={['w-2 h-2 rounded-full shrink-0', nature.is_active !== false ? 'bg-emerald-400' : 'bg-gray-300'].join(' ')} />

            <div className="flex-1 min-w-0">
                <p className={['text-sm font-medium truncate', selected ? 'text-indigo-800' : 'text-gray-800'].join(' ')}>
                    {nature.label}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] font-mono text-gray-400">{nature.code}</span>
                    <span className="text-[11px] text-gray-400">· {actions.length} action(s)</span>
                </div>
            </div>

            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-300" />
        </button>
    );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function BusinessNatureDetail({
    nature,
    onBack,
    onEdit,
    onDelete,
    isAdminUser,
}: {
    nature: ItineraryBusinessNature;
    onBack?: () => void;
    onEdit: (nature: ItineraryBusinessNature) => void;
    onDelete: (nature: ItineraryBusinessNature) => void;
    isAdminUser: boolean;
}) {
    const active = nature.is_active !== false;
    const actions = nature.action_rules?.actions ?? [];
    const requiredCount = actions.filter((a) => a.required).length;

    return (
        <div className="h-full flex flex-col bg-gray-50/40">

            {/* ── Hero header ── */}
            <div className="shrink-0 bg-white border-b border-gray-100">
                <div className="flex items-center justify-between px-6 pt-5 pb-4">
                    <div className="flex items-center gap-4">
                        <div className={[
                            'w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border',
                            active
                                ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 border-indigo-600 text-white'
                                : 'bg-gray-100 border-gray-200 text-gray-400',
                        ].join(' ')}>
                            <Briefcase className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-none">{nature.label}</h1>
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className="inline-flex items-center gap-1 text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                                    <Hash className="w-3 h-3" />{nature.code}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {/* Status pill — display only, no toggle mutation */}
                        <span className={[
                            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border',
                            active
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-gray-50 border-gray-200 text-gray-500',
                        ].join(' ')}>
                            <span className={[
                                'w-1.5 h-1.5 rounded-full',
                                active ? 'bg-emerald-500' : 'bg-gray-400',
                            ].join(' ')} />
                            {active ? 'Actif' : 'Inactif'}
                        </span>

                        {isAdminUser && (
                            <Button variant="outline" size="sm" onClick={() => onEdit(nature)} className="gap-1.5">
                                <Edit2 className="w-3.5 h-3.5" />Éditer
                            </Button>
                        )}

                        {isAdminUser && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onDelete(nature)}
                                className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                        )}

                        {onBack && (
                            <Button variant="ghost" size="sm" onClick={onBack} className="w-8 h-8 p-0 text-gray-400">
                                <X className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100">
                    {[
                        {
                            label: 'Types liés',
                            value: nature.itinerary_types_count ?? 0,
                            icon: <Briefcase className="w-3.5 h-3.5 text-indigo-400" />,
                        },
                        {
                            label: 'Actions définies',
                            value: actions.length,
                            icon: <ListChecks className="w-3.5 h-3.5 text-blue-500" />,
                        },
                        {
                            label: 'Obligatoires',
                            value: requiredCount,
                            icon: <CheckCircle2 className="w-3.5 h-3.5 text-red-400" />,
                        },
                    ].map((s) => (
                        <div key={s.label} className="flex items-center gap-2.5 px-6 py-3">
                            {s.icon}
                            <div>
                                <p className="text-sm font-bold text-gray-900 leading-none">{s.value}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">

                {/* Informations */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
                        <Tag className="w-3.5 h-3.5 text-indigo-400" />
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Informations</p>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {[
                            {
                                label: 'Code',
                                value: <span className="font-mono text-gray-800 text-xs">{nature.code}</span>,
                            },
                            {
                                label: 'Statut',
                                value: (
                                    <span className={['text-xs font-semibold', active ? 'text-emerald-600' : 'text-gray-400'].join(' ')}>
                                        {active ? '● Actif' : '○ Inactif'}
                                    </span>
                                ),
                            },
                            {
                                label: 'Types de tournée liés',
                                value: (
                                    <span className="text-sm font-medium text-gray-800">
                                        {nature.itinerary_types_count ?? '—'}
                                    </span>
                                ),
                            },
                        ].map((row) => (
                            <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                                <span className="text-xs text-gray-400">{row.label}</span>
                                {row.value}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Description */}
                {nature.description && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Description</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{nature.description}</p>
                    </div>
                )}

                {/* Playbook actions */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                        <div className="flex items-center gap-2">
                            <ListChecks className="w-3.5 h-3.5 text-blue-500" />
                            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Actions du playbook</p>
                        </div>
                        <span className="text-xs font-mono text-gray-400">{actions.length} action(s)</span>
                    </div>

                    {actions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <ListChecks className="w-6 h-6 text-gray-200 mb-2" />
                            <p className="text-xs text-gray-400">Aucune action définie dans ce playbook.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {actions.map((action, idx) => (
                                <div
                                    key={`${action.visit_action_code}-${idx}`}
                                    className="flex items-center gap-3 px-4 py-3"
                                >
                                    <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                                        {idx + 1}
                                    </span>
                                    <span className="font-mono text-xs text-gray-700 flex-1">{action.visit_action_code}</span>
                                    {action.required && (
                                        <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                                            Obligatoire
                                        </span>
                                    )}
                                    <span className="text-[11px] text-gray-400 shrink-0">
                                        {action.gates_any?.[0]?.[0] ?? 'always'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Raw JSON */}
                {nature.action_rules && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
                            <Code2 className="w-3.5 h-3.5 text-gray-400" />
                            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">JSON brut</p>
                        </div>
                        <div className="p-4">
                            <pre className="text-[11px] font-mono bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto max-h-64">
                                {JSON.stringify(nature.action_rules, null, 2)}
                            </pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Form — action_rules edited as validated raw JSON (admin only) ────────────

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
                                : 'border-gray-200 focus:ring-indigo-200'
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

// ─── Dashboard (no selection) ─────────────────────────────────────────────────

function NaturesDashboard({ natures }: { natures: ItineraryBusinessNature[] }) {
    const kpis = [
        {
            label: 'Total',
            value: natures.length,
            icon: <Briefcase className="w-5 h-5 text-indigo-500" />,
            bg: 'bg-indigo-50 border-indigo-200',
            num: 'text-indigo-700',
        },
        {
            label: 'Actives',
            value: natures.filter((n) => n.is_active !== false).length,
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
            bg: 'bg-emerald-50 border-emerald-200',
            num: 'text-emerald-700',
        },
        {
            label: 'Avec actions',
            value: natures.filter((n) => (n.action_rules?.actions?.length ?? 0) > 0).length,
            icon: <ListChecks className="w-5 h-5 text-blue-500" />,
            bg: 'bg-blue-50 border-blue-200',
            num: 'text-blue-700',
        },
    ];

    return (
        <div className="flex-1 overflow-y-auto p-8 bg-gray-50/40">
            <div className="max-w-lg mx-auto space-y-6">
                <div className="text-center">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-4">
                        <Briefcase className="w-7 h-7 text-indigo-500" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">Business Natures</h3>
                    <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                        Playbooks de visite appliqués aux types de tournée.
                        Sélectionnez une nature dans la liste pour voir ses règles d'action.
                    </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {kpis.map((kpi) => (
                        <div key={kpi.label} className={`rounded-2xl border p-5 ${kpi.bg}`}>
                            <div className="mb-3">{kpi.icon}</div>
                            <p className={`text-3xl font-bold leading-none ${kpi.num}`}>{kpi.value}</p>
                            <p className="text-xs text-gray-500 mt-1.5">{kpi.label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function BusinessNaturesPage() {
    const { data: natures, isLoading, refetch } = useBusinessNatures();
    const { isAdminUser } = usePermissions();

    const [activeOnly, setActiveOnly] = useState(false);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<ItineraryBusinessNature | null>(null);
    const [editing, setEditing] = useState<ItineraryBusinessNature | null | undefined>(undefined);
    const [toDelete, setToDelete] = useState<ItineraryBusinessNature | null>(null);

    const createNature = useCreateBusinessNature();
    const updateNature = useUpdateBusinessNature();
    const deleteNature = useDeleteBusinessNature();

    const allNatures = natures ?? [];

    const rows = useMemo(() => {
        let list = allNatures;
        if (activeOnly) list = list.filter((n) => n.is_active !== false);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(
                (n) => n.label.toLowerCase().includes(q) || n.code.toLowerCase().includes(q)
            );
        }
        return list;
    }, [allNatures, activeOnly, search]);

    const handleSelect = (nature: ItineraryBusinessNature) => {
        setSelected(nature);
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
            }
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

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
                    {/* Header */}
                    <div className="p-4 border-b border-gray-100 shrink-0">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                                    <Briefcase className="w-4 h-4 text-indigo-600" />
                                </div>
                                <h1 className="text-sm font-bold text-gray-900">Business Natures</h1>
                            </div>
                            <span className="text-[11px] font-mono text-gray-400">
                                {rows.length}/{allNatures.length}
                            </span>
                        </div>

                        <div className="relative mb-2">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <Input
                                placeholder="Libellé, code..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-8 text-xs pl-8"
                            />
                        </div>

                        {/* Filter chips */}
                        <div className="flex gap-1.5">
                            {[
                                { label: 'Tous', active: !activeOnly, onClick: () => setActiveOnly(false) },
                                { label: 'Actifs', active: activeOnly, onClick: () => setActiveOnly(true) },
                            ].map((chip) => (
                                <button
                                    key={chip.label}
                                    onClick={chip.onClick}
                                    className={[
                                        'px-2.5 py-1 rounded-full text-[11px] font-medium transition-all',
                                        chip.active
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                                    ].join(' ')}
                                >
                                    {chip.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                        {isLoading ? (
                            <div className="space-y-1.5 p-2">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
                                ))}
                            </div>
                        ) : rows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                                <Briefcase className="w-8 h-8 mb-2 text-gray-200" />
                                <p className="text-xs">Aucune nature trouvée</p>
                            </div>
                        ) : (
                            rows.map((nature) => (
                                <NatureListItem
                                    key={nature.id}
                                    nature={nature}
                                    selected={selected?.id === nature.id}
                                    onClick={() => handleSelect(nature)}
                                />
                            ))
                        )}
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full flex flex-col">
                    {/* Create / Edit form dialog */}
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

                    {/* Delete confirmation */}
                    <Dialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
                        <DialogContent className="max-w-sm">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <span className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                        <AlertTriangle className="w-4 h-4 text-red-500" />
                                    </span>
                                    Supprimer la nature business ?
                                </DialogTitle>
                                <DialogDescription>
                                    <strong>{toDelete?.label}</strong> ({toDelete?.code}) sera supprimée.
                                    Les types de tournée liés perdront leur playbook. Cette action est irréversible.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setToDelete(null)}>Annuler</Button>
                                <Button
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                    onClick={handleDelete}
                                    disabled={deleteNature.isPending}
                                >
                                    {deleteNature.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                                    Supprimer
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {selected ? (
                        <BusinessNatureDetail
                            nature={selected}
                            onBack={() => setSelected(null)}
                            onEdit={(n) => setEditing(n)}
                            onDelete={(n) => setToDelete(n)}
                            isAdminUser={isAdminUser}
                        />
                    ) : (
                        <NaturesDashboard natures={allNatures} />
                    )}
                </div>
            }
            rightContent={<ActionPanel groups={actionGroups} />}
        />
    );
}
