import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Plus, Edit2, Trash2, Users, Search, X, Loader2, CheckCircle2,
    Tag, BarChart3, AlertTriangle, UserMinus, UserPlus,
    TrendingUp, DollarSign, CreditCard, Building2, RefreshCw, Save, ArrowLeft, Activity,
    Info,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { DataGrid } from '@/components/common/DataGrid';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { SageCollapsible } from '@/components/common/SageCollapsible';

import * as api from '@/services/api/clientGroupsApi';
import type { ClientGroup, ClientGroupPayload } from '@/services/api/clientGroupsApi';
import type { ClientGroupDashboard, Partner } from '@/types/partner.types';
import { getPartners, assignPartnerToGroup } from '@/services/api/partnerApi';

// ─── helpers ─────────────────────────────────────────────────────────────────

const EMPTY_FORM: ClientGroupPayload = {
    code: '', name: '', description: '', default_discount_rate: null, is_active: true,
};

const fmt = (n: number | undefined | null, decimals = 0) =>
    n == null ? '—' : n.toLocaleString('fr-MA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const fmtMAD = (n: number | undefined | null) =>
    n == null ? '—' : `${fmt(n, 2)} MAD`;

type FormMode = 'view' | 'create' | 'edit';

const TABS: TabItem[] = [
    { id: 'informations', label: 'Informations', icon: Info },
    { id: 'membres',      label: 'Membres',      icon: Users },
    { id: 'dashboard',    label: 'Dashboard',    icon: BarChart3 },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function ClientGroupsPage() {
    const [searchParams, setSearchParams] = useSearchParams();

    // list
    const [groups, setGroups]       = useState<ClientGroup[]>([]);
    const [loading, setLoading]     = useState(true);
    const [search, setSearch]       = useState('');
    const [filterTab, setFilterTab] = useState<'all' | 'active' | 'inactive'>('all');

    // selection / form
    const [selected, setSelected] = useState<ClientGroup | null>(null);
    const [form, setForm]         = useState<ClientGroupPayload>(EMPTY_FORM);
    const [formMode, setFormMode] = useState<FormMode>('view');
    const [saving, setSaving]     = useState(false);

    // delete group
    const [deleteTarget, setDeleteTarget] = useState<ClientGroup | null>(null);
    const [deleting, setDeleting]         = useState(false);

    // remove member
    const [removeTarget, setRemoveTarget] = useState<Partner | null>(null);

    // ── Scroll-spy state (same pattern as PartnerManagementPage) ─────────────
    const [activeTab, setActiveTab]   = useState('informations');
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        informations: true, membres: true, dashboard: true,
    });
    const sectionRefs  = useRef<Record<string, HTMLDivElement | null>>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const isScrollingRef = useRef(false);

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
        const section = sectionRefs.current[tabId];
        if (section && containerRef.current) {
            isScrollingRef.current = true;
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => { isScrollingRef.current = false; }, 1000);
        }
    };

    const toggleSection = (id: string, open: boolean) =>
        setOpenSections(prev => ({ ...prev, [id]: open }));

    const handleExpandAll  = () => setOpenSections({ informations: true, membres: true, dashboard: true });
    const handleCollapseAll = () => setOpenSections({ informations: false, membres: false, dashboard: false });

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const onScroll = () => {
            if (isScrollingRef.current) return;
            const top = container.scrollTop;
            for (const tab of TABS) {
                const el = sectionRefs.current[tab.id];
                if (!el) continue;
                const elTop = el.offsetTop;
                const elBottom = elTop + el.clientHeight;
                if (elTop <= top + 100 && elBottom > top + 50) {
                    if (activeTab !== tab.id) setActiveTab(tab.id);
                    break;
                }
            }
        };
        container.addEventListener('scroll', onScroll);
        return () => container.removeEventListener('scroll', onScroll);
    }, [openSections, activeTab]);

    // ── Dashboard ─────────────────────────────────────────────────────────────
    const [dashboard, setDashboard]     = useState<ClientGroupDashboard | null>(null);
    const [dashLoading, setDashLoading] = useState(false);

    const fetchDashboard = useCallback(async (id: number) => {
        setDashLoading(true);
        setDashboard(null);
        try { setDashboard(await api.getClientGroupDashboard(id)); }
        catch { toast.error('Impossible de charger le dashboard'); }
        finally { setDashLoading(false); }
    }, []);

    // ── Members ───────────────────────────────────────────────────────────────
    const [members, setMembers]               = useState<Partner[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [memberSearch, setMemberSearch]     = useState('');
    const [searchResults, setSearchResults]   = useState<Partner[]>([]);
    const [searching, setSearching]           = useState(false);
    const [assigning, setAssigning]           = useState<number | null>(null);
    const [removing, setRemoving]             = useState<number | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchMembers = useCallback(async (groupId: number) => {
        setMembersLoading(true);
        setMembers([]);
        try {
            const res = await getPartners({ client_group_id: groupId, per_page: 200 });
            setMembers(res.partners.data ?? []);
        } catch {
            toast.error('Erreur chargement membres');
        } finally {
            setMembersLoading(false);
        }
    }, []);

    const runSearch = useCallback(async (q: string, currentMembers: Partner[]) => {
        if (q.trim().length < 2) { setSearchResults([]); return; }
        setSearching(true);
        try {
            const res = await getPartners({ search: q.trim(), per_page: 20 });
            const list = res.partners.data ?? [];
            const ids = new Set(currentMembers.map(m => m.id));
            setSearchResults(list.filter(p => !ids.has(p.id)));
        } catch {
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    }, []);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => runSearch(memberSearch, members), 350);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [memberSearch, members, runSearch]);

    const handleAssign = async (partner: Partner) => {
        if (!selected) return;
        setAssigning(partner.id);
        try {
            await assignPartnerToGroup(partner, selected.id);
            toast.success(`${partner.name} ajouté au groupe`);
            setMembers(prev => [...prev, partner]);
            setSearchResults(prev => prev.filter(p => p.id !== partner.id));
            setMemberSearch('');
        } catch {
            toast.error("Erreur lors de l'assignation");
        } finally {
            setAssigning(null);
        }
    };

    const handleRemove = async () => {
        if (!removeTarget || !selected) return;
        setRemoving(removeTarget.id);
        try {
            await assignPartnerToGroup(removeTarget, null);
            toast.success(`${removeTarget.name} retiré du groupe`);
            setMembers(prev => prev.filter(p => p.id !== removeTarget.id));
            setRemoveTarget(null);
        } catch {
            toast.error('Erreur lors du retrait');
        } finally {
            setRemoving(null);
        }
    };

    // ── Load groups ───────────────────────────────────────────────────────────

    const load = useCallback(async () => {
        setLoading(true);
        try { setGroups(await api.getClientGroups()); }
        catch { toast.error('Erreur chargement des groupes'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    // ── URL params ────────────────────────────────────────────────────────────

    useEffect(() => {
        const gidParam = searchParams.get('group_id');
        if (!gidParam || groups.length === 0) return;
        const g = groups.find(x => x.id === parseInt(gidParam, 10));
        if (g) {
            handleSelect(g);
            setSearchParams(p => { p.delete('group_id'); return p; }, { replace: true });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groups, searchParams]);

    const partnerCodeParam = searchParams.get('partner_code');
    useEffect(() => {
        if (!partnerCodeParam || !selected) return;
        handleTabChange('membres');
        setMemberSearch(partnerCodeParam);
        setSearchParams(p => { p.delete('partner_code'); return p; }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [partnerCodeParam, selected]);

    // ── Filtered list ─────────────────────────────────────────────────────────

    const filtered = useMemo(() => {
        let list = groups;
        if (filterTab === 'active')   list = list.filter(g => g.is_active);
        if (filterTab === 'inactive') list = list.filter(g => !g.is_active);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(g => g.name.toLowerCase().includes(q) || g.code.toLowerCase().includes(q));
        }
        return list;
    }, [groups, filterTab, search]);

    // ── Selection ─────────────────────────────────────────────────────────────

    const handleSelect = (g: ClientGroup) => {
        setSelected(g);
        setFormMode('view');
        setActiveTab('informations');
        setDashboard(null);
        setMembers([]);
        setMemberSearch('');
        setSearchResults([]);
        // auto-fetch all sections
        fetchDashboard(g.id);
        fetchMembers(g.id);
    };

    // ── CRUD ──────────────────────────────────────────────────────────────────

    const openCreate = () => { setSelected(null); setForm(EMPTY_FORM); setFormMode('create'); };
    const openEdit   = (g: ClientGroup) => {
        setSelected(g);
        setForm({ code: g.code, name: g.name, description: g.description ?? '', default_discount_rate: g.default_discount_rate ?? null, is_active: g.is_active });
        setFormMode('edit');
    };
    const cancelForm = () => setFormMode('view');

    const handleSave = async () => {
        if (!form.code.trim() || !form.name.trim()) { toast.error('Code et nom obligatoires'); return; }
        setSaving(true);
        try {
            if (formMode === 'create') {
                const created = await api.createClientGroup(form);
                toast.success('Groupe créé');
                await load();
                handleSelect(created);
            } else if (formMode === 'edit' && selected) {
                const updated = await api.updateClientGroup(selected.id, form);
                toast.success('Groupe mis à jour');
                setSelected(updated);
                setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
                setFormMode('view');
            }
        } catch {
            toast.error('Erreur lors de la sauvegarde');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.deleteClientGroup(deleteTarget.id);
            toast.success('Groupe supprimé');
            setGroups(prev => prev.filter(g => g.id !== deleteTarget.id));
            if (selected?.id === deleteTarget.id) { setSelected(null); setFormMode('view'); }
            setDeleteTarget(null);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Impossible de supprimer (partenaires liés ?)');
        } finally {
            setDeleting(false);
        }
    };

    // ── DataGrid columns ──────────────────────────────────────────────────────

    const columnDefs = useMemo<import('ag-grid-community').ColDef[]>(() => [
        {
            colId: 'status', headerName: '', width: 28, sortable: false,
            cellRenderer: (p: any) => (
                <div className="flex items-center justify-center h-full">
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.data?.is_active ? '#10b981' : '#d1d5db' }} />
                </div>
            ),
        },
        {
            colId: 'code', headerName: 'Code', width: 90, sortable: true,
            cellRenderer: (p: any) => (
                <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: '#4338ca' }}>
                    {p.data?.code}
                </span>
            ),
        },
        {
            field: 'name', headerName: 'Nom', flex: 1, minWidth: 120,
            cellStyle: { fontSize: '12px', fontWeight: '500', color: '#111827' },
        },
        {
            colId: 'discount', headerName: 'Remise', width: 72, sortable: false,
            cellRenderer: (p: any) => {
                const r = p.data?.default_discount_rate;
                if (!r) return null;
                return (
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#d97706', background: '#fef3c7', padding: '2px 6px', borderRadius: 4 }}>
                        -{r}%
                    </span>
                );
            },
        },
    ], []);

    // ── Action panel ──────────────────────────────────────────────────────────

    const actionGroups = useMemo((): { items: ActionItemProps[] }[] => {
        if (formMode === 'create' || formMode === 'edit') {
            return [{ items: [
                { icon: Save,  label: 'Enregistrer', variant: 'primary', onClick: handleSave, disabled: saving },
                { icon: X,     label: 'Annuler',     variant: 'warning', onClick: cancelForm },
            ]}];
        }
        const base: ActionItemProps[] = [
            { icon: Plus,      label: 'Nouveau groupe', variant: 'sage',    onClick: openCreate },
            { icon: RefreshCw, label: 'Actualiser',     variant: 'default', onClick: load, disabled: loading },
        ];
        if (selected) {
            return [
                { items: base },
                { items: [
                    { icon: Edit2,  label: 'Modifier',  variant: 'default', onClick: () => openEdit(selected) },
                    { icon: Trash2, label: 'Supprimer', variant: 'danger',  onClick: () => setDeleteTarget(selected) },
                ]},
            ];
        }
        return [{ items: base }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formMode, selected, loading, saving]);

    const activeCount = groups.filter(g => g.is_active).length;

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
                        <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Tag className="w-4 h-4 text-sage-600" />
                                    <h2 className="text-sm font-bold text-gray-900">Groupes clients</h2>
                                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-sage-50 text-sage-600 border border-sage-100">
                                        {groups.length}
                                    </span>
                                </div>
                                <span className="text-[10px] text-gray-400">{activeCount} actif{activeCount !== 1 ? 's' : ''}</span>
                            </div>

                            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-1 mb-2">
                                {([
                                    { key: 'all',      label: 'Tous',     count: groups.length },
                                    { key: 'active',   label: 'Actifs',   count: activeCount },
                                    { key: 'inactive', label: 'Inactifs', count: groups.length - activeCount },
                                ] as const).map(t => (
                                    <button
                                        key={t.key}
                                        onClick={() => setFilterTab(t.key)}
                                        className={`flex-1 flex items-center justify-center gap-1 py-1 text-[11px] font-medium rounded-md transition-all ${
                                            filterTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        {t.label}
                                        <span className={`text-[10px] font-bold ${filterTab === t.key ? 'text-gray-500' : 'text-gray-400'}`}>{t.count}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Rechercher…"
                                    className="w-full pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 bg-gray-50/70 transition-all"
                                />
                                {search && (
                                    <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                        <X className="w-3 h-3 text-gray-400" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 min-h-0">
                            <DataGrid
                                rowData={filtered}
                                columnDefs={columnDefs}
                                loading={loading}
                                rowSelection="single"
                                onRowClicked={e => { if (e.data) handleSelect(e.data); }}
                                defaultSelectedIds={row => row.id === selected?.id}
                            />
                        </div>
                    </div>
                }

                mainContent={
                    <div className="h-full flex flex-col overflow-hidden bg-gray-50">

                        {/* ── CREATE / EDIT ──────────────────────────────── */}
                        {(formMode === 'create' || formMode === 'edit') && (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center gap-3">
                                    <button onClick={cancelForm} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                                        <ArrowLeft className="w-4 h-4" />
                                    </button>
                                    <div>
                                        <h2 className="text-sm font-bold text-gray-900">
                                            {formMode === 'create' ? 'Nouveau groupe client' : `Modifier — ${selected?.name}`}
                                        </h2>
                                        <p className="text-[11px] text-gray-400">
                                            {formMode === 'create' ? 'Remplissez les informations du groupe' : 'Modifiez les informations du groupe'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6">
                                    <div className="max-w-lg space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Code *</label>
                                                <input
                                                    value={form.code}
                                                    onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 font-mono"
                                                    placeholder="GRP-001"
                                                />
                                            </div>
                                            <div className="flex items-end pb-1">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={form.is_active ?? true}
                                                        onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                                                        className="rounded border-gray-300 text-sage-600"
                                                    />
                                                    <span className="text-sm text-gray-700">Actif</span>
                                                </label>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Nom *</label>
                                            <input
                                                value={form.name}
                                                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                                                placeholder="Grands comptes nord"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                                            <textarea
                                                value={form.description ?? ''}
                                                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                                rows={3}
                                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 resize-none"
                                                placeholder="Description du groupe…"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Remise par défaut (%)</label>
                                            <input
                                                type="number" min="0" max="100" step="0.5"
                                                value={form.default_discount_rate ?? ''}
                                                onChange={e => setForm(p => ({ ...p, default_discount_rate: e.target.value === '' ? null : parseFloat(e.target.value) }))}
                                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="flex gap-3 pt-2">
                                            <button
                                                onClick={handleSave}
                                                disabled={saving}
                                                className="flex items-center gap-2 px-4 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors"
                                            >
                                                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                                {formMode === 'create' ? 'Créer' : 'Enregistrer'}
                                            </button>
                                            <button onClick={cancelForm} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                                Annuler
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── VIEW: header + SageTabs + scroll sections ──── */}
                        {formMode === 'view' && selected && (
                            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                                {/* header */}
                                <div className="px-6 pt-5 pb-0 bg-white border-b border-gray-200 shrink-0">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{selected.code}</span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${selected.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    {selected.is_active ? 'Actif' : 'Inactif'}
                                                </span>
                                                {(selected.default_discount_rate ?? 0) > 0 && (
                                                    <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-semibold">
                                                        Remise {selected.default_discount_rate}%
                                                    </span>
                                                )}
                                            </div>
                                            <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
                                            {selected.description && <p className="text-xs text-gray-500 mt-0.5">{selected.description}</p>}
                                        </div>
                                    </div>

                                    {/* SageTabs — same component as PartnerManagementPage */}
                                    <SageTabs
                                        tabs={TABS}
                                        activeTabId={activeTab}
                                        onTabChange={handleTabChange}
                                        onExpandAll={handleExpandAll}
                                        onCollapseAll={handleCollapseAll}
                                        className="shadow-none"
                                    />
                                </div>

                                {/* Scrollable content — scroll-spy */}
                                <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth bg-slate-50">

                                    {/* ── Informations ─────────────────────── */}
                                    <div ref={el => { sectionRefs.current['informations'] = el; }}>
                                        <SageCollapsible
                                            title="Informations"
                                            isOpen={openSections['informations']}
                                            onOpenChange={open => toggleSection('informations', open)}
                                        >
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Code</p>
                                                        <p className="text-sm font-mono font-bold text-gray-900">{selected.code}</p>
                                                    </div>
                                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Remise par défaut</p>
                                                        <p className="text-sm font-bold text-gray-900">
                                                            {selected.default_discount_rate != null ? `${selected.default_discount_rate}%` : '—'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Nom complet</p>
                                                    <p className="text-sm font-semibold text-gray-900">{selected.name}</p>
                                                </div>
                                                {selected.description && (
                                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Description</p>
                                                        <p className="text-sm text-gray-700 leading-relaxed">{selected.description}</p>
                                                    </div>
                                                )}
                                                <div className="flex gap-6 px-1">
                                                    <div>
                                                        <p className="text-[10px] text-gray-400">Créé</p>
                                                        <p className="text-xs font-medium text-gray-700">
                                                            {selected.created_at ? new Date(selected.created_at).toLocaleDateString('fr-MA') : '—'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-gray-400">Mis à jour</p>
                                                        <p className="text-xs font-medium text-gray-700">
                                                            {selected.updated_at ? new Date(selected.updated_at).toLocaleDateString('fr-MA') : '—'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </SageCollapsible>
                                    </div>

                                    {/* ── Membres ──────────────────────────── */}
                                    <div ref={el => { sectionRefs.current['membres'] = el; }}>
                                        <SageCollapsible
                                            title="Membres"
                                            isOpen={openSections['membres']}
                                            onOpenChange={open => toggleSection('membres', open)}
                                            rightContent={
                                                !membersLoading && (
                                                    <span className="text-[10px] text-gray-400 mr-2">{members.length} partenaire{members.length !== 1 ? 's' : ''}</span>
                                                )
                                            }
                                        >
                                            <div className="space-y-3">
                                                {/* add partner search */}
                                                <div className="border border-dashed border-sage-200 rounded-lg p-3 bg-sage-50/30">
                                                    <p className="text-[10px] font-semibold text-sage-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                        <UserPlus className="w-3 h-3" /> Ajouter un partenaire
                                                    </p>
                                                    <div className="relative">
                                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                                        <input
                                                            value={memberSearch}
                                                            onChange={e => setMemberSearch(e.target.value)}
                                                            placeholder="Rechercher par nom ou code…"
                                                            className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-sage-400"
                                                        />
                                                        {memberSearch && (
                                                            <button onClick={() => { setMemberSearch(''); setSearchResults([]); }} className="absolute right-2 top-1/2 -translate-y-1/2">
                                                                <X className="w-3 h-3 text-gray-400" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    {memberSearch.trim().length >= 2 && (
                                                        <div className="mt-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
                                                            {searching ? (
                                                                <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
                                                            ) : searchResults.length === 0 ? (
                                                                <p className="text-xs text-gray-400 text-center py-3">Aucun résultat (tous déjà membres ?)</p>
                                                            ) : (
                                                                <div className="divide-y divide-gray-50 max-h-40 overflow-y-auto">
                                                                    {searchResults.map(p => (
                                                                        <div key={p.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                                                                            <div>
                                                                                <p className="text-xs font-semibold text-gray-900">{p.name}</p>
                                                                                <p className="text-[10px] text-gray-400">{p.code}</p>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => handleAssign(p)}
                                                                                disabled={assigning === p.id}
                                                                                className="flex items-center gap-1 px-2 py-1 bg-sage-600 text-white text-[10px] font-semibold rounded-md hover:bg-sage-700 disabled:opacity-50 transition-colors"
                                                                            >
                                                                                {assigning === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                                                                                Ajouter
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* members list */}
                                                {membersLoading ? (
                                                    <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                                                ) : members.length === 0 ? (
                                                    <div className="text-center py-8 text-xs text-gray-400">
                                                        <Users className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                                                        Aucun partenaire dans ce groupe
                                                    </div>
                                                ) : (
                                                    <div className="divide-y divide-gray-100 rounded-lg overflow-hidden border border-gray-100">
                                                        {members.map(m => (
                                                            <div key={m.id} className="flex items-center justify-between px-3 py-2.5 bg-white hover:bg-gray-50 transition-colors">
                                                                <div>
                                                                    <p className="text-xs font-semibold text-gray-900">{m.name}</p>
                                                                    <p className="text-[10px] text-gray-400">{m.code} · {m.city ?? '—'}</p>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {m.status && (
                                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${m.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                                                                            {m.status}
                                                                        </span>
                                                                    )}
                                                                    <button
                                                                        onClick={() => setRemoveTarget(m)}
                                                                        disabled={removing === m.id}
                                                                        className="flex items-center gap-1 px-2 py-1 border border-red-200 text-red-500 text-[10px] font-medium rounded-md hover:bg-red-50 disabled:opacity-50 transition-colors"
                                                                    >
                                                                        {removing === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserMinus className="w-3 h-3" />}
                                                                        Retirer
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </SageCollapsible>
                                    </div>

                                    {/* ── Dashboard ────────────────────────── */}
                                    <div ref={el => { sectionRefs.current['dashboard'] = el; }}>
                                        <SageCollapsible
                                            title="Dashboard"
                                            isOpen={openSections['dashboard']}
                                            onOpenChange={open => toggleSection('dashboard', open)}
                                        >
                                            {dashLoading ? (
                                                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                                            ) : !dashboard ? (
                                                <div className="text-center py-10 text-xs text-gray-400">
                                                    <BarChart3 className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                                                    Données non disponibles
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {/* KPI row */}
                                                    <div className="grid grid-cols-4 gap-2">
                                                        {[
                                                            { label: 'Partenaires',   value: fmt(dashboard.summary.partners_count),            icon: Users,      color: 'text-blue-600 bg-blue-50' },
                                                            { label: 'CA total',      value: fmtMAD(dashboard.summary.total_invoiced_all_time), icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
                                                            { label: 'Encours',       value: fmtMAD(dashboard.summary.total_outstanding),       icon: CreditCard, color: 'text-amber-600 bg-amber-50' },
                                                            { label: 'Limite crédit', value: fmtMAD(dashboard.summary.total_credit_limit),      icon: DollarSign, color: 'text-indigo-600 bg-indigo-50' },
                                                        ].map(k => (
                                                            <div key={k.label} className="bg-gray-50 rounded-lg border border-gray-100 p-3">
                                                                <div className={`w-6 h-6 rounded-md ${k.color} flex items-center justify-center mb-1.5`}>
                                                                    <k.icon className="w-3 h-3" />
                                                                </div>
                                                                <p className="text-xs font-bold text-gray-900">{k.value}</p>
                                                                <p className="text-[10px] text-gray-400 mt-0.5">{k.label}</p>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Credit bar + overdue */}
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="bg-gray-50 rounded-lg border border-gray-100 p-3">
                                                            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Crédit disponible</p>
                                                            <p className={`text-base font-bold ${dashboard.summary.total_available_credit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                {fmtMAD(dashboard.summary.total_available_credit)}
                                                            </p>
                                                            {dashboard.summary.total_credit_limit > 0 && (
                                                                <div className="mt-2 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full ${
                                                                            (dashboard.summary.total_exposure / dashboard.summary.total_credit_limit) > 0.9 ? 'bg-red-500'
                                                                            : (dashboard.summary.total_exposure / dashboard.summary.total_credit_limit) > 0.7 ? 'bg-amber-400'
                                                                            : 'bg-emerald-400'
                                                                        }`}
                                                                        style={{ width: `${Math.min(100, (dashboard.summary.total_exposure / dashboard.summary.total_credit_limit) * 100)}%` }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="bg-gray-50 rounded-lg border border-gray-100 p-3">
                                                            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Factures en souffrance</p>
                                                            <p className={`text-base font-bold ${dashboard.summary.overdue_invoice_count > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                                {dashboard.summary.overdue_invoice_count}
                                                            </p>
                                                            <p className="text-[10px] text-gray-400 mt-0.5">facture{dashboard.summary.overdue_invoice_count !== 1 ? 's' : ''} impayée{dashboard.summary.overdue_invoice_count !== 1 ? 's' : ''}</p>
                                                        </div>
                                                    </div>

                                                    {/* KAM */}
                                                    {dashboard.group.kam && (
                                                        <div className="flex items-center gap-3 bg-gray-50 rounded-lg border border-gray-100 p-3">
                                                            <div className="w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center shrink-0">
                                                                <span className="text-xs font-bold text-sage-700">{dashboard.group.kam.name.charAt(0).toUpperCase()}</span>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] text-gray-400">KAM responsable</p>
                                                                <p className="text-sm font-semibold text-gray-900">{dashboard.group.kam.name}</p>
                                                                <p className="text-[10px] text-gray-400">{dashboard.group.kam.email}</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Partners exposure table */}
                                                    {dashboard.partners?.length > 0 && (
                                                        <div className="rounded-lg border border-gray-100 overflow-hidden">
                                                            <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                                                                <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Exposition par partenaire</p>
                                                            </div>
                                                            <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto bg-white">
                                                                {dashboard.partners.map(p => (
                                                                    <div key={p.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50">
                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                            <Building2 className="w-3 h-3 text-gray-300 shrink-0" />
                                                                            <div className="min-w-0">
                                                                                <p className="text-xs font-medium text-gray-900 truncate">{p.name}</p>
                                                                                <p className="text-[10px] text-gray-400">{p.code}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 shrink-0">
                                                                            {p.is_billed_via_payer && (
                                                                                <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-semibold">via payeur</span>
                                                                            )}
                                                                            <div className="text-right">
                                                                                <p className="text-[10px] text-gray-400">Exposition</p>
                                                                                <p className={`text-xs font-semibold ${p.total_exposure > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                                                                                    {fmtMAD(p.total_exposure)}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </SageCollapsible>
                                    </div>

                                    {/* bottom padding */}
                                    <div className="h-8" />
                                </div>
                            </div>
                        )}

                        {/* ── Empty state ────────────────────────────────── */}
                        {formMode === 'view' && !selected && (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
                                <Tag className="w-12 h-12 mb-3 text-gray-200" />
                                <p className="text-sm font-medium text-gray-600 mb-1">Groupes clients</p>
                                <p className="text-xs max-w-xs">
                                    Sélectionnez un groupe dans la liste pour consulter ses détails, gérer ses membres ou voir le dashboard financier.
                                </p>
                                <button
                                    onClick={openCreate}
                                    className="mt-4 flex items-center gap-2 px-4 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Nouveau groupe
                                </button>
                            </div>
                        )}
                    </div>
                }

                rightContent={<ActionPanel groups={actionGroups} />}
            />

            {/* ── REMOVE MEMBER modal ──────────────────────────────────────────── */}
            {removeTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                                <UserMinus className="w-4 h-4 text-amber-600" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900">Retirer du groupe</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">
                            Voulez-vous retirer <strong>{removeTarget.name}</strong> du groupe <strong>{selected?.name}</strong> ?
                        </p>
                        <p className="text-xs text-gray-400 mb-5">
                            Le partenaire ne sera plus rattaché à ce groupe. Vous pourrez le réassigner à tout moment.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={handleRemove}
                                disabled={removing === removeTarget.id}
                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
                            >
                                {removing === removeTarget.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
                                Retirer
                            </button>
                            <button
                                onClick={() => setRemoveTarget(null)}
                                disabled={removing === removeTarget.id}
                                className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                            >
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── DELETE modal ──────────────────────────────────────────────────── */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900">Supprimer le groupe</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">
                            Confirmez-vous la suppression de <strong>{deleteTarget.name}</strong> ?
                        </p>
                        <p className="text-xs text-amber-600 mb-5">
                            Si des partenaires sont encore assignés, la suppression sera refusée.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={handleDeleteConfirm}
                                disabled={deleting}
                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                Supprimer
                            </button>
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
