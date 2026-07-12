import { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { financeApi } from '@/services/api/financeApi';
import type { Settlement } from '@/types/finance.types';

const formatMAD = (n: number | null | undefined) => {
  if (n == null || isNaN(n)) return '0,00 MAD';
  return n.toLocaleString('fr-MA', { minimumFractionDigits: 2 }) + ' MAD';
};

// ── Settlement Card ───────────────────────────────────────────────────────────
const SettlementCard = ({ settlement, isSelected, onClick }: { settlement: Settlement; isSelected: boolean; onClick: () => void }) => {
  const { t } = useTranslation();
  const isPending = settlement.status === 'pending' || settlement.reconciled_at === null;
  return (
    <button onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/50'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">
            {settlement.vendor?.name ?? `Session #${settlement.work_session?.id ?? settlement.id}`}
          </p>
          {settlement.vendor?.code && <p className="text-xs text-gray-400">{settlement.vendor.code}</p>}
        </div>
        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${isPending ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
          {isPending ? t('finance.settlements.pending') : t('finance.settlements.reconciled')}
        </span>
      </div>
      <p className="text-sm font-semibold text-emerald-700 mt-2">{formatMAD(settlement.expected_cash_total)}</p>
      {settlement.work_session?.date && <p className="text-xs text-gray-400 mt-0.5">{settlement.work_session.date}</p>}
    </button>
  );
};

// ── Reconcile Result ──────────────────────────────────────────────────────────
const ReconcileResult = ({ settlement, result, onClose }: {
  settlement: Settlement;
  result: { cash_difference: number; vendor_personal_debt_balance?: number; vendor?: { name: string } };
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const gap = result.cash_difference ?? 0;
  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="w-8 h-8 text-green-500" />
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t('finance.settlements.reconciliationDone')}</h2>
          <p className="text-xs text-gray-500">Session #{settlement.work_session?.id ?? settlement.id}</p>
        </div>
      </div>

      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">{t('modules.finance.expectedTotal')}</span>
          <span className="text-sm font-semibold text-gray-800">{formatMAD(settlement.expected_cash_total)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">{t('modules.finance.countedTotal')}</span>
          <span className="text-sm font-semibold text-gray-800">{formatMAD(settlement.counted_cash_total ?? 0)}</span>
        </div>
        <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-700">{t('modules.finance.gap')}</span>
          <span className={`text-lg font-bold ${gap === 0 ? 'text-green-600' : 'text-orange-500'}`}>{formatMAD(gap)}</span>
        </div>
      </div>

      {gap > 0 && result.vendor?.name && (
        <div className="rounded-xl bg-orange-50 border border-orange-200 p-4 space-y-2">
          <p className="text-sm font-semibold text-orange-700">
            {t('finance.settlements.debtImputed')} {result.vendor.name}
          </p>
          {result.vendor_personal_debt_balance != null && (
            <p className="text-sm text-orange-600">
              {t('finance.settlements.newDebtBalance')} : <span className="font-bold">{formatMAD(result.vendor_personal_debt_balance)}</span>
            </p>
          )}
        </div>
      )}

      <button onClick={onClose}
        className="w-full py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700">
        {t('finance.settlements.new')}
      </button>
    </div>
  );
};

// ── Reconcile Form ────────────────────────────────────────────────────────────
const ReconcileForm = ({ settlement, onReconciled }: { settlement: Settlement; onReconciled: (result: Settlement) => void }) => {
  const { t } = useTranslation();
  const [countedCash, setCountedCash] = useState('');
  const [notes, setNotes] = useState('');
  const [notesError, setNotesError] = useState('');
  const [saving, setSaving] = useState(false);

  const countedNum = countedCash !== '' ? parseFloat(countedCash) : null;
  const gap = countedNum != null ? countedNum - settlement.expected_cash_total : null;
  const hasGap = gap != null && gap !== 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (countedNum == null) { toast.error(t('errors.validationError')); return; }
    if (hasGap && !notes.trim()) { setNotesError(t('finance.settlements.notesRequired')); return; }
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
      const msg = err?.response?.data?.message ?? t('errors.generic');
      if (errCode === 'FINANCE_GAP_NOTE_REQUIRED') setNotesError(msg);
      else toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const isPending = settlement.reconciled_at === null;

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      <div className="rounded-xl bg-gray-100 border border-gray-200 p-5 text-center">
        <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">{t('modules.finance.expectedTotal')}</p>
        <p className="text-4xl font-bold text-gray-900">{formatMAD(settlement.expected_cash_total)}</p>
      </div>

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
            <span className="text-gray-500">{t('common.status')}</span>
            <span className={`font-semibold ${isPending ? 'text-amber-600' : 'text-green-600'}`}>
              {isPending ? t('finance.settlements.pending') : t('finance.settlements.reconciled')}
            </span>
          </div>
        </div>
      )}

      {isPending ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.settlements.countedAmountLabel')} *</label>
            <input type="number" step="0.01" value={countedCash} onChange={e => setCountedCash(e.target.value)} placeholder="0.00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg font-semibold text-center focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          {hasGap && gap != null && (
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-center">
              <p className="text-xs text-orange-600 font-semibold mb-1">{t('finance.settlements.gapDetected')}</p>
              <p className="text-xl font-bold text-orange-600">{formatMAD(Math.abs(gap))}</p>
              <p className="text-xs text-orange-500 mt-1">{gap > 0 ? t('finance.settlements.surplus') : t('finance.settlements.deficit')}</p>
            </div>
          )}
          <div>
            <label className={`block text-sm font-medium mb-1 ${hasGap ? 'text-red-600' : 'text-gray-700'}`}>
              {t('common.notes')} {hasGap ? <span className="text-red-500">*</span> : `(${t('common.optional')})`}
            </label>
            <textarea value={notes} onChange={e => { setNotes(e.target.value); if (notesError) setNotesError(''); }} rows={3}
              placeholder={hasGap ? t('finance.settlements.notesRequired') : t('finance.settlements.notesOptional')}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none ${notesError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-emerald-500'}`} />
            {notesError && <p className="text-xs text-red-500 mt-1">{notesError}</p>}
          </div>
          <button type="submit" disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? t('common.saving') : t('finance.settlements.validate')}
          </button>
        </form>
      ) : (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-green-700">{t('finance.settlements.alreadyReconciled')}</p>
          {settlement.reconciled_at && <p className="text-xs text-green-600 mt-1">{new Date(settlement.reconciled_at).toLocaleString('fr-MA')}</p>}
          {settlement.cash_difference != null && (
            <p className="text-sm mt-2 font-semibold text-gray-700">
              {t('finance.settlements.gapLabel')} : <span className={settlement.cash_difference === 0 ? 'text-green-600' : 'text-orange-500'}>{formatMAD(settlement.cash_difference)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export const SettlementsPage = () => {
  const { t } = useTranslation();
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
      toast.error(t('finance.settlements.loadError'));
    } finally {
      setLoading(false);
    }
  }, [pendingOnly, t]);

  useEffect(() => { load(); }, [load]);

  const leftContent = (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-emerald-600" />
          {t('modules.finance.settlements')}
        </span>
        <button onClick={load} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="p-3 border-b border-gray-200">
        <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-medium">
          <button onClick={() => setPendingOnly(true)}
            className={`flex-1 py-1.5 transition-colors ${pendingOnly ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            {t('finance.settlements.pendingOnly')}
          </button>
          <button onClick={() => setPendingOnly(false)}
            className={`flex-1 py-1.5 transition-colors ${!pendingOnly ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            {t('finance.settlements.viewAll')}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 text-emerald-500 animate-spin" />
          </div>
        ) : settlements.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">{t('finance.settlements.noReconciliation')}</p>
        ) : (
          settlements.map(s => (
            <SettlementCard key={s.id} settlement={s} isSelected={selected?.id === s.id}
              onClick={() => { setSelected(s); setReconcileResult(null); }} />
          ))
        )}
      </div>
    </div>
  );

  const mainContent = (() => {
    if (!selected) return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-400">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t('finance.settlements.selectHint')}</p>
        </div>
      </div>
    );
    if (reconcileResult) return (
      <ReconcileResult settlement={selected} result={reconcileResult}
        onClose={() => { setReconcileResult(null); setSelected(null); }} />
    );
    return <ReconcileForm settlement={selected} onReconciled={r => { setReconcileResult(r); load(); }} />;
  })();

  return <MasterLayout leftContent={leftContent} mainContent={mainContent} />;
};

export default SettlementsPage;
