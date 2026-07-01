import { useRef, useState } from 'react';
import {
  Plus, RefreshCw, Loader2, Calendar, Clock, Users, Building2,
  ToggleLeft, ToggleRight, Pencil, Trash2, X,
  CheckCircle2, XCircle, SkipForward, AlertCircle, History,
  Sparkles, ExternalLink, ChevronRight, List,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { CheckboxSearchDropdown, type CheckboxOption } from '@/components/dispatcher/CheckboxSearchDropdown';
import {
  useMissionPlanningTemplates,
  useMissionPlanningRuns,
  useCreateMissionPlanningTemplate,
  useUpdateMissionPlanningTemplate,
  useDeleteMissionPlanningTemplate,
  useCommercials,
  useDispatcherPartners,
  useMissionPlanningCalendar,
} from '@/hooks/dispatcher/useDispatcherMissionPlanning';
import type {
  MissionPlanningTemplate,
  MissionPlanningRun,
  MissionPlanningCalendarEvent,
  CreateMissionPlanningTemplatePayload,
  UpdateMissionPlanningTemplatePayload,
} from '@/types/dispatcher.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS: Record<number, string> = {
  0: 'Dim', 1: 'Lun', 2: 'Mar', 3: 'Mer', 4: 'Jeu', 5: 'Ven', 6: 'Sam',
};
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = diff / 3600000;
  if (h < 1) return 'Il y a moins d\'1h';
  if (h < 24) return `Il y a ${Math.floor(h)}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Hier';
  if (d < 7) return `Il y a ${d}j`;
  return new Date(iso).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short' });
}

function NameList({ names, max = 2 }: { names: string[]; max?: number }) {
  if (names.length === 0) return <span className="text-gray-400">—</span>;
  const shown = names.slice(0, max);
  const rest = names.length - max;
  return (
    <span className="truncate">
      {shown.join(', ')}
      {rest > 0 && <span className="ml-1 text-gray-400 font-medium">+{rest}</span>}
    </span>
  );
}

// ─── Run status badge ─────────────────────────────────────────────────────────

const RUN_CFG: Record<string, { label: string; Icon: React.ElementType; cls: string }> = {
  success: { label: 'Succès',   Icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed:  { label: 'Échec',    Icon: XCircle,      cls: 'bg-red-50 text-red-700 border-red-200' },
  skipped: { label: 'Ignoré',   Icon: SkipForward,  cls: 'bg-gray-50 text-gray-500 border-gray-200' },
  pending: { label: 'En cours', Icon: AlertCircle,  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const RunBadge = ({ status }: { status: string }) => {
  const c = RUN_CFG[status] ?? RUN_CFG.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${c.cls}`}>
      <c.Icon size={10} /> {c.label}
    </span>
  );
};

// ─── Days-of-week picker ──────────────────────────────────────────────────────

const DaysPicker = ({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) => (
  <div>
    <p className="text-[11px] text-gray-500 mb-1.5 flex items-center gap-1">
      <Calendar size={11} /> Jours de déclenchement
      <span className="text-gray-400">(vide = tous les jours)</span>
    </p>
    <div className="flex gap-1.5 flex-wrap">
      {DAY_ORDER.map((d) => {
        const on = value.includes(d);
        return (
          <button
            key={d} type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d])}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
              on ? 'bg-sage-600 text-white border-sage-600' : 'bg-white text-gray-600 border-gray-200 hover:border-sage-300'
            }`}
          >
            {DAY_LABELS[d]}
          </button>
        );
      })}
    </div>
  </div>
);

// ─── Template form (right panel) ─────────────────────────────────────────────

interface FormState {
  name: string; days_of_week: number[]; trigger_time: string;
  commercial_ids: number[]; partner_ids: number[]; notes: string;
}
const EMPTY: FormState = { name: '', days_of_week: [], trigger_time: '04:00', commercial_ids: [], partner_ids: [], notes: '' };

const TemplateForm = ({
  template,
  onClose,
  onSaved,
}: {
  template: MissionPlanningTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const isEdit = !!template;
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<FormState>(
    template
      ? { name: template.name ?? '', days_of_week: template.days_of_week,
          trigger_time: template.trigger_time.slice(0, 5),
          commercial_ids: template.commercials.map((c) => c.id),
          partner_ids: template.partners.map((p) => p.id),
          notes: template.notes ?? '' }
      : EMPTY
  );

  const { create, loading: creating } = useCreateMissionPlanningTemplate();
  const { update, loading: updating } = useUpdateMissionPlanningTemplate();
  const saving = creating || updating;

  const { data: commercials, loading: loadingCommercials } = useCommercials();
  const { data: partners, loading: loadingPartners } = useDispatcherPartners();

  const commercialOpts: CheckboxOption[] = commercials.map((c) => ({ id: c.id, label: c.name }));
  const partnerOpts: CheckboxOption[] = partners.map((p) => ({ id: p.id, label: p.name }));

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.trigger_time) { toast.error("L'heure de déclenchement est requise"); return; }
    if (!form.commercial_ids.length) { toast.error('Sélectionnez au moins un commercial'); return; }
    if (!form.partner_ids.length) { toast.error('Sélectionnez au moins un partenaire'); return; }
    try {
      if (isEdit && template) {
        await update(template.id, {
          name: form.name || undefined, days_of_week: form.days_of_week,
          trigger_time: form.trigger_time, commercial_ids: form.commercial_ids,
          partner_ids: form.partner_ids, notes: form.notes || undefined,
        } as UpdateMissionPlanningTemplatePayload);
        toast.success('Template mis à jour');
      } else {
        await create({
          name: form.name || undefined, days_of_week: form.days_of_week,
          trigger_time: form.trigger_time, commercial_ids: form.commercial_ids,
          partner_ids: form.partner_ids, notes: form.notes || undefined,
        } as CreateMissionPlanningTemplatePayload);
        toast.success('Template créé');
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-sage-50 rounded-lg shrink-0">
            <Sparkles className="w-4 h-4 text-sage-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              {isEdit ? 'Modifier le template' : 'Nouveau template'}
            </h2>
            <p className="text-[11px] text-gray-400">
              {isEdit ? template?.name ?? `Template #${template?.id}` : 'Planification automatique de mission'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <form ref={formRef} onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
        <div>
          <label className="text-[11px] text-gray-500 mb-1 block">Nom du template</label>
          <input
            type="text" value={form.name} maxLength={150}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Ex: Tournée Atlas & Bensaid — Lun/Mer/Ven"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-300"
          />
        </div>

        <DaysPicker value={form.days_of_week} onChange={(v) => set('days_of_week', v)} />

        <div>
          <label className="text-[11px] text-gray-500 mb-1 flex items-center gap-1">
            <Clock size={11} /> Heure de déclenchement <span className="text-red-400">*</span>
          </label>
          <input
            type="time" required value={form.trigger_time}
            onChange={(e) => set('trigger_time', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-300"
          />
        </div>

        <div>
          <label className="text-[11px] text-gray-500 mb-1 flex items-center gap-1">
            <Users size={11} /> Commerciaux <span className="text-red-400">*</span>
          </label>
          {loadingCommercials ? (
            <div className="flex items-center gap-1.5 text-xs text-gray-400 py-2"><Loader2 size={12} className="animate-spin" /> Chargement…</div>
          ) : commercialOpts.length === 0 ? (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Endpoint <code>/dispatcher/commercials</code> non disponible — vérifiez avec le backend.
            </p>
          ) : (
            <CheckboxSearchDropdown label="" options={commercialOpts} selected={form.commercial_ids}
              onChange={(ids) => set('commercial_ids', ids)}
              emptyLabel="Sélectionner des commerciaux…" noResultsLabel="Aucun commercial trouvé" />
          )}
        </div>

        <div>
          <label className="text-[11px] text-gray-500 mb-1 flex items-center gap-1">
            <Building2 size={11} /> Partenaires / Clients <span className="text-red-400">*</span>
          </label>
          {loadingPartners ? (
            <div className="flex items-center gap-1.5 text-xs text-gray-400 py-2"><Loader2 size={12} className="animate-spin" /> Chargement…</div>
          ) : (
            <CheckboxSearchDropdown label="" options={partnerOpts} selected={form.partner_ids}
              onChange={(ids) => set('partner_ids', ids)}
              emptyLabel="Sélectionner des partenaires…" noResultsLabel="Aucun partenaire trouvé" />
          )}
          <p className="text-[10px] text-gray-400 mt-1">
            Remplacement complet sur PUT — renvoyer toute la liste à chaque modification.
          </p>
        </div>

        <div>
          <label className="text-[11px] text-gray-500 mb-1 block">Notes</label>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)}
            placeholder="Remarques libres…" rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-sage-300"
          />
        </div>
      </form>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 shrink-0">
        <button type="button" onClick={onClose}
          className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100">
          Annuler
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => formRef.current?.requestSubmit()}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-sage-600 text-white rounded-lg hover:bg-sage-700 disabled:opacity-60"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          {isEdit ? 'Enregistrer' : 'Créer le template'}
        </button>
      </div>
    </div>
  );
};

// ─── Runs history panel ───────────────────────────────────────────────────────

const RunsHistory = ({ template, onClose }: { template: MissionPlanningTemplate; onClose: () => void }) => {
  const navigate = useNavigate();
  const { data: runs, loading } = useMissionPlanningRuns(template.id);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
        <div>
          <p className="text-[11px] text-gray-400 flex items-center gap-1"><History size={11} /> Historique d'exécution</p>
          <h3 className="text-sm font-bold text-gray-900 truncate">{template.name ?? `Template #${template.id}`}</h3>
          <p className="text-xs text-sage-700 mt-0.5">{template.schedule_label}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 gap-2 text-sm">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Aucun déclenchement enregistré</p>
            <p className="text-xs text-gray-300 mt-1">Le template n'a pas encore été activé.</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-100" />
            <div className="space-y-3">
              {runs.map((run: MissionPlanningRun) => (
                <div key={run.id} className="relative pl-8">
                  <div className={`absolute left-1.5 top-2 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                    run.status === 'success' ? 'bg-emerald-400'
                      : run.status === 'failed' ? 'bg-red-400'
                      : run.status === 'skipped' ? 'bg-gray-300' : 'bg-amber-400'
                  }`} />
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <p className="text-xs font-medium text-gray-700">{relativeDate(run.triggered_at)}</p>
                        <p className="text-[10px] text-gray-400">
                          {new Date(run.triggered_at).toLocaleString('fr-MA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <RunBadge status={run.status} />
                    </div>
                    {run.status === 'success' && (
                      <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 size={11} className="text-emerald-500" />
                          <strong>{run.orders_injected}</strong> BC{run.orders_injected !== 1 ? 's' : ''} injecté{run.orders_injected !== 1 ? 's' : ''}
                        </span>
                        {run.delivery_mission_id && (
                          <button
                            onClick={() => navigate('/dispatcher/workspace/missions')}
                            className="flex items-center gap-0.5 text-sage-600 hover:text-sage-800 font-medium"
                          >
                            Mission #{run.delivery_mission_id} <ExternalLink size={10} />
                          </button>
                        )}
                      </div>
                    )}
                    {run.status === 'failed' && run.error_message && (
                      <p className="text-[11px] text-red-600 bg-red-50 rounded px-2 py-1 mt-1 font-mono break-all">{run.error_message}</p>
                    )}
                    {run.status === 'skipped' && (
                      <p className="text-[11px] text-gray-400">Aucun BC éligible à cette heure.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Delete confirm modal ─────────────────────────────────────────────────────

const DeleteModal = ({ template, onConfirm, onCancel, loading }: {
  template: MissionPlanningTemplate; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-red-50 rounded-xl"><Trash2 className="w-5 h-5 text-red-500" /></div>
        <h2 className="text-sm font-bold text-gray-900">Supprimer ce template ?</h2>
      </div>
      <p className="text-sm text-gray-600 mb-1">
        <strong>{template.name ?? `Template #${template.id}`}</strong> sera supprimé.
      </p>
      <p className="text-xs text-gray-400 mb-5">
        Soft-delete — l'historique des runs est conservé pour l'audit. Les missions déjà créées ne sont pas affectées.
      </p>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel}
          className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100">
          Annuler
        </button>
        <button onClick={onConfirm} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-60">
          {loading && <Loader2 size={12} className="animate-spin" />} Supprimer
        </button>
      </div>
    </div>
  </div>
);

// ─── Template card (left column) ─────────────────────────────────────────────

type PanelMode = { type: 'form'; template: MissionPlanningTemplate | null } | { type: 'runs'; template: MissionPlanningTemplate };

const TemplateCard = ({ template, isSelected, onSelect, onEdit, onToggle, onDelete, toggling }: {
  template: MissionPlanningTemplate;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  toggling: boolean;
}) => {
  const inactive = !template.is_active;
  const lr = template.last_run;

  return (
    <div
      className={`group relative rounded-xl border transition-all cursor-pointer ${
        isSelected
          ? 'border-sage-400 bg-sage-50 shadow-sm'
          : inactive
            ? 'border-gray-100 bg-white opacity-60 grayscale hover:opacity-80 hover:grayscale-0'
            : 'border-gray-100 bg-white hover:border-sage-200 hover:shadow-sm'
      }`}
      onClick={onSelect}
    >
      {/* Active indicator strip */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${template.is_active ? 'bg-emerald-400' : 'bg-gray-200'}`} />

      <div className="pl-4 pr-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {template.name ?? <span className="text-gray-400 italic font-normal">Template sans nom</span>}
            </p>
            <p className="text-xs text-sage-700 font-medium mt-0.5 flex items-center gap-1">
              <Clock size={11} /> {template.schedule_label}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              disabled={toggling}
              title={template.is_active ? 'Désactiver' : 'Activer'}
              className="p-0.5 disabled:opacity-50 hover:scale-105 transition-transform"
            >
              {template.is_active
                ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                : <ToggleLeft className="w-5 h-5 text-gray-300" />}
            </button>
          </div>
        </div>

        {/* Day pills */}
        {template.days_of_week.length > 0 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {template.days_of_week.map((d) => (
              <span key={d} className="text-[10px] font-semibold px-1.5 py-0.5 bg-sage-50 text-sage-700 rounded border border-sage-100">
                {DAY_LABELS[d]}
              </span>
            ))}
          </div>
        )}

        {/* People */}
        <div className="mt-2 space-y-0.5 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <Users size={11} className="text-gray-400 shrink-0" />
            <NameList names={template.commercials.map((c) => c.name)} max={2} />
          </div>
          <div className="flex items-center gap-1">
            <Building2 size={11} className="text-gray-400 shrink-0" />
            <NameList names={template.partners.map((p) => p.name)} max={2} />
          </div>
        </div>

        {/* Last run + actions */}
        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-50">
          <div className="text-[11px] text-gray-400 flex items-center gap-1.5 min-w-0">
            {lr ? (
              <>
                <RunBadge status={lr.status} />
                <span className="truncate">{relativeDate(lr.triggered_at)}</span>
                {lr.status === 'success' && lr.orders_injected > 0 && (
                  <span>· {lr.orders_injected} BC{lr.orders_injected !== 1 ? 's' : ''}</span>
                )}
              </>
            ) : (
              <span className="italic">Jamais déclenché</span>
            )}
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              title="Modifier" className="p-1 rounded-lg text-gray-400 hover:text-sage-600 hover:bg-sage-50">
              <Pencil size={12} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              title="Supprimer" className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50">
              <Trash2 size={12} />
            </button>
            <ChevronRight size={12} className="text-gray-300" />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Calendar (§19.7) ────────────────────────────────────────────────────────

const EVENT_CFG = {
  success: { bg: '#16a34a', border: '#15803d', dot: 'bg-emerald-500' },
  failed:  { bg: '#dc2626', border: '#b91c1c', dot: 'bg-red-500' },
  skipped: { bg: '#6b7280', border: '#4b5563', dot: 'bg-gray-400' },
  pending: { bg: '#3b82f6', border: '#2563eb', dot: 'bg-blue-400' },
};

function evCfg(ev: MissionPlanningCalendarEvent) {
  if (ev.type === 'future') return EVENT_CFG.pending;
  return EVENT_CFG[ev.status as keyof typeof EVENT_CFG] ?? EVENT_CFG.skipped;
}

// Popup shown when clicking an event
const EventPopup = ({
  ev,
  anchor,
  onClose,
  onGoMission,
}: {
  ev: MissionPlanningCalendarEvent;
  anchor: { x: number; y: number };
  onClose: () => void;
  onGoMission: (id: number) => void;
}) => {
  const cfg = evCfg(ev);
  const date = new Date(ev.start);
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        style={{ left: Math.min(anchor.x, window.innerWidth - 300), top: Math.min(anchor.y + 8, window.innerHeight - 240) }}
      >
        {/* Colour strip */}
        <div className="h-1.5" style={{ background: cfg.bg }} />
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 leading-tight truncate">{ev.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{ev.schedule_label}</p>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
              <X size={14} />
            </button>
          </div>

          <div className="space-y-2 text-xs text-gray-600">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Date</span>
              <span className="font-medium">
                {date.toLocaleDateString('fr-MA', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                {' · '}
                {date.toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Statut</span>
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
                style={{ background: cfg.bg }}
              >
                {ev.type === 'future' ? 'Planifié' : ev.status === 'success' ? 'Succès' : ev.status === 'failed' ? 'Échec' : 'Ignoré'}
              </span>
            </div>
            {ev.orders_injected > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400">BCs injectés</span>
                <span className="font-semibold text-emerald-600">{ev.orders_injected}</span>
              </div>
            )}
            {ev.type === 'future' && (
              <p className="text-[11px] text-blue-500 bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
                Déclenchement projeté — pas encore exécuté.
              </p>
            )}
          </div>

          {ev.delivery_mission_id && (
            <button
              onClick={() => onGoMission(ev.delivery_mission_id!)}
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-sage-600 text-white rounded-lg hover:bg-sage-700"
            >
              <ExternalLink size={12} /> Voir la mission #{ev.delivery_mission_id}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

const CalendarView = () => {
  const navigate = useNavigate();
  const now = new Date();
  const [rangeStart, setRangeStart] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  );
  const [rangeEnd, setRangeEnd] = useState(() => {
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
  });
  const [popup, setPopup] = useState<{ ev: MissionPlanningCalendarEvent; x: number; y: number } | null>(null);

  const { data: events, loading, error, refetch } = useMissionPlanningCalendar(rangeStart, rangeEnd);

  const stats = {
    success: events.filter((e) => e.type === 'past' && e.status === 'success').length,
    failed:  events.filter((e) => e.type === 'past' && e.status === 'failed').length,
    skipped: events.filter((e) => e.type === 'past' && e.status === 'skipped').length,
    future:  events.filter((e) => e.type === 'future').length,
    bcs:     events.reduce((s, e) => s + e.orders_injected, 0),
  };

  const fcEvents = events.map((ev) => {
    const cfg = evCfg(ev);
    return {
      id: ev.id,
      title: ev.title,
      start: ev.start,
      backgroundColor: ev.type === 'future' ? 'transparent' : cfg.bg,
      borderColor: cfg.border,
      textColor: ev.type === 'future' ? cfg.bg : '#fff',
      classNames: ev.type === 'future' ? ['fc-event-future'] : [],
      extendedProps: ev,
    };
  });

  return (
    <>
      <style>{`
        .fc { font-family: inherit; font-size: 13px; }
        .fc .fc-toolbar-title { font-size: 15px; font-weight: 700; color: #111827; }
        .fc .fc-button { font-size: 11px; font-weight: 600; padding: 5px 12px; border-radius: 8px; text-transform: none; box-shadow: none !important; }
        .fc .fc-button-primary { background: #fff; border-color: #e5e7eb; color: #374151; }
        .fc .fc-button-primary:hover { background: #f9fafb; border-color: #d1d5db; color: #111827; }
        .fc .fc-button-primary:not(:disabled).fc-button-active,
        .fc .fc-button-primary:not(:disabled):active { background: #2f5843; border-color: #2f5843; color: #fff; }
        .fc .fc-today-button { background: #2f5843 !important; border-color: #2f5843 !important; color: #fff !important; }
        .fc .fc-col-header-cell-cushion { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; text-decoration: none; }
        .fc .fc-daygrid-day-number { font-size: 12px; color: #374151; text-decoration: none; padding: 6px 8px; }
        .fc .fc-day-today { background: #f0fdf4 !important; }
        .fc .fc-day-today .fc-daygrid-day-number { color: #16a34a; font-weight: 700; }
        .fc .fc-daygrid-day-frame { min-height: 80px; }
        .fc-event { border-radius: 6px !important; font-size: 11px !important; padding: 1px 0 !important; }
        .fc-event-future { border-style: dashed !important; border-width: 1.5px !important; background: transparent !important; }
        .fc-event-future .fc-event-title { font-style: italic; }
        .fc .fc-daygrid-event { margin: 1px 2px !important; }
        .fc .fc-event-time { display: none; }
        .fc th { border-color: #f3f4f6 !important; }
        .fc td { border-color: #f3f4f6 !important; }
        .fc .fc-scrollgrid { border-color: #f3f4f6 !important; }
      `}</style>

      <div className="h-full flex flex-col bg-gray-50">
        {/* Stats strip */}
        <div className="px-5 py-3 border-b border-gray-100 bg-white shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-xs text-gray-500">Succès</span>
              <span className="text-xs font-bold text-gray-800">{stats.success}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              <span className="text-xs text-gray-500">Échec</span>
              <span className="text-xs font-bold text-gray-800">{stats.failed}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
              <span className="text-xs text-gray-500">Ignoré</span>
              <span className="text-xs font-bold text-gray-800">{stats.skipped}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400 border border-blue-400 border-dashed shrink-0" />
              <span className="text-xs text-gray-500">Planifié</span>
              <span className="text-xs font-bold text-gray-800">{stats.future}</span>
            </div>
            {stats.bcs > 0 && (
              <div className="ml-auto flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1">
                <CheckCircle2 size={12} className="text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-700">{stats.bcs} BCs injectés ce mois</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 ml-auto">
              {loading && <Loader2 size={13} className="animate-spin text-gray-400" />}
              {error && <span className="text-xs text-red-500 truncate max-w-[200px]">{error}</span>}
              <button onClick={refetch}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                title="Actualiser">
                <RefreshCw size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="flex-1 overflow-auto p-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-full min-h-[520px] p-4">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin]}
              initialView="dayGridMonth"
              locale="fr"
              firstDay={1}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek',
              }}
              buttonText={{ today: "Aujourd'hui", month: 'Mois', week: 'Semaine' }}
              events={fcEvents}
              height="100%"
              datesSet={(info) => {
                const s = info.startStr.slice(0, 10);
                const e = info.endStr.slice(0, 10);
                if (s !== rangeStart || e !== rangeEnd) {
                  setRangeStart(s);
                  setRangeEnd(e);
                }
              }}
              eventClick={(info) => {
                const ev = info.event.extendedProps as MissionPlanningCalendarEvent;
                const rect = info.el.getBoundingClientRect();
                setPopup({ ev, x: rect.left, y: rect.bottom });
              }}
              eventContent={(arg) => {
                const ev = arg.event.extendedProps as MissionPlanningCalendarEvent;
                const cfg = evCfg(ev);
                const time = new Date(ev.start).toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 w-full overflow-hidden cursor-pointer">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                    <span className="text-[11px] font-semibold truncate leading-tight">
                      {time} {ev.title.replace(/\s*\(.*?\)\s*$/, '')}
                    </span>
                    {ev.orders_injected > 0 && (
                      <span className="ml-auto text-[10px] opacity-80 shrink-0">·{ev.orders_injected}</span>
                    )}
                  </div>
                );
              }}
              noEventsContent={
                <div className="text-center py-12 text-gray-300">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Aucun déclenchement sur cette période</p>
                </div>
              }
            />
          </div>
        </div>
      </div>

      {popup && (
        <EventPopup
          ev={popup.ev}
          anchor={{ x: popup.x, y: popup.y }}
          onClose={() => setPopup(null)}
          onGoMission={(id) => { setPopup(null); navigate('/dispatcher/workspace/missions'); void id; }}
        />
      )}
    </>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const DispatcherMissionPlanningPage = () => {
  const { data, loading, error, refetch } = useMissionPlanningTemplates();
  const { update } = useUpdateMissionPlanningTemplate();
  const { remove, loading: deleting } = useDeleteMissionPlanningTemplate();

  const [tab, setTab] = useState<'templates' | 'calendar'>('templates');
  const [panel, setPanel] = useState<PanelMode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MissionPlanningTemplate | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const templates = data?.data ?? [];
  const total = data?.total ?? 0;

  const selectedId =
    panel?.type === 'form' ? panel.template?.id ?? null
    : panel?.type === 'runs' ? panel.template.id
    : null;

  const openCreate = () => setPanel({ type: 'form', template: null });
  const openEdit = (t: MissionPlanningTemplate) => setPanel({ type: 'form', template: t });
  const openRuns = (t: MissionPlanningTemplate) => setPanel({ type: 'runs', template: t });
  const openSelect = (t: MissionPlanningTemplate) =>
    panel?.type === 'runs' && panel.template.id === t.id
      ? setPanel(null)
      : setPanel({ type: 'runs', template: t });

  const handleToggle = async (t: MissionPlanningTemplate) => {
    setTogglingId(t.id);
    try {
      await update(t.id, { is_active: !t.is_active });
      toast.success(t.is_active ? 'Template désactivé' : 'Template activé');
      refetch();
    } catch { toast.error('Impossible de modifier le statut'); }
    finally { setTogglingId(null); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove(deleteTarget.id);
      toast.success('Template supprimé');
      setDeleteTarget(null);
      if (selectedId === deleteTarget.id) setPanel(null);
      refetch();
    } catch { toast.error('Suppression échouée'); }
  };

  const leftPanel = (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-sage-50 rounded-lg shrink-0">
            <Sparkles className="w-4 h-4 text-sage-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-gray-900 leading-tight">Planification auto</h1>
            <p className="text-[11px] text-gray-400 truncate">Mission Draft à l'heure paramétrée</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-lg border border-gray-200 p-0.5 mb-3 bg-gray-50">
          <button
            onClick={() => setTab('templates')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              tab === 'templates' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <List size={12} /> Templates
          </button>
          <button
            onClick={() => { setTab('calendar'); setPanel(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              tab === 'calendar' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Calendar size={12} /> Calendrier
          </button>
        </div>

        {tab === 'templates' && (
          <div className="flex items-center gap-2">
            <button onClick={refetch}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              title="Actualiser">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={openCreate}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-sage-600 text-white rounded-lg hover:bg-sage-700">
              <Plus size={13} /> Nouveau template
            </button>
          </div>
        )}
      </div>

      {/* Template list */}
      {tab === 'templates' && (
        <div className="flex-1 overflow-y-auto">
          {loading && !data ? (
            <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
              <Loader2 size={16} className="animate-spin" /><span className="text-sm">Chargement…</span>
            </div>
          ) : error ? (
            <div className="text-center py-12 px-4">
              <AlertCircle className="w-7 h-7 text-red-300 mx-auto mb-2" />
              <p className="text-sm text-red-500">{error}</p>
              <button onClick={refetch} className="text-xs text-sage-600 hover:underline mt-2">Réessayer</button>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 px-4 m-4 border-2 border-dashed border-gray-200 rounded-xl">
              <Calendar className="w-8 h-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-400">Aucun template</p>
              <p className="text-xs text-gray-300 mt-1">Créez votre premier template.</p>
              <button onClick={openCreate}
                className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-sage-600 text-white rounded-lg hover:bg-sage-700 mx-auto">
                <Plus size={12} /> Nouveau
              </button>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              <p className="text-[11px] text-gray-400 px-1">
                {total} template{total !== 1 ? 's' : ''} · {templates.filter((t) => t.is_active).length} actif{templates.filter((t) => t.is_active).length !== 1 ? 's' : ''}
              </p>
              {templates.map((t) => (
                <TemplateCard
                  key={t.id} template={t}
                  isSelected={selectedId === t.id}
                  onSelect={() => openSelect(t)}
                  onEdit={() => openEdit(t)}
                  onToggle={() => handleToggle(t)}
                  onDelete={() => setDeleteTarget(t)}
                  toggling={togglingId === t.id}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const mainPanel = tab === 'calendar' ? (
    <CalendarView />
  ) : panel ? (
    panel.type === 'form' ? (
      <TemplateForm
        template={panel.template}
        onClose={() => setPanel(null)}
        onSaved={refetch}
      />
    ) : (
      <div className="flex flex-col h-full">
        <RunsHistory template={panel.template} onClose={() => setPanel(null)} />
        <div className="px-5 py-3 border-t border-gray-100 shrink-0">
          <button
            onClick={() => openEdit(panel.template)}
            className="flex items-center gap-1.5 text-xs font-semibold text-sage-600 hover:text-sage-800"
          >
            <Pencil size={12} /> Modifier ce template
          </button>
        </div>
      </div>
    )
  ) : (
    <div className="flex-1 flex items-center justify-center text-center p-8 text-gray-300 h-full">
      <div>
        <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p className="text-sm font-medium text-gray-400">Sélectionnez un template</p>
        <p className="text-xs mt-1">pour voir son historique ou le modifier</p>
        <button onClick={openCreate}
          className="mt-4 flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-sage-600 text-white rounded-xl hover:bg-sage-700 mx-auto">
          <Plus size={13} /> Nouveau template
        </button>
      </div>
    </div>
  );

  return (
    <>
      <MasterLayout leftContent={leftPanel} mainContent={mainPanel} />
      {deleteTarget && (
        <DeleteModal
          template={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </>
  );
};

export default DispatcherMissionPlanningPage;
