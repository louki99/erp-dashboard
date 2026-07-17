import React, { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import toast from 'react-hot-toast';
import {
    Shield, Plus, RefreshCw, Edit2, Trash2, X,
    AlertTriangle, CheckCircle2, XCircle, Search,
    LayoutList, ChevronRight,
} from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { DataRuleForm, WildcardDenyDialog } from '@/components/data-rules';
import {
    useCreateDataRule,
    useDataRules,
    useDeleteDataRule,
    useUpdateDataRule,
    isWildcardDenyConfirmationError,
} from '@/hooks/dataRules/useDataRules';
import type {
    CreateDataRulePayload,
    DataRule,
    DataRuleFilters as Filters,
    UpdateDataRulePayload,
} from '@/types/dataRules.types';
import {
    getActionLabel,
    getModelTypeLabel,
    getScopeTypeLabel,
    MODEL_TYPE_OPTIONS,
} from '@/lib/dataRules';
import { isAxiosError } from 'axios';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) return error.response?.data?.message ?? error.message;
    if (error instanceof Error) return error.message;
    return 'Une erreur est survenue.';
}

const DEFAULT_FILTERS: Filters = { per_page: 50, page: 1 };

const ACTION_COLORS = {
    allow: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
    deny:  { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500'     },
};

function fmtDate(s: string) {
    return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

const RuleDetail: React.FC<{
    rule: DataRule;
    onEdit: () => void;
    onDelete: () => void;
}> = ({ rule, onEdit, onDelete }) => {
    const ac = ACTION_COLORS[rule.action] ?? ACTION_COLORS.allow;
    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-white px-5 py-4 border-b border-gray-200 shrink-0">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            rule.action === 'allow'
                                ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                                : 'bg-gradient-to-br from-red-500 to-red-600'
                        }`}>
                            {rule.action === 'allow'
                                ? <CheckCircle2 className="w-5 h-5 text-white" />
                                : <XCircle className="w-5 h-5 text-white" />
                            }
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-base font-bold text-gray-900">Règle #{rule.id}</h1>
                                <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${ac.bg} ${ac.text} ${ac.border}`}>
                                    {getActionLabel(rule.action)}
                                </span>
                            </div>
                            <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                                <span>{rule.model_type_label}</span>
                                <ChevronRight className="w-3 h-3" />
                                <span>{rule.model_id === null ? 'wildcard' : rule.resource_label}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button onClick={onEdit}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors" title="Modifier">
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={onDelete}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Supprimer">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                {/* Modèle & Ressource */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Modèle & Ressource</span>
                    </div>
                    <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">Type de modèle</span>
                            <span className="font-semibold text-gray-900">{rule.model_type_label}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">Ressource</span>
                            {rule.model_id === null
                                ? <span className="italic text-gray-400">wildcard — toutes les ressources</span>
                                : <span className="font-semibold text-gray-900">{rule.resource_label}</span>
                            }
                        </div>
                        {rule.model_id !== null && (
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-400">ID</span>
                                <span className="font-mono text-gray-700">{rule.model_id}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Scope */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Scope</span>
                    </div>
                    <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">Type</span>
                            <span className="font-semibold text-gray-900 capitalize">{getScopeTypeLabel(rule.scope_type)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">Valeur</span>
                            <span className="font-mono text-gray-700">{rule.scope_value}</span>
                        </div>
                        {rule.scope_label && rule.scope_label !== rule.scope_value && (
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-400">Libellé</span>
                                <span className="text-gray-700">{rule.scope_label}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Action */}
                <div className={`rounded-xl border p-4 ${ac.bg} ${ac.border}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            rule.action === 'allow' ? 'bg-emerald-100' : 'bg-red-100'
                        }`}>
                            {rule.action === 'allow'
                                ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                : <XCircle className="w-4 h-4 text-red-600" />
                            }
                        </div>
                        <div>
                            <div className={`text-sm font-bold ${ac.text}`}>{getActionLabel(rule.action)}</div>
                            <div className="text-[11px] text-gray-500">
                                {rule.action === 'allow'
                                    ? 'La ressource est visible pour ce scope'
                                    : 'La ressource est masquée pour ce scope'
                                }
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dates */}
                {(rule.created_at || rule.updated_at) && (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Horodatage</span>
                        </div>
                        <div className="p-4 space-y-2">
                            {rule.created_at && (
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-400">Créé le</span>
                                    <span className="text-gray-700">{fmtDate(rule.created_at)}</span>
                                </div>
                            )}
                            {rule.updated_at && (
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-400">Modifié le</span>
                                    <span className="text-gray-700">{fmtDate(rule.updated_at)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ onNew: () => void }> = ({ onNew }) => (
    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-5 shadow-md border border-gray-100">
            <Shield className="w-10 h-10 text-gray-200" />
        </div>
        <h3 className="text-base font-semibold text-gray-700">Aucune règle sélectionnée</h3>
        <p className="text-sm mt-1.5 text-gray-400 max-w-xs text-center">
            Double-cliquez sur une règle à gauche pour afficher ses détails.
        </p>
        <button onClick={onNew}
            className="mt-5 flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-sage-500 text-white hover:bg-sage-600 transition-colors font-medium">
            <Plus className="w-4 h-4" /> Nouvelle règle
        </button>
    </div>
);

// ─── Delete Dialog ────────────────────────────────────────────────────────────

const DeleteDialog: React.FC<{
    rule: DataRule;
    loading: boolean;
    onConfirm: () => void;
    onClose: () => void;
}> = ({ rule, loading, onConfirm, onClose }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                    <div className="text-sm font-semibold text-gray-900">Supprimer la règle #{rule.id} ?</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                        {getActionLabel(rule.action)} · {getModelTypeLabel(rule.model_type)} · {getScopeTypeLabel(rule.scope_type)} {rule.scope_value}
                    </div>
                </div>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                <p className="text-xs text-red-700">Cette action est irréversible.</p>
            </div>
            <div className="flex gap-2">
                <button onClick={onClose}
                    className="flex-1 py-2 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                    Annuler
                </button>
                <button onClick={onConfirm} disabled={loading}
                    className="flex-1 py-2 text-xs rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50 transition-colors">
                    {loading ? 'Suppression…' : 'Supprimer'}
                </button>
            </div>
        </div>
    </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DataRulesPage() {
    const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
    const [searchQuery, setSearchQuery] = useState('');
    const [modelFilter, setModelFilter] = useState<string>('all');

    const { data, isLoading, refetch } = useDataRules(filters);

    const [selectedRule, setSelectedRule] = useState<DataRule | null>(null);
    // undefined = form closed, null = new rule, DataRule = edit
    const [editingRule, setEditingRule] = useState<DataRule | null | undefined>(undefined);
    const [ruleToDelete, setRuleToDelete] = useState<DataRule | null>(null);

    const [pendingPayload, setPendingPayload] = useState<CreateDataRulePayload | UpdateDataRulePayload | null>(null);
    const [showWildcardDialog, setShowWildcardDialog] = useState(false);

    const createRule = useCreateDataRule();
    const updateRule = useUpdateDataRule(editingRule?.id ?? 0);
    const deleteRule = useDeleteDataRule();

    // Loading cursor on row select
    const cursorTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => {
        if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
        document.getElementById('loading-cursor-style')?.remove();
    }, []);

    const handleRowSelect = useCallback((row: DataRule) => {
        if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
        if (!document.getElementById('loading-cursor-style')) {
            const style = document.createElement('style');
            style.id = 'loading-cursor-style';
            style.innerHTML = '* { cursor: wait !important; }';
            document.head.appendChild(style);
        }
        setSelectedRule(row);
        setEditingRule(undefined);
        cursorTimeoutRef.current = setTimeout(() => {
            document.getElementById('loading-cursor-style')?.remove();
            cursorTimeoutRef.current = undefined;
        }, 300);
    }, []);

    // ── Form handlers ─────────────────────────────────────────────────────────

    const handleFormSubmit = async (payload: CreateDataRulePayload | UpdateDataRulePayload) => {
        try {
            if (editingRule) {
                const updated = await updateRule.mutateAsync(payload as UpdateDataRulePayload);
                toast.success('Règle mise à jour.');
                setSelectedRule(updated);
            } else {
                const created = await createRule.mutateAsync(payload as CreateDataRulePayload);
                toast.success('Règle créée.');
                setSelectedRule(created);
            }
            setEditingRule(undefined);
        } catch (error) {
            if (isWildcardDenyConfirmationError(error)) {
                setPendingPayload(payload);
                setShowWildcardDialog(true);
                return;
            }
            toast.error(getErrorMessage(error));
        }
    };

    const handleConfirmWildcardDeny = async () => {
        if (!pendingPayload) return;
        const confirmedPayload = { ...pendingPayload, confirm_wildcard_deny: true };
        try {
            if (editingRule) {
                const updated = await updateRule.mutateAsync(confirmedPayload as UpdateDataRulePayload);
                toast.success('Règle mise à jour.');
                setSelectedRule(updated);
            } else {
                const created = await createRule.mutateAsync(confirmedPayload as CreateDataRulePayload);
                toast.success('Règle créée.');
                setSelectedRule(created);
            }
            setPendingPayload(null);
            setShowWildcardDialog(false);
            setEditingRule(undefined);
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleDelete = async () => {
        if (!ruleToDelete) return;
        try {
            await deleteRule.mutateAsync(ruleToDelete.id);
            toast.success('Règle supprimée.');
            setRuleToDelete(null);
            if (selectedRule?.id === ruleToDelete.id) {
                setSelectedRule(null);
                setEditingRule(undefined);
            }
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    // ── Client-side filter ────────────────────────────────────────────────────

    const allRules = data?.data ?? [];

    const filteredRules = useMemo(() => {
        let rules = allRules;
        if (modelFilter !== 'all') {
            rules = rules.filter(r => r.model_type === modelFilter);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            rules = rules.filter(r =>
                r.model_type_label?.toLowerCase().includes(q) ||
                r.resource_label?.toLowerCase().includes(q) ||
                r.scope_label?.toLowerCase().includes(q) ||
                r.scope_value?.toLowerCase().includes(q) ||
                String(r.id).includes(q)
            );
        }
        return rules;
    }, [allRules, modelFilter, searchQuery]);

    // ── Columns ───────────────────────────────────────────────────────────────

    const columnDefs = useMemo<ColDef[]>(() => [
        {
            colId: 'model_type_label',
            headerName: 'Modèle',
            flex: 1,
            minWidth: 100,
            valueGetter: (p: any) => p.data?.model_type_label || getModelTypeLabel(p.data?.model_type ?? ''),
            cellRenderer: (p: any) => {
                const color = p.data?.action === 'allow' ? '#10b981' : '#ef4444';
                return (
                    <div className="flex items-center gap-2 h-full">
                        <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#111827' }}>{p.value}</span>
                    </div>
                );
            },
        },
        {
            colId: 'resource',
            headerName: 'Ressource',
            flex: 1,
            minWidth: 90,
            valueGetter: (p: any) => p.data?.model_id === null ? '— wildcard —' : (p.data?.resource_label ?? ''),
            cellStyle: (p: any) => ({
                fontSize: '11px',
                color: p.data?.model_id === null ? '#9ca3af' : '#374151',
                fontStyle: p.data?.model_id === null ? 'italic' : 'normal',
            }),
        },
        {
            colId: 'scope',
            headerName: 'Scope',
            width: 110,
            valueGetter: (p: any) => {
                const st = getScopeTypeLabel(p.data?.scope_type ?? '');
                const sv = p.data?.scope_value ?? '';
                return `${st} ${sv}`.trim();
            },
            cellStyle: { fontSize: '11px', color: '#6b7280' },
        },
    ], []);

    // ── Action Panel ──────────────────────────────────────────────────────────

    const actionGroups = useMemo(() => {
        const base: ActionItemProps[] = [
            {
                label: 'Nouvelle règle',
                icon: Plus,
                onClick: () => { setEditingRule(null); setSelectedRule(null); },
                variant: 'primary',
            },
            {
                label: 'Actualiser',
                icon: RefreshCw,
                onClick: () => refetch(),
                variant: 'default',
            },
        ];

        const ruleActions: ActionItemProps[] = selectedRule && editingRule === undefined ? [
            {
                label: 'Modifier',
                icon: Edit2,
                onClick: () => setEditingRule(selectedRule),
                variant: 'default',
            },
            {
                label: 'Supprimer',
                icon: Trash2,
                onClick: () => setRuleToDelete(selectedRule),
                variant: 'danger',
            },
        ] : [];

        return ruleActions.length > 0
            ? [{ items: base }, { items: ruleActions }]
            : [{ items: base }];
    }, [selectedRule, editingRule, refetch]);

    // ── Main content ──────────────────────────────────────────────────────────

    const mainContent = () => {
        if (editingRule !== undefined) {
            return (
                <div className="h-full flex flex-col overflow-hidden">
                    <div className="bg-white px-5 py-3.5 border-b border-gray-200 shrink-0 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-gray-900">
                            {editingRule ? `Modifier la règle #${editingRule.id}` : 'Nouvelle règle'}
                        </h2>
                        <button onClick={() => setEditingRule(undefined)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
                        <DataRuleForm
                            key={editingRule ? `edit-${editingRule.id}` : 'create'}
                            rule={editingRule ?? null}
                            onSubmit={handleFormSubmit}
                            onCancel={() => setEditingRule(undefined)}
                            loading={createRule.isPending || updateRule.isPending}
                        />
                    </div>
                </div>
            );
        }
        if (selectedRule) {
            return (
                <RuleDetail
                    rule={selectedRule}
                    onEdit={() => setEditingRule(selectedRule)}
                    onDelete={() => setRuleToDelete(selectedRule)}
                />
            );
        }
        return <EmptyState onNew={() => setEditingRule(null)} />;
    };

    // ── Render ────────────────────────────────────────────────────────────────

    const total = data?.meta?.total ?? 0;

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
                        {/* Header */}
                        <div className="px-3 pt-3 pb-2.5 border-b border-gray-100 shrink-0">
                            <div className="flex items-center justify-between mb-2.5">
                                <div className="flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-gray-500" />
                                    <h1 className="text-sm font-bold text-gray-900 tracking-tight">Règles de données</h1>
                                </div>
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-blue-50 text-blue-600">
                                    {filteredRules.length}
                                    {total > filteredRules.length && `/${total}`}
                                </span>
                            </div>

                            {/* Model type tabs */}
                            <div className="flex flex-wrap gap-1 mb-2">
                                <button
                                    onClick={() => setModelFilter('all')}
                                    className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                                        modelFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                                >
                                    <LayoutList className="w-3 h-3" /> Tous
                                </button>
                                {MODEL_TYPE_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setModelFilter(opt.value)}
                                        className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                                            modelFilter === opt.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Rechercher…"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200">
                                        <X className="w-3 h-3 text-gray-400" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Grid */}
                        <div className="flex-1 min-h-0 p-2">
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full">
                                <DataGrid
                                    rowData={filteredRules}
                                    columnDefs={columnDefs}
                                    loading={isLoading}
                                    rowSelection="single"
                                    onRowDoubleClicked={handleRowSelect}
                                />
                            </div>
                        </div>
                    </div>
                }
                mainContent={
                    <div className="h-full flex overflow-hidden">
                        <div className="flex-1 min-w-0 overflow-hidden">
                            {mainContent()}
                        </div>
                    </div>
                }
                rightContent={
                    <ActionPanel groups={actionGroups} />
                }
            />

            {/* Delete dialog */}
            {ruleToDelete && (
                <DeleteDialog
                    rule={ruleToDelete}
                    loading={deleteRule.isPending}
                    onConfirm={handleDelete}
                    onClose={() => setRuleToDelete(null)}
                />
            )}

            {/* Wildcard deny confirmation */}
            <WildcardDenyDialog
                open={showWildcardDialog}
                onOpenChange={(open) => {
                    if (!open) { setShowWildcardDialog(false); setPendingPayload(null); }
                }}
                onConfirm={handleConfirmWildcardDeny}
                scopeLabel={
                    pendingPayload
                        ? `${getScopeTypeLabel(pendingPayload.scope_type!)} ${pendingPayload.scope_value}`
                        : undefined
                }
            />
        </>
    );
}
