import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Pencil, CheckCircle2, Route, Trash2, Send, X, Truck, User, Package, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

import { dispatcherApi } from '@/services/api/dispatcherApi';
import { SearchSelectDropdown } from '@/components/dispatcher/SearchSelectDropdown';
import { CheckboxSearchDropdown, type CheckboxOption } from '@/components/dispatcher/CheckboxSearchDropdown';
import type { DoDecisionItem, DoDecisionsResponse, RiderWithVehicles } from '@/types/dispatcher.types';

const INTENT_STYLE: Record<string, { icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  EDIT:     { icon: Pencil,       cls: 'bg-gray-600 hover:bg-gray-700 text-white' },
  VALIDATE: { icon: CheckCircle2, cls: 'bg-sage-500 hover:bg-sage-600 text-white' },
  DISPATCH: { icon: Route,        cls: 'bg-sage-600 hover:bg-sage-700 text-white' },
  DELETE:   { icon: Trash2,       cls: 'bg-white border border-red-200 text-red-600 hover:bg-red-50' },
};
const DEFAULT_INTENT_STYLE = { icon: Send, cls: 'bg-emerald-600 hover:bg-emerald-700 text-white' };

// decision_denied errors come back as { violations: [{ constraint, reason, context }] }, not
// `constraints` — surface each violation's `reason` so the dispatcher sees the actual cause.
//
// Delivery-mission decisions (docs §8.1-8.7) are the exception — their 422 `message` is a terse
// machine code (`mission_not_draft`, `bp_already_finalized`, ...), not a human sentence like
// every other module's `violations[].reason`. Mapped here so the dispatcher never sees a raw
// snake_case string. `bp_already_finalized` specifically: docs §8.6 explicitly calls out "do not
// silently retry this error" — it means the magasinier finished/rejected the BP in the race
// window between the dispatcher opening "Modifier la préparation" and submitting it.
const KNOWN_ERROR_CODES: Record<string, string> = {
  mission_not_draft: "Cette mission n'est plus en brouillon — un autre utilisateur l'a peut-être déjà modifiée. Rafraîchissez.",
  invalid_status: "Cette action n'est plus disponible pour le statut actuel de la mission — rafraîchissez pour voir l'état réel.",
  no_draft_bls: 'Aucun BL en brouillon sur cette mission.',
  driver_not_found: 'Livreur introuvable.',
  vehicle_not_found: 'Véhicule introuvable.',
  orders_not_in_mission: "Une des BC sélectionnées n'est plus rattachée à cette mission.",
  order_not_confirmed: "Une des BC sélectionnées n'est pas (ou plus) confirmée.",
  mixed_branches: "Les BC sélectionnées n'appartiennent pas toutes à la même branche que la mission.",
  no_preparation_order: 'Aucun bon de préparation associé à cette mission.',
  bp_already_finalized: 'Le magasinier a déjà finalisé ou rejeté la préparation entre-temps — impossible de rouvrir la mission. Rafraîchissez pour voir l\'état réel.',
  reason_required: 'Une raison est requise pour cette action.',
  // reassign_delivery_mission errors (docs §8.x, 2026-06-25)
  mission_not_ready: "La mission n'est pas en état Prêt — rafraîchissez.",
  transfer_already_accepted: "Le livreur a déjà accepté le chargement — contactez le magasin.",
  rider_not_driver: "L'utilisateur sélectionné n'a pas le rôle livreur.",
  same_rider: "Même livreur que l'actuel — choisissez un autre.",
};

const extractErrorMessage = (err: any): string => {
  const violations = err?.response?.data?.violations as
    | Array<{ constraint?: string; reason: string; context?: unknown }>
    | undefined;
  if (violations?.length) return violations.map((v) => v.reason).join(' · ');
  const raw = err?.response?.data?.message as string | undefined;
  if (raw && KNOWN_ERROR_CODES[raw]) return KNOWN_ERROR_CODES[raw];
  return raw ?? "Échec de l'action";
};

const RICH_TOAST_TONE = {
  success: { bg: 'bg-emerald-100', text: 'text-emerald-600', Icon: CheckCircle2 },
  warning: { bg: 'bg-amber-100', text: 'text-amber-600', Icon: AlertTriangle },
  info: { bg: 'bg-sage-100', text: 'text-sage-600', Icon: Package },
} as const;

// Replaces the plain `toast(text, { icon: 'ℹ️' })` one-liners with a proper card (icon badge,
// title, optional subtitle) for outcomes worth more than a generic green/gray bar — e.g. mission
// allocation results where the dispatcher needs to see the BP number, not just "Action effectuée".
const showRichToast = (opts: {
  tone: keyof typeof RICH_TOAST_TONE;
  title: string;
  subtitle?: React.ReactNode;
  duration?: number;
}) => {
  const { bg, text, Icon } = RICH_TOAST_TONE[opts.tone];
  toast.custom(
    (t) => (
      <div
        className={`max-w-sm w-full bg-white shadow-lg ring-1 ring-black/5 rounded-xl pointer-events-auto flex items-start gap-3 p-3.5 transition-all ${
          t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
        }`}
      >
        <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${bg} ${text}`}>
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-semibold text-gray-900 leading-snug">{opts.title}</p>
          {opts.subtitle && <div className="text-xs text-gray-500 mt-1">{opts.subtitle}</div>}
        </div>
        <button onClick={() => toast.dismiss(t.id)} className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors">
          <X size={14} />
        </button>
      </div>
    ),
    { duration: opts.duration ?? 6000 }
  );
};

// Friendlier labels/icons for known field names — falls back to the backend-provided f.label for
// anything not in this map, so the form stays generic for decisions we haven't special-cased.
const FIELD_META: Record<string, { label: string; icon: React.ReactNode }> = {
  driver_id: { label: 'Livreur', icon: <User size={12} /> },
  rider_id: { label: 'Livreur', icon: <User size={12} /> },
  new_rider_id: { label: 'Nouveau livreur', icon: <User size={12} /> },
  vehicle_id: { label: 'Véhicule', icon: <Truck size={12} /> },
  new_vehicle_id: { label: 'Nouveau véhicule', icon: <Truck size={12} /> },
  add_delivery_note_ids: { label: 'Ajouter des BL', icon: <CheckCircle2 size={12} /> },
  remove_delivery_note_ids: { label: 'Retirer des BL', icon: <Trash2 size={12} /> },
  add_order_ids: { label: 'Ajouter des BC', icon: <CheckCircle2 size={12} /> },
  remove_order_ids: { label: 'Retirer des BC', icon: <Trash2 size={12} /> },
  // accept_partial_preparation's soft-limit override (docs §10): shortage % > 20, valeur > 500,
  // ou ligne critique — sans ça la décision est refusée (violations[].reason le précise).
  force_accept: { label: "Forcer l'acceptation (dépasse les seuils habituels)", icon: <AlertCircle size={12} /> },
};

// Field names whose value is a number[] multi-select rather than a single scalar — handled
// distinctly in missingRequired/handleSubmit below instead of the generic single-value path.
const MULTI_SELECT_FIELDS = new Set(['add_delivery_note_ids', 'remove_delivery_note_ids', 'add_order_ids', 'remove_order_ids']);

// Extra context only the mission-level "Edit Mission" decision needs — the BL add/remove pickers
// can't function without knowing the mission's current BLs (to remove) and branch (to scope which
// draft BLs are eligible to add). Optional so every other decision (BL cancel, etc.) is unaffected.
// Steps shown inside the modal while the API call is in-flight (purely cosmetic simulation —
// the backend executes all steps atomically; this gives the dispatcher transparency instead of
// a black-box spinner on heavy rollback/cascade transactions).
const DECISION_STEPS: Record<string, string[]> = {
  reassign_delivery_mission: [
    'Vérification des verrous de sécurité et lock de la mission…',
    "Annulation du transfert de stock (WT) de l'ancien véhicule…",
    'Bascule du contexte livreur sur la mission et cascade sur les BLs…',
    'Génération du nouveau transfert de stock vers le nouveau van…',
  ],
  cancel_delivery_mission: [
    'Révocation du transfert de stock en attente…',
    'Annulation du Bon de Préparation (BP) et libération des réservations de stock…',
    'Suppression logique (Soft-delete) des Bons de Livraison (BLs)…',
    "Restauration des Bons de Commande (BCs) d'origine dans le backlog…",
  ],
};

export interface MissionEditContext {
  branchCode?: string;
  currentBls: CheckboxOption[];
  currentOrders?: CheckboxOption[];
  currentRiderId?: number;
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
  const [boolValues, setBoolValues] = useState<Record<string, boolean>>({});

  // Step-by-step progress stepper for heavy cascade decisions.
  // stepIdx === -1 → not running; 0..n-1 → at that step; n → all done (brief flash before close).
  const steps = DECISION_STEPS[decisionItem.decision];
  const [stepIdx, setStepIdx] = useState(-1);
  const isStepperActive = steps != null && stepIdx >= 0;
  const isAllDone = steps != null && stepIdx >= steps.length;

  useEffect(() => {
    if (!steps) { setStepIdx(-1); return; }
    if (!loading) {
      // API returned — snap to "all done" if stepper was running, otherwise stay idle.
      setStepIdx((p) => (p >= 0 ? steps.length : -1));
      return;
    }
    setStepIdx(0);
    let cur = 0;
    const id = setInterval(() => {
      cur++;
      setStepIdx(Math.min(cur, steps.length - 1));
      if (cur >= steps.length - 1) clearInterval(id);
    }, 650);
    return () => clearInterval(id);
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const [riders, setRiders] = useState<RiderWithVehicles[]>([]);
  const [loadingRiders, setLoadingRiders] = useState(false);
  const [availableBls, setAvailableBls] = useState<CheckboxOption[]>([]);
  const [loadingAvailableBls, setLoadingAvailableBls] = useState(false);
  const [availableOrders, setAvailableOrders] = useState<CheckboxOption[]>([]);
  const [loadingAvailableOrders, setLoadingAvailableOrders] = useState(false);

  const DRIVER_FIELD_NAMES = new Set(['driver_id', 'rider_id', 'new_rider_id']);
  const VEHICLE_FIELD_NAMES = new Set(['vehicle_id', 'new_vehicle_id']);
  const driverField = decisionItem.fields.find((f) => DRIVER_FIELD_NAMES.has(f.name));
  const hasVehicleField = decisionItem.fields.some((f) => VEHICLE_FIELD_NAMES.has(f.name));
  const hasAddBlField = decisionItem.fields.some((f) => f.name === 'add_delivery_note_ids');
  const hasAddOrderField = decisionItem.fields.some((f) => f.name === 'add_order_ids');

  // Driver + vehicle come from the same "rider with their assigned vehicle(s)" lookup (docs §12d).
  // For reassign_delivery_mission (new_rider_id field), the current rider is excluded from the
  // list — no point offering a "reassign to the same person" option.
  useEffect(() => {
    if (!driverField && !hasVehicleField) return;
    setLoadingRiders(true);
    dispatcherApi.fleet.getRidersWithVehicles({ status: 'active' })
      .then((res) => {
        const all = Array.isArray(res) ? res : [];
        const isReassign = decisionItem.fields.some((f) => f.name === 'new_rider_id');
        setRiders(
          isReassign && missionContext?.currentRiderId
            ? all.filter((r) => r.id !== missionContext.currentRiderId)
            : all
        );
      })
      .catch(() => setRiders([]))
      .finally(() => setLoadingRiders(false));
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

  // If the driver changes to someone who doesn't have the currently-picked vehicle, clear it.
  // If the new driver has exactly one vehicle, auto-select it so the dispatcher doesn't need
  // to pick it manually (the common case for reassign_delivery_mission).
  useEffect(() => {
    if (!driverField || !hasVehicleField) return;
    const vehicleFieldName = decisionItem.fields.find((f) => VEHICLE_FIELD_NAMES.has(f.name))?.name;
    if (!vehicleFieldName) return;
    const current = values[vehicleFieldName] ? Number(values[vehicleFieldName]) : null;
    if (current != null && !vehicleOptions.some((v) => v.id === current)) {
      setField(vehicleFieldName, '');
    }
    if (vehicleOptions.length === 1) {
      setField(vehicleFieldName, String(vehicleOptions[0].id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRiderId]);

  const missingRequired = decisionItem.fields.some((f) => {
    if (!f.required) return false;
    if (f.type === 'boolean') return false; // unchecked (false) is a valid value, never "missing"
    if (MULTI_SELECT_FIELDS.has(f.name)) {
      return !(multiValues[f.name]?.length);
    }
    return !values[f.name];
  });

  const handleSubmit = () => {
    const payload: Record<string, unknown> = {};
    for (const f of decisionItem.fields) {
      if (f.type === 'boolean') {
        // Only send when explicitly toggled — most boolean fields (e.g. force_accept) are
        // soft-limit overrides the backend defaults to false; omitting it when untouched keeps
        // the payload minimal and avoids implying an explicit "false" was chosen.
        if (boolValues[f.name]) payload[f.name] = true;
        continue;
      }
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

        {/* ── Step-by-step progress stepper (replaces form body while in-flight) ── */}
        {isStepperActive ? (
          <div className="px-5 py-6 space-y-3">
            {steps.map((step, idx) => {
              const done = isAllDone || idx < stepIdx;
              const active = !isAllDone && idx === stepIdx;
              return (
                <div
                  key={idx}
                  className={`flex items-start gap-3 transition-all duration-300 ${!done && !active ? 'opacity-35' : ''}`}
                >
                  <div className="shrink-0 w-5 h-5 mt-0.5 flex items-center justify-center">
                    {done
                      ? <CheckCircle2 size={18} className="text-emerald-500" />
                      : active
                      ? <Loader2 size={18} className="animate-spin text-sage-500" />
                      : <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 block" />
                    }
                  </div>
                  <p className={`text-xs leading-snug mt-0.5 ${done ? 'text-emerald-600' : active ? 'text-gray-900' : 'text-gray-400'}`}>
                    <span className={`font-bold mr-1 ${done ? 'text-emerald-500' : active ? 'text-sage-600' : 'text-gray-400'}`}>
                      Étape {idx + 1} :
                    </span>
                    <span className={active ? 'font-medium' : ''}>{step}</span>
                  </p>
                </div>
              );
            })}
            <div className="mt-3 h-1 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${isAllDone ? 'bg-emerald-500' : 'bg-sage-500'}`}
                style={{ width: `${isAllDone ? 100 : ((stepIdx + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>
        ) : (

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

            if (DRIVER_FIELD_NAMES.has(f.name)) {
              return (
                <div key={f.name}>
                  <SearchSelectDropdown
                    label={label + (f.required ? ' *' : '')}
                    icon={loadingRiders ? <Loader2 size={12} className="animate-spin" /> : meta?.icon}
                    options={riders.map((r) => ({
                      id: r.id,
                      label: r.name,
                      sublabel: r.vehicles.length === 0 ? 'Sans véhicule' : r.vehicles.length > 1 ? `${r.vehicles.length} véhicules` : (r.vehicles[0].display_name ?? r.vehicles[0].plate_number),
                    }))}
                    value={values[f.name] ? Number(values[f.name]) : ''}
                    onChange={(id) => setField(f.name, id === '' ? '' : String(id))}
                    placeholder={loadingRiders ? 'Chargement…' : 'Sélectionner…'}
                    disabled={loadingRiders}
                  />
                </div>
              );
            }

            if (VEHICLE_FIELD_NAMES.has(f.name)) {
              return (
                <SearchSelectDropdown
                  key={f.name}
                  label={label + (f.required ? ' *' : '')}
                  icon={meta?.icon}
                  options={vehicleOptions}
                  value={values[f.name] ? Number(values[f.name]) : ''}
                  onChange={(id) => setField(f.name, id === '' ? '' : String(id))}
                  placeholder={selectedRider ? 'Sélectionner…' : driverField ? "Choisissez un livreur d'abord" : 'Sélectionner…'}
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

            if (f.name === 'remove_order_ids') {
              return (
                <CheckboxSearchDropdown
                  key={f.name}
                  label={label + (f.required ? ' *' : '')}
                  icon={meta?.icon}
                  options={missionContext?.currentOrders ?? []}
                  selected={multiValues[f.name] ?? []}
                  onChange={(ids) => setMultiField(f.name, ids)}
                  emptyLabel="Aucun"
                  noResultsLabel="Cette mission n'a aucune BC à retirer."
                />
              );
            }

            if (f.type === 'boolean') {
              return (
                <label key={f.name} className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={boolValues[f.name] ?? false}
                    onChange={(e) => setBoolValues((p) => ({ ...p, [f.name]: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-sage-600 focus:ring-sage-500/30"
                  />
                  <span className="text-xs text-gray-700">{label}</span>
                </label>
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
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-sage-500/30 outline-none resize-none"
                  />
                ) : (
                  <input
                    type={f.type}
                    value={values[f.name] ?? ''}
                    onChange={(e) => setField(f.name, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-sage-500/30 outline-none"
                  />
                )}
              </div>
            );
          })}

          {decisionItem.fields.length === 0 && <p className="text-sm text-gray-500">Confirmer cette action ?</p>}
        </div>

        )} {/* end stepper/form conditional */}

        {!isStepperActive && (
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
        )}
      </div>
    </div>
  );
};

export type DecisionExecutor = (id: number, decision: string, extra?: Record<string, unknown>) => Promise<{ success: boolean; message: string; output?: unknown }>;
export type DecisionsFetcher = (id: number) => Promise<{ decisions: DoDecisionItem[] }>;

/**
 * Model-agnostic "available decisions" action bar — fetches the live decision list for a
 * subject (DO / LOT / BCH / BL) from the workflow engine and renders one button per decision,
 * opening the same dynamic field-driven confirmation modal used elsewhere in the app (docs §16).
 */
export const DecisionActionsBar = ({
  subjectId,
  subjectLabel,
  fetchDecisions,
  decisions: passedDecisions,
  executeDecision,
  onActionDone,
  compact = false,
  missionContext,
  customDecisionHandlers,
}: {
  subjectId: number;
  subjectLabel: string;
  fetchDecisions?: DecisionsFetcher;
  decisions?: DoDecisionItem[];
  executeDecision: DecisionExecutor;
  onActionDone: () => void;
  compact?: boolean;
  missionContext?: MissionEditContext;
  // Opt-in escape hatch: when a decision's key has an entry here, clicking its button calls this
  // handler instead of opening the generic field-driven DecisionFormModal — for decisions whose
  // real-world UX needs more than text/number/boolean fields (e.g. accept_partial_preparation's
  // per-BL quantity allocation table, which no generic field type covers). Everything else still
  // goes through the normal dynamic flow; this only opts out specific, named decisions.
  customDecisionHandlers?: Record<string, () => void>;
}) => {
  const [fetchedDecisions, setFetchedDecisions] = useState<DoDecisionItem[]>([]);
  const [loading, setLoading] = useState(!!fetchDecisions && !passedDecisions);
  const [executing, setExecuting] = useState(false);
  const [activeDecision, setActiveDecision] = useState<DoDecisionItem | null>(null);

  const decisions = passedDecisions ?? fetchedDecisions;

  const refetch = () => {
    if (!fetchDecisions) return;
    setLoading(true);
    fetchDecisions(subjectId)
      .then((res) => setFetchedDecisions(res.decisions ?? []))
      .catch(() => setFetchedDecisions([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refetch(); }, [subjectId, fetchDecisions]);

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
            showRichToast({
              tone: withBacklog.length > 0 ? 'warning' : 'success',
              title: summary,
              subtitle: preparation?.bp_number ? (
                <span className="inline-flex items-center gap-1">
                  <Package size={11} className="shrink-0" />
                  BP <span className="font-mono font-medium text-gray-700">{preparation.bp_number}</span> généré
                </span>
              ) : undefined,
              duration: 7000,
            });
          }
          // accept_partial_preparation (docs §10, fixed 2026-06-23) auto-chains a backlog BC split
          // for the shortage quantity — the dispatcher needs to know this happened and how many
          // backlog orders landed back in /orders/pending, not just "rupture acceptée".
          const backlog = (res.output as { backlog?: { backlog_orders_count?: number; total_shortage_released?: number } } | undefined)?.backlog;
          if (backlog?.backlog_orders_count) {
            toast(
              `${backlog.backlog_orders_count} BC backlog créée(s) pour le reliquat (${backlog.total_shortage_released ?? '?'} unité(s)).`,
              { icon: '📦', duration: 7000 }
            );
          }
          // reassign_delivery_mission — show new WT number + BL update count
          const newWt = (res.output as { new_wt?: { number?: string }; bls_updated?: number } | undefined);
          if (newWt?.new_wt?.number) {
            showRichToast({
              tone: 'success',
              title: `Mission réassignée — ${newWt.bls_updated ?? 0} BL mis à jour`,
              subtitle: (
                <span className="inline-flex items-center gap-1">
                  <Truck size={11} className="shrink-0" />
                  Nouveau transfert <span className="font-mono font-medium text-gray-700">{newWt.new_wt.number}</span>
                </span>
              ),
              duration: 7000,
            });
          }
        }
        onActionDone();
        // Terminal decisions (cancel/complete) put the subject in a state the workflow engine no
        // longer resolves decisions for — re-querying after one of these 404s (confirmed live on
        // cancel_delivery_mission). Skip the refetch instead of firing a request we know will
        // fail; there are no further decisions possible from a terminal state anyway.
        const isTerminal = /^(cancel|complete)_/.test(decision);
        if (isTerminal) {
          if (!passedDecisions) setFetchedDecisions([]);
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
              onClick={(e) => {
                e.stopPropagation();
                const custom = customDecisionHandlers?.[d.decision];
                if (custom) custom(); else setActiveDecision(d);
              }}
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
            // Hold the modal open briefly so the "all steps done" green flash is visible
            // before it closes. Only for decisions that have a stepper (others close instantly).
            if (DECISION_STEPS[activeDecision.decision]) {
              await new Promise((r) => setTimeout(r, 500));
            }
            setActiveDecision(null);
          }}
        />
      )}
    </>
  );
};

export default DecisionActionsBar;
