import { useState, useEffect, useCallback, type ComponentType, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, BookOpen, RefreshCw, Calendar, Filter, RotateCcw, FileSpreadsheet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import type { ICellRendererParams } from 'ag-grid-community';
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
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message ?? t('finance.ledger.error'));
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
  const [searchParams] = useSearchParams();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [totals, setTotals] = useState<LedgerTotals>({ total_debit: 0, total_credit: 0 });
  const [loading, setLoading] = useState(false);
  const [adjustEntry, setAdjustEntry] = useState<LedgerEntry | null>(null);
  const [resultCount, setResultCount] = useState(0);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  // Deep-link support (?journal=B8ESP) — a caisse's "Grand livre" tab links
  // straight into this filtered view instead of duplicating a ledger screen.
  const [journalCode, setJournalCode] = useState(searchParams.get('journal') ?? '');
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
      const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setEntries(list);
      setResultCount(list.length);
      if (res.totals) setTotals(res.totals);
    } catch {
      toast.error(t('finance.ledger.loadError'));
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, journalCode, typeFilter, compteComptable, t]);

  useEffect(() => { load(); }, [load]);

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
      cellRenderer: (p: ICellRendererParams<LedgerEntry>) => {
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
      cellRenderer: (p: ICellRendererParams<LedgerEntry>) => {
        const v = parseFloat(p.value ?? '0');
        return v > 0 ? <span className="text-green-700 font-semibold text-xs">{formatMAD(v)}</span> : <span className="text-gray-300 text-xs">—</span>;
      },
    },
    {
      headerName: t('finance.ledger.col.credit'),
      field: 'credit_amount',
      width: 130,
      cellStyle: { textAlign: 'right' },
      cellRenderer: (p: ICellRendererParams<LedgerEntry>) => {
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
      cellRenderer: (p: ICellRendererParams<LedgerEntry>) => (
        <button
          onClick={() => setAdjustEntry(p.data ?? null)}
          className="text-xs px-2 py-1 rounded border border-amber-300 text-amber-700 hover:bg-amber-50"
        >
          {t('modules.finance.counterEntry')}
        </button>
      ),
    },
  ];

  const hasActiveFilters = fromDate || toDate || journalCode || typeFilter !== 'ALL' || compteComptable;

  const FilterInput = ({
    label,
    icon: Icon,
    children,
  }: {
    label: string;
    icon?: ComponentType<{ className?: string }>;
    children: ReactNode;
  }) => (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 uppercase tracking-wide">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </label>
      {children}
    </div>
  );

  const filterBar = (
    <div className="bg-white border-b border-gray-200 px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Filter className="w-4 h-4 text-emerald-600" />
          {t('common.filter')}
          {hasActiveFilters && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {t('common.active')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={!hasActiveFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t('common.reset')}
          </button>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            {t('common.search')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <FilterInput label={t('finance.ledger.filterFrom')} icon={Calendar}>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
          />
        </FilterInput>

        <FilterInput label={t('finance.ledger.filterTo')} icon={Calendar}>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
          />
        </FilterInput>

        <FilterInput label={t('finance.ledger.filterJournal')} icon={FileSpreadsheet}>
          <input
            type="text"
            value={journalCode}
            onChange={e => setJournalCode(e.target.value)}
            placeholder={t('finance.journals.col.code')}
            className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
          />
        </FilterInput>

        <FilterInput label={t('finance.ledger.filterType')}>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as 'ALL' | 'IN' | 'OUT')}
            className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white transition-shadow"
          >
            <option value="ALL">{t('finance.ledger.allJournals')}</option>
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
          </select>
        </FilterInput>

        <FilterInput label={t('finance.ledger.filterAccount')}>
          <input
            type="text"
            value={compteComptable}
            onChange={e => setCompteComptable(e.target.value)}
            placeholder={t('finance.ledger.filterAccountPlaceholder')}
            className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
          />
        </FilterInput>
      </div>
    </div>
  );

  const mainContent = (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="px-5 py-3 bg-white border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <BookOpen className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">{t('modules.finance.ledger')}</h1>
            <p className="text-[11px] text-gray-500">
              {loading ? t('common.loading') : `${resultCount} ${t('finance.ledger.col.entry').toLowerCase()}(s)`}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
          title={t('common.refresh')}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {filterBar}
      <div className="flex-1 overflow-hidden p-1">
        <DataGrid rowData={entries} columnDefs={columnDefs} loading={loading} rowSelection="single" suppressAutoFit />
      </div>
      <div className="border-t border-gray-200 bg-white px-5 py-3 flex items-center justify-between text-sm">
        <span className="text-xs text-gray-500">
          {resultCount > 0
            ? `${resultCount} ligne(s) affichée(s)`
            : t('common.noData')}
        </span>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{t('finance.ledger.totalDebit')}</span>
            <span className="font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-md">{formatMAD(totals.total_debit)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{t('finance.ledger.totalCredit')}</span>
            <span className="font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-md">{formatMAD(totals.total_credit)}</span>
          </div>
        </div>
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
