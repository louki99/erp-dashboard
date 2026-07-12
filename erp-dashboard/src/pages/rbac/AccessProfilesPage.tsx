import { useState, useEffect, useCallback } from 'react';
import { Copy, Plus, Save, Sliders, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { rbacApi } from '@/services/api/rbacApi';
import type { AccessProfile } from '@/types/rbac.types';
import { RbacNav } from './RbacNav';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ActiveDot = ({ active }: { active: boolean }) => (
  <span className="inline-flex items-center gap-1.5 text-xs">
    <span className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
    {active ? 'Actif' : 'Inactif'}
  </span>
);

// ── KV Editor ─────────────────────────────────────────────────────────────────

interface KvEntry { key: string; value: string }

interface KvEditorProps {
  entries: KvEntry[];
  onChange: (entries: KvEntry[]) => void;
}

const KvEditor = ({ entries, onChange }: KvEditorProps) => {
  const addRow = () => onChange([...entries, { key: '', value: '' }]);
  const removeRow = (i: number) => onChange(entries.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: 'key' | 'value', val: string) => {
    const next = entries.map((e, idx) => idx === i ? { ...e, [field]: val } : e);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {entries.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={entry.key}
            onChange={e => updateRow(i, 'key', e.target.value)}
            placeholder="Clé"
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-gray-400">:</span>
          <input
            type="text"
            value={entry.value}
            onChange={e => updateRow(i, 'value', e.target.value)}
            placeholder="Valeur"
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button onClick={() => removeRow(i)} className="p-1 text-gray-400 hover:text-red-500">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={addRow}
        className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
      >
        <Plus className="w-3 h-3" /> Ajouter une entrée
      </button>
    </div>
  );
};

const settingsToKv = (settings?: Record<string, unknown>): KvEntry[] => {
  if (!settings) return [];
  return Object.entries(settings).map(([key, value]) => ({ key, value: String(value) }));
};

const kvToSettings = (entries: KvEntry[]): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const { key, value } of entries) {
    if (key.trim()) result[key.trim()] = value;
  }
  return result;
};

// ── Create Profile Modal ──────────────────────────────────────────────────────

interface CreateProfileModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const CreateProfileModal = ({ onClose, onCreated }: CreateProfileModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [kvEntries, setKvEntries] = useState<KvEntry[]>([]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Veuillez saisir un nom'); return; }
    setSaving(true);
    try {
      await rbacApi.createAccessProfile({
        name: name.trim(),
        description: description.trim() || undefined,
        is_active: isActive,
        settings: kvToSettings(kvEntries),
      });
      toast.success('Profil créé');
      onCreated();
      onClose();
    } catch {
      toast.error('Erreur lors de la création du profil');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Nouveau profil d'accès</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="create-active"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="create-active" className="text-sm text-gray-700">Profil actif</label>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Paramètres (settings)</p>
            <KvEditor entries={kvEntries} onChange={setKvEntries} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Clone Profile Modal ───────────────────────────────────────────────────────

interface CloneProfileModalProps {
  profile: AccessProfile;
  onClose: () => void;
  onCloned: () => void;
}

const CloneProfileModal = ({ profile, onClose, onCloned }: CloneProfileModalProps) => {
  const [name, setName] = useState(`${profile.name} — copie`);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Veuillez saisir un nom'); return; }
    setSaving(true);
    try {
      await rbacApi.cloneAccessProfile(profile.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      toast.success('Profil cloné');
      onCloned();
      onClose();
    } catch {
      toast.error('Erreur lors du clonage');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cloner « {profile.name} »</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du nouveau profil</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optionnel)</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Clonage…' : 'Cloner'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Profile Detail Panel ──────────────────────────────────────────────────────

interface ProfileDetailPanelProps {
  profile: AccessProfile;
  onUpdated: () => void;
  onClone: () => void;
}

const ProfileDetailPanel = ({ profile, onUpdated, onClone }: ProfileDetailPanelProps) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [description, setDescription] = useState(profile.description ?? '');
  const [isActive, setIsActive] = useState(profile.is_active);
  const [kvEntries, setKvEntries] = useState<KvEntry[]>(settingsToKv(profile.settings));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(profile.name);
    setDescription(profile.description ?? '');
    setIsActive(profile.is_active);
    setKvEntries(settingsToKv(profile.settings));
    setEditing(false);
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await rbacApi.updateAccessProfile(profile.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        is_active: isActive,
        settings: kvToSettings(kvEntries),
      });
      if (res.success) {
        toast.success('Profil mis à jour');
        setEditing(false);
        onUpdated();
      } else {
        toast.error(res.message ?? 'Erreur lors de la mise à jour');
      }
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string; error?: string; error_code?: string } } };
      const errorCode = anyErr?.response?.data?.error_code;
      const msg = anyErr?.response?.data?.message ?? anyErr?.response?.data?.error ?? 'Erreur';
      if (errorCode === 'RBAC_PROFILE_HAS_USERS') {
        toast.error(msg || 'Impossible de désactiver : ce profil est utilisé par des utilisateurs actifs');
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div>
          <h2 className="font-semibold text-gray-900">{profile.name}</h2>
          <div className="flex items-center gap-3 mt-0.5">
            <ActiveDot active={profile.is_active} />
            <span className="text-xs text-gray-500">{profile.users_count} utilisateur(s)</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClone}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Copy className="w-3.5 h-3.5" />
            Cloner
          </button>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              Modifier
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {editing ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-active"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="edit-active" className="text-sm text-gray-700">Profil actif</label>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Paramètres (settings)</p>
              <KvEditor entries={kvEntries} onChange={setKvEntries} />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Annuler
              </button>
            </div>
          </>
        ) : (
          <>
            {profile.description && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Description</p>
                <p className="text-sm text-gray-700">{profile.description}</p>
              </div>
            )}
            {profile.settings && Object.keys(profile.settings).length > 0 && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Paramètres</p>
                <table className="text-sm w-full border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Clé</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Valeur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(profile.settings).map(([k, v]) => (
                      <tr key={k} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-mono text-xs text-gray-600">{k}</td>
                        <td className="px-3 py-2 text-gray-700">{String(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export function AccessProfilesPage() {
  const [profiles, setProfiles] = useState<AccessProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AccessProfile | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [cloneTarget, setCloneTarget] = useState<AccessProfile | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await rbacApi.getAccessProfiles();
      if (res.success) {
        setProfiles(res.data);
        // Re-sync selected if it was set
        if (selected) {
          const updated = res.data.find(p => p.id === selected.id);
          setSelected(updated ?? null);
        }
      }
    } catch {
      toast.error('Erreur lors du chargement des profils');
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => { fetchProfiles(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const leftPanel = <RbacNav />;

  const mainPanel = (
    <div className="h-full flex overflow-hidden bg-gray-50">
      {/* Left list */}
      <div className={`flex flex-col bg-white border-r border-gray-200 shrink-0 ${selected ? 'w-72' : 'w-full max-w-lg'}`}>
        {/* List header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div>
            <h1 className="text-sm font-bold text-gray-900">Profils d'accès</h1>
            <p className="text-[10px] text-gray-400">{profiles.length} profil{profiles.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-3 h-3" />
            Nouveau
          </button>
        </div>

        {/* Card list */}
        {loading ? (
          <div className="flex items-center justify-center flex-1 text-sm text-gray-400">Chargement…</div>
        ) : profiles.length === 0 ? (
          <div className="flex items-center justify-center flex-1 text-sm text-gray-400">Aucun profil</div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {profiles.map(profile => (
              <button
                key={profile.id}
                onClick={() => setSelected(profile)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                  selected?.id === profile.id ? 'bg-indigo-50 border-l-2 border-l-indigo-600' : 'border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-0.5">
                  <span className={`text-sm font-semibold leading-tight ${selected?.id === profile.id ? 'text-indigo-700' : 'text-gray-900'}`}>
                    {profile.name}
                  </span>
                  <ActiveDot active={profile.is_active} />
                </div>
                {profile.description && (
                  <p className="text-xs text-gray-500 line-clamp-1 mb-1.5">{profile.description}</p>
                )}
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
                  {profile.users_count} utilisateur{profile.users_count !== 1 ? 's' : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right detail */}
      {selected ? (
        <div className="flex-1 overflow-hidden">
          <ProfileDetailPanel
            profile={selected}
            onUpdated={fetchProfiles}
            onClone={() => setCloneTarget(selected)}
          />
        </div>
      ) : (
        !loading && profiles.length > 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <Sliders className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-500">Sélectionnez un profil</p>
            <p className="text-xs text-gray-400">Cliquez sur un profil pour voir ses détails</p>
          </div>
        )
      )}
    </div>
  );

  return (
    <>
      <MasterLayout leftContent={leftPanel} mainContent={mainPanel} />
      {showCreate && (
        <CreateProfileModal onClose={() => setShowCreate(false)} onCreated={fetchProfiles} />
      )}
      {cloneTarget && (
        <CloneProfileModal
          profile={cloneTarget}
          onClose={() => setCloneTarget(null)}
          onCloned={fetchProfiles}
        />
      )}
    </>
  );
}
