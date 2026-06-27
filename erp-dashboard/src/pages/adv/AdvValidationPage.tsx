import { useState, useEffect, useMemo } from 'react';
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
    Settings, Printer, Download, Share2, History,
    ShieldAlert, TrendingUp, Truck, DollarSign,
    Tag, Layers, Weight, Box, AlertCircle,
    Search, RefreshCw, BarChart3, Star,
    Receipt, Warehouse,
} from 'lucide-react';
import type { ColDef } from 'ag-grid-community';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
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

// ─── Sidebar BC list ──────────────────────────────────────────────────────────

interface BcRowProps { bc: any; selected: boolean; onClick: () => void }
const BcRow = ({ bc, selected, onClick }: BcRowProps) => {
    const cfg = getCfg(bc.bc_status);
    return (
        <button onClick={onClick}
            className={cn(
                'w-full text-left px-4 py-3 border-l-[3px] transition-all duration-150',
                selected
                    ? cn('bg-sage-50 border-l-sage-500', cfg.row.replace('border-l-', 'border-l-sage-'))
                    : cn('hover:bg-gray-50/80 border-l-transparent', 'hover:' + cfg.row),
                'border-b border-gray-100/80 last:border-b-0 focus:outline-none focus:bg-sage-50/60'
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0 mt-px', cfg.dot)} />
                        <span className="text-xs font-bold text-gray-800 font-mono truncate">{bc.order_code}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 truncate pl-3">{bc.partner?.name ?? '—'}</p>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-xs font-black text-gray-900">{fmt(bc.total_amount, 0)} <span className="font-normal text-gray-400">Dh</span></p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(bc.created_at)}</p>
                </div>
            </div>
            <div className="flex items-center justify-between mt-1.5 pl-3">
                <Pill className={cn(cfg.badge, 'text-[10px]')}>{cfg.label}</Pill>
                <span className="text-[10px] text-gray-400">{bc.canal}</span>
            </div>
        </button>
    );
};

const BcSidebar = ({ bcs, loading, selectedId, onSelect, onRefresh }: { bcs: any[]; loading: boolean; selectedId: number | null; onSelect: (id: number) => void; onRefresh: () => void }) => {
    const [search, setSearch] = useState('');
    const filtered = useMemo(() => {
        if (!search.trim()) return bcs;
        const q = search.toLowerCase();
        return bcs.filter(b =>
            b.order_code?.toLowerCase().includes(q) ||
            b.partner?.name?.toLowerCase().includes(q) ||
            b.bc_status?.toLowerCase().includes(q)
        );
    }, [bcs, search]);

    return (
        <div className="flex flex-col h-full bg-white border-r border-gray-200">
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0 space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-900">Commandes ADV</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{bcs.length} bon{bcs.length > 1 ? 's' : ''} de commande</p>
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
                {/* Status summary */}
                <div className="flex gap-1 flex-wrap">
                    {Object.entries(STATUS).slice(0, 5).map(([s, cfg]) => {
                        const count = bcs.filter(b => b.bc_status === s).length;
                        if (!count) return null;
                        return (
                            <button key={s} onClick={() => setSearch(s)}
                                className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ring-1 transition-colors hover:opacity-80', cfg.badge)}>
                                <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />{count}
                            </button>
                        );
                    })}
                    {search && (
                        <button onClick={() => setSearch('')}
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 text-gray-500 hover:bg-gray-200 ring-1 ring-gray-200">
                            ×
                        </button>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-32 text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                        <FileText className="w-8 h-8 mb-2 text-gray-200" />
                        <p className="text-xs">Aucun résultat</p>
                    </div>
                ) : (
                    filtered.map(bc => (
                        <BcRow key={bc.id} bc={bc} selected={bc.id === selectedId}
                            onClick={() => onSelect(bc.id)} />
                    ))
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

// ─── Detail: Document Header ──────────────────────────────────────────────────

const DetailHeader = ({ data }: { data: BcDetailData }) => {
    const { bc, stockAvailable, creditOk, creditExceeded, excessAmount } = data;
    const cfg = getCfg(bc.bc_status);

    return (
        <div className="bg-white border-b border-gray-100 shrink-0">
            {/* Top stripe with status color */}
            <div className={cn('h-1 w-full rounded-t-none', cfg.dot.replace('bg-', 'bg-'))} />

            <div className="px-6 py-5">
                {/* Row 1: ID + Status + Amount */}
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <div className="flex items-center gap-2.5 mb-1.5">
                            <h1 className="text-xl font-black text-gray-900 font-mono tracking-tight">{bc.order_code}</h1>
                            <Pill className={cfg.badge}><span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />{cfg.label}</Pill>
                            {bc.is_preorder && <Pill className="bg-sage-50 text-sage-700 ring-sage-200">Pré-commande</Pill>}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Building className="w-3.5 h-3.5 text-gray-400" />
                            <span className="font-semibold text-gray-700">{bc.partner.name}</span>
                            <span className="text-gray-300">·</span>
                            <span className="font-mono text-gray-400 text-xs">{bc.partner.code}</span>
                        </div>
                    </div>

                    <div className="text-right shrink-0">
                        <p className="text-2xl font-black text-gray-900">{fmt(bc.total_amount)} <span className="text-sm font-normal text-gray-400">Dh</span></p>
                        <div className="flex items-center justify-end gap-3 text-xs text-gray-400 mt-0.5">
                            <span>HT {fmt(bc.sub_total)} Dh</span>
                            <span className="text-gray-200">|</span>
                            <span>TVA {fmt(bc.tax_amount)} Dh</span>
                        </div>
                    </div>
                </div>

                {/* Row 2: Meta chips */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-600">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        {fmtDate(bc.order_date, true)}
                    </div>
                    {bc.due_date && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-600">
                            <Clock className="w-3 h-3 text-gray-400" />
                            Échéance : {fmtDate(bc.due_date)}
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-600">
                        <Tag className="w-3 h-3 text-gray-400" />{bc.canal}
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-600">
                        <FileText className="w-3 h-3 text-gray-400" />{bc.document_type}
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-600">
                        <Package className="w-3 h-3 text-gray-400" />{bc.order_products.length} article{bc.order_products.length > 1 ? 's' : ''}
                    </div>
                </div>

                {/* Row 3: Check indicators */}
                <div className="flex items-center gap-2 flex-wrap">
                    {[
                        { ok: creditOk, okLabel: 'Crédit OK', koLabel: creditExceeded ? `Dépassement ${fmt(excessAmount, 0)} Dh` : 'Crédit KO', icon: CreditCard },
                        { ok: stockAvailable, okLabel: 'Stock OK', koLabel: 'Stock insuffisant', icon: Warehouse },
                        { ok: bc.financial_metadata?.balance_checked ?? false, okLabel: 'Solde vérifié', koLabel: 'Solde non vérifié', icon: CheckCircle },
                        { ok: !data.pendingDerogation, okLabel: 'Sans dérogation', koLabel: 'Dérogation en cours', icon: ShieldAlert },
                    ].map(({ ok, okLabel, koLabel, icon: Icon }) => (
                        <div key={okLabel} className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold',
                            ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100')}>
                            {ok ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {ok ? okLabel : koLabel}
                        </div>
                    ))}
                </div>

                {/* Alert banners */}
                {(creditExceeded || !stockAvailable) && (
                    <div className="mt-3 space-y-2">
                        {creditExceeded && (
                            <div className="flex items-center gap-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                                <p className="text-xs font-semibold text-red-700">Plafond de crédit dépassé de <span className="font-black">{fmt(excessAmount)} Dh</span> — une dérogation est nécessaire pour valider cette commande.</p>
                            </div>
                        )}
                        {!stockAvailable && (
                            <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                                <Package className="w-4 h-4 text-amber-500 shrink-0" />
                                <p className="text-xs font-semibold text-amber-700">Certains articles présentent un stock insuffisant par rapport à la quantité commandée.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Tab bar */}
            <div className="px-6 border-t border-gray-100" id="detail-tab-anchor" />
        </div>
    );
};

// ─── Tab nav ──────────────────────────────────────────────────────────────────

const TABS = [
    { id: 'resume',     label: 'Résumé',      icon: BarChart3 },
    { id: 'lignes',     label: 'Lignes',       icon: Receipt },
    { id: 'client',     label: 'Client',       icon: User },
    { id: 'stock',      label: 'Stock',        icon: Warehouse },
    { id: 'logistique', label: 'Logistique',   icon: Truck },
    { id: 'historique', label: 'Historique',   icon: History },
] as const;
type TabId = typeof TABS[number]['id'];

const TabBar = ({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) => (
    <div className="flex items-center gap-0.5 px-6 bg-white border-b border-gray-100 shrink-0 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => onChange(id)}
                className={cn('flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap',
                    active === id
                        ? 'border-sage-500 text-sage-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                )}>
                <Icon className="w-3.5 h-3.5" />
                {label}
            </button>
        ))}
    </div>
);

// ─── Tab: Résumé ──────────────────────────────────────────────────────────────

const TabResume = ({ data, onRefresh }: { data: BcDetailData; onRefresh: () => void }) => {
    const { bc, partnerStats } = data;
    const wi = bc.workflow_instance;

    return (
        <div className="grid grid-cols-3 gap-5">
            {/* Left col: Workflow + stats */}
            <div className="col-span-2 space-y-5">
                {/* Workflow actions */}
                <Card>
                    <CardHeader icon={Settings} title="Actions Workflow" />
                    <div className="p-5">
                        <BCWorkflowActions orderId={bc.id} onSuccess={onRefresh} />
                    </div>
                </Card>

                {/* BC details */}
                <Card>
                    <CardHeader icon={FileText} title="Détails de la Commande" />
                    <div className="p-5">
                        <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
                            <Field label="N° Commande"    value={<span className="font-mono">{bc.order_code}</span>} />
                            <Field label="Statut BC"      value={<Pill className={getCfg(bc.bc_status).badge}><span className={cn('w-1.5 h-1.5 rounded-full', getCfg(bc.bc_status).dot)} />{getCfg(bc.bc_status).label}</Pill>} />
                            <Field label="Canal"          value={bc.canal} />
                            <Field label="Type document"  value={bc.document_type} />
                            <Field label="Date commande"  value={fmtDate(bc.order_date, true)} />
                            <Field label="Date échéance"  value={fmtDate(bc.due_date)} />
                            <Field label="Statut paiement" value={bc.payment_status} />
                            <Field label="Branche"        value={`#${bc.branch_id}`} />
                        </dl>
                        {bc.bc_notes && (
                            <>
                                <Divider />
                                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                                    <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider mb-1">Notes</p>
                                    <p className="text-sm text-amber-800">{bc.bc_notes}</p>
                                </div>
                            </>
                        )}
                    </div>
                </Card>

                {/* Workflow state */}
                {wi?.current_step && (
                    <Card>
                        <CardHeader icon={Clock} title="État Workflow" />
                        <div className="p-5">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="flex-1 p-3 bg-sage-50 border border-sage-100 rounded-xl">
                                    <p className="text-[10px] text-sage-400 font-semibold uppercase tracking-wider">Étape actuelle</p>
                                    <p className="text-sm font-bold text-sage-800 mt-0.5">{wi.current_step.name}</p>
                                    <p className="text-xs text-sage-500 font-mono mt-0.5">{wi.current_step.code}</p>
                                </div>
                                <div className="px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-center">
                                    <p className="text-[10px] text-gray-400 font-semibold uppercase">Statut</p>
                                    <p className="text-xs font-bold text-gray-700 mt-0.5 capitalize">{wi.status.replace('_', ' ')}</p>
                                </div>
                            </div>
                            {wi.current_step.allowed_transitions.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Transitions autorisées</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {wi.current_step.allowed_transitions.map(t => (
                                            <span key={t} className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-mono">{t}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                )}
            </div>

            {/* Right col: Partner quick + Financial summary */}
            <div className="space-y-5">
                {/* Financial summary */}
                <Card>
                    <CardHeader icon={DollarSign} title="Synthèse Financière" />
                    <div className="p-5 space-y-3">
                        <div className="p-4 bg-gradient-to-br from-sage-500 to-sage-700 rounded-xl text-white">
                            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80 mb-1">Total TTC</p>
                            <p className="text-2xl font-black">{fmt(bc.total_amount)} <span className="text-sm font-normal opacity-70">Dh</span></p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="p-3 bg-sage-50 border border-sage-100 rounded-xl">
                                <p className="text-[10px] text-sage-400 font-semibold uppercase">HT</p>
                                <p className="text-sm font-black text-sage-800 mt-0.5">{fmt(bc.sub_total)} Dh</p>
                            </div>
                            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                                <p className="text-[10px] text-amber-400 font-semibold uppercase">TVA</p>
                                <p className="text-sm font-black text-amber-800 mt-0.5">{fmt(bc.tax_amount)} Dh</p>
                            </div>
                        </div>
                        <Divider />
                        <div className="space-y-2.5">
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Mode paiement</span>
                                <span className="font-semibold text-gray-800">{bc.financial_metadata?.payment_method ?? '—'}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Vente crédit</span>
                                <Pill className={bc.financial_metadata?.is_credit_sale ? 'bg-sage-50 text-sage-700 ring-sage-200' : 'bg-gray-50 text-gray-600 ring-gray-200'}>
                                    {bc.financial_metadata?.is_credit_sale ? 'Oui' : 'Non'}
                                </Pill>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Solde vérifié</span>
                                <Pill className={bc.financial_metadata?.balance_checked ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-red-50 text-red-700 ring-red-200'}>
                                    {bc.financial_metadata?.balance_checked ? 'Oui' : 'Non'}
                                </Pill>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Partner stats */}
                {partnerStats && (
                    <Card>
                        <CardHeader icon={TrendingUp} title="Stats Partenaire" />
                        <div className="p-5 space-y-4">
                            {[
                                { label: 'Commandes totales', value: partnerStats.total_orders, color: 'sage' as const },
                                { label: 'BCs en attente',    value: partnerStats.pending_bcs,  color: 'amber' as const },
                            ].map(s => (
                                <div key={s.label}>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className="text-xs text-gray-500">{s.label}</span>
                                        <Stat label="" value={s.value} color={s.color} />
                                    </div>
                                </div>
                            ))}
                            <Divider />
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Valeur moy. commande</span>
                                <span className="font-black text-gray-900">{fmt(partnerStats.avg_order_value, 0)} Dh</span>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Credit quick view */}
                <Card>
                    <CardHeader icon={CreditCard} title="Crédit Client" />
                    <div className="p-5">
                        <div className="mb-3">
                            <div className="flex justify-between text-xs mb-1.5">
                                <span className="text-gray-500">Utilisation</span>
                                <span className="font-bold text-gray-700">
                                    {n(bc.partner.credit_limit) > 0 ? ((n(bc.partner.credit_used) / n(bc.partner.credit_limit)) * 100).toFixed(1) : '0'}%
                                </span>
                            </div>
                            <Bar pct={n(bc.partner.credit_limit) > 0 ? (n(bc.partner.credit_used) / n(bc.partner.credit_limit)) * 100 : 0}
                                color={(n(bc.partner.credit_used) / n(bc.partner.credit_limit)) > 0.9 ? 'red' : (n(bc.partner.credit_used) / n(bc.partner.credit_limit)) > 0.75 ? 'amber' : 'emerald'} />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs"><span className="text-gray-400">Plafond</span><span className="font-bold">{fmt(bc.partner.credit_limit, 0)} Dh</span></div>
                            <div className="flex justify-between text-xs"><span className="text-gray-400">Utilisé</span><span className="font-bold text-amber-600">{fmt(bc.partner.credit_used, 0)} Dh</span></div>
                            <div className="flex justify-between text-xs"><span className="text-gray-400">Disponible</span><span className="font-bold text-emerald-600">{fmt(bc.partner.credit_available, 0)} Dh</span></div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-500">Statut</span>
                                <Pill className={bc.partner.credit_hold ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}>
                                    {bc.partner.credit_hold ? 'Bloqué' : 'Normal'}
                                </Pill>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

// ─── Tab: Lignes ──────────────────────────────────────────────────────────────

const TabLignes = ({ bc }: { bc: BC }) => {
    const totals = bc.order_products.reduce((a, p) => ({
        ht: a.ht + n(p.line_total_ht), tva: a.tva + n(p.line_tax_amount), ttc: a.ttc + n(p.total_price),
    }), { ht: 0, tva: 0, ttc: 0 });

    const colDefs: ColDef<OrderProduct>[] = [
        {
            headerName: '', field: 'product.thumbnail' as any, width: 48, pinned: 'left', resizable: false, sortable: false,
            cellRenderer: (p: any) => (
                <div className="flex items-center justify-center h-full">
                    {p.data.product.thumbnail
                        ? <img src={p.data.product.thumbnail} alt="" className="w-7 h-7 rounded-lg object-cover border border-gray-100" />
                        : <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-[8px] font-bold text-gray-400">{p.data.product.code?.slice(-3)}</div>}
                </div>
            ),
        },
        {
            headerName: 'Article', flex: 2, minWidth: 220, pinned: 'left',
            cellRenderer: (p: any) => (
                <div className="flex flex-col justify-center h-full py-1">
                    <p className="text-xs font-bold text-gray-900 leading-tight truncate">{p.data.product.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-mono text-gray-400">{p.data.product.code}</span>
                        {p.data.sales_group_code && <span className="text-[9px] px-1 bg-slate-100 text-slate-500 rounded font-semibold">{p.data.sales_group_code}</span>}
                    </div>
                </div>
            ),
        },
        {
            headerName: 'Qté', field: 'quantity', width: 72,
            cellClass: 'font-black text-right text-sm text-gray-900',
            valueFormatter: p => parseFloat(p.value).toLocaleString('fr-FR'),
        },
        {
            headerName: 'TVA', field: 'tax_rate', width: 60,
            cellClass: 'text-center text-xs text-gray-500',
            valueFormatter: p => `${parseFloat(p.value).toFixed(0)}%`,
        },
        {
            headerName: 'PU HT', field: 'unit_price_ht', width: 100,
            cellClass: 'text-right text-xs text-gray-500',
            valueFormatter: p => `${fmt(p.value)} Dh`,
        },
        {
            headerName: 'PU TTC', field: 'price', width: 100,
            cellClass: 'text-right text-xs font-semibold text-gray-700',
            valueFormatter: p => `${fmt(p.value)} Dh`,
        },
        {
            headerName: 'Total HT', field: 'line_total_ht', width: 110,
            cellClass: 'text-right text-xs text-gray-500',
            valueFormatter: p => `${fmt(p.value)} Dh`,
        },
        {
            headerName: 'TVA Ligne', field: 'line_tax_amount', width: 100,
            cellClass: 'text-right text-xs text-amber-600',
            valueFormatter: p => `${fmt(p.value)} Dh`,
        },
        {
            headerName: 'Total TTC', field: 'total_price', width: 115, pinned: 'right',
            cellRenderer: (p: any) => (
                <div className="flex items-center justify-end h-full">
                    <span className="font-black text-sm text-sage-700">{fmt(p.value)} Dh</span>
                </div>
            ),
        },
        {
            headerName: 'Stock', field: 'available_stock_quantity', width: 90, pinned: 'right',
            cellRenderer: (p: any) => {
                const ok = p.value >= parseFloat(p.data.quantity);
                return (
                    <div className="flex items-center justify-center h-full">
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
                            {p.value}
                        </span>
                    </div>
                );
            },
        },
    ];

    return (
        <div className="space-y-4">
            {/* Totals bar */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Total HT',  value: totals.ht,  color: 'blue' },
                    { label: 'Total TVA', value: totals.tva, color: 'amber' },
                    { label: 'Total TTC', value: totals.ttc, color: 'sage' },
                ].map(t => (
                    <Card key={t.label} className="p-4 flex items-center gap-3">
                        <div className={cn('w-1 h-8 rounded-full shrink-0', t.color === 'blue' ? 'bg-blue-400' : t.color === 'amber' ? 'bg-amber-400' : 'bg-sage-500')} />
                        <div>
                            <p className="text-[10px] text-gray-400 font-semibold uppercase">{t.label}</p>
                            <p className="text-lg font-black text-gray-900 mt-0.5">{fmt(t.value)} <span className="text-xs font-normal text-gray-400">Dh</span></p>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Grid */}
            <Card>
                <div className="h-[420px] overflow-hidden rounded-2xl">
                    <DataGrid rowData={bc.order_products} columnDefs={colDefs} rowHeight={52} />
                </div>
            </Card>
        </div>
    );
};

// ─── Tab: Client ──────────────────────────────────────────────────────────────

const TabClient = ({ bc }: { bc: BC }) => {
    const p = bc.partner;
    const limit = n(p.credit_limit), used = n(p.credit_used), avail = n(p.credit_available);
    const util = limit > 0 ? (used / limit) * 100 : 0;
    const newBalance = used + n(bc.total_amount);
    const willExceed = newBalance > limit;

    return (
        <div className="grid grid-cols-3 gap-5">
            {/* Identity */}
            <Card className="col-span-2">
                <CardHeader icon={User} title="Identité & Coordonnées" />
                <div className="p-5 grid grid-cols-2 gap-x-10 gap-y-4">
                    <div className="space-y-4">
                        <Field label="Code client"    value={<span className="font-mono">{p.code}</span>} />
                        <Field label="Raison sociale" value={p.name} />
                        <Field label="Type"           value={p.partner_type} />
                        <Field label="Canal"          value={p.channel} />
                        <Field label="ICE"            value={p.tax_number_ice} />
                        <Field label="IF"             value={p.tax_number_if} />
                        <Field label="Statut"         value={<Pill className={p.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-red-50 text-red-700 ring-red-200'}>{p.status}</Pill>} />
                    </div>
                    <div className="space-y-4">
                        <Field label="Adresse"    value={p.address_line1} />
                        <Field label="Ville"      value={p.city} />
                        <Field label="Région"     value={p.region} />
                        <Field label="Pays"       value={p.country} />
                        <Field label="Téléphone"  value={p.phone} />
                        <Field label="Email"      value={p.email} />
                        <Field label="Site web"   value={p.website} />
                    </div>
                </div>
            </Card>

            {/* Scores */}
            <div className="space-y-4">
                <Card>
                    <CardHeader icon={Star} title="Scores" />
                    <div className="p-5 space-y-5">
                        {[
                            { label: 'Comportement paiement', value: p.payment_behavior_score, invert: false },
                            { label: 'Score de risque',       value: p.risk_score,             invert: true },
                        ].map(s => {
                            const pct = s.value;
                            const color = s.invert
                                ? (pct >= 70 ? 'red' : pct >= 40 ? 'amber' : 'emerald') as any
                                : (pct >= 70 ? 'emerald' : pct >= 40 ? 'amber' : 'red') as any;
                            return (
                                <div key={s.label}>
                                    <div className="flex justify-between text-xs mb-1.5">
                                        <span className="text-gray-500">{s.label}</span>
                                        <span className="font-black text-gray-900">{pct}<span className="text-gray-400 font-normal">/100</span></span>
                                    </div>
                                    <Bar pct={pct} color={color} />
                                </div>
                            );
                        })}
                        <Divider />
                        <div className="grid grid-cols-2 gap-3">
                            <div className="text-center p-2 bg-gray-50 rounded-xl">
                                <p className="text-xl font-black text-gray-900">{p.total_orders_count}</p>
                                <p className="text-[10px] text-gray-400">commandes</p>
                            </div>
                            <div className="text-center p-2 bg-gray-50 rounded-xl">
                                <p className="text-sm font-black text-gray-900">{fmt(p.total_orders_value, 0)}</p>
                                <p className="text-[10px] text-gray-400">Dh total</p>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Credit full */}
            <Card className="col-span-3">
                <CardHeader icon={CreditCard} title="Situation Crédit" />
                <div className="p-5">
                    {willExceed && (
                        <div className="mb-5 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-bold text-red-800">Ce BC dépasserait le plafond de crédit</p>
                                <p className="text-red-600 text-xs mt-0.5">Nouveau solde après BC : <b>{fmt(newBalance)} Dh</b> — Plafond : <b>{fmt(limit)} Dh</b> — Excédent : <b>{fmt(newBalance - limit)} Dh</b></p>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-4 gap-5">
                        <div className="col-span-3">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-500 font-medium">Taux d'utilisation</span>
                                <span className="font-black">{util.toFixed(1)}%</span>
                            </div>
                            <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden mb-4">
                                <div className={cn('h-full rounded-full transition-all', util > 100 ? 'bg-red-500' : util > 80 ? 'bg-amber-500' : 'bg-emerald-500')}
                                    style={{ width: `${Math.min(util, 100)}%` }} />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                {[{ l: 'Plafond', v: limit, c: 'text-gray-900' }, { l: 'Utilisé', v: used, c: 'text-amber-700' }, { l: 'Disponible', v: avail, c: 'text-emerald-700' }].map(i => (
                                    <div key={i.l} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                        <p className="text-[10px] text-gray-400 uppercase font-semibold">{i.l}</p>
                                        <p className={cn('text-lg font-black mt-0.5', i.c)}>{fmt(i.v, 0)} <span className="text-xs font-normal text-gray-400">Dh</span></p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-3">
                            <Field label="Statut crédit" value={<Pill className={p.credit_hold ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}>{p.credit_hold ? '● Bloqué' : '● Normal'}</Pill>} />
                            {p.credit_hold_reason && <Field label="Raison" value={p.credit_hold_reason} />}
                            <Field label="Mode paiement" value={bc.financial_metadata?.payment_method} />
                            <Field label="Solde vérifié" value={bc.financial_metadata?.balance_checked ? 'Oui' : 'Non'} />
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

// ─── Tab: Stock ───────────────────────────────────────────────────────────────

const TabStock = ({ bc }: { bc: BC }) => {
    const items = bc.order_products;
    const ok = items.filter(p => p.available_stock_quantity >= parseFloat(p.quantity)).length;
    const partial = items.filter(p => p.available_stock_quantity > 0 && p.available_stock_quantity < parseFloat(p.quantity)).length;
    const out = items.length - ok - partial;

    return (
        <div className="space-y-5">
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Disponible', n: ok,      icon: CheckCircle, c: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: 'text-emerald-500' } },
                    { label: 'Partiel',    n: partial,  icon: AlertTriangle, c: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-500' } },
                    { label: 'Rupture',    n: out,      icon: XCircle, c: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'text-red-500' } },
                ].map(({ label, n: count, icon: Icon, c }) => (
                    <div key={label} className={cn('rounded-2xl border p-5 flex items-center gap-4', c.bg, c.border)}>
                        <div className={cn('w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center shrink-0')}>
                            <Icon className={cn('w-5 h-5', c.icon)} />
                        </div>
                        <div>
                            <p className={cn('text-3xl font-black leading-none', c.text)}>{count}</p>
                            <p className={cn('text-xs mt-1', c.text, 'opacity-70')}>{label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Per article */}
            <Card>
                <CardHeader icon={Package} title="Stock par Article" />
                <div className="divide-y divide-gray-50">
                    {items.map(item => {
                        const qty = parseFloat(item.quantity);
                        const avail = item.available_stock_quantity;
                        const pct = qty > 0 ? Math.min(avail / qty, 1) * 100 : 100;
                        const okLine = avail >= qty;
                        const partLine = avail > 0 && !okLine;
                        const color = okLine ? 'emerald' : partLine ? 'amber' : 'red';
                        return (
                            <div key={item.id} className="px-5 py-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className={cn('w-2 h-2 rounded-full shrink-0', okLine ? 'bg-emerald-500' : partLine ? 'bg-amber-500' : 'bg-red-500')} />
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-900 truncate">{item.product.name}</p>
                                            <p className="text-[10px] text-gray-400 font-mono">{item.product.code}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0 ml-4">
                                        <span className="text-xs text-gray-500"><span className="font-black text-gray-900">{avail}</span> / {qty} unités</span>
                                        <Pill className={okLine ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : partLine ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-red-50 text-red-700 ring-red-200'}>
                                            {okLine ? 'OK' : partLine ? 'Partiel' : 'Rupture'}
                                        </Pill>
                                    </div>
                                </div>
                                <Bar pct={pct} color={color} />
                            </div>
                        );
                    })}
                </div>
            </Card>
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

    return (
        <div className="grid grid-cols-2 gap-5">
            {/* Transitions from BC detail */}
            <Card>
                <CardHeader icon={Clock} title="Transitions de la Commande" />
                <div className="p-5">
                    {transitions.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">Aucune transition</p>
                    ) : (
                        <div className="relative">
                            <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-100" />
                            <div className="space-y-4">
                                {transitions.map(t => (
                                    <div key={t.id} className="relative pl-10">
                                        <div className={cn('absolute left-3 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ring-2', t.action === 'submit_order' ? 'bg-sage-500 ring-sage-200' : t.action === 'initialized' ? 'bg-gray-400 ring-gray-200' : 'bg-sage-500 ring-sage-200')} />
                                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-[10px] font-mono font-bold text-gray-700 px-1.5 py-0.5 bg-white border border-gray-200 rounded-md">{t.action}</span>
                                                <span className="text-[10px] text-gray-400">{fmtDate(t.performed_at, true)}</span>
                                            </div>
                                            {t.performed_by && (
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <div className="w-4 h-4 rounded-full bg-sage-100 flex items-center justify-center shrink-0">
                                                        <User className="w-2.5 h-2.5 text-sage-600" />
                                                    </div>
                                                    <span className="text-xs font-semibold text-gray-700">{t.performed_by.name}</span>
                                                </div>
                                            )}
                                            {t.comment && <p className="text-xs italic text-gray-500 mt-1.5 pt-1.5 border-t border-gray-100">"{t.comment}"</p>}
                                            {t.metadata && Object.keys(t.metadata).length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {Object.entries(t.metadata).map(([k, v]) => (
                                                        <span key={k} className="text-[9px] px-1.5 py-0.5 bg-white border border-gray-200 rounded font-mono text-gray-400">{k}: {String(v)}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {/* Workflow API history */}
            <Card>
                <CardHeader icon={History} title="Historique Workflow" />
                <div className="p-5">
                    {isLoadingHistory ? (
                        <div className="flex items-center justify-center h-20 text-gray-400">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" /><span className="text-sm">Chargement...</span>
                        </div>
                    ) : (
                        <WorkflowHistory history={workflowHistory} isLoading={isLoadingHistory} />
                    )}
                </div>
            </Card>
        </div>
    );
};

// ─── Detail view ──────────────────────────────────────────────────────────────

const DetailView = ({ detailData, onRefresh }: { detailData: BcDetailData; onRefresh: () => void }) => {
    const [tab, setTab] = useState<TabId>('resume');
    const { bc } = detailData;

    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-50/80">
            <DetailHeader data={detailData} />
            <TabBar active={tab} onChange={setTab} />
            <div className="flex-1 overflow-y-auto p-5">
                {tab === 'resume'     && <TabResume     data={detailData}   onRefresh={onRefresh} />}
                {tab === 'lignes'     && <TabLignes     bc={bc} />}
                {tab === 'client'     && <TabClient     bc={bc} />}
                {tab === 'stock'      && <TabStock      bc={bc} />}
                {tab === 'logistique' && <TabLogistique logistics={detailData.logistics_aggregate} />}
                {tab === 'historique' && <TabHistorique bc={bc} orderId={bc.id} />}
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

    return (
        <>
            <MasterLayout
                leftContent={
                    <BcSidebar bcs={bcs} loading={loading} selectedId={selectedId}
                        onSelect={handleSelect} onRefresh={fetchList} />
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
                            ...(can(PERMISSIONS.ADV.CREDIT_UPDATE_LIMIT)
                                ? [{
                                    items: [{
                                        icon: ShieldAlert,
                                        label: 'Demander Dérogation',
                                        variant: 'sage' as const,
                                        onClick: () => setShowDerogation(true),
                                        disabled: !selectedId || detailData?.bc.bc_status === 'pending_derogation',
                                    }],
                                }]
                                : []),
                            {
                                items: [
                                    { icon: Printer, label: 'Imprimer', disabled: !selectedId },
                                    ...(can(PERMISSIONS.ADV.BC_EXPORT)
                                        ? [{ icon: Download, label: 'Exporter PDF', disabled: !selectedId }]
                                        : []),
                                    { icon: Share2, label: 'Partager', variant: 'primary' as const, disabled: !selectedId },
                                ],
                            },
                            { items: [{ icon: Settings, label: 'Paramètres' }] },
                        ]}
                    />
                }
            />
            <DerogationModal isOpen={showDerogation} bcId={selectedId}
                onClose={() => setShowDerogation(false)} onSuccess={handleRefresh} />
        </>
    );
};
