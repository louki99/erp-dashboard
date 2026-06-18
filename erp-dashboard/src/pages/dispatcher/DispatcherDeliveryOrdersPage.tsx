import { useEffect, useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import {
  Loader2, RefreshCw, ChevronRight, AlertCircle, FileText, Package,
  Truck, MapPin, Calendar, Hash, User, ArrowRight, ShoppingCart,
  Route, Send, X, Pencil, CheckCircle2, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { SageCollapsible } from '@/components/common/SageCollapsible';
import {
  useDispatcherDeliveryOrdersList,
  useDispatcherDeliveryOrderDetail,
  useDoDecisions,
  useExecuteDoDecision,
} from '@/hooks/dispatcher/useDispatcherDeliveryOrders';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type { DeliveryOrder, DoStatus, DoDecisionItem, Rider, Vehicle } from '@/types/dispatcher.types';

// ─── Status config ─────────────────────────────────────────────────────────────

const DO_STATUS: Record<DoStatus, { label: string; color: string; dot: string }> = {
  draft:               { label: 'Brouillon',         color: 'bg-gray-100 text-gray-700 border-gray-200',     dot: 'bg-gray-400' },
  pending_allocation:  { label: 'Alloc. en attente', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  allocated:           { label: 'Alloué',            color: 'bg-blue-100 text-blue-700 border-blue-200',      dot: 'bg-blue-500' },
  partially_allocated: { label: 'Alloc. partielle',  color: 'bg-orange-100 text-orange-700 border-orange-200',dot: 'bg-orange-500' },
  validated:           { label: 'Validé (Val.DO)',   color: 'bg-sky-100 text-sky-700 border-sky-200',         dot: 'bg-sky-500' },
  optimized:           { label: 'Optimisé',          color: 'bg-indigo-100 text-indigo-700 border-indigo-200',dot: 'bg-indigo-500' },
  in_preparation:      { label: 'En préparation',    color: 'bg-purple-100 text-purple-700 border-purple-200',dot: 'bg-purple-500' },
  prepared:            { label: 'Préparé',           color: 'bg-teal-100 text-teal-700 border-teal-200',      dot: 'bg-teal-500' },
  ready_for_loading:   { label: 'Prêt chargement',  color: 'bg-cyan-100 text-cyan-700 border-cyan-200',      dot: 'bg-cyan-500' },
  dispatched:          { label: 'Dispatché',         color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  cancelled:           { label: 'Annulé',            color: 'bg-red-100 text-red-700 border-red-200',         dot: 'bg-red-500' },
  rejected:            { label: 'Rejeté',            color: 'bg-rose-100 text-rose-700 border-rose-200',      dot: 'bg-rose-500' },
};

const StatusBadge = ({ status }: { status: DoStatus }) => {
  const cfg = DO_STATUS[status] ?? { label: status, color: 'bg-gray-100 text-gray-700 border-gray-200', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// Single most likely next decision per status, derived from the Dispatch V2 chain (docs §2b/§16).
// Used to render a one-click quick-action button directly in the list — opens the real decision
// modal (fields/confirm/danger still come live from the API) without a detour through the detail panel.
const STATUS_NEXT_ACTION: Partial<Record<DoStatus, { decision: string; label: string; icon: React.ComponentType<{ className?: string }> }>> = {
  draft:             { decision: 'optimize_do',            label: 'Optimiser',  icon: Route },
  optimized:         { decision: 'start_do_preparation',   label: 'Préparer',   icon: Send },
  in_preparation:    { decision: 'complete_do_preparation', label: 'Terminer',   icon: CheckCircle2 },
  prepared:          { decision: 'generate_bch_from_dos',  label: 'Générer BCH', icon: Truck },
  ready_for_loading: { decision: 'generate_bch_from_dos',  label: 'Générer BCH', icon: Truck },
};

const DO_FILTER_TABS = [
  { id: '', label: 'Tous' },
  { id: 'draft', label: 'Brouillons' },
  { id: 'pending_allocation', label: 'En attente' },
  { id: 'optimized', label: 'Optimisés' },
  { id: 'in_preparation', label: 'En prép.' },
  { id: 'dispatched', label: 'Dispatchés' },
];

// ─── Pipeline step indicator ─────────────────────────────────────────────────
// Two separate, non-intersecting pipelines (docs §2, confirmed by backend 2026-06-16): a DO
// follows Pipeline 1 (LOT path: allocated/partially_allocated/validated) OR Pipeline 2
// (Dispatch V2: optimized/in_preparation/prepared/ready_for_loading/dispatched) — never both,
// since these DoStatus values are mutually exclusive. Stringing both into one linear chain
// falsely implies a DO will pass through every step of both, which previously caused dispatchers
// to attempt out-of-pipeline decisions (e.g. validate_delivery_order on a Pipeline-2 DO).

const PIPELINE_1_STEPS: DoStatus[] = ['draft', 'pending_allocation', 'allocated', 'partially_allocated', 'validated'];
const PIPELINE_2_STEPS: DoStatus[] = ['draft', 'pending_allocation', 'optimized', 'in_preparation', 'prepared', 'ready_for_loading', 'dispatched'];
const PIPELINE_2_ONLY_STATUSES: DoStatus[] = ['optimized', 'in_preparation', 'prepared', 'ready_for_loading', 'dispatched'];
const TERMINAL_STATUSES: DoStatus[] = ['cancelled', 'rejected'];

const PipelineIndicator = ({ status }: { status: DoStatus }) => {
  if (TERMINAL_STATUSES.includes(status)) return <StatusBadge status={status} />;

  const isPipeline2 = PIPELINE_2_ONLY_STATUSES.includes(status);
  const steps = isPipeline2 ? PIPELINE_2_STEPS : PIPELINE_1_STEPS;
  const currentIdx = steps.indexOf(status);
  const isUndetermined = status === 'draft' || status === 'pending_allocation';

  return (
    <div>
      {isUndetermined && (
        <p className="text-[10px] text-gray-400 mb-1">
          Pipeline pas encore engagé — peut suivre LOT (allocated…) ou Dispatch V2 (optimized…)
        </p>
      )}
      <div className="flex items-center gap-1 flex-wrap">
        {steps.map((step, i) => {
          const cfg = DO_STATUS[step];
          const isActive = i === currentIdx;
          const isPast = i < currentIdx;
          return (
            <div key={step} className="flex items-center gap-1">
              <div
                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                  isActive
                    ? `${cfg.color} ring-2 ring-offset-1 ring-current`
                    : isPast
                    ? 'bg-gray-100 text-gray-400 border border-gray-200 line-through'
                    : 'bg-gray-50 text-gray-300 border border-gray-100'
                }`}
              >
                {cfg.label}
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className={`w-3 h-3 ${isPast ? 'text-gray-300' : 'text-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Pipeline decisions ───────────────────────────────────────────────────────
// Decision metadata (label, description, confirm/danger, dynamic fields) now comes
// straight from GET /workflow/delivery-order/{id}/decisions — see docs §16.

const INTENT_STYLE: Record<string, { icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  EDIT:     { icon: Pencil,       cls: 'bg-gray-600 hover:bg-gray-700 text-white' },
  VALIDATE: { icon: CheckCircle2, cls: 'bg-blue-600 hover:bg-blue-700 text-white' },
  DISPATCH: { icon: Route,        cls: 'bg-indigo-600 hover:bg-indigo-700 text-white' },
  DELETE:   { icon: Trash2,       cls: 'bg-white border border-red-200 text-red-600 hover:bg-red-50' },
};
const DEFAULT_INTENT_STYLE = { icon: Send, cls: 'bg-emerald-600 hover:bg-emerald-700 text-white' };

interface DecisionFormModalProps {
  doItem: DeliveryOrder;
  decisionItem: DoDecisionItem;
  loading: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, unknown>) => void;
}

const DecisionFormModal = ({ doItem, decisionItem, loading, onClose, onSubmit }: DecisionFormModalProps) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [riders, setRiders] = useState<Rider[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    if (decisionItem.fields.some((f) => f.name === 'driver_id')) {
      dispatcherApi.livreurs.getList().then(setRiders).catch(() => {});
    }
    if (decisionItem.fields.some((f) => f.name === 'vehicle_id')) {
      dispatcherApi.vehicles.getList().then(setVehicles).catch(() => {});
    }
  }, [decisionItem]);

  const style = INTENT_STYLE[decisionItem.intent ?? ''] ?? DEFAULT_INTENT_STYLE;
  const Icon = decisionItem.danger ? Trash2 : style.icon;
  const setField = (name: string, v: string) => setValues((p) => ({ ...p, [name]: v }));

  const missingRequired = decisionItem.fields.some((f) => f.required && !values[f.name]);

  const handleSubmit = () => {
    const payload: Record<string, unknown> = {};
    for (const f of decisionItem.fields) {
      const v = values[f.name];
      if (v === undefined || v === '') continue;
      payload[f.name] = f.type === 'number' ? Number(v) : v;
    }
    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`p-1.5 rounded-lg shrink-0 ${decisionItem.danger ? 'bg-red-100' : 'bg-gray-100'}`}>
              <Icon className={`w-4 h-4 ${decisionItem.danger ? 'text-red-600' : 'text-gray-600'}`} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900 truncate">{decisionItem.label}</h2>
              <p className="text-xs text-gray-400 truncate">{doItem.do_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {decisionItem.description && (
            <p className="text-xs text-gray-500">{decisionItem.description}</p>
          )}

          {decisionItem.danger && (
            <div className="flex items-start gap-1.5 p-2.5 rounded-lg bg-red-50 text-xs text-red-700">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Cette action est irréversible.
            </div>
          )}

          {decisionItem.fields.map((f) => (
            <div key={f.name}>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                {f.label} {f.required && <span className="text-red-500">*</span>}
              </label>
              {f.name === 'driver_id' ? (
                <select
                  value={values[f.name] ?? ''}
                  onChange={(e) => setField(f.name, e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-300 outline-none"
                >
                  <option value="">— Sélectionner —</option>
                  {riders.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              ) : f.name === 'vehicle_id' ? (
                <select
                  value={values[f.name] ?? ''}
                  onChange={(e) => setField(f.name, e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-300 outline-none"
                >
                  <option value="">— Sélectionner —</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate_number ?? v.plate} {v.internal_code ? `(${v.internal_code})` : ''} — {v.capacity_weight ?? v.capacity_kg ?? '?'} kg
                    </option>
                  ))}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea
                  rows={3}
                  value={values[f.name] ?? ''}
                  onChange={(e) => setField(f.name, e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-300 outline-none resize-none"
                />
              ) : (
                <input
                  type={f.type}
                  value={values[f.name] ?? ''}
                  onChange={(e) => setField(f.name, e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-300 outline-none"
                />
              )}
            </div>
          ))}

          {decisionItem.fields.length === 0 && (
            <p className="text-sm text-gray-500">Confirmer cette action ?</p>
          )}
        </div>

        <div className="flex items-center gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} disabled={loading}
            className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
            Retour
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || missingRequired}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-xl disabled:opacity-60 transition-colors ${
              decisionItem.danger ? 'bg-red-600 hover:bg-red-700 text-white' : style.cls
            }`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
};

interface PipelineActionsProps {
  doItem: DeliveryOrder;
  onActionDone: () => void;
  autoOpenDecision?: string | null;
  onAutoOpened?: () => void;
}

const PipelineActions = ({ doItem, onActionDone, autoOpenDecision, onAutoOpened }: PipelineActionsProps) => {
  const { data: decisionsData, loading: decisionsLoading, refetch: refetchDecisions } = useDoDecisions(doItem.id);
  const { execute, loading: executing } = useExecuteDoDecision();
  const [activeDecision, setActiveDecision] = useState<DoDecisionItem | null>(null);

  const decisions = decisionsData?.decisions ?? [];

  // Opens the matching decision modal as soon as it's loaded — powers the list's quick-action button
  useEffect(() => {
    if (!autoOpenDecision || decisionsLoading) return;
    const match = decisions.find((d) => d.decision === autoOpenDecision);
    if (match) setActiveDecision(match);
    onAutoOpened?.();
  }, [autoOpenDecision, decisionsLoading, decisions]);

  const run = async (decision: string, extra?: Record<string, unknown>) => {
    try {
      const res = await execute(doItem.id, decision, extra);
      if (res.success) {
        toast.success(res.message || 'Action effectuée');
        onActionDone();
        refetchDecisions();
      } else {
        toast.error(res.message || 'Action refusée');
      }
    } catch (err: any) {
      const constraints = err?.response?.data?.constraints as Array<{ reason: string }> | undefined;
      const msg = constraints?.length
        ? constraints.map((c) => c.reason).join(' · ')
        : err?.response?.data?.message ?? "Échec de l'action";
      toast.error(msg);
    }
  };

  if (decisionsLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Vérification des actions disponibles…
      </div>
    );
  }

  if (decisions.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {decisions.map((d) => {
          const style = INTENT_STYLE[d.intent ?? ''] ?? DEFAULT_INTENT_STYLE;
          const Icon = d.danger ? Trash2 : style.icon;
          const cls = d.danger ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50' : style.cls;
          return (
            <button
              key={d.decision}
              disabled={executing}
              onClick={() => setActiveDecision(d)}
              title={d.description}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${cls}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {d.label}
            </button>
          );
        })}
      </div>

      {activeDecision && (
        <DecisionFormModal
          doItem={doItem}
          decisionItem={activeDecision}
          loading={executing}
          onClose={() => setActiveDecision(null)}
          onSubmit={async (vals) => {
            await run(activeDecision.decision, Object.keys(vals).length ? vals : undefined);
            setActiveDecision(null);
          }}
        />
      )}
    </>
  );
};

// ─── Detail panel ─────────────────────────────────────────────────────────────

const DetailPanel = ({
  doItem,
  onClose,
  onListRefresh,
  autoOpenDecision,
  onAutoOpened,
}: {
  doItem: DeliveryOrder;
  onClose: () => void;
  onListRefresh?: () => void;
  autoOpenDecision?: string | null;
  onAutoOpened?: () => void;
}) => {
  const { data: detail, loading, refetch } = useDispatcherDeliveryOrderDetail(doItem.id);
  const [activeTab, setActiveTab] = useState('info');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    header: true,
    pipeline: true,
    orders: true,
    bls: false,
    shipments: false,
    items: false,
  });

  const d = detail ?? doItem;
  const status = d.status as DoStatus;

  const bchs = d.bchs ?? d.shipments;
  const tabs: TabItem[] = useMemo(() => [
    { id: 'info',      label: 'DO',              icon: FileText },
    { id: 'orders',    label: `Commandes (${d.orders?.length ?? d.orders_count ?? 0})`, icon: ShoppingCart },
    { id: 'bls',       label: `BLs (${d.delivery_notes?.length ?? 0})`, icon: Package },
    { id: 'shipments', label: `BCH (${bchs?.length ?? 0})`, icon: Truck },
  ], [d.orders?.length, d.orders_count, d.delivery_notes?.length, bchs?.length]);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
              <ChevronRight className="w-4 h-4 text-gray-500 rotate-180" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-gray-900 truncate">{d.do_number}</h2>
                <StatusBadge status={status} />
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                {d.delivery_zone && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {d.delivery_zone}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(d.planned_delivery_date).toLocaleDateString('fr-FR')}
                </span>
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-lg font-bold text-gray-900">
              {Number(d.total_ordered_amount).toLocaleString('fr-MA')}
              <span className="text-xs font-normal text-gray-400 ml-1">Dh</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{d.orders_count} commande(s)</div>
            {loading && (
              <div className="flex items-center justify-end gap-1 text-xs text-gray-400 mt-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Chargement…
              </div>
            )}
          </div>
        </div>

        <PipelineActions
          doItem={d}
          onActionDone={() => {
            refetch();
            onListRefresh?.();
          }}
          autoOpenDecision={autoOpenDecision}
          onAutoOpened={onAutoOpened}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-100 shrink-0">
        <SageTabs tabs={tabs} activeTabId={activeTab} onTabChange={setActiveTab} className="px-4 shadow-none" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">

        {/* Info tab */}
        {activeTab === 'info' && (
          <>
            <SageCollapsible
              title="En-tête DO"
              isOpen={openSections.header}
              onOpenChange={(v) => setOpenSections((p) => ({ ...p, header: v }))}
            >
              <div className="grid grid-cols-2 gap-3 p-1">
                {[
                  { label: 'N° DO', value: d.do_number, icon: Hash },
                  { label: 'Zone livraison', value: d.delivery_zone ?? '—', icon: MapPin },
                  { label: 'Date prévue', value: new Date(d.planned_delivery_date).toLocaleDateString('fr-FR'), icon: Calendar },
                  // optimize_do's driver_id/vehicle_id is a non-binding planning proposal, not a
                  // commitment — the vehicle actually used is resolved at generate_bch_from_dos
                  // and can differ once several DOs get grouped into one BCH (docs §2, corrected
                  // 2026-06-17). Label it as proposed so it isn't read as final here.
                  { label: 'Conducteur (proposé)', value: d.driver?.name ?? (d.driver_id ? `#${d.driver_id}` : '—'), icon: User },
                  { label: 'Véhicule (proposé)', value: d.vehicle?.plate_number ?? d.vehicle?.plate ?? (d.vehicle_id ? `#${d.vehicle_id}` : '—'), icon: Truck },
                  { label: 'Nb commandes', value: String(d.orders_count), icon: ShoppingCart },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="p-3 rounded-lg bg-white border border-gray-100 flex items-start gap-2">
                    <Icon className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs text-gray-500">{label}</div>
                      <div className="text-sm font-semibold text-gray-900 mt-0.5 truncate">{value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </SageCollapsible>

            <SageCollapsible
              title="Pipeline logistique"
              isOpen={openSections.pipeline}
              onOpenChange={(v) => setOpenSections((p) => ({ ...p, pipeline: v }))}
            >
              <div className="p-3">
                <PipelineIndicator status={status} />
              </div>
            </SageCollapsible>

            {d.items && d.items.length > 0 && (
              <SageCollapsible
                title={`Lignes produits (${d.items.length})`}
                isOpen={openSections.items}
                onOpenChange={(v) => setOpenSections((p) => ({ ...p, items: v }))}
              >
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-100 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">Produit</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">Qté</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">P.U</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 bg-white">
                      {d.items.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5">
                            <div className="text-xs font-medium text-gray-900">{item.product?.name ?? `#${item.product_id}`}</div>
                            <div className="text-xs text-gray-400">{item.product?.sku}</div>
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs text-gray-700">{item.quantity}</td>
                          <td className="px-3 py-2.5 text-right text-xs text-gray-700">{Number(item.unit_price).toLocaleString()} Dh</td>
                          <td className="px-3 py-2.5 text-right text-xs font-semibold text-gray-900">{Number(item.total_price).toLocaleString()} Dh</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SageCollapsible>
            )}
          </>
        )}

        {/* Orders tab */}
        {activeTab === 'orders' && (
          <SageCollapsible
            title={`Bons de commande (${d.orders?.length ?? 0})`}
            isOpen={openSections.orders}
            onOpenChange={(v) => setOpenSections((p) => ({ ...p, orders: v }))}
          >
            {d.orders && d.orders.length > 0 ? (
              <div className="space-y-2 p-1">
                {d.orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-mono font-semibold text-gray-800 truncate">{order.order_code}</div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">{order.partner?.name}</div>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <div className="text-sm font-bold text-gray-900">{Number(order.total_amount).toLocaleString('fr-MA')} Dh</div>
                      <div className="text-xs text-gray-400 mt-0.5">{order.bc_status}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 p-3">Aucune commande liée</p>
            )}
          </SageCollapsible>
        )}

        {/* BLs tab */}
        {activeTab === 'bls' && (
          <SageCollapsible
            title={`Bons de livraison (${d.delivery_notes?.length ?? 0})`}
            isOpen={openSections.bls}
            onOpenChange={(v) => setOpenSections((p) => ({ ...p, bls: v }))}
          >
            {d.delivery_notes && d.delivery_notes.length > 0 ? (
              <div className="space-y-2 p-1">
                {d.delivery_notes.map((bl) => (
                  <div key={bl.id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-mono font-semibold text-gray-800 truncate">{bl.delivery_number}</div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">{bl.partner?.name}</div>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <div className="text-sm font-bold text-gray-900">{Number(bl.total_amount).toLocaleString('fr-MA')} Dh</div>
                      <div className="text-xs text-gray-400 mt-0.5">{bl.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 p-3">Aucun BL généré pour ce DO</p>
            )}
          </SageCollapsible>
        )}

        {/* Shipments tab */}
        {activeTab === 'shipments' && (
          <SageCollapsible
            title={`Expéditions BCH (${bchs?.length ?? 0})`}
            isOpen={openSections.shipments}
            onOpenChange={(v) => setOpenSections((p) => ({ ...p, shipments: v }))}
          >
            {bchs && bchs.length > 0 ? (
              <div className="space-y-2 p-1">
                {bchs.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-mono font-semibold text-gray-800 truncate">{s.shipment_number}</div>
                      {(s.rider?.name ?? s.livreur?.name) && (
                        <div className="text-xs text-gray-500 mt-0.5">{s.rider?.name ?? s.livreur?.name}</div>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">{s.status}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 p-3">Aucun BCH lié</p>
            )}
          </SageCollapsible>
        )}
      </div>
    </div>
  );
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export const DispatcherDeliveryOrdersPage = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<DeliveryOrder | null>(null);
  const [autoOpenDecision, setAutoOpenDecision] = useState<string | null>(null);

  const handleQuickAction = (row: DeliveryOrder, decision: string) => {
    setSelected(row);
    setAutoOpenDecision(decision);
  };

  const filters = useMemo(() => ({
    status: statusFilter || undefined,
    search: search || undefined,
    page,
  }), [statusFilter, search, page]);

  const { data, loading, error, refetch } = useDispatcherDeliveryOrdersList(filters);
  const dos = data?.data ?? [];
  const total = data?.total ?? 0;

  const columnDefs = useMemo<ColDef[]>(() => [
    {
      field: 'do_number',
      headerName: 'N° DO',
      width: 200,
      cellRenderer: (p: any) => (
        <span className="font-mono text-xs font-semibold text-gray-800">{p.value}</span>
      ),
    },
    {
      field: 'status',
      headerName: 'Statut',
      width: 160,
      cellRenderer: (p: any) => {
        const cfg = DO_STATUS[p.value as DoStatus];
        return cfg ? (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        ) : p.value;
      },
    },
    {
      field: 'delivery_zone',
      headerName: 'Zone',
      width: 130,
      valueFormatter: (p: any) => p.value ?? '—',
    },
    {
      field: 'planned_delivery_date',
      headerName: 'Date prévue',
      width: 120,
      valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString('fr-FR') : '—',
    },
    { field: 'orders_count', headerName: 'BC', width: 65 },
    {
      field: 'total_ordered_amount',
      headerName: 'Montant',
      flex: 1,
      minWidth: 130,
      valueFormatter: (p: any) => p.value ? `${Number(p.value).toLocaleString('fr-MA')} Dh` : '—',
    },
    {
      field: 'driver.name',
      headerName: 'Conducteur',
      width: 130,
      valueFormatter: (p: any) => p.value ?? '—',
    },
    {
      field: 'id',
      headerName: '',
      width: 130,
      sortable: false,
      filter: false,
      floatingFilter: false,
      cellRenderer: (p: any) => {
        const row = p.data as DeliveryOrder;
        const next = STATUS_NEXT_ACTION[row.status as DoStatus];
        if (!next) return null;
        const Icon = next.icon;
        return (
          <button
            onClick={(e) => { e.stopPropagation(); handleQuickAction(row, next.decision); }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            <Icon className="w-3 h-3" />
            {next.label}
          </button>
        );
      },
    },
  ], []);

  return (
    <MasterLayout
      leftContent={
        <div className="h-full flex flex-col bg-white border-r border-gray-100">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-sm font-bold text-gray-900">Delivery Orders</h1>
                <p className="text-xs text-gray-400 mt-0.5">Unités de planification logistique</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="font-semibold text-gray-700">{total}</span> DO(s)
                <button onClick={refetch} className="p-1 rounded hover:bg-gray-100 transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <FileText className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="N° DO, zone…"
                className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-400 bg-gray-50"
              />
            </div>

            {/* Status filter tabs */}
            <div className="flex flex-wrap gap-1">
              {DO_FILTER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setStatusFilter(tab.id); setPage(1); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === tab.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}

          {/* Grid */}
          <div className="flex-1 min-h-0 p-2">
            <div className="bg-white rounded-lg border border-gray-200 h-full">
              {loading ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
                </div>
              ) : (
                <DataGrid
                  rowData={dos}
                  columnDefs={columnDefs}
                  loading={false}
                  onRowSelected={(row: DeliveryOrder) => setSelected(row)}
                />
              )}
            </div>
          </div>

          {/* Pagination */}
          {data && data.last_page && data.last_page > 1 && (
            <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between shrink-0">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                Préc.
              </button>
              <span className="text-xs text-gray-500">Page {page} / {data.last_page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= (data.last_page ?? 1)}
                className="px-3 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                Suiv.
              </button>
            </div>
          )}
        </div>
      }
      mainContent={
        selected ? (
          <DetailPanel
            key={selected.id}
            doItem={selected}
            onClose={() => setSelected(null)}
            onListRefresh={refetch}
            autoOpenDecision={autoOpenDecision}
            onAutoOpened={() => setAutoOpenDecision(null)}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-slate-50">
            <div className="text-center space-y-3">
              <Truck className="w-14 h-14 text-gray-200 mx-auto" />
              <h3 className="text-base font-semibold text-gray-500">Aucun DO sélectionné</h3>
              <p className="text-sm text-gray-400 max-w-xs">
                Les Delivery Orders planifient les livraisons par zone et date, avant la génération des BLs
              </p>
            </div>
          </div>
        )
      }
    />
  );
};
