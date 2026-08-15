import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
    Globe, Shield, ShieldOff, ShieldCheck, Plus, RefreshCw, Loader2,
    CheckCircle2, XCircle, AlertTriangle, Clock, Wifi, WifiOff,
    Building2, Users, Search, X, ChevronDown, Zap, Lock, Unlock,
    Trash2, Star, FlaskConical, Info, Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { DataGrid } from '@/components/common/DataGrid';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { SageCollapsible } from '@/components/common/SageCollapsible';

import * as api from '@/services/api/superAdminApi';
import type {
    Tenant, TenantDomain, TenantStatus, DomainStatus, DomainTestResponse,
} from '@/services/api/superAdminApi';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtDateTime = (d: string | null) =>
    d ? new Date(d).toLocaleString('fr-MA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const TENANT_STATUS: Record<TenantStatus, { label: string; bg: string; text: string; dot: string }> = {
    active:    { label: 'Actif',     bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    trial:     { label: 'Essai',     bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400' },
    suspended: { label: 'Suspendu',  bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
    blocked:   { label: 'Bloqué',    bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500' },
    expired:   { label: 'Expiré',    bg: 'bg-gray-100',   text: 'text-gray-500',    dot: 'bg-gray-400' },
};

const DOMAIN_STATUS: Record<DomainStatus, { label: string; color: string; bg: string }> = {
    active:     { label: 'Actif',       color: 'text-emerald-700', bg: 'bg-emerald-50' },
    blocked:    { label: 'Bloqué',      color: 'text-red-700',     bg: 'bg-red-50' },
    pending:    { label: 'En attente',  color: 'text-amber-700',   bg: 'bg-amber-50' },
    unverified: { label: 'Non vérifié', color: 'text-gray-600',    bg: 'bg-gray-100' },
};

const TEST_RESULT_ICON = {
    ok:      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
    error:   <XCircle      className="w-3.5 h-3.5 text-red-500" />,
    timeout: <Clock        className="w-3.5 h-3.5 text-amber-500" />,
    pending: <Loader2      className="w-3.5 h-3.5 text-gray-400 animate-spin" />,
};

const TABS: TabItem[] = [
    { id: 'apercu',   label: 'Aperçu',   icon: Info },
    { id: 'domaines', label: 'Domaines', icon: Globe },
    { id: 'acces',    label: 'Accès',    icon: Shield },
];

type FormMode = 'view' | 'create';

// ─── Component ───────────────────────────────────────────────────────────────

export default function SuperAdminPage() {
    // list
    const [tenants, setTenants]     = useState<Tenant[]>([]);
    const [loading, setLoading]     = useState(true);
    const [search, setSearch]       = useState('');
    const [statusFilter, setStatusFilter] = useState<TenantStatus | 'all'>('all');

    // selection
    const [selected, setSelected]   = useState<Tenant | null>(null);
    const [formMode, setFormMode]   = useState<FormMode>('view');
    const [saving, setSaving]       = useState(false);

    // create form
    const [createForm, setCreateForm] = useState({
        code: '', name: '', contact_email: '', contact_name: '',
        plan: 'standard', max_users: '', expires_at: '',
    });

    // scroll-spy
    const [activeTab, setActiveTab] = useState('apercu');
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        apercu: true, domaines: true, acces: true,
    });
    const sectionRefs  = useRef<Record<string, HTMLDivElement | null>>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const isScrollingRef = useRef(false);

    const handleTabChange = (id: string) => {
        setActiveTab(id);
        const el = sectionRefs.current[id];
        if (el && containerRef.current) {
            isScrollingRef.current = true;
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => { isScrollingRef.current = false; }, 1000);
        }
    };
    const toggleSection = (id: string, open: boolean) => setOpenSections(p => ({ ...p, [id]: open }));
    const expandAll   = () => setOpenSections({ apercu: true, domaines: true, acces: true });
    const collapseAll = () => setOpenSections({ apercu: false, domaines: false, acces: false });

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const onScroll = () => {
            if (isScrollingRef.current) return;
            const top = el.scrollTop;
            for (const tab of TABS) {
                const sec = sectionRefs.current[tab.id];
                if (!sec) continue;
                if (sec.offsetTop <= top + 100 && sec.offsetTop + sec.clientHeight > top + 50) {
                    if (activeTab !== tab.id) setActiveTab(tab.id);
                    break;
                }
            }
        };
        el.addEventListener('scroll', onScroll);
        return () => el.removeEventListener('scroll', onScroll);
    }, [openSections, activeTab]);

    // domains
    const [domains, setDomains]         = useState<TenantDomain[]>([]);
    const [domainsLoading, setDomainsLoading] = useState(false);
    const [testingDomainId, setTestingDomainId] = useState<number | null>(null);
    const [testResults, setTestResults] = useState<Record<number, DomainTestResponse>>({});
    const [newDomain, setNewDomain]     = useState('');
    const [addingDomain, setAddingDomain] = useState(false);

    // status change modal
    const [statusModal, setStatusModal] = useState<{ tenant: Tenant; nextStatus: TenantStatus } | null>(null);
    const [statusReason, setStatusReason] = useState('');
    const [applyingStatus, setApplyingStatus] = useState(false);

    // domain action modal
    const [domainModal, setDomainModal] = useState<{ domain: TenantDomain; nextStatus: DomainStatus } | null>(null);
    const [applyingDomain, setApplyingDomain] = useState(false);

    // ── Load ─────────────────────────────────────────────────────────────────

    const load = useCallback(async () => {
        setLoading(true);
        try { setTenants(await api.getTenants()); }
        catch { toast.error('Erreur chargement des tenants'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const fetchDomains = useCallback(async (tenantId: number) => {
        setDomainsLoading(true);
        setDomains([]);
        try { setDomains(await api.getTenantDomains(tenantId)); }
        catch { toast.error('Erreur chargement des domaines'); }
        finally { setDomainsLoading(false); }
    }, []);

    const handleSelect = (t: Tenant) => {
        setSelected(t);
        setFormMode('view');
        setActiveTab('apercu');
        setDomains([]);
        setTestResults({});
        setNewDomain('');
        fetchDomains(t.id);
    };

    // ── Domain actions ────────────────────────────────────────────────────────

    const handleTestDomain = async (domain: TenantDomain) => {
        if (!selected) return;
        setTestingDomainId(domain.id);
        try {
            const result = await api.testDomain(selected.id, domain.id);
            setTestResults(p => ({ ...p, [domain.id]: result }));
            if (result.result === 'ok') toast.success(`${domain.domain} — OK`);
            else toast.error(`${domain.domain} — ${result.message}`);
        } catch {
            toast.error('Erreur lors du test');
        } finally {
            setTestingDomainId(null);
        }
    };

    const confirmDomainStatus = async () => {
        if (!domainModal || !selected) return;
        setApplyingDomain(true);
        try {
            const updated = await api.updateDomainStatus(selected.id, domainModal.domain.id, domainModal.nextStatus);
            setDomains(prev => prev.map(d => d.id === updated.id ? updated : d));
            toast.success(`Domaine ${domainModal.nextStatus === 'blocked' ? 'bloqué' : 'activé'}`);
            setDomainModal(null);
        } catch {
            toast.error('Erreur lors de la mise à jour');
        } finally {
            setApplyingDomain(false);
        }
    };

    const handleAddDomain = async () => {
        if (!selected || !newDomain.trim()) return;
        setAddingDomain(true);
        try {
            const created = await api.addDomain(selected.id, newDomain.trim());
            setDomains(prev => [...prev, created]);
            setNewDomain('');
            toast.success('Domaine ajouté');
        } catch {
            toast.error('Erreur lors de l\'ajout');
        } finally {
            setAddingDomain(false);
        }
    };

    // ── Tenant status actions ────────────────────────────────────────────────

    const confirmStatusChange = async () => {
        if (!statusModal) return;
        setApplyingStatus(true);
        try {
            const updated = await api.updateTenantStatus(statusModal.tenant.id, statusModal.nextStatus, statusReason || undefined);
            setTenants(prev => prev.map(t => t.id === updated.id ? updated : t));
            if (selected?.id === updated.id) setSelected(updated);
            toast.success(`Tenant ${TENANT_STATUS[statusModal.nextStatus].label.toLowerCase()}`);
            setStatusModal(null);
            setStatusReason('');
        } catch {
            toast.error('Erreur lors du changement de statut');
        } finally {
            setApplyingStatus(false);
        }
    };

    // ── Create tenant ────────────────────────────────────────────────────────

    const handleCreate = async () => {
        if (!createForm.code.trim() || !createForm.name.trim()) {
            toast.error('Code et nom obligatoires'); return;
        }
        setSaving(true);
        try {
            const created = await api.createTenant({
                code: createForm.code.trim(),
                name: createForm.name.trim(),
                contact_email: createForm.contact_email || undefined,
                contact_name: createForm.contact_name || undefined,
                plan: createForm.plan || undefined,
                max_users: createForm.max_users ? parseInt(createForm.max_users) : undefined,
                expires_at: createForm.expires_at || undefined,
            });
            toast.success('Tenant créé');
            await load();
            handleSelect(created);
        } catch {
            toast.error('Erreur lors de la création');
        } finally {
            setSaving(false);
        }
    };

    // ── Filtered list ────────────────────────────────────────────────────────

    const filtered = useMemo(() => {
        let list = tenants;
        if (statusFilter !== 'all') list = list.filter(t => t.status === statusFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(t =>
                t.name.toLowerCase().includes(q) ||
                t.code.toLowerCase().includes(q) ||
                (t.primary_domain ?? '').toLowerCase().includes(q)
            );
        }
        return list;
    }, [tenants, statusFilter, search]);

    // ── DataGrid columns ─────────────────────────────────────────────────────

    const columnDefs = useMemo<import('ag-grid-community').ColDef[]>(() => [
        {
            colId: 'status', headerName: '', width: 28, sortable: false,
            cellRenderer: (p: any) => {
                const s = TENANT_STATUS[p.data?.status as TenantStatus];
                return (
                    <div className="flex items-center justify-center h-full">
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: s ? getComputedStyle(document.documentElement).getPropertyValue('--dot-' + p.data?.status) || '#9ca3af' : '#9ca3af' }}
                             className={`${s?.dot ?? 'bg-gray-400'} rounded-full`} />
                    </div>
                );
            },
        },
        {
            colId: 'code', headerName: 'Code', width: 85,
            cellRenderer: (p: any) => (
                <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: '#4338ca' }}>{p.data?.code}</span>
            ),
        },
        { field: 'name', headerName: 'Tenant', flex: 1, minWidth: 130, cellStyle: { fontSize: '12px', fontWeight: '500', color: '#111827' } },
        {
            colId: 'domain', headerName: 'Domaine', flex: 1, minWidth: 120,
            cellRenderer: (p: any) => (
                <span style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>{p.data?.primary_domain ?? '—'}</span>
            ),
        },
        {
            colId: 'statusBadge', headerName: 'Statut', width: 90,
            cellRenderer: (p: any) => {
                const s = TENANT_STATUS[p.data?.status as TenantStatus];
                if (!s) return null;
                return (
                    <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: 9999 }}
                          className={`${s.bg} ${s.text}`}>{s.label}</span>
                );
            },
        },
        {
            colId: 'users', headerName: '', width: 52,
            cellRenderer: (p: any) => (
                <div className="flex items-center gap-1 text-[11px] text-gray-400 h-full">
                    <Users className="w-3 h-3" />{p.data?.user_count ?? 0}
                </div>
            ),
        },
    ], []);

    // ── Action panel ─────────────────────────────────────────────────────────

    const actionGroups = useMemo((): { items: ActionItemProps[] }[] => {
        if (formMode === 'create') {
            return [{ items: [
                { icon: CheckCircle2, label: 'Créer',   variant: 'primary', onClick: handleCreate, disabled: saving },
                { icon: X,           label: 'Annuler',  variant: 'warning', onClick: () => setFormMode('view') },
            ]}];
        }
        const base: ActionItemProps[] = [
            { icon: Plus,      label: 'Nouveau tenant', variant: 'sage',    onClick: () => { setCreateForm({ code: '', name: '', contact_email: '', contact_name: '', plan: 'standard', max_users: '', expires_at: '' }); setFormMode('create'); } },
            { icon: RefreshCw, label: 'Actualiser',     variant: 'default', onClick: load, disabled: loading },
        ];
        if (selected) {
            const statusActions: ActionItemProps[] = [];
            if (selected.status !== 'active') {
                statusActions.push({ icon: Unlock, label: 'Activer', variant: 'success', onClick: () => { setStatusModal({ tenant: selected, nextStatus: 'active' }); setStatusReason(''); } });
            }
            if (selected.status !== 'suspended') {
                statusActions.push({ icon: Lock, label: 'Suspendre', variant: 'warning', onClick: () => { setStatusModal({ tenant: selected, nextStatus: 'suspended' }); setStatusReason(''); } });
            }
            if (selected.status !== 'blocked') {
                statusActions.push({ icon: ShieldOff, label: 'Bloquer', variant: 'danger', onClick: () => { setStatusModal({ tenant: selected, nextStatus: 'blocked' }); setStatusReason(''); } });
            }
            return [
                { items: base },
                { items: statusActions },
            ];
        }
        return [{ items: base }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formMode, selected, loading, saving]);

    const counts = useMemo(() => ({
        total:     tenants.length,
        active:    tenants.filter(t => t.status === 'active').length,
        suspended: tenants.filter(t => t.status === 'suspended').length,
        blocked:   tenants.filter(t => t.status === 'blocked').length,
        trial:     tenants.filter(t => t.status === 'trial').length,
    }), [tenants]);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
                        {/* header */}
                        <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                                    <h2 className="text-sm font-bold text-gray-900">Super Admin</h2>
                                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                                        {counts.total}
                                    </span>
                                </div>
                                <div className="flex gap-1 text-[9px]">
                                    <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded font-semibold">{counts.active} actifs</span>
                                    {counts.blocked > 0 && <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded font-semibold">{counts.blocked} bloqués</span>}
                                </div>
                            </div>

                            {/* status filter pills */}
                            <div className="flex flex-wrap gap-1 mb-2">
                                {([
                                    { key: 'all',       label: 'Tous' },
                                    { key: 'active',    label: 'Actifs' },
                                    { key: 'trial',     label: 'Essai' },
                                    { key: 'suspended', label: 'Suspendus' },
                                    { key: 'blocked',   label: 'Bloqués' },
                                ] as const).map(f => (
                                    <button
                                        key={f.key}
                                        onClick={() => setStatusFilter(f.key)}
                                        className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border transition-colors ${
                                            statusFilter === f.key
                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Rechercher tenant, domaine…"
                                    className="w-full pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-gray-50/70 transition-all"
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

                        {/* ── CREATE form ───────────────────────────────── */}
                        {formMode === 'create' && (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0">
                                    <h2 className="text-sm font-bold text-gray-900">Nouveau tenant</h2>
                                    <p className="text-[11px] text-gray-400">Créer un nouvel espace client isolé</p>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6">
                                    <div className="max-w-lg space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Code *</label>
                                                <input
                                                    value={createForm.code}
                                                    onChange={e => setCreateForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono"
                                                    placeholder="ACME"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Plan</label>
                                                <select
                                                    value={createForm.plan}
                                                    onChange={e => setCreateForm(p => ({ ...p, plan: e.target.value }))}
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                                                >
                                                    <option value="trial">Essai</option>
                                                    <option value="standard">Standard</option>
                                                    <option value="premium">Premium</option>
                                                    <option value="enterprise">Entreprise</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Nom du tenant *</label>
                                            <input
                                                value={createForm.name}
                                                onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                                placeholder="Acme Corporation"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Contact nom</label>
                                                <input
                                                    value={createForm.contact_name}
                                                    onChange={e => setCreateForm(p => ({ ...p, contact_name: e.target.value }))}
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                                    placeholder="John Doe"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Contact email</label>
                                                <input
                                                    type="email"
                                                    value={createForm.contact_email}
                                                    onChange={e => setCreateForm(p => ({ ...p, contact_email: e.target.value }))}
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                                    placeholder="contact@acme.com"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Max utilisateurs</label>
                                                <input
                                                    type="number" min="1"
                                                    value={createForm.max_users}
                                                    onChange={e => setCreateForm(p => ({ ...p, max_users: e.target.value }))}
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                                    placeholder="50"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Date d'expiration</label>
                                                <input
                                                    type="date"
                                                    value={createForm.expires_at}
                                                    onChange={e => setCreateForm(p => ({ ...p, expires_at: e.target.value }))}
                                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-3 pt-2">
                                            <button
                                                onClick={handleCreate}
                                                disabled={saving}
                                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                            >
                                                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                                Créer le tenant
                                            </button>
                                            <button onClick={() => setFormMode('view')} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                                Annuler
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── VIEW: tenant detail ───────────────────────── */}
                        {formMode === 'view' && selected && (() => {
                            const s = TENANT_STATUS[selected.status];
                            return (
                                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                                    {/* header */}
                                    <div className="px-6 pt-5 pb-0 bg-white border-b border-gray-200 shrink-0">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{selected.code}</span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${s.bg} ${s.text}`}>{s.label}</span>
                                                    {selected.plan && (
                                                        <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-semibold capitalize">{selected.plan}</span>
                                                    )}
                                                </div>
                                                <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
                                                {selected.primary_domain && (
                                                    <p className="text-xs font-mono text-gray-500 mt-0.5 flex items-center gap-1">
                                                        <Globe className="w-3 h-3" /> {selected.primary_domain}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-[10px] text-gray-400">Dernière connexion</p>
                                                <p className="text-xs font-medium text-gray-700">{fmtDateTime(selected.last_login_at)}</p>
                                            </div>
                                        </div>

                                        <SageTabs
                                            tabs={TABS}
                                            activeTabId={activeTab}
                                            onTabChange={handleTabChange}
                                            onExpandAll={expandAll}
                                            onCollapseAll={collapseAll}
                                            className="shadow-none"
                                        />
                                    </div>

                                    {/* scrollable sections */}
                                    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth bg-slate-50">

                                        {/* ── Aperçu ─────────────────────── */}
                                        <div ref={el => { sectionRefs.current['apercu'] = el; }}>
                                            <SageCollapsible
                                                title="Aperçu"
                                                isOpen={openSections['apercu']}
                                                onOpenChange={open => toggleSection('apercu', open)}
                                            >
                                                <div className="space-y-3">
                                                    {/* status alert */}
                                                    {(selected.status === 'blocked' || selected.status === 'suspended') && (
                                                        <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                                                            selected.status === 'blocked'
                                                                ? 'bg-red-50 border-red-200'
                                                                : 'bg-amber-50 border-amber-200'
                                                        }`}>
                                                            {selected.status === 'blocked'
                                                                ? <ShieldOff className="w-4 h-4 text-red-600 shrink-0" />
                                                                : <Lock className="w-4 h-4 text-amber-600 shrink-0" />}
                                                            <p className={`text-xs font-medium ${selected.status === 'blocked' ? 'text-red-700' : 'text-amber-700'}`}>
                                                                Ce tenant est <strong>{s.label.toLowerCase()}</strong> — les utilisateurs ne peuvent pas se connecter.
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* KPI strip */}
                                                    <div className="grid grid-cols-4 gap-2">
                                                        {[
                                                            { label: 'Utilisateurs', value: selected.user_count,   sub: selected.max_users ? `/ ${selected.max_users}` : null, icon: Users,     color: 'text-blue-600 bg-blue-50' },
                                                            { label: 'Domaines',     value: selected.domain_count, sub: null,                                                    icon: Globe,     color: 'text-indigo-600 bg-indigo-50' },
                                                            { label: 'Plan',         value: selected.plan ?? '—',  sub: null,                                                    icon: Shield,    color: 'text-sage-600 bg-sage-50' },
                                                            { label: 'Expire le',    value: fmtDate(selected.expires_at), sub: null,                                             icon: Clock,     color: 'text-amber-600 bg-amber-50' },
                                                        ].map(k => (
                                                            <div key={k.label} className="bg-gray-50 rounded-lg border border-gray-100 p-3">
                                                                <div className={`w-6 h-6 rounded-md ${k.color} flex items-center justify-center mb-1.5`}>
                                                                    <k.icon className="w-3 h-3" />
                                                                </div>
                                                                <p className="text-xs font-bold text-gray-900 capitalize">{k.value}</p>
                                                                {k.sub && <p className="text-[10px] text-gray-400">{k.sub}</p>}
                                                                <p className="text-[10px] text-gray-400 mt-0.5">{k.label}</p>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* contact info */}
                                                    {(selected.contact_name || selected.contact_email) && (
                                                        <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                                                <span className="text-xs font-bold text-indigo-700">
                                                                    {(selected.contact_name ?? selected.contact_email ?? 'T').charAt(0).toUpperCase()}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] text-gray-400">Contact référent</p>
                                                                {selected.contact_name && <p className="text-sm font-semibold text-gray-900">{selected.contact_name}</p>}
                                                                {selected.contact_email && <p className="text-[11px] text-gray-500">{selected.contact_email}</p>}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* dates */}
                                                    <div className="flex gap-6 px-1">
                                                        <div>
                                                            <p className="text-[10px] text-gray-400">Créé</p>
                                                            <p className="text-xs font-medium text-gray-700">{fmtDate(selected.created_at)}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] text-gray-400">Expiration</p>
                                                            <p className={`text-xs font-medium ${selected.expires_at && new Date(selected.expires_at) < new Date() ? 'text-red-600' : 'text-gray-700'}`}>
                                                                {fmtDate(selected.expires_at)}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] text-gray-400">Dernière connexion</p>
                                                            <p className="text-xs font-medium text-gray-700">{fmtDateTime(selected.last_login_at)}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </SageCollapsible>
                                        </div>

                                        {/* ── Domaines ───────────────────── */}
                                        <div ref={el => { sectionRefs.current['domaines'] = el; }}>
                                            <SageCollapsible
                                                title="Domaines"
                                                isOpen={openSections['domaines']}
                                                onOpenChange={open => toggleSection('domaines', open)}
                                                rightContent={
                                                    !domainsLoading && (
                                                        <span className="text-[10px] text-gray-400 mr-2">{domains.length} domaine{domains.length !== 1 ? 's' : ''}</span>
                                                    )
                                                }
                                            >
                                                <div className="space-y-3">
                                                    {/* add domain */}
                                                    <div className="flex gap-2">
                                                        <div className="relative flex-1">
                                                            <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                                            <input
                                                                value={newDomain}
                                                                onChange={e => setNewDomain(e.target.value)}
                                                                onKeyDown={e => e.key === 'Enter' && handleAddDomain()}
                                                                placeholder="app.example.com"
                                                                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={handleAddDomain}
                                                            disabled={!newDomain.trim() || addingDomain}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                                                        >
                                                            {addingDomain ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                                            Ajouter
                                                        </button>
                                                    </div>

                                                    {/* domain list */}
                                                    {domainsLoading ? (
                                                        <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
                                                    ) : domains.length === 0 ? (
                                                        <div className="text-center py-6 text-xs text-gray-400">
                                                            <Globe className="w-7 h-7 mx-auto mb-2 text-gray-200" />
                                                            Aucun domaine configuré
                                                        </div>
                                                    ) : (
                                                        <div className="divide-y divide-gray-100 rounded-lg overflow-hidden border border-gray-100">
                                                            {domains.map(d => {
                                                                const ds = DOMAIN_STATUS[d.status];
                                                                const tr = testResults[d.id];
                                                                return (
                                                                    <div key={d.id} className="bg-white px-3 py-2.5 hover:bg-gray-50 transition-colors">
                                                                        <div className="flex items-center justify-between gap-3">
                                                                            <div className="flex items-center gap-2 min-w-0">
                                                                                {d.is_primary && <Star className="w-3 h-3 text-amber-400 shrink-0" />}
                                                                                <span className="text-xs font-mono font-medium text-gray-900 truncate">{d.domain}</span>
                                                                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${ds.bg} ${ds.color}`}>{ds.label}</span>
                                                                                {!d.verified && (
                                                                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold shrink-0">non vérifié</span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center gap-1 shrink-0">
                                                                                {/* test result indicator */}
                                                                                {testingDomainId === d.id
                                                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                                                                                    : tr
                                                                                    ? <span title={tr.message}>{TEST_RESULT_ICON[tr.result]}</span>
                                                                                    : null}

                                                                                <button
                                                                                    onClick={() => handleTestDomain(d)}
                                                                                    disabled={testingDomainId === d.id}
                                                                                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50 disabled:opacity-40 transition-colors"
                                                                                >
                                                                                    <FlaskConical className="w-3 h-3" /> Tester
                                                                                </button>

                                                                                {d.status === 'blocked' ? (
                                                                                    <button
                                                                                        onClick={() => setDomainModal({ domain: d, nextStatus: 'active' })}
                                                                                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-emerald-600 border border-emerald-200 rounded-md hover:bg-emerald-50 transition-colors"
                                                                                    >
                                                                                        <Unlock className="w-3 h-3" /> Autoriser
                                                                                    </button>
                                                                                ) : (
                                                                                    <button
                                                                                        onClick={() => setDomainModal({ domain: d, nextStatus: 'blocked' })}
                                                                                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-red-500 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                                                                                    >
                                                                                        <ShieldOff className="w-3 h-3" /> Bloquer
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {/* test result detail */}
                                                                        {tr && (
                                                                            <div className={`mt-2 p-2 rounded-md text-[10px] flex items-start gap-2 ${
                                                                                tr.result === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                                                                            }`}>
                                                                                {tr.result === 'ok'
                                                                                    ? <Wifi className="w-3 h-3 mt-0.5 shrink-0" />
                                                                                    : <WifiOff className="w-3 h-3 mt-0.5 shrink-0" />}
                                                                                <div>
                                                                                    <span className="font-semibold">{tr.message}</span>
                                                                                    {tr.checks && (
                                                                                        <span className="ml-2 opacity-70">
                                                                                            DNS:{tr.checks.dns ? '✓' : '✗'} SSL:{tr.checks.ssl ? '✓' : '✗'} Ping:{tr.checks.reachable ? '✓' : '✗'}
                                                                                            {tr.checks.latency_ms != null && ` ${tr.checks.latency_ms}ms`}
                                                                                        </span>
                                                                                    )}
                                                                                    <span className="ml-2 opacity-50">— {fmtDateTime(tr.tested_at)}</span>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </SageCollapsible>
                                        </div>

                                        {/* ── Accès ──────────────────────── */}
                                        <div ref={el => { sectionRefs.current['acces'] = el; }}>
                                            <SageCollapsible
                                                title="Contrôle d'accès"
                                                isOpen={openSections['acces']}
                                                onOpenChange={open => toggleSection('acces', open)}
                                            >
                                                <div className="space-y-2">
                                                    <p className="text-xs text-gray-500 mb-3">
                                                        Modifier le statut du tenant affecte immédiatement la capacité de ses utilisateurs à se connecter.
                                                    </p>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {([
                                                            {
                                                                status: 'active' as TenantStatus,
                                                                icon: Unlock,
                                                                label: 'Activer',
                                                                desc: 'Accès complet',
                                                                cls: 'border-emerald-200 hover:bg-emerald-50 text-emerald-700',
                                                                disabled: selected.status === 'active',
                                                            },
                                                            {
                                                                status: 'suspended' as TenantStatus,
                                                                icon: Lock,
                                                                label: 'Suspendre',
                                                                desc: 'Accès temporairement restreint',
                                                                cls: 'border-amber-200 hover:bg-amber-50 text-amber-700',
                                                                disabled: selected.status === 'suspended',
                                                            },
                                                            {
                                                                status: 'blocked' as TenantStatus,
                                                                icon: ShieldOff,
                                                                label: 'Bloquer',
                                                                desc: 'Accès complètement interdit',
                                                                cls: 'border-red-200 hover:bg-red-50 text-red-700',
                                                                disabled: selected.status === 'blocked',
                                                            },
                                                        ]).map(action => (
                                                            <button
                                                                key={action.status}
                                                                onClick={() => { setStatusModal({ tenant: selected, nextStatus: action.status }); setStatusReason(''); }}
                                                                disabled={action.disabled}
                                                                className={`flex flex-col items-center p-3 border rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${action.cls} ${action.disabled ? 'bg-gray-50' : 'bg-white'}`}
                                                            >
                                                                <action.icon className="w-4 h-4 mb-1.5" />
                                                                <span className="text-xs font-semibold">{action.label}</span>
                                                                <span className="text-[9px] mt-0.5 opacity-70 text-center leading-tight">{action.desc}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </SageCollapsible>
                                        </div>

                                        <div className="h-8" />
                                    </div>
                                </div>
                            );
                        })()}

                        {/* ── Empty state ───────────────────────────────── */}
                        {formMode === 'view' && !selected && (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
                                <ShieldCheck className="w-12 h-12 mb-3 text-gray-200" />
                                <p className="text-sm font-medium text-gray-600 mb-1">Super Administration</p>
                                <p className="text-xs max-w-xs">
                                    Sélectionnez un tenant pour gérer ses domaines, contrôler l'accès et consulter les informations de licence.
                                </p>
                            </div>
                        )}
                    </div>
                }

                rightContent={<ActionPanel groups={actionGroups} />}
            />

            {/* ── STATUS CHANGE MODAL ───────────────────────────────────────────── */}
            {statusModal && (() => {
                const next = TENANT_STATUS[statusModal.nextStatus];
                const isBlock = statusModal.nextStatus === 'blocked';
                const isSuspend = statusModal.nextStatus === 'suspended';
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${next.bg}`}>
                                    {isBlock ? <ShieldOff className={`w-4 h-4 ${next.text}`} />
                                    : isSuspend ? <Lock className={`w-4 h-4 ${next.text}`} />
                                    : <Unlock className={`w-4 h-4 ${next.text}`} />}
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-gray-900">{next.label} le tenant</h3>
                                    <p className="text-[11px] text-gray-400">{statusModal.tenant.name}</p>
                                </div>
                            </div>

                            {isBlock && (
                                <div className="p-2.5 mb-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 flex items-start gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    Tous les utilisateurs de ce tenant seront immédiatement déconnectés et ne pourront plus se reconnecter.
                                </div>
                            )}

                            <div className="mb-4">
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    Raison {isBlock || isSuspend ? '*' : '(optionnel)'}
                                </label>
                                <textarea
                                    value={statusReason}
                                    onChange={e => setStatusReason(e.target.value)}
                                    rows={3}
                                    placeholder={isBlock ? 'Violation des CGU…' : isSuspend ? 'Paiement en attente…' : 'Réactivation suite au…'}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={confirmStatusChange}
                                    disabled={applyingStatus || ((isBlock || isSuspend) && !statusReason.trim())}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-40 transition-colors ${
                                        isBlock ? 'bg-red-600 hover:bg-red-700'
                                        : isSuspend ? 'bg-amber-500 hover:bg-amber-600'
                                        : 'bg-emerald-600 hover:bg-emerald-700'
                                    }`}
                                >
                                    {applyingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                    Confirmer
                                </button>
                                <button
                                    onClick={() => setStatusModal(null)}
                                    disabled={applyingStatus}
                                    className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
                                >
                                    Annuler
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── DOMAIN ACTION MODAL ───────────────────────────────────────────── */}
            {domainModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${domainModal.nextStatus === 'blocked' ? 'bg-red-100' : 'bg-emerald-100'}`}>
                                {domainModal.nextStatus === 'blocked'
                                    ? <ShieldOff className="w-4 h-4 text-red-600" />
                                    : <Unlock className="w-4 h-4 text-emerald-600" />}
                            </div>
                            <h3 className="text-base font-semibold text-gray-900">
                                {domainModal.nextStatus === 'blocked' ? 'Bloquer' : 'Autoriser'} le domaine
                            </h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">
                            Domaine : <strong className="font-mono">{domainModal.domain.domain}</strong>
                        </p>
                        {domainModal.nextStatus === 'blocked' && (
                            <p className="text-xs text-red-600 mb-4">
                                Les requêtes provenant de ce domaine seront rejetées.
                            </p>
                        )}
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={confirmDomainStatus}
                                disabled={applyingDomain}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors ${
                                    domainModal.nextStatus === 'blocked' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                                }`}
                            >
                                {applyingDomain ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                Confirmer
                            </button>
                            <button onClick={() => setDomainModal(null)} disabled={applyingDomain} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
