import { useState, useEffect, useCallback } from 'react';
import { Search, X, BookOpen, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { financeApi } from '@/services/api/financeApi';
import type { LedgerEntry, LedgerTotals } from '@/types/finance.types';

// ── Helpers ────────────────────────────────────────────────────────────────────
const formatMAD = (n: number | string) => {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (!num || isNaN(num)) return '—';
  return num.toLocaleString('fr-MA', { minimumFractionDigits: 2 }) + ' MAD';
};

// ── Contre-écriture Modal ─────────────────────────────────────────────────────
interface AdjustModalProps {
  entry: LedgerEntry;
  onClose: () => void;
  onDone: () => void;
}

const AdjustModal = ({ entry, onClose, onDone }: AdjustModalProps) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [dateComptable, setDateComptable] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { toast.error(t('finance.ledger.reasonRequired')); return; }
    setSaving(true);
    try {
      await financeApi.adjustLedger(entry.id, {
        reason,
        ...(dateComptable ? { date_comptable: dateComptable } : {}),
      });
      toast.success(t('finance.ledger.saved'));
      onDone();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t('finance.ledger.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('modules.finance.counterEntry')}</h2>
        <p className="text-xs text-gray-500 mb-4">#{entry.id} — {entry.journal_code} — {entry.compte_comptable}</p>

        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 mb-4 text-xs space-y-1">
          <div><span className="text-gray-500">{t('finance.ledger.labelField')} :</span> <span className="text-gray-800">{entry.libelle}</span></div>
          <div><span className="text-gray-500">{t('finance.ledger.debitField')} :</span> <span className="text-green-700 font-semibold">{formatMAD(entry.debit_amount)}</span></div>
          <div><span className="text-gray-500">{t('finance.ledger.creditField')} :</span> <span className="text-red-600 font-semibold">{formatMAD(entry.credit_amount)}</span></div>
          <div><span className="text-gray-500">{t('finance.ledger.accountingDateLabel')} :</span> <span className="text-gray-800">{entry.date_comptable}</span></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.ledger.reasonLabel')} *</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              placeholder={t('finance.ledger.reasonPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.ledger.accountingDateOptional')}</label>
            <input
              type="date"
              value={dateComptable}
              onChange={e => setDateComptable(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export const LedgerPage = () => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [totals, setTotals] = useState<LedgerTotals>({ total_debit: 0, total_credit: 0 });
  const [loading, setLoading] = useState(false);
  const [adjustEntry, setAdjustEntry] = useState<LedgerEntry | null>(null);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [journalCode, setJournalCode] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [compteComptable, setCompteComptable] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeApi.getLedger({
        ...(fromDate ? { from_date: fromDate } : {}),
        ...(toDate ? { to_date: toDate } : {}),
        ...(journalCode ? { journal_code: journalCode } : {}),
        ...(typeFilter !== 'ALL' ? { type: typeFilter } : {}),
        ...(compteComptable ? { compte_comptable: compteComptable } : {}),
        per_page: 500,
      });
      setEntries(Array.isArray(res.data) ? res.data : []);
      if (res.totals) setTotals(res.totals);
    } catch {
      toast.error(t('finance.ledger.loadError'));
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, journalCode, typeFilter, compteComptable, t]);

  useEffect(() => { load(); }, []);

  const handleReset = () => {
    setFromDate('');
    setToDate('');
    setJournalCode('');
    setTypeFilter('ALL');
    setCompteComptable('');
  };

  const ceMarker = t('finance.ledger.ceMarker');

  const columnDefs = [
    { headerName: t('finance.ledger.col.entry'), field: 'id', width: 70, suppressAutoFit: true },
    { headerName: t('finance.ledger.col.journal'), field: 'journal_code', width: 110 },
    { headerName: t('finance.ledger.col.account'), field: 'compte_comptable', width: 120 },
    { headerName: t('finance.ledger.col.accountingDate'), field: 'date_comptable', width: 130 },
    {
      headerName: t('finance.ledger.col.label'),
      field: 'libelle',
      flex: 2,
      cellRenderer: (p: any) => {
        const val: string = p.value ?? '';
        const isContre = val.startsWith('[CONTRE-ÉCRITURE');
        return (
          <span className="text-xs">
            {isContre ? (
              <span className="inline-flex items-center gap-1">
                <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded">{ceMarker}</span>
                {val}
              </span>
            ) : val}
          </span>
        );
      },
    },
    {
      headerName: t('finance.ledger.col.debit'),
      field: 'debit_amount',
      width: 130,
      cellStyle: { textAlign: 'right' },
      cellRenderer: (p: any) => {
        const v = parseFloat(p.value ?? '0');
        return v > 0 ? <span className="text-green-700 font-semibold text-xs">{formatMAD(v)}</span> : <span className="text-gray-300 text-xs">—</span>;
      },
    },
    {
      headerName: t('finance.ledger.col.credit'),
      field: 'credit_amount',
      width: 130,
      cellStyle: { textAlign: 'right' },
      cellRenderer: (p: any) => {
        const v = parseFloat(p.value ?? '0');
        return v > 0 ? <span className="text-red-600 font-semibold text-xs">{formatMAD(v)}</span> : <span className="text-gray-300 text-xs">—</span>;
      },
    },
    {
      headerName: t('finance.ledger.col.action'),
      field: 'id',
      width: 130,
      filter: false,
      sortable: false,
      cellRenderer: (p: any) => (
        <button
          onClick={() => setAdjustEntry(p.data)}
          className="text-xs px-2 py-1 rounded border border-amber-300 text-amber-700 hover:bg-amber-50"
        >
          {t('modules.finance.counterEntry')}
        </button>
      ),
    },
  ];

  const filterBar = (
    <div className="border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('finance.ledger.filterFrom')}</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('finance.ledger.filterTo')}</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('finance.ledger.filterJournal')}</label>
          <input type="text" value={journalCode} onChange={e => setJournalCode(e.target.value)}
            placeholder={t('finance.journals.col.code')}
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-32" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('finance.ledger.filterType')}</label>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as 'ALL' | 'IN' | 'OUT')}
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="ALL">{t('finance.ledger.allJournals')}</option>
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('finance.ledger.filterAccount')}</label>
          <input type="text" value={compteComptable} onChange={e => setCompteComptable(e.target.value)}
            placeholder={t('finance.ledger.filterAccountPlaceholder')}
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-28" />
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
          <Search className="w-4 h-4" /> {t('common.search')}
        </button>
        <button onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
          <X className="w-4 h-4" /> {t('common.reset')}
        </button>
      </div>
    </div>
  );

  const mainContent = (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-emerald-600" />
        <h1 className="text-base font-semibold text-gray-800">{t('modules.finance.ledger')}</h1>
      </div>
      {filterBar}
      <div className="flex-1 overflow-hidden">
        <DataGrid rowData={entries} columnDefs={columnDefs} loading={loading} rowSelection="single" suppressAutoFit />
      </div>
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 flex items-center justify-end gap-8 text-sm">
        <span className="text-gray-500">{t('finance.ledger.totalDebit')} :</span>
        <span className="font-bold text-green-700">{formatMAD(totals.total_debit)}</span>
        <span className="text-gray-500 ml-4">{t('finance.ledger.totalCredit')} :</span>
        <span className="font-bold text-red-600">{formatMAD(totals.total_credit)}</span>
      </div>
    </div>
  );

  return (
    <>
      <MasterLayout leftContent={null} mainContent={mainContent} />
      {adjustEntry && (
        <AdjustModal entry={adjustEntry} onClose={() => setAdjustEntry(null)} onDone={load} />
      )}
    </>
  );
};

export default LedgerPage;
