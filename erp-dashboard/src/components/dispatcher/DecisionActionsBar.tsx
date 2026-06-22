import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Pencil, CheckCircle2, Route, Trash2, Send, X, Truck, User } from 'lucide-react';
import toast from 'react-hot-toast';

import { dispatcherApi } from '@/services/api/dispatcherApi';
import { SearchSelectDropdown } from '@/components/dispatcher/SearchSelectDropdown';
import { CheckboxSearchDropdown, type CheckboxOption } from '@/components/dispatcher/CheckboxSearchDropdown';
import type { DoDecisionItem, DoDecisionsResponse, RiderWithVehicles } from '@/types/dispatcher.types';

const INTENT_STYLE: Record<string, { icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  EDIT:     { icon: Pencil,       cls: 'bg-gray-600 hover:bg-gray-700 text-white' },
  VALIDATE: { icon: CheckCircle2, cls: 'bg-blue-600 hover:bg-blue-700 text-white' },
  DISPATCH: { icon: Route,        cls: 'bg-indigo-600 hover:bg-indigo-700 text-white' },
  DELETE:   { icon: Trash2,       cls: 'bg-white border border-red-200 text-red-600 hover:bg-red-50' },
};
const DEFAULT_INTENT_STYLE = { icon: Send, cls: 'bg-emerald-600 hover:bg-emerald-700 text-white' };

// decision_denied errors come back as { violations: [{ constraint, reason, context }] }, not
// `constraints` — surface each violation's `reason` so the dispatcher sees the actual cause.
const extractErrorMessage = (err: any): string => {
  const violations = err?.response?.data?.violations as
    | Array<{ constraint?: string; reason: string; context?: unknown }>
    | undefined;
  if (violations?.length) return violations.map((v) => v.reason).join(' · ');
  return err?.response?.data?.message ?? "Échec de l'action";
};

// Friendlier labels/icons for known field names — falls back to the backend-provided f.label for
// anything not in this map, so the form stays generic for decisions we haven't special-cased.
const FIELD_META: Record<string, { label: string; icon: React.ReactNode }> = {
  driver_id: { label: 'Livreur', icon: <User size={12} /> },
  rider_id: { label: 'Livreur', icon: <User size={12} /> },
  vehicle_id: { label: 'Véhicule', icon: <Truck size={12} /> },
  add_delivery_note_ids: { label: 'Ajouter des BL', icon: <CheckCircle2 size={12} /> },
  remove_delivery_note_ids: { label: 'Retirer des BL', icon: <Trash2 size={12} /> },
  add_order_ids: { label: 'Ajouter des BC', icon: <CheckCircle2 size={12} /> },
};

// Field names whose value is a number[] multi-select rather than a single scalar — handled
// distinctly in missingRequired/handleSubmit below instead of the generic single-value path.
const MULTI_SELECT_FIELDS = new Set(['add_delivery_note_ids', 'remove_delivery_note_ids', 'add_order_ids']);

// Extra context only the mission-level "Edit Mission" decision needs — the BL add/remove pickers
// can't function without knowing the mission's current BLs (to remove) and branch (to scope which
// draft BLs are eligible to add). Optional so every other decision (BL cancel, etc.) is unaffected.
export interface MissionEditContext {
  branchCode?: string;
  currentBls: CheckboxOption[];
}

const DecisionFormModal = ({
  subjectLabel,
  decisionItem,
  loading,
  onClose,
  onSubmit,
  missionContext,
}: {
  subjectLabel: string;
  decisionItem: DoDecisionItem;
  loading: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, unknown>) => void;
  missionContext?: MissionEditContext;
}) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [multiValues, setMultiValues] = useState<Record<string, number[]>>({});
  const [riders, setRiders] = useState<RiderWithVehicles[]>([]);
  const [availableBls, setAvailableBls] = useState<CheckboxOption[]>([]);
  const [loadingAvailableBls, setLoadingAvailableBls] = useState(false);
  const [availableOrders, setAvailableOrders] = useState<CheckboxOption[]>([]);
  const [loadingAvailableOrders, setLoadingAvailableOrders] = useState(false);

  const driverField = decisionItem.fields.find((f) => f.name === 'driver_id' || f.name === 'rider_id');
  const hasVehicleField = decisionItem.fields.some((f) => f.name === 'vehicle_id');
  const hasAddBlField = decisionItem.fields.some((f) => f.name === 'add_delivery_note_ids');
  const hasAddOrderField = decisionItem.fields.some((f) => f.name === 'add_order_ids');

  // Driver + vehicle come from the same "rider with their assigned vehicle(s)" lookup (docs §12d)
  // — lets the vehicle picker scope itself to whichever driver is selected, instead of listing
  // every active vehicle in the branch regardless of who's actually driving it.
  useEffect(() => {
    if (driverField || hasVehicleField) {
      dispatcherApi.fleet.getRidersWithVehicles({ status: 'active' })
        .then((res) => setRiders(Array.isArray(res) ? res : []))
        .catch(() => setRiders([]));
    }
  }, [decisionItem]);

  // Eligible BLs to attach — must be draft and not already on a mission (docs §8.6); scoped to
  // the mission's own branch when known, since cross-branch attachment isn't valid either way.
  useEffect(() => {
    if (!hasAddBlField) return;
    setLoadingAvailableBls(true);
    dispatcherApi.bonLivraisons.getList({ status: 'draft', per_page: 200 })
      .then((res) => {
        const opts = (res.data ?? [])
          .filter((bl) => bl.delivery_mission_id == null && (!missionContext?.branchCode || bl.branch_code === missionContext.branchCode))
          .map((bl) => ({ id: bl.id, label: `${bl.delivery_number} — ${bl.partner?.name ?? ''}` }));
        setAvailableBls(opts);
      })
      .catch(() => setAvailableBls([]))
      .finally(() => setLoadingAvailableBls(false));
  }, [decisionItem]);

  // Eligible BCs to attach — confirmed, not yet converted to a BL, same branch as the mission
  // (backend 2026-06-22: new add_order_ids field on update_delivery_mission). Reuses the same
  // orders/pending pool the mission workspace's BC selector already pulls from.
  useEffect(() => {
    if (!hasAddOrderField) return;
    setLoadingAvailableOrders(true);
    // No client-side branch filter here — confirmed live that `orders/pending` doesn't carry a
    // top-level `branch_code` (only `branch_id`, a numeric FK with no client-side mapping to the
    // mission's string `branch_code`), so comparing the two silently excluded every order. Branch
    // eligibility is enforced server-side anyway (422 mixed_branches on submit), so just list
    // every confirmed pending order and let that be the real check.
    dispatcherApi.orders.getPending({ per_page: 200 })
      .then((res) => {
        const opts = (res.data ?? []).map((o) => ({ id: o.id, label: `${o.order_code} — ${o.partner?.name ?? ''}` }));
        setAvailableOrders(opts);
      })
      .catch(() => setAvailableOrders([]))
      .finally(() => setLoadingAvailableOrders(false));
  }, [decisionItem]);

  const style = INTENT_STYLE[decisionItem.intent ?? ''] ?? DEFAULT_INTENT_STYLE;
  const Icon = decisionItem.danger ? Trash2 : style.icon;
  const setField = (name: string, v: string) => setValues((p) => ({ ...p, [name]: v }));
  const setMultiField = (name: string, ids: number[]) => setMultiValues((p) => ({ ...p, [name]: ids }));

  const selectedRiderId = driverField ? (values[driverField.name] ? Number(values[driverField.name]) : '') : '';
  const selectedRider = riders.find((r) => r.id === selectedRiderId);
  const vehicleOptions = useMemo(() => {
    if (selectedRider) {
      return selectedRider.vehicles.map((v) => ({
        id: v.id,
        label: v.display_name ?? v.plate_number ?? v.plate ?? `#${v.id}`,
        sublabel: [v.make, v.model].filter(Boolean).join(' ') || undefined,
      }));
    }
    // No driver field on this decision (or none chosen yet) — fall back to every active rider's
    // vehicle, tagged with that rider's name so it's still clear who currently has it.
    return riders.flatMap((r) =>
      r.vehicles.map((v) => ({
        id: v.id,
        label: v.display_name ?? v.plate_number ?? v.plate ?? `#${v.id}`,
        sublabel: r.name,
      }))
    );
  }, [riders, selectedRider]);

  // If the driver changes to someone who doesn't have the currently-picked vehicle, clear it
  // rather than silently submitting a vehicle/driver pair that don't belong together.
  useEffect(() => {
    if (!driverField || !hasVehicleField) return;
    const vehicleFieldName = decisionItem.fields.find((f) => f.name === 'vehicle_id')?.name;
    if (!vehicleFieldName) return;
    const current = values[vehicleFieldName] ? Number(values[vehicleFieldName]) : null;
    if (current != null && !vehicleOptions.some((v) => v.id === current)) {
      setField(vehicleFieldName, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRiderId]);

  const missingRequired = decisionItem.fields.some((f) => {
    if (!f.required) return false;
    if (MULTI_SELECT_FIELDS.has(f.name)) {
      return !(multiValues[f.name]?.length);
    }
    return !values[f.name];
  });

  const handleSubmit = () => {
    const payload: Record<string, unknown> = {};
    for (const f of decisionItem.fields) {
      if (MULTI_SELECT_FIELDS.has(f.name)) {
        const arr = multiValues[f.name];
        if (arr?.length) payload[f.name] = arr;
        continue;
      }
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
              <p className="text-xs text-gray-400 truncate">{subjectLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {decisionItem.description && <p className="text-xs text-gray-500">{decisionItem.description}</p>}

          {decisionItem.danger && (
            <div className="flex items-start gap-1.5 p-2.5 rounded-lg bg-red-50 text-xs text-red-700">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Cette action est irréversible.
            </div>
          )}

          {decisionItem.fields.map((f) => {
            const meta = FIELD_META[f.name];
            const label = meta?.label ?? f.label;

            if (f.name === 'driver_id' || f.name === 'rider_id') {
              return (
                <SearchSelectDropdown
                  key={f.name}
                  label={label + (f.required ? ' *' : '')}
                  icon={meta?.icon}
                  options={riders.map((r) => ({
                    id: r.id,
                    label: r.name,
                    sublabel: r.vehicles.length === 0 ? 'Sans véhicule' : r.vehicles.length > 1 ? `${r.vehicles.length} véhicules` : (r.vehicles[0].display_name ?? r.vehicles[0].plate_number),
                  }))}
                  value={values[f.name] ? Number(values[f.name]) : ''}
                  onChange={(id) => setField(f.name, id === '' ? '' : String(id))}
                />
              );
            }

            if (f.name === 'vehicle_id') {
              return (
                <SearchSelectDropdown
                  key={f.name}
                  label={label + (f.required ? ' *' : '')}
                  icon={meta?.icon}
                  options={vehicleOptions}
                  value={values[f.name] ? Number(values[f.name]) : ''}
                  onChange={(id) => setField(f.name, id === '' ? '' : String(id))}
                  placeholder={selectedRider ? 'Sélectionner…' : driverField ? 'Choisissez un livreur d\'abord' : 'Sélectionner…'}
                  disabled={!!driverField && !selectedRider}
                />
              );
            }

            if (f.name === 'add_delivery_note_ids') {
              return (
                <div key={f.name}>
                  <CheckboxSearchDropdown
                    label={label + (f.required ? ' *' : '')}
                    icon={meta?.icon}
                    options={availableBls}
                    selected={multiValues[f.name] ?? []}
                    onChange={(ids) => setMultiField(f.name, ids)}
                    emptyLabel={loadingAvailableBls ? 'Chargement…' : 'Aucun'}
                    noResultsLabel={
                      loadingAvailableBls
                        ? 'Chargement…'
                        : "Aucun BL brouillon disponible — un BL n'existe en dehors d'une mission que s'il en a été retiré (« Retirer des BL »)."
                    }
                  />
                  <p className="text-[10px] text-gray-400 mt-1">BL brouillon, même branche, pas encore en mission.</p>
                </div>
              );
            }

            if (f.name === 'add_order_ids') {
              return (
                <div key={f.name}>
                  <CheckboxSearchDropdown
                    label={label + (f.required ? ' *' : '')}
                    icon={meta?.icon}
                    options={availableOrders}
                    selected={multiValues[f.name] ?? []}
                    onChange={(ids) => setMultiField(f.name, ids)}
                    emptyLabel={loadingAvailableOrders ? 'Chargement…' : 'Aucun'}
                    noResultsLabel={loadingAvailableOrders ? 'Chargement…' : 'Aucune BC confirmée disponible.'}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    BC confirmée, pas encore convertie en BL. Sera fusionnée dans le BL existant du
                    partenaire si la mission en a déjà un, sinon un nouveau BL est créé. Une BC d'une
                    autre branche sera refusée à la confirmation.
                  </p>
                </div>
              );
            }

            if (f.name === 'remove_delivery_note_ids') {
              return (
                <CheckboxSearchDropdown
                  key={f.name}
                  label={label + (f.required ? ' *' : '')}
                  icon={meta?.icon}
                  options={missionContext?.currentBls ?? []}
                  selected={multiValues[f.name] ?? []}
                  onChange={(ids) => setMultiField(f.name, ids)}
                  emptyLabel="Aucun"
                  noResultsLabel="Cette mission n'a aucun BL à retirer."
                />
              );
            }

            return (
              <div key={f.name}>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  {label} {f.required && <span className="text-red-500">*</span>}
                </label>
                {f.type === 'textarea' ? (
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
            );
          })}

          {decisionItem.fields.length === 0 && <p className="text-sm text-gray-500">Confirmer cette action ?</p>}
        </div>

        <div className="flex items-center gap-3 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
          >
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

export type DecisionExecutor = (id: number, decision: string, extra?: Record<string, unknown>) => Promise<{ success: boolean; message: string; output?: unknown }>;
export type DecisionsFetcher = (id: number) => Promise<DoDecisionsResponse>;

/**
 * Model-agnostic "available decisions" action bar — fetches the live decision list for a
 * subject (DO / LOT / BCH / BL) from the workflow engine and renders one button per decision,
 * opening the same dynamic field-driven confirmation modal used elsewhere in the app (docs §16).
 */
export const DecisionActionsBar = ({
  subjectId,
  subjectLabel,
  fetchDecisions,
  executeDecision,
  onActionDone,
  compact = false,
  missionContext,
}: {
  subjectId: number;
  subjectLabel: string;
  fetchDecisions: DecisionsFetcher;
  executeDecision: DecisionExecutor;
  onActionDone: () => void;
  compact?: boolean;
  missionContext?: MissionEditContext;
}) => {
  const [decisions, setDecisions] = useState<DoDecisionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [activeDecision, setActiveDecision] = useState<DoDecisionItem | null>(null);

  const refetch = () => {
    setLoading(true);
    fetchDecisions(subjectId)
      .then((res) => setDecisions(res.decisions ?? []))
      .catch(() => setDecisions([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refetch(); }, [subjectId]);

  const run = async (decision: string, extra?: Record<string, unknown>) => {
    setExecuting(true);
    try {
      const res = await executeDecision(subjectId, decision, extra);
      if (res.success) {
        // validate_delivery_order's allocation can legitimately come back partial (shortage on
        // some lines) — docs §2/§9 are explicit this is a normal outcome, not an error, and must
        // be shown clearly rather than as a generic green "success" toast. Checked generically on
        // `output.status` rather than hardcoded to this one decision, since other decisions may
        // return the same shape in the future.
        const outputStatus = (res.output as { status?: string } | undefined)?.status;
        if (outputStatus === 'partially_allocated') {
          const rate = (res.output as { allocation_rate?: number } | undefined)?.allocation_rate;
          toast(
            `Allocation partielle${rate != null ? ` (${rate}% couvert)` : ''} — rupture sur certaines lignes, ce n'est pas une erreur.`,
            { icon: '⚠️', duration: 7000 }
          );
        } else {
          toast.success(res.message || 'Action effectuée');
          // add_order_ids (2026-06-22) — each attached BC either merges into the partner's
          // existing draft BL on this mission or spawns a new one; surface which happened so the
          // dispatcher knows whether to expect a new BL row or an updated quantity on one already
          // on screen.
          const addedFromOrders = (res.output as { added_from_orders?: Array<{ merged_into_existing?: boolean }> } | undefined)?.added_from_orders;
          if (addedFromOrders?.length) {
            const mergedCount = addedFromOrders.filter((x) => x.merged_into_existing).length;
            const newCount = addedFromOrders.length - mergedCount;
            const parts = [];
            if (newCount > 0) parts.push(`${newCount} nouveau(x) BL`);
            if (mergedCount > 0) parts.push(`${mergedCount} fusionnée(s) dans un BL existant`);
            toast(`BC attachées — ${parts.join(', ')}.`, { icon: 'ℹ️', duration: 6000 });
          }
          // confirm_delivery_mission (2026-06-22) replaces the old allocate_delivery_note +
          // generate_preparation_for_mission pair — one atomic call that reserves stock for every
          // BL (shortage-tolerant, same semantics the old allocate had) and generates the BP.
          // Surface both halves so the dispatcher sees exactly what happened, not just "success".
          const allocations = (res.output as { allocations?: Array<{ delivery_number: string; backlog_orders_count?: number }> } | undefined)?.allocations;
          const preparation = (res.output as { preparation?: { bp_number?: string } } | undefined)?.preparation;
          if (allocations?.length) {
            const withBacklog = allocations.filter((a) => (a.backlog_orders_count ?? 0) > 0);
            const summary = withBacklog.length > 0
              ? `${allocations.length} BL alloué(s), ${withBacklog.length} avec rupture (backlog créé)`
              : `${allocations.length} BL alloué(s) intégralement`;
            toast(
              preparation?.bp_number ? `${summary} — BP ${preparation.bp_number} généré.` : summary,
              { icon: withBacklog.length > 0 ? '⚠️' : 'ℹ️', duration: 7000 }
            );
          }
        }
        onActionDone();
        // Terminal decisions (cancel/complete) put the subject in a state the workflow engine no
        // longer resolves decisions for — re-querying after one of these 404s (confirmed live on
        // cancel_delivery_mission). Skip the refetch instead of firing a request we know will
        // fail; there are no further decisions possible from a terminal state anyway.
        const isTerminal = /^(cancel|complete)_/.test(decision);
        if (isTerminal) {
          setDecisions([]);
        } else {
          refetch();
        }
      } else {
        toast.error(res.message || 'Action refusée');
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
        <Loader2 className="w-3 h-3 animate-spin" /> Actions…
      </div>
    );
  }

  if (decisions.length === 0) return null;

  return (
    <>
      <div className={`flex flex-wrap items-center gap-1.5 ${compact ? '' : 'gap-2'}`}>
        {decisions.map((d) => {
          const style = INTENT_STYLE[d.intent ?? ''] ?? DEFAULT_INTENT_STYLE;
          const Icon = d.danger ? Trash2 : style.icon;
          const cls = d.danger ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50' : style.cls;
          return (
            <button
              key={d.decision}
              disabled={executing}
              onClick={(e) => { e.stopPropagation(); setActiveDecision(d); }}
              title={d.description}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${cls}`}
            >
              <Icon className="w-3 h-3" />
              {d.label}
            </button>
          );
        })}
      </div>

      {activeDecision && (
        <DecisionFormModal
          subjectLabel={subjectLabel}
          decisionItem={activeDecision}
          loading={executing}
          onClose={() => setActiveDecision(null)}
          missionContext={missionContext}
          onSubmit={async (vals) => {
            await run(activeDecision.decision, Object.keys(vals).length ? vals : undefined);
            setActiveDecision(null);
          }}
        />
      )}
    </>
  );
};

export default DecisionActionsBar;
