import { useMemo, useState } from 'react';
import { ArrowLeft, Calendar, Info, Loader2, Pencil, StickyNote } from 'lucide-react';
import toast from 'react-hot-toast';

import { useUpdateAssignment } from '@/hooks/dispatcher/useDispatcherFleet';
import type { Vehicle } from '@/types/dispatcher.types';

interface EditAssignmentPanelProps {
  vehicle: Vehicle;
  onBack: () => void;
  onUpdated: () => void;
}

const labelCls = 'block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5';
const inputCls = 'w-full px-3.5 py-2.5 text-sm text-gray-800 bg-white border border-gray-200 rounded-xl outline-none transition-all focus:ring-2 focus:ring-sage-200 focus:border-sage-400';

export const EditAssignmentPanel = ({ vehicle, onBack, onUpdated }: EditAssignmentPanelProps) => {
  const [notes, setNotes] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const { update, loading } = useUpdateAssignment();
  const endsAtIsPastOrNow = useMemo(() => endsAt !== '' && new Date(endsAt).getTime() <= new Date().getTime(), [endsAt]);

  const submit = async () => {
    try {
      const res = await update(vehicle.id, {
        notes: notes || undefined,
        ends_at: endsAt || undefined,
        ...(isActive ? {} : { is_active: false }),
      });
      if (res.success) { toast.success(res.message || 'Assignation mise à jour'); onUpdated(); }
      else toast.error(res.message || 'Échec de la mise à jour');
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'response' in err
        ? (err.response as { data?: { message?: string } })?.data?.message
        : undefined;
      toast.error(message ?? 'Échec de la mise à jour', { duration: 6000 });
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      <div className="px-6 py-4 border-b border-gray-200 bg-white/90 backdrop-blur-md shrink-0 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} title="Retour" className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center shrink-0 transition-colors">
          <ArrowLeft size={18} className="text-gray-500" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-gray-900 truncate">Modifier l'assignation</h2>
          <p className="text-xs text-gray-500 truncate">{vehicle.plate_number ?? vehicle.plate}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
            <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Modifie l'assignation active sans en créer une nouvelle — utile pour ajouter une note ou planifier une fin, sans réassigner le véhicule.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div>
              <label className={`${labelCls} flex items-center gap-1.5`}><StickyNote size={12} /> Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Ex : Véhicule en panne, intervention prévue demain..."
                className={`${inputCls} resize-none`}
              />
            </div>

            <div>
              <label className={`${labelCls} flex items-center gap-1.5`}><Calendar size={12} /> Terminer l'assignation le (optionnel)</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={`${inputCls} ${endsAtIsPastOrNow ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-200' : ''}`}
              />
              {endsAt ? (
                <p className={`text-xs mt-2 flex items-start gap-1.5 ${endsAtIsPastOrNow ? 'text-red-600 font-semibold' : 'text-amber-700'}`}>
                  <Info size={12} className="mt-0.5 shrink-0" />
                  {endsAtIsPastOrNow
                    ? "Cette date est déjà passée — le véhicule sera retiré du livreur dès l'enregistrement."
                    : "Le véhicule restera assigné jusqu'à cette date, puis sera automatiquement retiré."}
                </p>
              ) : (
                <p className="text-xs text-gray-400 mt-2">Laisser vide pour ne pas toucher à la date de fin actuelle.</p>
              )}
            </div>

            <label className="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors hover:bg-gray-50">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-sage-600 focus:ring-sage-500"
              />
              <div>
                <span className="text-sm font-semibold text-gray-700">Assignation active</span>
                {!isActive && <span className="block text-xs text-red-500 font-medium">Le véhicule sera retiré du livreur à l'enregistrement</span>}
              </div>
            </label>
          </div>

          <div className="flex items-center gap-3 pb-6">
            <button
              onClick={submit}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-white bg-emerald-700 rounded-xl shadow-sm hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Pencil size={16} />}
              Enregistrer
            </button>
            <button onClick={onBack} className="px-5 py-3 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditAssignmentPanel;
