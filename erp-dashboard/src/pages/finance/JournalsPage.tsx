import { useState, useEffect, useCallback } from 'react';
import { Plus, Save, RefreshCw, Landmark } from 'lucide-react';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { financeApi } from '@/services/api/financeApi';
import type { Journal } from '@/types/finance.types';

// ── Helpers ────────────────────────────────────────────────────────────────────
const formatMAD = (n: number) =>
  n.toLocaleString('fr-MA', { minimumFractionDigits: 2 }) + ' MAD';

type MethodSuffix = 'ESP' | 'CHQ' | 'EFF' | 'VIR' | 'VER';

const METHOD_COLORS: Record<MethodSuffix, string> = {
  ESP: 'bg-green-100 text-green-800',
  CHQ: 'bg-blue-100 text-blue-800',
  EFF: 'bg-amber-100 text-amber-800',
  VIR: 'bg-indigo-100 text-indigo-800',
  VER: 'bg-purple-100 text-purple-800',
};

const MethodBadge = ({ suffix }: { suffix: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${METHOD_COLORS[suffix as MethodSuffix] ?? 'bg-gray-100 text-gray-700'}`}>
    {suffix}
  </span>
);

const ActiveDot = ({ active }: { active: boolean }) => (
  <span className="inline-flex items-center gap-1.5 text-xs">
    <span className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
    {active ? 'Actif' : 'Inactif'}
  </span>
);

// ── Create Journal Modal ───────────────────────────────────────────────────────
interface CreateModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const CreateJournalModal = ({ onClose, onCreated }: CreateModalProps) => {
  const [userId, setUserId] = useState('');
  const [methodSuffix, setMethodSuffix] = useState<MethodSuffix>('ESP');
  const [branchId, setBranchId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) { toast.error('Veuillez saisir un ID utilisateur'); return; }
    setSaving(true);
    try {
      await financeApi.createJournal({
        user_id: Number(userId),
        method_suffix: methodSuffix,
        ...(branchId ? { branch_id: Number(branchId) } : {}),
      });
      toast.success('Journal créé avec succès');
      onCreated();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data?.error ?? 'Erreur lors de la création';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Nouveau journal</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID Utilisateur *</label>
            <input
              type="number"
              value={userId}
              onChange={e => setUserId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="ex: 42"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Méthode *</label>
            <select
              value={methodSuffix}
              onChange={e => setMethodSuffix(e.target.value as MethodSuffix)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {(['ESP', 'CHQ', 'EFF', 'VIR', 'VER'] as MethodSuffix[]).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID Agence (optionnel)</label>
            <input
              type="number"
              value={branchId}
              onChange={e => setBranchId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="ex: 1"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Detail Panel ──────────────────────────────────────────────────────────────
interface DetailPanelProps {
  journal: Journal;
  onSaved: () => void;
}

const JournalDetailPanel = ({ journal, onSaved }: DetailPanelProps) => {
  const [isActive, setIsActive] = useState(journal.is_active);
  const [currency, setCurrency] = useState(journal.currency);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIsActive(journal.is_active);
    setCurrency(journal.currency);
  }, [journal]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await financeApi.updateJournal(journal.id, { is_active: isActive, currency });
      toast.success('Journal mis à jour');
      onSaved();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data?.error ?? 'Erreur lors de la mise à jour';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      {/* Balance cards */}
      <div className="grid grid-cols-1 gap-3">
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Solde calculé</p>
          <p className="text-2xl font-bold text-gray-800">{formatMAD(journal.computed_balance)}</p>
        </div>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <p className="text-xs text-amber-600 uppercase font-semibold tracking-wide mb-1">En transit</p>
          <p className="text-2xl font-bold text-amber-700">{formatMAD(journal.transit_balance)}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
          <p className="text-xs text-emerald-600 uppercase font-semibold tracking-wide mb-1">Disponible</p>
          <p className="text-2xl font-bold text-emerald-700">{formatMAD(journal.available_balance)}</p>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Code journal</p>
          <p className="font-mono text-sm font-semibold text-gray-800 bg-gray-100 rounded px-2 py-1 inline-block">{journal.code}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Propriétaire</p>
          <p className="text-sm text-gray-800">{journal.user.name}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Méthode</p>
          <MethodBadge suffix={journal.method_suffix} />
        </div>
      </div>

      {/* Edit form */}
      <div className="rounded-xl border border-gray-200 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Modifier</h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700">Journal actif</span>
          <button
            onClick={() => setIsActive(v => !v)}
            className={`relative inline-flex w-11 h-6 rounded-full transition-colors ${isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}
          >
            <span className={`inline-block w-4 h-4 mt-1 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Devise</label>
          <input
            type="text"
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="MAD"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer
        </button>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export const JournalsPage = () => {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Journal | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeApi.getJournals();
      setJournals(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error('Erreur lors du chargement des journaux');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const columnDefs = [
    {
      headerName: 'Code',
      field: 'code',
      cellRenderer: (p: any) => (
        <span className="font-mono text-xs bg-gray-100 text-gray-800 rounded px-1.5 py-0.5">{p.value}</span>
      ),
    },
    {
      headerName: 'Méthode',
      field: 'method_suffix',
      cellRenderer: (p: any) => <MethodBadge suffix={p.value} />,
    },
    { headerName: 'Propriétaire', field: 'user.name', valueGetter: (p: any) => p.data?.user?.name },
    {
      headerName: 'Solde calculé',
      field: 'computed_balance',
      cellRenderer: (p: any) => <span className="text-xs">{formatMAD(p.value ?? 0)}</span>,
    },
    {
      headerName: 'Transit',
      field: 'transit_balance',
      cellRenderer: (p: any) => <span className="text-xs text-amber-600">{formatMAD(p.value ?? 0)}</span>,
    },
    {
      headerName: 'Disponible',
      field: 'available_balance',
      cellRenderer: (p: any) => <span className="text-xs text-emerald-700 font-semibold">{formatMAD(p.value ?? 0)}</span>,
    },
    {
      headerName: 'Statut',
      field: 'is_active',
      cellRenderer: (p: any) => <ActiveDot active={!!p.value} />,
    },
  ];

  const leftContent = (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Landmark className="w-4 h-4 text-emerald-600" />
          Journaux
        </span>
        <div className="flex items-center gap-1">
          <button onClick={load} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Actualiser">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
          >
            <Plus className="w-3.5 h-3.5" /> Nouveau
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <DataGrid
          rowData={journals}
          columnDefs={columnDefs}
          loading={loading}
          rowSelection="single"
          onRowClicked={(e: any) => setSelected(e.data)}
        />
      </div>
    </div>
  );

  const mainContent = selected ? (
    <JournalDetailPanel journal={selected} onSaved={load} />
  ) : (
    <div className="h-full flex items-center justify-center">
      <div className="text-center text-gray-400">
        <Landmark className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Sélectionnez un journal pour voir ses détails</p>
      </div>
    </div>
  );

  return (
    <>
      <MasterLayout leftContent={leftContent} mainContent={mainContent} />
      {showCreate && (
        <CreateJournalModal
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
    </>
  );
};

export default JournalsPage;
