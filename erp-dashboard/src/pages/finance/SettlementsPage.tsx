import { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, RefreshCw, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { financeApi } from '@/services/api/financeApi';
import type { Settlement } from '@/types/finance.types';

// ── Helpers ────────────────────────────────────────────────────────────────────
const formatMAD = (n: number | null | undefined) => {
  if (n == null || isNaN(n)) return '0,00 MAD';
  return n.toLocaleString('fr-MA', { minimumFractionDigits: 2 }) + ' MAD';
};

// ── Settlement Card ───────────────────────────────────────────────────────────
interface SettlementCardProps {
  settlement: Settlement;
  isSelected: boolean;
  onClick: () => void;
}

const SettlementCard = ({ settlement, isSelected, onClick }: SettlementCardProps) => {
  const isPending = settlement.status === 'pending' || settlement.reconciled_at === null;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all ${
        isSelected
          ? 'border-emerald-500 bg-emerald-50'
          : 'border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">
            {settlement.vendor?.name ?? `Session #${settlement.work_session?.id ?? settlement.id}`}
          </p>
          {settlement.vendor?.code && (
            <p className="text-xs text-gray-400">{settlement.vendor.code}</p>
          )}
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${isPending ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
          {isPending ? 'EN ATTENTE' : 'RÉCONCILIÉ'}
        </span>
      </div>
      <p className="text-sm font-semibold text-emerald-700 mt-2">
        {formatMAD(settlement.expected_cash_total)}
      </p>
      {settlement.work_session?.date && (
        <p className="text-xs text-gray-400 mt-0.5">{settlement.work_session.date}</p>
      )}
    </button>
  );
};

// ── Reconcile Result ──────────────────────────────────────────────────────────
interface ReconcileResultProps {
  settlement: Settlement;
  result: {
    cash_difference: number;
    vendor_personal_debt_balance?: number;
    vendor?: { name: string };
  };
  onClose: () => void;
}

const ReconcileResult = ({ settlement, result, onClose }: ReconcileResultProps) => {
  const gap = result.cash_difference ?? 0;
  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="w-8 h-8 text-green-500" />
        <div>
          <h2 className="text-lg font-bold text-gray-900">Réconciliation effectuée</h2>
          <p className="text-xs text-gray-500">Session #{settlement.work_session?.id ?? settlement.id}</p>
        </div>
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Montant attendu</span>
          <span className="text-sm font-semibold text-gray-800">{formatMAD(settlement.expected_cash_total)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Montant compté</span>
          <span className="text-sm font-semibold text-gray-800">{formatMAD(settlement.counted_cash_total ?? 0)}</span>
        </div>
        <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-700">Écart</span>
          <span className={`text-lg font-bold ${gap === 0 ? 'text-green-600' : 'text-orange-500'}`}>
            {formatMAD(gap)}
          </span>
        </div>
      </div>

      {gap > 0 && result.vendor?.name && (
        <div className="rounded-xl bg-orange-50 border border-orange-200 p-4 space-y-2">
          <p className="text-sm font-semibold text-orange-700">
            Imputé à la dette personnelle de {result.vendor.name}
          </p>
          {result.vendor_personal_debt_balance != null && (
            <p className="text-sm text-orange-600">
              Nouveau solde de dette : <span className="font-bold">{formatMAD(result.vendor_personal_debt_balance)}</span>
            </p>
          )}
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700"
      >
        Nouvelle réconciliation
      </button>
    </div>
  );
};

// ── Reconcile Form ────────────────────────────────────────────────────────────
interface ReconcileFormProps {
  settlement: Settlement;
  onReconciled: (result: Settlement) => void;
}

const ReconcileForm = ({ settlement, onReconciled }: ReconcileFormProps) => {
  const [countedCash, setCountedCash] = useState('');
  const [notes, setNotes] = useState('');
  const [notesError, setNotesError] = useState('');
  const [saving, setSaving] = useState(false);

  const countedNum = countedCash !== '' ? parseFloat(countedCash) : null;
  const gap = countedNum != null ? countedNum - settlement.expected_cash_total : null;
  const hasGap = gap != null && gap !== 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (countedNum == null) { toast.error('Veuillez saisir le montant compté'); return; }
    if (hasGap && !notes.trim()) {
      setNotesError('Les notes sont obligatoires en cas d\'écart');
      return;
    }
    setNotesError('');
    setSaving(true);
    try {
      const res = await financeApi.reconcileSettlement({
        ...(settlement.vendor ? { vendor_settlement_id: settlement.id } : {}),
        ...(settlement.work_session ? { work_session_id: settlement.work_session.id } : {}),
        counted_cash_total: countedNum,
        ...(notes ? { notes } : {}),
      });
      onReconciled(res.data);
    } catch (err: any) {
      const errCode = err?.response?.data?.error_code;
      const msg = err?.response?.data?.message ?? err?.response?.data?.error ?? 'Erreur lors de la réconciliation';
      if (errCode === 'FINANCE_GAP_NOTE_REQUIRED') {
        setNotesError(msg);
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const isPending = settlement.reconciled_at === null;

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      {/* Expected amount — prominent */}
      <div className="rounded-xl bg-gray-100 border border-gray-200 p-5 text-center">
        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Montant attendu</p>
        <p className="text-4xl font-bold text-gray-900">{formatMAD(settlement.expected_cash_total)}</p>
      </div>

      {/* Vendor / session info */}
      {(settlement.vendor || settlement.work_session) && (
        <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
          {settlement.vendor && (
            <div className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-gray-500">Vendeur</span>
              <span className="font-semibold text-gray-800">{settlement.vendor.name}</span>
            </div>
          )}
          {settlement.work_session && (
            <div className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-gray-500">Session</span>
              <span className="text-gray-800">#{settlement.work_session.id}{settlement.work_session.date ? ` — ${settlement.work_session.date}` : ''}</span>
            </div>
          )}
          <div className="flex justify-between px-4 py-2.5 text-sm">
            <span className="text-gray-500">Statut</span>
            <span className={`font-semibold ${isPending ? 'text-amber-600' : 'text-green-600'}`}>
              {isPending ? 'En attente' : 'Réconcilié'}
            </span>
          </div>
        </div>
      )}

      {isPending ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Montant réellement compté *
            </label>
            <input
              type="number"
              step="0.01"
              value={countedCash}
              onChange={e => setCountedCash(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg font-semibold text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="0.00"
            />
          </div>

          {hasGap && gap != null && (
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-center">
              <p className="text-xs text-orange-600 font-semibold mb-1">Écart détecté</p>
              <p className="text-xl font-bold text-orange-600">{formatMAD(Math.abs(gap))}</p>
              <p className="text-xs text-orange-500 mt-1">{gap > 0 ? 'Surplus' : 'Déficit'}</p>
            </div>
          )}

          <div>
            <label className={`block text-sm font-medium mb-1 ${hasGap ? 'text-red-600' : 'text-gray-700'}`}>
              Notes {hasGap ? <span className="text-red-500">*</span> : '(optionnel)'}
            </label>
            <textarea
              value={notes}
              onChange={e => { setNotes(e.target.value); if (notesError) setNotesError(''); }}
              rows={3}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none ${
                notesError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-emerald-500'
              }`}
              placeholder={hasGap ? 'Obligatoire en cas d\'écart…' : 'Commentaire optionnel…'}
            />
            {notesError && <p className="text-xs text-red-500 mt-1">{notesError}</p>}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Valider la réconciliation
          </button>
        </form>
      ) : (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-green-700">Déjà réconcilié</p>
          {settlement.reconciled_at && (
            <p className="text-xs text-green-600 mt-1">{new Date(settlement.reconciled_at).toLocaleString('fr-MA')}</p>
          )}
          {settlement.cash_difference != null && (
            <p className="text-sm mt-2 font-semibold text-gray-700">
              Écart : <span className={settlement.cash_difference === 0 ? 'text-green-600' : 'text-orange-500'}>
                {formatMAD(settlement.cash_difference)}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export const SettlementsPage = () => {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Settlement | null>(null);
  const [pendingOnly, setPendingOnly] = useState(true);
  const [reconcileResult, setReconcileResult] = useState<Settlement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeApi.getSettlements({ pending_only: pendingOnly });
      setSettlements(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error('Erreur lors du chargement des réconciliations');
    } finally {
      setLoading(false);
    }
  }, [pendingOnly]);

  useEffect(() => { load(); }, [load]);

  const handleReconciled = (result: Settlement) => {
    setReconcileResult(result);
    load();
  };

  const leftContent = (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-emerald-600" />
          Tournées
        </span>
        <button onClick={load} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {/* Toggle pending/all */}
      <div className="p-3 border-b border-gray-200">
        <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-medium">
          <button
            onClick={() => setPendingOnly(true)}
            className={`flex-1 py-1.5 transition-colors ${pendingOnly ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            En attente
          </button>
          <button
            onClick={() => setPendingOnly(false)}
            className={`flex-1 py-1.5 transition-colors ${!pendingOnly ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Tout voir
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 text-emerald-500 animate-spin" />
          </div>
        ) : settlements.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">Aucune réconciliation</p>
        ) : (
          settlements.map(s => (
            <SettlementCard
              key={s.id}
              settlement={s}
              isSelected={selected?.id === s.id}
              onClick={() => { setSelected(s); setReconcileResult(null); }}
            />
          ))
        )}
      </div>
    </div>
  );

  const mainContent = (() => {
    if (!selected) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center text-gray-400">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sélectionnez une tournée pour lancer la réconciliation</p>
          </div>
        </div>
      );
    }
    if (reconcileResult) {
      return (
        <ReconcileResult
          settlement={selected}
          result={reconcileResult}
          onClose={() => { setReconcileResult(null); setSelected(null); }}
        />
      );
    }
    return <ReconcileForm settlement={selected} onReconciled={handleReconciled} />;
  })();

  return <MasterLayout leftContent={leftContent} mainContent={mainContent} />;
};

export default SettlementsPage;
