import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import apiClient from '@/services/api/client';
import toast from 'react-hot-toast';
import { PERMISSIONS } from '@/lib/rbac/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { useSearchParams } from 'react-router-dom';
import { BCWorkflowActions } from '@/components/adv/BCWorkflowActions';
import { WorkflowHistory } from '@/components/workflow/WorkflowHistory';
import { useAdvWorkflow } from '@/hooks/adv/useAdvWorkflow';
import {
    Calendar, User, Building, CheckCircle, XCircle, Clock,
    AlertTriangle, CreditCard, FileText, Package, Loader2,
    Printer, Download, Share2, History,
    ShieldAlert, TrendingUp, Truck, DollarSign,
    Tag, Layers, Weight, Box, AlertCircle,
    Search, RefreshCw, BarChart3, Star,
    Receipt, Warehouse, ListChecks,
} from 'lucide-react';
import type { ColDef } from 'ag-grid-community';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { DataGrid } from '@/components/common/DataGrid';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { SageCollapsible } from '@/components/common/SageCollapsible';
import { cn } from '@/lib/utils';
import { advApi } from '@/services/api/advApi';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product { id: number; name: string; code: string; thumbnail: string | null }
interface LogisticsFlags { stackable: boolean; fragile: boolean; keep_upright: boolean; requires_separation: boolean; temperature_controlled: boolean; temperature_profile_code: string | null }
interface LogisticsLine { line_base_quantity: number; shipping_level: string; physical_packages_estimate: number; line_gross_weight_kg_estimate: number | null; line_volume_m3_estimate: number | null; missing_reason: string | null; profile_flags: LogisticsFlags }
interface OrderProduct { id: number; order_id: number; product_id: number; quantity: string; price: string; total_price: string; unit: string | null; tax_rate: string; unit_price_ht: string; line_tax_amount: string; line_total_ht: string; out_of_stock: boolean; available_stock_quantity: number; sales_group_code: string; logistics_line: LogisticsLine; product: Product }
interface Partner { id: number; code: string; name: string; credit_limit: string; credit_used: string; credit_available: string; credit_hold: boolean; credit_hold_reason: string | null; tax_number_ice: string | null; tax_number_if: string | null; city: string | null; region: string | null; country: string | null; address_line1: string | null; phone: string | null; email: string | null; website: string | null; partner_type: string; channel: string; risk_score: number; payment_behavior_score: number; total_orders_count: number; total_orders_value: string; status: string; payment_term_id: number | null }
interface FinancialMetadata { is_credit_sale: boolean; payment_term_id: number | null; balance_checked: boolean; balance_checked_at: string | null; payment_method: string; stamp_duty: string }
interface WorkflowStep { id: number; code: string; name: string; allowed_transitions: string[]; is_final: boolean }
interface WorkflowTransitionRecord { id: number; action: string; performed_by: { id: number; name: string; email: string } | null; performed_at: string; comment: string | null; metadata: any; from_step_id: number | null; to_step_id: number }
interface WorkflowInstance { id: number; status: string; current_step: WorkflowStep; transitions: WorkflowTransitionRecord[] }
interface LogisticsAggregate { total_weight_kg: number; total_volume_m3: number; weight_evaluable: boolean; volume_evaluable: boolean; data_completeness: 'complete' | 'partial' | 'missing'; missing_product_logistics: { product_id: number; reason: string }[]; per_product: Record<string, { product_id: number; product_name: string; base_quantity: number; shipping_level: string; physical_packages: number; line_gross_weight_kg: number | null; line_volume_m3: number | null; weight_evaluable: boolean; volume_evaluable: boolean; profile_flags: LogisticsFlags }>; handling_flags: { fragile_present: boolean; all_stackable: boolean; requires_separation_present: boolean; temperature_profile_codes: string[]; load_categories: string[] }; constraint_warnings: string[]; notes: string[] }
interface PartnerStats { total_orders: number; pending_bcs: number; avg_order_value: number }
interface BC { id: number; order_code: string; bc_status: string; total_amount: string; sub_total: string; tax_amount: string; payment_status: string; order_status: string; created_at: string; order_date: string; due_date: string | null; canal: string; document_type: string; bc_notes: string | null; is_preorder: boolean; branch_id: number; partner: Partner; order_products: OrderProduct[]; financial_metadata: FinancialMetadata | null; workflow_instance: WorkflowInstance | null; payment_term: any | null; delivery_notes: any[] }
interface BcDetailData { bc: BC; stockAvailable: boolean; creditOk: boolean; creditExceeded: boolean; excessAmount: number; pendingDerogation: any | null; partnerStats: PartnerStats; logistics_aggregate: LogisticsAggregate }

// ─── Utils ────────────────────────────────────────────────────────────────────

const n = (v: string | number | null | undefined) => Number(v ?? 0);
const fmt = (v: string | number | null | undefined, d = 2) => n(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtDate = (d: string | null | undefined, time = false) =>
    d ? new Date(d).toLocaleDateString('fr-FR', time ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STATUS: Record<string, { label: string; dot: string; row: string; badge: string }> = {
    submitted:          { label: 'Soumis',       dot: 'bg-blue-500',   row: 'border-l-blue-400',   badge: 'bg-blue-50 text-blue-700 ring-blue-200' },
    in_review:          { label: 'En révision',  dot: 'bg-indigo-500', row: 'border-l-indigo-400', badge: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
    on_hold:            { label: 'En attente',   dot: 'bg-amber-500',  row: 'border-l-amber-400',  badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
    pending_derogation: { label: 'Dérogation',   dot: 'bg-purple-500', row: 'border-l-purple-400', badge: 'bg-purple-50 text-purple-700 ring-purple-200' },
    confirmed:          { label: 'Confirmé',     dot: 'bg-emerald-500',row: 'border-l-emerald-400',badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    rejected:           { label: 'Rejeté',       dot: 'bg-red-500',    row: 'border-l-red-400',    badge: 'bg-red-50 text-red-700 ring-red-200' },
    cancelled:          { label: 'Annulé',       dot: 'bg-gray-400',   row: 'border-l-gray-300',   badge: 'bg-gray-50 text-gray-600 ring-gray-200' },
};

const getCfg = (s: string) => STATUS[s] ?? { label: s, dot: 'bg-gray-400', row: 'border-l-gray-300', badge: 'bg-gray-50 text-gray-600 ring-gray-200' };

// ─── Shared atoms ─────────────────────────────────────────────────────────────

const Pill = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1', className)}>{children}</span>
);

const Divider = () => <div className="border-t border-gray-100 my-4" />;

const Field = ({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) => (
    <div className={cn('', className)}>
        <dt className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</dt>
        <dd className="text-sm font-semibold text-gray-900">{value ?? <span className="text-gray-300 font-normal">—</span>}</dd>
    </div>
);

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={cn('bg-white rounded-2xl border border-gray-100 shadow-sm', className)}>{children}</div>
);

const CardHeader = ({ icon: Icon, title, action }: { icon?: React.ElementType; title: string; action?: React.ReactNode }) => (
    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
            {Icon && <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center"><Icon className="w-3.5 h-3.5 text-gray-500" /></div>}
            <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        </div>
        {action}
    </div>
);

const Stat = ({ label, value, sub, color = 'gray' }: { label: string; value: React.ReactNode; sub?: string; color?: string }) => {
    const colors: Record<string, string> = { gray: 'text-gray-900', sage: 'text-sage-700', blue: 'text-blue-700', amber: 'text-amber-700', emerald: 'text-emerald-700', red: 'text-red-700' };
    return (
        <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
            <p className={cn('text-xl font-black mt-0.5 leading-none', colors[color] ?? 'text-gray-900')}>{value}</p>
            {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
        </div>
    );
};

const Bar = ({ pct, color = 'emerald' }: { pct: number; color?: string }) => {
    const colors: Record<string, string> = { emerald: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', blue: 'bg-blue-500', sage: 'bg-sage-500' };
    return (
        <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-500', colors[color] ?? 'bg-gray-400')} style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }} />
        </div>
    );
};

// ─── Left: BC DataGrid ────────────────────────────────────────────────────────

const AdvBcGrid = ({ bcs, loading, selectedId, onSelect, onRefresh }: {
    bcs: any[]; loading: boolean; selectedId: number | null;
    onSelect: (id: number) => void; onRefresh: () => void;
}) => {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search.trim()) return bcs;
        const q = search.toLowerCase();
        return bcs.filter(b =>
            b.order_code?.toLowerCase().includes(q) ||
            b.partner?.name?.toLowerCase().includes(q)
        );
    }, [bcs, search]);

    const isSelected = useCallback((row: any) => row.id === selectedId, [selectedId]);

    const colDefs = useMemo<ColDef[]>(() => [
        {
            headerName: 'N° BC',
            flex: 1,
            minWidth: 130,
            sortable: true,
            cellRenderer: (p: any) => (
                <div className="flex items-center gap-2 h-full">
                    <span className={cn('w-2 h-2 rounded-full shrink-0', getCfg(p.data.bc_status).dot)} />
                    <div className="min-w-0">
                        <p className="font-mono font-bold text-[11px] text-gray-900 truncate leading-tight">{p.data.order_code}</p>
                        <p className="text-[10px] text-gray-400 truncate leading-tight">{fmtDate(p.data.created_at)}</p>
                    </div>
                </div>
            ),
        },
        {
            headerName: 'Client',
            flex: 2,
            minWidth: 120,
            sortable: true,
            cellRenderer: (p: any) => (
                <div className="flex flex-col justify-center h-full">
                    <p className="text-[11px] font-semibold text-gray-800 truncate leading-tight">{p.data.partner?.name ?? '—'}</p>
                    <p className="text-[10px] text-gray-400 truncate leading-tight">{p.data.canal}</p>
                </div>
            ),
        },
        {
            field: 'total_amount',
            headerName: 'TTC',
            width: 90,
            sortable: true,
            cellRenderer: (p: any) => (
                <div className="flex flex-col items-end justify-center h-full">
                    <p className="text-xs font-black text-gray-900 leading-tight">{fmt(p.value, 0)} Dh</p>
                    <p className={cn('text-[9px] font-semibold leading-tight', getCfg(p.data.bc_status).badge.split(' ').filter(c => c.startsWith('text-')).join(' '))}>
                        {getCfg(p.data.bc_status).label}
                    </p>
                </div>
            ),
        },
    ], []);

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header — mirrors ProductsPage sidebar header */}
            <div className="px-4 py-3 border-b border-gray-100 shrink-0">
                <div className="flex items-center justify-between mb-2.5">
                    <div>
                        <p className="text-sm font-bold text-gray-900">Commandes ADV</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                            {filtered.length}{filtered.length !== bcs.length ? ` / ${bcs.length}` : ''} bon{bcs.length !== 1 ? 's' : ''} de commande
                        </p>
                    </div>
                    <button onClick={onRefresh} disabled={loading}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40">
                        <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                    </button>
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Rechercher..."
                        className="w-full pl-8 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sage-400/50 focus:border-sage-400 transition-colors placeholder:text-gray-400" />
                </div>
            </div>

            {/* DataGrid */}
            <div className="flex-1 min-h-0">
                {loading && bcs.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                ) : (
                    <DataGrid
                        rowData={filtered}
                        columnDefs={colDefs}
                        rowHeight={52}
                        headerHeight={36}
                        rowSelection="single"
                        onRowClicked={(e: any) => onSelect(e.data.id)}
                        defaultSelectedIds={isSelected}
                        getRowId={(p: any) => String(p.data.id)}
                    />
                )}
            </div>
        </div>
    );
};

// ─── Derogation modal ─────────────────────────────────────────────────────────

const DerogationModal = ({ isOpen, bcId, onClose, onSuccess }: { isOpen: boolean; bcId: number | null; onClose: () => void; onSuccess: () => void }) => {
    const [justification, setJustification] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!bcId || justification.trim().length < 20) { toast.error('Justification : 20 caractères minimum.'); return; }
        setLoading(true);
        try {
            await advApi.derogations.request(bcId, { justification });
            toast.success('Demande de dérogation soumise');
            setJustification(''); onSuccess(); onClose();
        } catch (err: any) { toast.error(err?.response?.data?.message || 'Erreur'); }
        finally { setLoading(false); }
    };

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200">
                <div className="p-6">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-4">
                        <ShieldAlert className="w-5 h-5 text-amber-600" />
                    </div>
                    <h3 className="text-base font-bold text-gray-900 mb-1">Demande de Dérogation Crédit</h3>
                    <p className="text-sm text-gray-500 mb-5">Le plafond de crédit sera dépassé. Une justification est requise pour cette dérogation exceptionnelle.</p>
                    <textarea value={justification} onChange={e => setJustification(e.target.value)} rows={4} maxLength={1000}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none bg-gray-50 placeholder:text-gray-400"
                        placeholder="Décrivez le contexte commercial qui justifie cette dérogation..." />
                    <div className="flex justify-between items-center mt-1 mb-5">
                        <span className={cn('text-xs', justification.length < 20 ? 'text-red-400' : 'text-gray-400')}>{justification.length < 20 ? `${20 - justification.length} car. manquants` : `${justification.length}/1000`}</span>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50">Annuler</button>
                        <button onClick={handleSubmit} disabled={loading || justification.trim().length < 20}
                            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            Soumettre
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Tab: Infos (replaces fixed header) ───────────────────────────────────────

const TabInfos = ({ data, onNavigate }: { data: BcDetailData; onNavigate?: (tabId: string) => void }) => {
    const { bc, stockAvailable, creditOk, creditExceeded, excessAmount } = data;
    const cfg = getCfg(bc.bc_status);

    const checks = [
        { ok: creditOk,       icon: CreditCard,   koIcon: XCircle,       okLabel: 'Crédit OK',        koLabel: creditExceeded ? `Dépass. ${fmt(excessAmount, 0)} Dh` : 'Crédit KO', targetTab: 'client' },
        { ok: stockAvailable, icon: Warehouse,     koIcon: XCircle,       okLabel: 'Stock OK',         koLabel: 'Stock insuffisant',   targetTab: 'stock' },
        { ok: bc.financial_metadata?.balance_checked ?? false, icon: CheckCircle, koIcon: AlertTriangle, okLabel: 'Solde vérifié', koLabel: 'Solde non vérifié', targetTab: 'resume' },
        { ok: !data.pendingDerogation, icon: ShieldAlert, koIcon: XCircle, okLabel: 'Sans dérogation', koLabel: 'Dérogation en cours', targetTab: 'decisions' },
    ];

    return (
        <div className="space-y-4">

            {/* ── Identité (no duplicate header — parent SageCollapsible already labels this section) ── */}
            <div className="bg-white rounded-xl border border-gray-200">
                {/* Code + status pills */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider shrink-0">N° BC</span>
                        <span className="text-sm font-black font-mono text-gray-900 tracking-tight">{bc.order_code}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <Pill className={cfg.badge}>
                            <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
                            {cfg.label}
                        </Pill>
                        {bc.is_preorder && <Pill className="bg-sage-50 text-sage-700 ring-sage-200">Pré-commande</Pill>}
                    </div>
                </div>

                {/* Partner + TTC */}
                <div className="px-5 py-4 flex items-center justify-between gap-6">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                            <Building className="w-4 h-4 text-gray-500" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{bc.partner.name}</p>
                            <p className="text-[11px] font-mono text-gray-400">{bc.partner.code}</p>
                        </div>
                    </div>

                    {/* TTC encadré */}
                    <div className="shrink-0 bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 text-right">
                        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Montant TTC</p>
                        <p className="text-2xl font-black text-gray-900 tabular-nums leading-none">
                            {fmt(bc.total_amount)}<span className="text-sm font-semibold text-gray-400 ml-1">Dh</span>
                        </p>
                        <div className="flex items-center justify-end gap-3 mt-1.5 text-[11px] text-gray-500">
                            <span>HT <span className="font-bold text-gray-700 tabular-nums">{fmt(bc.sub_total)}</span></span>
                            <span className="text-gray-300">·</span>
                            <span>TVA <span className="font-bold text-gray-700 tabular-nums">{fmt(bc.tax_amount)}</span></span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Classification & Dates (compact rows) ── */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <SectionHeader icon={Tag} title="Classification" />
                    <div className="divide-y divide-gray-50">
                        {[
                            { label: 'Canal',         value: bc.canal,                      icon: Tag },
                            { label: 'Type doc.',     value: bc.document_type,              icon: FileText },
                            { label: 'Nb articles',   value: `${bc.order_products.length} article${bc.order_products.length > 1 ? 's' : ''}`, icon: Package },
                        ].map(f => (
                            <div key={f.label} className="flex items-center gap-2.5 px-4 py-2">
                                <f.icon className="w-3 h-3 text-gray-300 shrink-0" />
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-20 shrink-0">{f.label}</span>
                                <span className="text-xs font-semibold text-gray-800">{f.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <SectionHeader icon={Calendar} title="Dates" />
                    <div className="divide-y divide-gray-50">
                        {[
                            { label: 'Commande', value: fmtDate(bc.order_date, true),              icon: Calendar },
                            { label: 'Échéance', value: bc.due_date ? fmtDate(bc.due_date) : '—', icon: Clock },
                            { label: 'Créée le', value: fmtDate(bc.created_at, true),             icon: Clock },
                        ].map(f => (
                            <div key={f.label} className="flex items-center gap-2.5 px-4 py-2">
                                <f.icon className="w-3 h-3 text-gray-300 shrink-0" />
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-20 shrink-0">{f.label}</span>
                                <span className="text-xs font-semibold text-gray-800 tabular-nums">{f.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Contrôles & Alertes ── */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <SectionHeader
                    icon={ShieldAlert}
                    title="Contrôles & Alertes"
                    badge={
                        checks.some(c => !c.ok) ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded-full">
                                {checks.filter(c => !c.ok).length} anomalie{checks.filter(c => !c.ok).length > 1 ? 's' : ''}
                            </span>
                        ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full">
                                Tout validé
                            </span>
                        )
                    }
                />
                <div className="grid grid-cols-4 divide-x divide-gray-100">
                    {checks.map(({ ok, icon: OkIcon, koIcon: KoIcon, okLabel, koLabel, targetTab }) => {
                        const Icon = ok ? OkIcon : KoIcon;
                        return (
                            <button
                                key={okLabel}
                                type="button"
                                onClick={() => onNavigate?.(targetTab)}
                                className={cn(
                                    'flex flex-col items-center justify-center gap-2 py-5 px-3 w-full text-center transition-colors',
                                    ok ? 'bg-white hover:bg-gray-50' : 'bg-red-50/40 hover:bg-red-50/70',
                                    onNavigate && 'cursor-pointer'
                                )}
                            >
                                <div className={cn('w-9 h-9 rounded-full flex items-center justify-center',
                                    ok ? 'bg-emerald-50' : 'bg-red-100')}>
                                    <Icon className={cn('w-4 h-4', ok ? 'text-emerald-600' : 'text-red-500')} />
                                </div>
                                <div>
                                    <p className={cn('text-xs font-bold', ok ? 'text-emerald-700' : 'text-red-700')}>
                                        {ok ? okLabel : koLabel}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                        {ok ? '✓ Validé' : (onNavigate ? '→ Voir détail' : '✗ Anomalie')}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {(creditExceeded || !stockAvailable) && (
                    <div className="border-t border-gray-100 p-4 space-y-2">
                        {creditExceeded && (
                            <div className="flex items-center gap-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                                <p className="text-xs font-semibold text-red-700">
                                    Plafond de crédit dépassé de <span className="font-black">{fmt(excessAmount)} Dh</span> — dérogation nécessaire.
                                </p>
                            </div>
                        )}
                        {!stockAvailable && (
                            <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                                <Package className="w-4 h-4 text-amber-500 shrink-0" />
                                <p className="text-xs font-semibold text-amber-700">Certains articles présentent un stock insuffisant.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Tab definitions (matches ProductsPage pattern) ───────────────────────────

const ADV_TABS: TabItem[] = [
    { id: 'infos',      label: 'Infos',       icon: FileText },
    { id: 'decisions',  label: 'Décisions',   icon: ListChecks },
    { id: 'resume',     label: 'Résumé',      icon: BarChart3 },
    { id: 'lignes',     label: 'Lignes',      icon: Receipt },
    { id: 'client',     label: 'Client',      icon: User },
    { id: 'stock',      label: 'Stock',       icon: Warehouse },
    { id: 'logistique', label: 'Logistique',  icon: Truck },
    { id: 'historique', label: 'Historique',  icon: History },
];

// ─── Tab: Décisions ──────────────────────────────────────────────────────────

const TabDecisions = ({ bc, onRefresh }: { bc: BC; onRefresh: () => void }) => (
    <BCWorkflowActions orderId={bc.id} onSuccess={onRefresh} />
);

// ─── Tab: Résumé ──────────────────────────────────────────────────────────────

const SectionHeader = ({ icon: Icon, title, badge }: { icon: React.ElementType; title: string; badge?: React.ReactNode }) => (
    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
            <Icon className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-800">{title}</span>
        </div>
        {badge}
    </div>
);

const TabResume = ({ data, onRefresh }: { data: BcDetailData; onRefresh: () => void }) => {
    const { bc, partnerStats } = data;
    const wi   = bc.workflow_instance;
    const limit = n(bc.partner.credit_limit);
    const used  = n(bc.partner.credit_used);
    const avail = n(bc.partner.credit_available);
    const util  = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
    const barColor = util > 90 ? 'bg-red-500' : util > 75 ? 'bg-amber-400' : 'bg-emerald-500';
    const utilColor = util > 90 ? 'text-red-600' : util > 75 ? 'text-amber-600' : 'text-emerald-600';

    return (
        <div className="space-y-4">

            {/* ── Synthèse financière (KPI strip) ── */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-4 divide-x divide-gray-100">
                    {[
                        { label: 'Total TTC',    value: fmt(bc.total_amount), unit: 'Dh', cls: 'text-gray-900' },
                        { label: 'Sous-total HT', value: fmt(bc.sub_total),  unit: 'Dh', cls: 'text-gray-700' },
                        { label: 'TVA',           value: fmt(bc.tax_amount), unit: 'Dh', cls: 'text-amber-600' },
                        ...(bc.financial_metadata?.stamp_duty && n(bc.financial_metadata.stamp_duty) > 0
                            ? [{ label: 'Timbre fiscal', value: fmt(bc.financial_metadata.stamp_duty), unit: 'Dh', cls: 'text-gray-500' }]
                            : [{ label: 'Articles', value: String(bc.order_products.length), unit: '', cls: 'text-gray-700' }]
                        ),
                    ].map(({ label, value, unit, cls }) => (
                        <div key={label} className="px-5 py-4">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                            <p className={cn('text-xl font-black tabular-nums', cls)}>
                                {value}
                                {unit && <span className="text-xs font-normal text-gray-400 ml-1">{unit}</span>}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Workflow + Paiement ── */}
            <div className="grid grid-cols-2 gap-4">

                {/* Workflow state */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <SectionHeader
                        icon={Clock}
                        title="État du workflow"
                        badge={wi?.status ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full uppercase tracking-wider">
                                {wi.status.replace(/_/g, ' ')}
                            </span>
                        ) : undefined}
                    />
                    {wi?.current_step ? (
                        <div className="divide-y divide-gray-50">
                            <div className="px-5 py-4 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-sage-50 border border-sage-100 flex items-center justify-center shrink-0">
                                    <CheckCircle className="w-4 h-4 text-sage-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Étape actuelle</p>
                                    <p className="text-sm font-bold text-gray-900">{wi.current_step.name}</p>
                                    <p className="text-[10px] font-mono text-gray-400">{wi.current_step.code}</p>
                                </div>
                            </div>
                            {wi.current_step.allowed_transitions.length > 0 && (
                                <div className="px-5 py-3">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Prochaines transitions</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {wi.current_step.allowed_transitions.map(t => (
                                            <span key={t} className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-mono text-slate-600">
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="px-5 py-6 text-sm text-gray-400">Aucun workflow actif</div>
                    )}
                </div>

                {/* Paiement */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <SectionHeader icon={Receipt} title="Paiement" />
                    <div className="divide-y divide-gray-50">
                        {[
                            { label: 'Mode',          value: bc.financial_metadata?.payment_method ?? '—' },
                            { label: 'Statut',        value: bc.payment_status },
                            { label: 'Vente crédit',  value: bc.financial_metadata?.is_credit_sale ? 'Oui' : 'Non' },
                            { label: 'Solde vérifié', value: bc.financial_metadata?.balance_checked ? 'Vérifié' : 'Non vérifié' },
                        ].map(({ label, value }) => (
                            <div key={label} className="flex items-center justify-between px-5 py-2.5">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
                                <span className="text-xs font-semibold text-gray-800">{value}</span>
                            </div>
                        ))}
                        {bc.bc_notes && (
                            <div className="px-5 py-3 bg-amber-50">
                                <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider mb-0.5">Note</p>
                                <p className="text-xs text-amber-800">{bc.bc_notes}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Crédit + Activité ── */}
            <div className="grid grid-cols-2 gap-4">

                {/* Crédit client */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <SectionHeader
                        icon={CreditCard}
                        title="Crédit client"
                        badge={
                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border',
                                bc.partner.credit_hold
                                    ? 'bg-red-50 text-red-600 border-red-200'
                                    : 'bg-emerald-50 text-emerald-600 border-emerald-200')}>
                                {bc.partner.credit_hold ? 'Bloqué' : 'Normal'}
                            </span>
                        }
                    />
                    <div className="px-5 py-4 space-y-4">
                        <div>
                            <div className="flex justify-between items-center text-xs mb-1.5">
                                <span className="text-gray-500">Utilisation du plafond</span>
                                <span className={cn('font-black', utilColor)}>{util.toFixed(1)} %</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className={cn('h-full rounded-full', barColor)} style={{ width: `${util}%` }} />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 divide-x divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                            {[
                                { label: 'Plafond',    value: limit, cls: 'text-gray-800' },
                                { label: 'Utilisé',    value: used,  cls: 'text-amber-600' },
                                { label: 'Disponible', value: avail, cls: 'text-emerald-600' },
                            ].map(({ label, value, cls }) => (
                                <div key={label} className="px-3 py-2.5 text-center">
                                    <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider">{label}</p>
                                    <p className={cn('text-sm font-black mt-0.5 tabular-nums', cls)}>{fmt(value, 0)}</p>
                                    <p className="text-[9px] text-gray-300">Dh</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Activité partenaire */}
                {partnerStats ? (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <SectionHeader icon={TrendingUp} title="Activité partenaire" />
                        <div className="divide-y divide-gray-50">
                            {[
                                { label: 'Commandes totales', value: String(partnerStats.total_orders),         cls: 'text-gray-800' },
                                { label: 'En attente',        value: String(partnerStats.pending_bcs),          cls: 'text-amber-600' },
                                { label: 'Panier moyen',      value: `${fmt(partnerStats.avg_order_value, 0)} Dh`, cls: 'text-blue-700' },
                            ].map(({ label, value, cls }) => (
                                <div key={label} className="flex items-center justify-between px-5 py-2.5">
                                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
                                    <span className={cn('text-sm font-black tabular-nums', cls)}>{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <SectionHeader icon={TrendingUp} title="Activité partenaire" />
                        <div className="px-5 py-6 text-sm text-gray-400">Aucune donnée disponible</div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Tab: Lignes ──────────────────────────────────────────────────────────────

const TabLignes = ({ bc }: { bc: BC }) => {
    const totals = bc.order_products.reduce(
        (a, p) => ({ ht: a.ht + n(p.line_total_ht), tva: a.tva + n(p.line_tax_amount), ttc: a.ttc + n(p.total_price) }),
        { ht: 0, tva: 0, ttc: 0 }
    );

    return (
        <div className="space-y-3">

            {/* ── Summary strip ── */}
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Package className="w-4 h-4 text-gray-400" />
                    <span className="font-semibold">{bc.order_products.length} article{bc.order_products.length > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-400">HT</span>
                    <span className="font-bold text-gray-800">{fmt(totals.ht)} Dh</span>
                    <span className="text-gray-300">+</span>
                    <span className="text-gray-400">TVA</span>
                    <span className="font-bold text-amber-600">{fmt(totals.tva)} Dh</span>
                    <span className="text-gray-300">=</span>
                    <span className="font-black text-sage-700 bg-sage-50 px-3 py-1 rounded-lg border border-sage-200 text-sm">
                        {fmt(totals.ttc)} Dh TTC
                    </span>
                </div>
            </div>

            {/* ── Invoice table ── */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="w-11 px-3 py-3 border-r border-gray-100" />
                                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider">Article</th>
                                <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Qté</th>
                                <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">PU HT</th>
                                <th className="text-center px-3 py-3 font-semibold text-gray-500 uppercase tracking-wider">TVA</th>
                                <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">PU TTC</th>
                                <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap border-l border-gray-100">Total HT</th>
                                <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">TVA Ligne</th>
                                <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap border-l border-gray-200 bg-sage-50/60">Total TTC</th>
                                <th className="text-center px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                            </tr>
                        </thead>

                        <tbody>
                            {bc.order_products.map((item, idx) => {
                                const qty = parseFloat(item.quantity);
                                const stockOk      = item.available_stock_quantity >= qty;
                                const stockPartial = item.available_stock_quantity > 0 && !stockOk;
                                const unitLabel    = item.unit ?? item.logistics_line?.shipping_level ?? null;

                                return (
                                    <tr key={item.id}
                                        className={cn(
                                            'border-b border-gray-100 transition-colors hover:bg-gray-50/70 group',
                                            !stockOk && 'bg-red-50/20 hover:bg-red-50/40'
                                        )}>

                                        {/* Line # / thumbnail */}
                                        <td className="px-3 py-3 border-r border-gray-100">
                                            {item.product.thumbnail
                                                ? <img src={item.product.thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover border border-gray-100" />
                                                : <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-400">
                                                    #{idx + 1}
                                                  </div>
                                            }
                                        </td>

                                        {/* Article */}
                                        <td className="px-4 py-3 max-w-[240px]">
                                            <p className="font-semibold text-gray-900 leading-tight truncate">{item.product.name}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="font-mono text-gray-400 text-[10px]">{item.product.code}</span>
                                                {item.sales_group_code && (
                                                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-semibold">{item.sales_group_code}</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Qty + unit */}
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <span className="font-black text-gray-900 text-sm tabular-nums">{qty.toLocaleString('fr-FR')}</span>
                                            {unitLabel && (
                                                <span className="ml-1 text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                                    {unitLabel}
                                                </span>
                                            )}
                                        </td>

                                        {/* PU HT */}
                                        <td className="px-4 py-3 text-right text-gray-600 tabular-nums font-medium">{fmt(item.unit_price_ht)}<span className="text-gray-400 ml-0.5">Dh</span></td>

                                        {/* TVA % */}
                                        <td className="px-3 py-3 text-center">
                                            <span className="inline-block px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded font-semibold text-[10px]">
                                                {parseFloat(item.tax_rate).toFixed(0)}%
                                            </span>
                                        </td>

                                        {/* PU TTC */}
                                        <td className="px-4 py-3 text-right font-semibold text-gray-700 tabular-nums">{fmt(item.price)}<span className="text-gray-400 ml-0.5">Dh</span></td>

                                        {/* Total HT */}
                                        <td className="px-4 py-3 text-right text-gray-600 tabular-nums font-medium border-l border-gray-100">{fmt(item.line_total_ht)}<span className="text-gray-400 ml-0.5">Dh</span></td>

                                        {/* TVA montant */}
                                        <td className="px-4 py-3 text-right text-amber-600 tabular-nums font-medium">{fmt(item.line_tax_amount)}<span className="text-amber-400 ml-0.5">Dh</span></td>

                                        {/* Total TTC */}
                                        <td className="px-4 py-3 text-right font-black text-sage-700 tabular-nums border-l border-gray-200 bg-sage-50/30 group-hover:bg-sage-50/60">
                                            {fmt(item.total_price)}<span className="text-sage-400 font-semibold ml-0.5">Dh</span>
                                        </td>

                                        {/* Stock */}
                                        <td className="px-4 py-3 text-center">
                                            <span className={cn(
                                                'inline-flex items-center gap-1 px-2 py-1 rounded-lg font-bold text-[10px] leading-none',
                                                stockOk      ? 'bg-emerald-100 text-emerald-700' :
                                                stockPartial ? 'bg-amber-100   text-amber-700'   :
                                                               'bg-red-100     text-red-700'
                                            )}>
                                                {stockOk ? <CheckCircle className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                                                {item.available_stock_quantity}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>

                        {/* ── Footer totals ── */}
                        <tfoot>
                            <tr className="border-t-2 border-gray-200 bg-gray-50/80">
                                <td colSpan={6} className="px-4 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    Sous-total
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-gray-700 tabular-nums border-l border-gray-100">
                                    {fmt(totals.ht)} Dh
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-amber-600 tabular-nums">
                                    {fmt(totals.tva)} Dh
                                </td>
                                <td className="px-4 py-3 text-right font-black text-sage-700 tabular-nums border-l border-gray-200 bg-sage-50/60">
                                    {fmt(totals.ttc)} Dh
                                </td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ─── Tab: Client ──────────────────────────────────────────────────────────────

const TabClient = ({ bc }: { bc: BC }) => {
    const p = bc.partner;
    const limit      = n(p.credit_limit);
    const used       = n(p.credit_used);
    const avail      = n(p.credit_available);
    const util       = limit > 0 ? (used / limit) * 100 : 0;
    const newBalance = used + n(bc.total_amount);
    const willExceed = newBalance > limit;
    const barColor   = util > 90 ? 'bg-red-500' : util > 75 ? 'bg-amber-400' : 'bg-emerald-500';
    const pctColor   = util > 90 ? 'text-red-600' : util > 75 ? 'text-amber-600' : 'text-emerald-600';

    const payScore  = p.payment_behavior_score ?? 0;
    const riskScore = p.risk_score ?? 0;
    const payColor  = payScore  >= 70 ? 'bg-emerald-500' : payScore  >= 40 ? 'bg-amber-400' : 'bg-red-500';
    const riskColor = riskScore >= 70 ? 'bg-red-500'     : riskScore >= 40 ? 'bg-amber-400' : 'bg-emerald-500';

    return (
        <div className="space-y-4">

            {/* ── Identity strip ── */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Header row */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-sage-100 flex items-center justify-center shrink-0">
                            <span className="text-sm font-black text-sage-700">{p.name?.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-900 leading-tight">{p.name}</p>
                            <p className="text-[11px] font-mono text-gray-400 leading-tight mt-0.5">{p.code}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Pill className={p.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            : 'bg-red-50 text-red-700 ring-red-200'}>
                            <span className={cn('w-1.5 h-1.5 rounded-full', p.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-red-500')} />
                            {p.status}
                        </Pill>
                        {p.partner_type && (
                            <Pill className="bg-gray-50 text-gray-600 ring-gray-200">{p.partner_type}</Pill>
                        )}
                    </div>
                </div>

                {/* Fields grid */}
                <div className="grid grid-cols-3 divide-x divide-gray-100">
                    {/* Coordonnées */}
                    <div className="px-5 py-4 space-y-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Coordonnées</p>
                        {[
                            { label: 'Adresse',   value: p.address_line1 },
                            { label: 'Ville',     value: [p.city, p.region].filter(Boolean).join(', ') || null },
                            { label: 'Pays',      value: p.country },
                            { label: 'Téléphone', value: p.phone },
                            { label: 'Email',     value: p.email },
                        ].map(({ label, value }) => value ? (
                            <div key={label}>
                                <p className="text-[10px] text-gray-400 font-medium">{label}</p>
                                <p className="text-xs font-semibold text-gray-800 mt-0.5">{value}</p>
                            </div>
                        ) : null)}
                    </div>

                    {/* Fiscal */}
                    <div className="px-5 py-4 space-y-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fiscal & Commercial</p>
                        {[
                            { label: 'ICE',   value: p.tax_number_ice },
                            { label: 'IF',    value: p.tax_number_if },
                            { label: 'Canal', value: p.channel },
                        ].map(({ label, value }) => value ? (
                            <div key={label}>
                                <p className="text-[10px] text-gray-400 font-medium">{label}</p>
                                <p className="text-xs font-semibold text-gray-800 font-mono mt-0.5">{value}</p>
                            </div>
                        ) : null)}
                    </div>

                    {/* Scores + activity */}
                    <div className="px-5 py-4 space-y-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Scores & Activité</p>
                        {[
                            { label: 'Paiement', score: payScore,  bar: payColor },
                            { label: 'Risque',   score: riskScore, bar: riskColor },
                        ].map(({ label, score, bar }) => (
                            <div key={label}>
                                <div className="flex justify-between text-[10px] mb-1">
                                    <span className="text-gray-500 font-medium">{label}</span>
                                    <span className="font-black text-gray-800">{score}<span className="text-gray-400 font-normal">/100</span></span>
                                </div>
                                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={cn('h-full rounded-full', bar)} style={{ width: `${score}%` }} />
                                </div>
                            </div>
                        ))}
                        <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-center">
                            <div className="bg-gray-50 rounded-lg py-2">
                                <p className="text-base font-black text-gray-900">{p.total_orders_count}</p>
                                <p className="text-[9px] text-gray-400 font-medium mt-0.5">commandes</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg py-2">
                                <p className="text-xs font-black text-gray-900">{fmt(p.total_orders_value, 0)}</p>
                                <p className="text-[9px] text-gray-400 font-medium mt-0.5">Dh total</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Crédit ── */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-semibold text-gray-800">Situation crédit</span>
                    </div>
                    <Pill className={p.credit_hold ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', p.credit_hold ? 'bg-red-500' : 'bg-emerald-500')} />
                        {p.credit_hold ? 'Bloqué' : 'Normal'}
                    </Pill>
                </div>

                <div className="p-5">
                    {/* Exceed alert */}
                    {willExceed && (
                        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-5">
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-red-800">Ce BC dépasse le plafond de crédit</p>
                                <p className="text-[11px] text-red-600 mt-1 space-x-3">
                                    <span>Nouveau solde : <b>{fmt(newBalance)} Dh</b></span>
                                    <span>·</span>
                                    <span>Plafond : <b>{fmt(limit)} Dh</b></span>
                                    <span>·</span>
                                    <span>Excédent : <b className="text-red-700">{fmt(newBalance - limit)} Dh</b></span>
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Usage bar */}
                    <div className="mb-5">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-gray-500 font-medium">Taux d'utilisation</span>
                            <span className={cn('text-sm font-black', pctColor)}>{util.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full transition-all duration-500', barColor)}
                                style={{ width: `${Math.min(util, 100)}%` }} />
                        </div>
                    </div>

                    {/* Three amounts */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: 'Plafond',    value: limit, cls: 'text-gray-800',    border: 'border-gray-200' },
                            { label: 'Utilisé',    value: used,  cls: 'text-amber-600',   border: 'border-amber-100' },
                            { label: 'Disponible', value: avail, cls: 'text-emerald-600', border: 'border-emerald-100' },
                        ].map(({ label, value, cls, border }) => (
                            <div key={label} className={cn('rounded-xl border p-4 text-center', border, 'bg-gray-50/50')}>
                                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{label}</p>
                                <p className={cn('text-lg font-black mt-1 leading-none', cls)}>{fmt(value, 0)}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">Dh</p>
                            </div>
                        ))}
                    </div>

                    {p.credit_hold_reason && (
                        <div className="mt-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
                            <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-0.5">Raison du blocage</p>
                            <p className="text-xs text-red-700">{p.credit_hold_reason}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Tab: Stock ───────────────────────────────────────────────────────────────

const TabStock = ({ bc }: { bc: BC }) => {
    const items   = bc.order_products;
    const okCount = items.filter(p => p.available_stock_quantity >= parseFloat(p.quantity)).length;
    const partCount = items.filter(p => p.available_stock_quantity > 0 && p.available_stock_quantity < parseFloat(p.quantity)).length;
    const outCount  = items.length - okCount - partCount;
    const allOk     = outCount === 0 && partCount === 0;

    return (
        <div className="space-y-3">

            {/* ── Summary strip ── */}
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Package className="w-4 h-4 text-gray-400" />
                    <span className="font-semibold">{items.length} article{items.length > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-3">
                    {[
                        { count: okCount,   label: 'Disponible', dot: 'bg-emerald-500', cls: 'text-emerald-700' },
                        { count: partCount, label: 'Partiel',    dot: 'bg-amber-400',  cls: 'text-amber-700'  },
                        { count: outCount,  label: 'Rupture',    dot: 'bg-red-500',    cls: 'text-red-700'    },
                    ].map(({ count, label, dot, cls }) => count > 0 && (
                        <div key={label} className="flex items-center gap-1.5">
                            <span className={cn('w-2 h-2 rounded-full', dot)} />
                            <span className={cn('text-xs font-semibold', cls)}>{count} {label}</span>
                        </div>
                    ))}
                    {allOk && (
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                            <CheckCircle className="w-3.5 h-3.5" /> Tout disponible
                        </span>
                    )}
                </div>
            </div>

            {/* ── Per-article table ── */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="w-10 px-3 py-3 border-r border-gray-100" />
                            <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider">Article</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Qté commandée</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Stock dispo</th>
                            <th className="px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider" style={{ minWidth: 160 }}>Couverture</th>
                            <th className="text-center px-4 py-3 font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map(item => {
                            const qty      = parseFloat(item.quantity);
                            const avail    = item.available_stock_quantity;
                            const pct      = qty > 0 ? Math.min(avail / qty, 1) * 100 : 100;
                            const okLine   = avail >= qty;
                            const partLine = avail > 0 && !okLine;
                            const barCls   = okLine ? 'bg-emerald-500' : partLine ? 'bg-amber-400' : 'bg-red-500';
                            const dotCls   = okLine ? 'bg-emerald-500' : partLine ? 'bg-amber-400' : 'bg-red-500';
                            const pillCls  = okLine
                                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                : partLine
                                ? 'bg-amber-50 text-amber-700 ring-amber-200'
                                : 'bg-red-50 text-red-700 ring-red-200';

                            return (
                                <tr key={item.id}
                                    className={cn(
                                        'border-b border-gray-100 hover:bg-gray-50/60 transition-colors',
                                        !okLine && !partLine && 'bg-red-50/20',
                                        partLine && 'bg-amber-50/10'
                                    )}>
                                    {/* Thumbnail */}
                                    <td className="px-3 py-3 border-r border-gray-100">
                                        {item.product.thumbnail
                                            ? <img src={item.product.thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover border border-gray-100" />
                                            : <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-400 font-mono">
                                                {item.product.code?.slice(-3)}
                                              </div>
                                        }
                                    </td>

                                    {/* Article */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className={cn('w-2 h-2 rounded-full shrink-0', dotCls)} />
                                            <div className="min-w-0">
                                                <p className="font-semibold text-gray-900 truncate leading-tight">{item.product.name}</p>
                                                <p className="font-mono text-gray-400 text-[10px] mt-0.5">{item.product.code}</p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Qty ordered */}
                                    <td className="px-4 py-3 text-right">
                                        <span className="font-black text-gray-900">{qty.toLocaleString('fr-FR')}</span>
                                        {item.unit && <span className="text-gray-400 ml-1 text-[10px]">{item.unit}</span>}
                                    </td>

                                    {/* Stock available */}
                                    <td className="px-4 py-3 text-right">
                                        <span className={cn('font-black', okLine ? 'text-emerald-600' : partLine ? 'text-amber-600' : 'text-red-600')}>
                                            {avail.toLocaleString('fr-FR')}
                                        </span>
                                    </td>

                                    {/* Coverage bar */}
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div className={cn('h-full rounded-full transition-all', barCls)}
                                                    style={{ width: `${pct}%` }} />
                                            </div>
                                            <span className={cn('text-[10px] font-bold tabular-nums w-8 text-right shrink-0',
                                                okLine ? 'text-emerald-600' : partLine ? 'text-amber-600' : 'text-red-600')}>
                                                {pct.toFixed(0)}%
                                            </span>
                                        </div>
                                    </td>

                                    {/* Status pill */}
                                    <td className="px-4 py-3 text-center">
                                        <Pill className={pillCls}>
                                            {okLine ? 'OK' : partLine ? 'Partiel' : 'Rupture'}
                                        </Pill>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ─── Tab: Logistique ──────────────────────────────────────────────────────────

const TabLogistique = ({ logistics }: { logistics?: LogisticsAggregate }) => {
    if (!logistics) return <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Données logistiques non disponibles</div>;
    const products = Object.values(logistics.per_product);
    const cmpColor = { complete: 'emerald', partial: 'amber', missing: 'red' }[logistics.data_completeness] as any;
    const cmpLabel = { complete: 'Complète', partial: 'Partielle', missing: 'Manquante' }[logistics.data_completeness];

    return (
        <div className="space-y-5">
            {/* KPIs */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { icon: Weight, label: 'Poids total',  value: logistics.weight_evaluable ? `${fmt(logistics.total_weight_kg)} kg` : 'N/A' },
                    { icon: Box,    label: 'Volume total',  value: logistics.volume_evaluable ? `${fmt(logistics.total_volume_m3, 3)} m³` : 'N/A' },
                    { icon: Package, label: 'Colis',       value: products.reduce((s, p) => s + (p.physical_packages || 0), 0) },
                    { icon: Layers, label: 'Complétude',   value: <Pill className={`bg-${cmpColor}-50 text-${cmpColor}-700 ring-${cmpColor}-200`}>{cmpLabel}</Pill> },
                ].map(k => (
                    <Card key={k.label} className="p-4 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                            <k.icon className="w-4 h-4 text-gray-400" />
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 font-semibold uppercase">{k.label}</p>
                            <p className="text-sm font-black text-gray-900 mt-0.5">{k.value}</p>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Handling flags */}
            <Card>
                <CardHeader icon={Truck} title="Contraintes de Manutention" />
                <div className="p-5 flex flex-wrap gap-2">
                    {[
                        { flag: logistics.handling_flags.fragile_present,           label: 'Fragile',            ok: false },
                        { flag: logistics.handling_flags.all_stackable,             label: 'Tout empilable',     ok: true },
                        { flag: logistics.handling_flags.requires_separation_present, label: 'Séparation requise', ok: false },
                        { flag: (logistics.handling_flags.temperature_profile_codes?.length ?? 0) > 0, label: 'Chaîne du froid', ok: false },
                    ].map(f => (
                        <div key={f.label} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold',
                            f.flag
                                ? f.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-gray-50 text-gray-400 border-gray-200')}>
                            {f.flag
                                ? f.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />
                                : <XCircle className="w-3.5 h-3.5" />}
                            {f.label}
                        </div>
                    ))}
                </div>
            </Card>

            {/* Per product */}
            <Card>
                <CardHeader icon={Package} title="Détail Logistique par Article" />
                <div className="divide-y divide-gray-50">
                    {products.map(prod => (
                        <div key={prod.product_id} className="px-5 py-4">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <p className="text-sm font-bold text-gray-900">{prod.product_name}</p>
                                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">#{prod.product_id}</p>
                                </div>
                                <Pill className="bg-slate-100 text-slate-600 ring-slate-200 font-mono text-[10px]">{prod.shipping_level}</Pill>
                            </div>
                            <div className="grid grid-cols-4 gap-3">
                                {[
                                    { label: 'Qté', value: prod.base_quantity },
                                    { label: 'Colis', value: prod.physical_packages },
                                    { label: 'Poids', value: prod.line_gross_weight_kg != null ? `${prod.line_gross_weight_kg} kg` : '—' },
                                    { label: 'Volume', value: prod.line_volume_m3 != null ? `${prod.line_volume_m3} m³` : '—' },
                                ].map(f => (
                                    <div key={f.label} className="text-center p-2 bg-gray-50 rounded-xl">
                                        <p className="text-[10px] text-gray-400">{f.label}</p>
                                        <p className="text-sm font-black text-gray-900 mt-0.5">{f.value}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-3">
                                {prod.profile_flags.stackable && <span className="text-[10px] px-2 py-0.5 bg-sage-50 text-sage-600 border border-sage-100 rounded-lg">Empilable</span>}
                                {prod.profile_flags.fragile && <span className="text-[10px] px-2 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded-lg">Fragile</span>}
                                {prod.profile_flags.keep_upright && <span className="text-[10px] px-2 py-0.5 bg-slate-50 text-slate-600 border border-slate-100 rounded-lg">À l'endroit</span>}
                                {prod.profile_flags.temperature_controlled && <span className="text-[10px] px-2 py-0.5 bg-cyan-50 text-cyan-600 border border-cyan-100 rounded-lg">Tempéré</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Missing + notes */}
            {logistics.missing_product_logistics.length > 0 && (
                <Card>
                    <CardHeader icon={AlertCircle} title="Données Manquantes" />
                    <div className="p-5 space-y-2">
                        {logistics.missing_product_logistics.map((m, i) => (
                            <div key={i} className="flex items-center gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                <span className="text-xs text-amber-800">Produit <span className="font-mono font-bold">#{m.product_id}</span> — <span className="font-mono">{m.reason.replace(/_/g, ' ')}</span></span>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
            {logistics.notes?.length > 0 && (
                <div className="p-4 bg-sage-50 border border-sage-100 rounded-xl">
                    {logistics.notes.map((note, i) => <p key={i} className="text-xs text-sage-700">{note}</p>)}
                </div>
            )}
        </div>
    );
};

// ─── Tab: Historique ──────────────────────────────────────────────────────────

const TabHistorique = ({ bc, orderId }: { bc: BC; orderId: number }) => {
    const { workflowHistory, isLoadingHistory } = useAdvWorkflow(orderId);
    const transitions = bc.workflow_instance?.transitions ?? [];

    const getActionCfg = (action: string) => {
        const a = action.toLowerCase();
        if (['submit_order', 'confirm', 'approve', 'sell', 'resume'].some(k => a.includes(k)))
            return { dot: 'bg-sage-500 ring-sage-200', tag: 'bg-sage-50 text-sage-700 border-sage-200' };
        if (['reject', 'cancel'].some(k => a.includes(k)))
            return { dot: 'bg-red-500 ring-red-200', tag: 'bg-red-50 text-red-700 border-red-200' };
        if (['hold', 'credit', 'escalat'].some(k => a.includes(k)))
            return { dot: 'bg-amber-500 ring-amber-200', tag: 'bg-amber-50 text-amber-700 border-amber-200' };
        if (a === 'initialized')
            return { dot: 'bg-gray-400 ring-gray-200', tag: 'bg-gray-50 text-gray-500 border-gray-200' };
        return { dot: 'bg-indigo-500 ring-indigo-200', tag: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    };

    return (
        <div className="grid grid-cols-2 gap-4">
            {/* ── Transitions de la Commande ── */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <SectionHeader
                    icon={Clock}
                    title="Transitions de la Commande"
                    badge={transitions.length > 0 ? (
                        <span className="text-xs font-semibold text-gray-400 tabular-nums">{transitions.length}</span>
                    ) : undefined}
                />
                <div className="p-4">
                    {transitions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                            <Clock className="w-8 h-8 mb-2" />
                            <p className="text-sm text-gray-400">Aucune transition enregistrée</p>
                        </div>
                    ) : (
                        <div className="relative">
                            <div className="absolute left-[6px] top-3 bottom-3 w-px bg-gray-100" />
                            <div className="space-y-4">
                                {transitions.map((t, i) => {
                                    const cfg = getActionCfg(t.action);
                                    return (
                                        <div key={t.id ?? i} className="relative pl-6">
                                            <div className={cn('absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white ring-2 shrink-0', cfg.dot)} />
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                                    <span className={cn('text-[10px] font-mono font-bold px-2 py-0.5 rounded border', cfg.tag)}>
                                                        {t.action.replace(/_/g, ' ')}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 tabular-nums">{fmtDate(t.performed_at, true)}</span>
                                                </div>
                                                {t.performed_by && (
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                                            <User className="w-2.5 h-2.5 text-gray-500" />
                                                        </div>
                                                        <span className="text-xs font-semibold text-gray-700">{t.performed_by.name}</span>
                                                        {(t.performed_by as any).role && (
                                                            <span className="text-[10px] text-gray-400">· {(t.performed_by as any).role}</span>
                                                        )}
                                                    </div>
                                                )}
                                                {t.comment && (
                                                    <p className="text-xs italic text-gray-500 pl-2 border-l-2 border-gray-200">
                                                        {t.comment}
                                                    </p>
                                                )}
                                                {t.metadata && Object.keys(t.metadata).length > 0 && (
                                                    <div className="flex flex-wrap gap-1 pt-0.5">
                                                        {Object.entries(t.metadata).map(([k, v]) => (
                                                            <span key={k} className="text-[9px] px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded font-mono text-gray-400">
                                                                {k}: {String(v)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Historique Workflow ── */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <SectionHeader
                    icon={History}
                    title="Historique Workflow"
                    badge={!isLoadingHistory && workflowHistory.length > 0 ? (
                        <span className="text-xs font-semibold text-gray-400 tabular-nums">{workflowHistory.length}</span>
                    ) : undefined}
                />
                <div className="p-4">
                    {isLoadingHistory ? (
                        <div className="flex items-center justify-center h-20 text-gray-400">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            <span className="text-sm">Chargement...</span>
                        </div>
                    ) : workflowHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                            <History className="w-8 h-8 mb-2" />
                            <p className="text-sm text-gray-400">Aucun historique disponible</p>
                        </div>
                    ) : (
                        <div className="relative">
                            <div className="absolute left-[6px] top-3 bottom-3 w-px bg-gray-100" />
                            <div className="space-y-4">
                                {workflowHistory.map((entry, i) => {
                                    const cfg = getActionCfg(entry.action ?? '');
                                    return (
                                        <div key={entry.id ?? i} className="relative pl-6">
                                            <div className={cn('absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white ring-2 shrink-0', cfg.dot)} />
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[10px] px-2 py-0.5 bg-gray-50 border border-gray-200 rounded font-mono text-gray-500">
                                                            {entry.from_step}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400">→</span>
                                                        <span className={cn('text-[10px] px-2 py-0.5 rounded border font-mono font-bold', cfg.tag)}>
                                                            {entry.to_step}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-gray-400 tabular-nums">{fmtDate(entry.created_at, true)}</span>
                                                </div>
                                                {entry.user && (
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                                            <User className="w-2.5 h-2.5 text-gray-500" />
                                                        </div>
                                                        <span className="text-xs font-semibold text-gray-700">{entry.user}</span>
                                                        {entry.action && (
                                                            <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', cfg.tag)}>
                                                                {entry.action.replace(/_/g, ' ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                {entry.comment && (
                                                    <p className="text-xs italic text-gray-500 pl-2 border-l-2 border-gray-200">
                                                        {entry.comment}
                                                    </p>
                                                )}
                                                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                                                    <div className="flex flex-wrap gap-1 pt-0.5">
                                                        {Object.entries(entry.metadata).map(([k, v]) => (
                                                            <span key={k} className="text-[9px] px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded font-mono text-gray-400">
                                                                {k}: {String(v)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


// ─── Detail view — ProductsPage scroll-spy pattern ────────────────────────────

const DetailView = ({ detailData, onRefresh }: { detailData: BcDetailData; onRefresh: () => void }) => {
    const { bc } = detailData;
    const containerRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const isScrollingRef = useRef(false);
    const [activeTab, setActiveTab] = useState('infos');
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        infos: true, decisions: true, resume: true, lignes: true, client: true, stock: true, logistique: true, historique: true,
    });

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
        const section = sectionRefs.current[tabId];
        if (section && containerRef.current) {
            isScrollingRef.current = true;
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => { isScrollingRef.current = false; }, 1000);
        }
    };

    const toggleSection = (id: string, isOpen: boolean) =>
        setOpenSections(prev => ({ ...prev, [id]: isOpen }));

    const handleExpandAll = () =>
        setOpenSections(ADV_TABS.reduce((a, t) => ({ ...a, [t.id]: true }), {}));

    const handleCollapseAll = () =>
        setOpenSections(ADV_TABS.reduce((a, t) => ({ ...a, [t.id]: false }), {}));

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const handleScroll = () => {
            if (isScrollingRef.current) return;
            const top = container.scrollTop;
            for (const tab of ADV_TABS) {
                const el = sectionRefs.current[tab.id];
                if (!el || !openSections[tab.id]) continue;
                if (el.offsetTop <= top + 100 && el.offsetTop + el.clientHeight > top + 50) {
                    if (activeTab !== tab.id) setActiveTab(tab.id);
                    break;
                }
            }
        };
        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [openSections, activeTab]);

    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-50">
            <div className="shrink-0 bg-white border-b border-gray-200 overflow-hidden">
                <SageTabs
                    tabs={ADV_TABS}
                    activeTabId={activeTab}
                    onTabChange={handleTabChange}
                    onExpandAll={handleExpandAll}
                    onCollapseAll={handleCollapseAll}
                    className="shadow-none"
                />
            </div>

            <div ref={containerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 scroll-smooth bg-slate-50">
                <div ref={el => { sectionRefs.current['infos'] = el; }}>
                    <SageCollapsible title="Informations de la commande" isOpen={openSections['infos']} onOpenChange={o => toggleSection('infos', o)}>
                        <TabInfos data={detailData} onNavigate={handleTabChange} />
                    </SageCollapsible>
                </div>
                <div ref={el => { sectionRefs.current['decisions'] = el; }}>
                    <SageCollapsible title="Décisions & Actions" isOpen={openSections['decisions']} onOpenChange={o => toggleSection('decisions', o)}>
                        <TabDecisions bc={bc} onRefresh={onRefresh} />
                    </SageCollapsible>
                </div>
                <div ref={el => { sectionRefs.current['resume'] = el; }}>
                    <SageCollapsible title="Résumé" isOpen={openSections['resume']} onOpenChange={o => toggleSection('resume', o)}>
                        <TabResume data={detailData} onRefresh={onRefresh} />
                    </SageCollapsible>
                </div>
                <div ref={el => { sectionRefs.current['lignes'] = el; }}>
                    <SageCollapsible title="Lignes de commande" isOpen={openSections['lignes']} onOpenChange={o => toggleSection('lignes', o)}>
                        <TabLignes bc={bc} />
                    </SageCollapsible>
                </div>
                <div ref={el => { sectionRefs.current['client'] = el; }}>
                    <SageCollapsible title="Client & Crédit" isOpen={openSections['client']} onOpenChange={o => toggleSection('client', o)}>
                        <TabClient bc={bc} />
                    </SageCollapsible>
                </div>
                <div ref={el => { sectionRefs.current['stock'] = el; }}>
                    <SageCollapsible title="Disponibilité Stock" isOpen={openSections['stock']} onOpenChange={o => toggleSection('stock', o)}>
                        <TabStock bc={bc} />
                    </SageCollapsible>
                </div>
                <div ref={el => { sectionRefs.current['logistique'] = el; }}>
                    <SageCollapsible title="Logistique" isOpen={openSections['logistique']} onOpenChange={o => toggleSection('logistique', o)}>
                        <TabLogistique logistics={detailData.logistics_aggregate} />
                    </SageCollapsible>
                </div>
                <div ref={el => { sectionRefs.current['historique'] = el; }}>
                    <SageCollapsible title="Historique & Workflow" isOpen={openSections['historique']} onOpenChange={o => toggleSection('historique', o)}>
                        <TabHistorique bc={bc} orderId={bc.id} />
                    </SageCollapsible>
                </div>
            </div>
        </div>
    );
};

// ─── Main page ────────────────────────────────────────────────────────────────

export const AdvValidationPage = () => {
    const { can } = usePermissions();
    const [searchParams] = useSearchParams();
    const [bcs, setBcs] = useState<any[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [detailData, setDetailData] = useState<BcDetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [showDerogation, setShowDerogation] = useState(false);

    const fetchDetail = async (id: number) => {
        setDetailLoading(true);
        try {
            const res = await apiClient.get(`/api/backend/adv/bc/${id}`);
            setDetailData(res.data as BcDetailData);
        } catch { setDetailData(null); }
        finally { setDetailLoading(false); }
    };

    const fetchList = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/api/backend/adv/bc');
            const list = res.data?.bcs?.data ?? [];
            setBcs(list);
            const pid = searchParams.get('bcId');
            const firstId = pid ? parseInt(pid) : (list[0]?.id ?? null);
            if (firstId && !selectedId) { setSelectedId(firstId); fetchDetail(firstId); }
        } catch { /* handled */ }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchList(); }, []);

    const handleSelect = (id: number) => { setSelectedId(id); fetchDetail(id); };
    const handleRefresh = () => { fetchList(); if (selectedId) fetchDetail(selectedId); };

    const bc = detailData?.bc ?? null;
    const canDerogation = can(PERMISSIONS.ADV.CREDIT_UPDATE_LIMIT);
    const canExport = can(PERMISSIONS.ADV.BC_EXPORT);

    return (
        <>
            <MasterLayout
                leftContent={
                    <AdvBcGrid
                        bcs={bcs}
                        loading={loading}
                        selectedId={selectedId}
                        onSelect={handleSelect}
                        onRefresh={fetchList}
                    />
                }
                mainContent={
                    <div className="h-full overflow-hidden flex flex-col">
                        {detailLoading ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                                <Loader2 className="w-7 h-7 animate-spin text-sage-500" />
                                <p className="text-sm">Chargement de la commande...</p>
                            </div>
                        ) : detailData ? (
                            <DetailView detailData={detailData} onRefresh={handleRefresh} />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-3">
                                <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                                    <FileText className="w-7 h-7 text-gray-300" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-semibold text-gray-500">Aucune commande sélectionnée</p>
                                    <p className="text-xs text-gray-400 mt-1">Sélectionnez un BC dans la liste</p>
                                </div>
                            </div>
                        )}
                    </div>
                }
                rightContent={
                    <ActionPanel
                        groups={[
                            ...(canDerogation ? [{
                                items: [{
                                    icon: ShieldAlert,
                                    label: 'Dérogation crédit',
                                    variant: 'warning' as const,
                                    disabled: !bc || bc.bc_status === 'pending_derogation',
                                    onClick: () => setShowDerogation(true),
                                }],
                            }] : []),
                            {
                                items: [
                                    { icon: Printer,  label: 'Imprimer',     disabled: !bc },
                                    ...(canExport ? [{ icon: Download, label: 'Exporter PDF', disabled: !bc }] : []),
                                    { icon: Share2,   label: 'Partager',     disabled: !bc },
                                ],
                            },
                        ]}
                    />
                }
            />
            <DerogationModal isOpen={showDerogation} bcId={selectedId}
                onClose={() => setShowDerogation(false)} onSuccess={handleRefresh} />
        </>
    );
};
