import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Pencil, CheckCircle2, Route, Trash2, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { dispatcherApi } from '@/services/api/dispatcherApi';
import type { DoDecisionItem, DoDecisionsResponse, Rider, Vehicle } from '@/types/dispatcher.types';

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

const DecisionFormModal = ({
  subjectLabel,
  decisionItem,
  loading,
  onClose,
  onSubmit,
}: {
  subjectLabel: string;
  decisionItem: DoDecisionItem;
  loading: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, unknown>) => void;
}) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [riders, setRiders] = useState<Rider[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    if (decisionItem.fields.some((f) => f.name === 'driver_id' || f.name === 'rider_id')) {
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
              <p className="text-xs text-gray-400 truncate">{subjectLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {decisionItem.description && <p className="text-xs text-gray-500">{decisionItem.description}</p>}

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
              {f.name === 'driver_id' || f.name === 'rider_id' ? (
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

export type DecisionExecutor = (id: number, decision: string, extra?: Record<string, unknown>) => Promise<{ success: boolean; message: string }>;
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
}: {
  subjectId: number;
  subjectLabel: string;
  fetchDecisions: DecisionsFetcher;
  executeDecision: DecisionExecutor;
  onActionDone: () => void;
  compact?: boolean;
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
        toast.success(res.message || 'Action effectuée');
        onActionDone();
        refetch();
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
