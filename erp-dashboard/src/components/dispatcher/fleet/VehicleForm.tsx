import { useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Plus, Pencil, Truck, Hash, Tag, Gauge, Snowflake, Building2, Box } from 'lucide-react';
import toast from 'react-hot-toast';

import { useCreateVehicle, useUpdateVehicle } from '@/hooks/dispatcher/useDispatcherFleet';
import type { CreateVehiclePayload, UpdateVehiclePayload, Vehicle } from '@/types/dispatcher.types';

const VEHICLE_TYPES: { value: 'van' | 'truck' | 'motorcycle'; label: string; icon: string }[] = [
  { value: 'van', label: 'Fourgon', icon: '🚐' },
  { value: 'truck', label: 'Camion', icon: '🚛' },
  { value: 'motorcycle', label: 'Moto', icon: '🏍️' },
];

const VEHICLE_STATUSES: { value: 'active' | 'maintenance' | 'retired'; label: string; color: string }[] = [
  { value: 'active', label: 'Actif', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'maintenance', label: 'En maintenance', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'retired', label: 'Retiré', color: 'bg-gray-100 text-gray-600 border-gray-200' },
];

const currentYear = new Date().getFullYear();

const emptyCreateForm: CreateVehiclePayload = {
  plate_number: '',
  make: '',
  model: '',
  year: currentYear,
  type: 'van',
  internal_code: '',
  branch_code: '',
  cold_chain_enabled: false,
  payload_kg: null,
  fuel_type: '',
};

interface VehicleFormProps {
  mode: 'create' | 'edit';
  vehicle?: Vehicle;
  branches: { code: string; name: string }[];
  defaultBranchCode?: string;
  onBack: () => void;
  onSuccess: () => void;
}

const labelCls = 'block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5';
const inputBaseCls = 'w-full px-3.5 py-2.5 text-sm text-gray-800 bg-white border rounded-xl outline-none transition-all focus:ring-2 focus:ring-sage-200 focus:border-sage-400';
const sectionCls = 'bg-white rounded-2xl border border-gray-100 shadow-sm p-5';
const sectionTitleCls = 'text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2 mb-4';

const FieldError = ({ message }: { message?: string }) =>
  message ? <p className="text-[11px] text-red-600 mt-1.5 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-red-500" />{message}</p> : null;

const RatioField = ({
  label, value, onChange, error,
}: {
  label: string;
  value?: number | null;
  onChange: (v: number | null) => void;
  error?: string;
}) => {
  const pct = value != null ? Math.round(value * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className={labelCls}>{label}</label>
        <span className="text-xs font-bold text-sage-700 bg-sage-50 px-2 py-0.5 rounded-md">{pct}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value ?? 0}
        onChange={(e) => {
          const v = Number(e.target.value);
          onChange(v === 0 ? null : v);
        }}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sage-600"
      />
      <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-medium">
        <span>0%</span>
        <span>100%</span>
      </div>
      <FieldError message={error} />
    </div>
  );
};

const getInitialForm = (mode: 'create' | 'edit', vehicle?: Vehicle, defaultBranchCode?: string): UpdateVehiclePayload => {
  if (mode === 'create') {
    return { ...emptyCreateForm, branch_code: defaultBranchCode ?? '' };
  }
  return {
    plate_number: vehicle?.plate_number ?? vehicle?.plate ?? '',
    internal_code: vehicle?.internal_code ?? '',
    make: vehicle?.make ?? '',
    model: vehicle?.model ?? '',
    year: vehicle?.year,
    type: (vehicle?.type as CreateVehiclePayload['type']) ?? 'van',
    branch_code: vehicle?.branch_code ?? '',
    payload_kg: vehicle?.payload_kg ?? null,
    fuel_type: vehicle?.fuel_type ?? '',
    cold_chain_enabled: vehicle?.cold_chain_enabled,
    status: (vehicle?.status as UpdateVehiclePayload['status']) ?? 'active',
    capacity_volume: vehicle?.capacity_volume ?? null,
    capacity_weight: vehicle?.capacity_weight ?? null,
    capacity_length: vehicle?.capacity_length ?? null,
    capacity_width: vehicle?.capacity_width ?? null,
    capacity_height: vehicle?.capacity_height ?? null,
    usable_volume_ratio: vehicle?.usable_volume_ratio ?? null,
    loading_efficiency_ratio: vehicle?.loading_efficiency_ratio ?? null,
  };
};

export const VehicleForm = ({ mode, vehicle, branches, defaultBranchCode, onBack, onSuccess }: VehicleFormProps) => {
  const { create, loading: creating } = useCreateVehicle();
  const { update, loading: updating } = useUpdateVehicle();
  const loading = creating || updating;

  const [form, setForm] = useState<UpdateVehiclePayload>(() => getInitialForm(mode, vehicle, defaultBranchCode));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof UpdateVehiclePayload>(k: K, v: UpdateVehiclePayload[K]) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    setFieldErrors((prev) => { const n = { ...prev }; delete n[k as string]; return n; });
  };

  const title = mode === 'create' ? 'Nouveau véhicule' : 'Modifier le véhicule';
  const subtitle = mode === 'create' ? 'Ajouter un véhicule à la flotte' : vehicle?.plate_number ?? vehicle?.plate;

  const typeOption = useMemo(() => VEHICLE_TYPES.find((t) => t.value === form.type) ?? VEHICLE_TYPES[0], [form.type]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (mode === 'create') {
      if (!form.plate_number?.trim()) errors.plate_number = 'La plaque est obligatoire';
      if (!form.make?.trim()) errors.make = 'La marque est obligatoire';
      if (!form.model?.trim()) errors.model = 'Le modèle est obligatoire';
      if (!form.branch_code) errors.branch_code = "L'agence est obligatoire";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      toast.error('Veuillez corriger les champs indiqués');
      return;
    }

    const optionalNumber = (v: unknown) => (v != null && String(v) !== '' ? Number(v) : null);

    const payload: UpdateVehiclePayload = {
      plate_number: form.plate_number?.trim() || undefined,
      internal_code: form.internal_code?.trim() || undefined,
      make: form.make?.trim() || undefined,
      model: form.model?.trim() || undefined,
      year: form.year != null ? Number(form.year) : undefined,
      type: form.type,
      branch_code: form.branch_code || undefined,
      cold_chain_enabled: form.cold_chain_enabled,
      payload_kg: optionalNumber(form.payload_kg),
      fuel_type: form.fuel_type?.trim() || undefined,
      capacity_volume: optionalNumber(form.capacity_volume),
      capacity_weight: optionalNumber(form.capacity_weight),
      capacity_length: optionalNumber(form.capacity_length),
      capacity_width: optionalNumber(form.capacity_width),
      capacity_height: optionalNumber(form.capacity_height),
      usable_volume_ratio: optionalNumber(form.usable_volume_ratio),
      loading_efficiency_ratio: optionalNumber(form.loading_efficiency_ratio),
      ...(mode === 'edit' ? { status: form.status } : {}),
    };

    try {
      if (mode === 'create') {
        const res = await create(payload as CreateVehiclePayload);
        if (res.success) {
          toast.success(res.message || 'Véhicule créé avec succès');
          onSuccess();
        } else {
          toast.error('Échec de la création');
        }
      } else if (vehicle) {
        const res = await update(vehicle.id, payload);
        if (res.success) {
          toast.success(res.message || 'Véhicule mis à jour');
          onSuccess();
        } else {
          toast.error('Échec de la mise à jour');
        }
      }
    } catch (err: unknown) {
      const axiosErr = err && typeof err === 'object' && 'response' in err
        ? (err.response as { data?: { errors?: Record<string, string[]>; message?: string } })?.data
        : undefined;
      if (axiosErr?.errors) {
        const mapped: Record<string, string> = {};
        Object.entries(axiosErr.errors).forEach(([k, v]) => { mapped[k] = Array.isArray(v) ? v[0] : String(v); });
        setFieldErrors(mapped);
      }
      toast.error(axiosErr?.message ?? (mode === 'create' ? 'Échec de la création' : 'Échec de la mise à jour'), { duration: 6000 });
    }
  };

  const inputCls = (field: string) =>
    `${inputBaseCls} ${fieldErrors[field] ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-200' : 'border-gray-200'}`;

  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      <div className="px-6 py-4 border-b border-gray-200 bg-white/90 backdrop-blur-md shrink-0 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} title="Retour" className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center shrink-0 transition-colors">
          <ArrowLeft size={18} className="text-gray-500" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-gray-900 truncate">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {/* Header card */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center shrink-0 text-2xl">
              {typeOption.icon}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold truncate">{form.plate_number?.trim() || 'Nouveau véhicule'}</h3>
              <p className="text-sm text-slate-300 truncate">
                {[form.make, form.model].filter(Boolean).join(' ') || 'Saisissez les informations du véhicule'}
              </p>
            </div>
          </div>

          {/* Identification */}
          <div className={sectionCls}>
            <h4 className={sectionTitleCls}><Hash size={16} className="text-sage-600" /> Identification</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Plaque d'immatriculation {mode === 'create' && '*'}</label>
                <input
                  value={form.plate_number ?? ''}
                  onChange={(e) => set('plate_number', e.target.value)}
                  placeholder="12345-A-50"
                  className={`${inputCls('plate_number')} font-mono uppercase`}
                />
                <FieldError message={fieldErrors.plate_number} />
              </div>
              <div>
                <label className={labelCls}>Code interne</label>
                <input
                  value={form.internal_code ?? ''}
                  onChange={(e) => set('internal_code', e.target.value)}
                  placeholder="VAN-MERC-05"
                  className={`${inputCls('internal_code')} font-mono`}
                />
                <FieldError message={fieldErrors.internal_code} />
              </div>
            </div>
          </div>

          {/* Vehicle info */}
          <div className={sectionCls}>
            <h4 className={sectionTitleCls}><Truck size={16} className="text-sage-600" /> Caractéristiques</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className={labelCls}>Marque {mode === 'create' && '*'}</label>
                <input
                  value={form.make ?? ''}
                  onChange={(e) => set('make', e.target.value)}
                  placeholder="Mercedes"
                  className={inputCls('make')}
                />
                <FieldError message={fieldErrors.make} />
              </div>
              <div>
                <label className={labelCls}>Modèle {mode === 'create' && '*'}</label>
                <input
                  value={form.model ?? ''}
                  onChange={(e) => set('model', e.target.value)}
                  placeholder="Sprinter 316 CDI"
                  className={inputCls('model')}
                />
                <FieldError message={fieldErrors.model} />
              </div>
              <div>
                <label className={labelCls}>Année</label>
                <input
                  type="number"
                  min={1990}
                  max={currentYear + 1}
                  value={form.year ?? ''}
                  onChange={(e) => set('year', e.target.value ? Number(e.target.value) : undefined)}
                  className={inputCls('year')}
                />
                <FieldError message={fieldErrors.year} />
              </div>
              <div>
                <label className={labelCls}>Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {VEHICLE_TYPES.map((t) => {
                    const selected = form.type === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => set('type', t.value)}
                        className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border text-xs font-semibold transition-all ${
                          selected
                            ? 'bg-sage-50 border-sage-500 text-sage-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <span className="text-lg">{t.icon}</span>
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
                <FieldError message={fieldErrors.type} />
              </div>
            </div>
          </div>

          {/* Capacity & specs */}
          <div className={sectionCls}>
            <h4 className={sectionTitleCls}><Gauge size={16} className="text-sage-600" /> Capacité & spécifications</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className={labelCls}>Poids max (kg)</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={form.capacity_weight ?? ''}
                    onChange={(e) => set('capacity_weight', e.target.value ? Number(e.target.value) : null)}
                    placeholder="3500"
                    className={`${inputCls('capacity_weight')} pr-10`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">kg</span>
                </div>
                <FieldError message={fieldErrors.capacity_weight} />
              </div>
              <div>
                <label className={labelCls}>Volume max (m³)</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={form.capacity_volume ?? ''}
                    onChange={(e) => set('capacity_volume', e.target.value ? Number(e.target.value) : null)}
                    placeholder="12.5"
                    className={`${inputCls('capacity_volume')} pr-10`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">m³</span>
                </div>
                <FieldError message={fieldErrors.capacity_volume} />
              </div>
              <div>
                <label className={labelCls}>Charge utile (kg)</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={form.payload_kg ?? ''}
                    onChange={(e) => set('payload_kg', e.target.value ? Number(e.target.value) : null)}
                    placeholder="3500"
                    className={`${inputCls('payload_kg')} pr-10`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">kg</span>
                </div>
                <FieldError message={fieldErrors.payload_kg} />
              </div>
              <div>
                <label className={labelCls}>Carburant</label>
                <input
                  value={form.fuel_type ?? ''}
                  onChange={(e) => set('fuel_type', e.target.value)}
                  placeholder="Diesel"
                  className={inputCls('fuel_type')}
                />
                <FieldError message={fieldErrors.fuel_type} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div>
                <label className={labelCls}>Longueur (m)</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.capacity_length ?? ''}
                    onChange={(e) => set('capacity_length', e.target.value ? Number(e.target.value) : null)}
                    placeholder="3.20"
                    className={`${inputCls('capacity_length')} pr-10`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">m</span>
                </div>
                <FieldError message={fieldErrors.capacity_length} />
              </div>
              <div>
                <label className={labelCls}>Largeur (m)</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.capacity_width ?? ''}
                    onChange={(e) => set('capacity_width', e.target.value ? Number(e.target.value) : null)}
                    placeholder="1.80"
                    className={`${inputCls('capacity_width')} pr-10`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">m</span>
                </div>
                <FieldError message={fieldErrors.capacity_width} />
              </div>
              <div>
                <label className={labelCls}>Hauteur (m)</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.capacity_height ?? ''}
                    onChange={(e) => set('capacity_height', e.target.value ? Number(e.target.value) : null)}
                    placeholder="2.10"
                    className={`${inputCls('capacity_height')} pr-10`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">m</span>
                </div>
                <FieldError message={fieldErrors.capacity_height} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <RatioField
                label="Ratio volume utilisable"
                value={form.usable_volume_ratio}
                onChange={(v) => set('usable_volume_ratio', v)}
                error={fieldErrors.usable_volume_ratio}
              />
              <RatioField
                label="Efficacité de chargement"
                value={form.loading_efficiency_ratio}
                onChange={(v) => set('loading_efficiency_ratio', v)}
                error={fieldErrors.loading_efficiency_ratio}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div className="sm:col-span-2 flex items-end">
                <label
                  className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                    form.cold_chain_enabled
                      ? 'bg-sky-50 border-sky-200 text-sky-800'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!form.cold_chain_enabled}
                    onChange={(e) => set('cold_chain_enabled', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-sage-600 focus:ring-sage-500"
                  />
                  <Snowflake size={18} className={form.cold_chain_enabled ? 'text-sky-600' : 'text-gray-400'} />
                  <span className="text-sm font-semibold">Chaîne du froid</span>
                </label>
              </div>
              <div className="rounded-xl bg-sage-50 border border-sage-100 p-3 flex items-center gap-3">
                <Box size={18} className="text-sage-600 shrink-0" />
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase">Volume utile estimé</div>
                  <div className="text-sm font-bold text-sage-700">
                    {form.capacity_volume != null && form.usable_volume_ratio != null && form.loading_efficiency_ratio != null
                      ? `${Math.round(form.capacity_volume * form.usable_volume_ratio * form.loading_efficiency_ratio * 10) / 10} m³`
                      : '—'}
                  </div>
                </div>
              </div>
            </div>

            {form.type === 'van' && (
              <div className="mt-4 flex items-start gap-2.5 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <Tag size={14} className="shrink-0 mt-0.5" />
                L'entrepôt et l'emplacement de stockage du van seront créés automatiquement.
              </div>
            )}
          </div>

          {/* Agency & status */}
          <div className={sectionCls}>
            <h4 className={sectionTitleCls}><Building2 size={16} className="text-sage-600" /> Agence & statut</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Agence {mode === 'create' && '*'}</label>
                <select
                  value={form.branch_code}
                  onChange={(e) => set('branch_code', e.target.value)}
                  className={`${inputCls('branch_code')} bg-white`}
                >
                  <option value="">— Sélectionner une agence —</option>
                  {branches.map((b) => (
                    <option key={b.code} value={b.code}>{b.name} ({b.code})</option>
                  ))}
                </select>
                <FieldError message={fieldErrors.branch_code} />
              </div>
              {mode === 'edit' && (
                <div>
                  <label className={labelCls}>Statut</label>
                  <div className="grid grid-cols-3 gap-2">
                    {VEHICLE_STATUSES.map((s) => {
                      const selected = form.status === s.value;
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => set('status', s.value)}
                          className={`px-2 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                            selected ? s.color : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 pb-6">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-white bg-emerald-700 rounded-xl shadow-sm hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : mode === 'create' ? <Plus size={16} /> : <Pencil size={16} />}
              {mode === 'create' ? 'Créer le véhicule' : 'Enregistrer les modifications'}
            </button>
            <button
              onClick={onBack}
              className="px-5 py-3 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VehicleForm;
