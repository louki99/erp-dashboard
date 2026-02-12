import React from 'react';
import { Loader2, Plus, X, AlertTriangle, Edit, Settings } from 'lucide-react';
import type {
    CustomField,
    CreateCustomFieldRequest,
    FieldType,
    EntityType,
} from '@/types/customFields.types';

// ─── Shared modal primitives ─────────────────────────────────────────────────

const ModalWrapper: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {children}
        </div>
    </div>
);

const ModalHeader: React.FC<{ icon: React.ElementType; title: string; onClose: () => void }> = ({ icon: Icon, title, onClose }) => (
    <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><Icon className="w-4 h-4 text-blue-600" /></div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
    </div>
);

const ModalFooter: React.FC<{ onClose: () => void; onSubmit: () => void; loading: boolean; label: string }> = ({ onClose, onSubmit, loading, label }) => (
    <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">Annuler</button>
        <button onClick={onSubmit} disabled={loading}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {label}
        </button>
    </div>
);

const Field: React.FC<{ label: string; required?: boolean; hint?: string; children: React.ReactNode }> = ({ label, required, hint, children }) => (
    <div>
        <label className="block text-xs text-gray-500 mb-1 font-medium">{label}{required && ' *'}</label>
        {children}
        {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
);

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";
const selectCls = `${inputCls} bg-white`;

const FIELD_TYPES: { value: FieldType; label: string }[] = [
    { value: 'text', label: 'Texte' },
    { value: 'textarea', label: 'Zone de texte' },
    { value: 'number', label: 'Nombre' },
    { value: 'email', label: 'Email' },
    { value: 'date', label: 'Date' },
    { value: 'datetime', label: 'Date et heure' },
    { value: 'select', label: 'Liste déroulante' },
    { value: 'radio', label: 'Boutons radio' },
    { value: 'checkbox', label: 'Case à cocher' },
    { value: 'file', label: 'Fichier' },
];

const ENTITY_TYPES: { value: EntityType; label: string }[] = [
    { value: 'partner', label: 'Partenaire' },
    { value: 'product', label: 'Produit' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Create / Edit Custom Field
// ═══════════════════════════════════════════════════════════════════════════════

interface ModalCreateEditProps {
    editing: CustomField | null;
    form: Partial<CreateCustomFieldRequest>;
    setForm: (f: any) => void;
    onClose: () => void;
    onSubmit: () => void;
    loading: boolean;
}

export const ModalCreateEdit: React.FC<ModalCreateEditProps> = ({ editing, form, setForm, onClose, onSubmit, loading }) => {
    const showOptions = form.field_type === 'select' || form.field_type === 'radio';

    return (
        <ModalWrapper onClose={onClose}>
            <ModalHeader
                icon={editing ? Edit : Plus}
                title={editing ? 'Modifier le champ personnalisé' : 'Nouveau champ personnalisé'}
                onClose={onClose}
            />
            <div className="p-4 space-y-4">
                {/* Row 1: Label + Entity type */}
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Libellé" required>
                        <input
                            type="text"
                            value={form.field_label || ''}
                            onChange={e => setForm((prev: any) => ({ ...prev, field_label: e.target.value }))}
                            className={inputCls}
                            placeholder="Ex: Numéro fiscal"
                        />
                    </Field>
                    <Field label="Entité" required>
                        <select
                            value={form.entity_type || ''}
                            onChange={e => setForm((prev: any) => ({ ...prev, entity_type: e.target.value }))}
                            className={selectCls}
                        >
                            <option value="">-- Choisir --</option>
                            {ENTITY_TYPES.map(et => (
                                <option key={et.value} value={et.value}>{et.label}</option>
                            ))}
                        </select>
                    </Field>
                </div>

                {/* Row 2: Type + Order */}
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Type de champ" required>
                        <select
                            value={form.field_type || ''}
                            onChange={e => setForm((prev: any) => ({ ...prev, field_type: e.target.value }))}
                            className={selectCls}
                        >
                            <option value="">-- Choisir --</option>
                            {FIELD_TYPES.map(ft => (
                                <option key={ft.value} value={ft.value}>{ft.label}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Ordre d'affichage">
                        <input
                            type="number"
                            value={form.order ?? ''}
                            onChange={e => setForm((prev: any) => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                            className={inputCls}
                            min="0"
                        />
                    </Field>
                </div>

                {/* Options (for select/radio) */}
                {showOptions && (
                    <Field label="Options" required hint="Séparez les options par des virgules: Option A, Option B, Option C">
                        <input
                            type="text"
                            value={form.options || ''}
                            onChange={e => setForm((prev: any) => ({ ...prev, options: e.target.value }))}
                            className={inputCls}
                            placeholder="Option A, Option B, Option C"
                        />
                    </Field>
                )}

                {/* Placeholder + Default value */}
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Placeholder">
                        <input
                            type="text"
                            value={form.placeholder || ''}
                            onChange={e => setForm((prev: any) => ({ ...prev, placeholder: e.target.value }))}
                            className={inputCls}
                            placeholder="Texte d'aide dans le champ"
                        />
                    </Field>
                    <Field label="Valeur par défaut">
                        <input
                            type="text"
                            value={form.default_value || ''}
                            onChange={e => setForm((prev: any) => ({ ...prev, default_value: e.target.value }))}
                            className={inputCls}
                        />
                    </Field>
                </div>

                {/* Help text */}
                <Field label="Texte d'aide">
                    <input
                        type="text"
                        value={form.help_text || ''}
                        onChange={e => setForm((prev: any) => ({ ...prev, help_text: e.target.value }))}
                        className={inputCls}
                        placeholder="Description affichée sous le champ"
                    />
                </Field>

                {/* Validation rules */}
                <Field label="Règles de validation" hint="Règles Laravel séparées par des pipes: max:100|nullable">
                    <input
                        type="text"
                        value={form.validation_rules || ''}
                        onChange={e => setForm((prev: any) => ({ ...prev, validation_rules: e.target.value }))}
                        className={inputCls}
                        placeholder="max:100|nullable"
                    />
                </Field>

                {/* Toggles: required, active, searchable */}
                <div className="grid grid-cols-3 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                        <input
                            type="checkbox"
                            checked={form.is_required ?? false}
                            onChange={e => setForm((prev: any) => ({ ...prev, is_required: e.target.checked }))}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">Obligatoire</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                        <input
                            type="checkbox"
                            checked={form.is_active ?? true}
                            onChange={e => setForm((prev: any) => ({ ...prev, is_active: e.target.checked }))}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">Actif</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                        <input
                            type="checkbox"
                            checked={form.is_searchable ?? false}
                            onChange={e => setForm((prev: any) => ({ ...prev, is_searchable: e.target.checked }))}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">Recherchable</span>
                    </label>
                </div>
            </div>
            <ModalFooter onClose={onClose} onSubmit={onSubmit} loading={loading} label={editing ? 'Enregistrer' : 'Créer'} />
        </ModalWrapper>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Delete Confirmation
// ═══════════════════════════════════════════════════════════════════════════════

interface ModalDeleteProps {
    field: CustomField;
    onClose: () => void;
    onConfirm: () => void;
    loading: boolean;
}

export const ModalDelete: React.FC<ModalDeleteProps> = ({ field, onClose, onConfirm, loading }) => (
    <ModalWrapper onClose={onClose}>
        <div className="p-5 pb-3 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center mb-3 shadow-sm">
                <AlertTriangle className="w-7 h-7 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Supprimer le champ</h2>
            <p className="text-sm text-gray-500 mt-1">Êtes-vous sûr de vouloir supprimer ce champ personnalisé ?</p>
        </div>
        <div className="mx-5 p-3 bg-slate-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-sm font-semibold text-gray-900">{field.field_label}</div>
                    <div className="text-xs text-gray-500 mt-0.5 font-mono">{field.field_name}</div>
                </div>
                <div className="text-right">
                    <div className="text-xs text-gray-500">Type</div>
                    <div className="text-sm font-bold text-gray-900 capitalize">{field.field_type}</div>
                </div>
            </div>
        </div>
        <div className="mx-5 mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700"><strong>Attention:</strong> Cette action est irréversible. Toutes les valeurs associées à ce champ seront également supprimées.</p>
        </div>
        <div className="flex items-center justify-end gap-2 p-5 pt-4">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium">Annuler</button>
            <button onClick={onConfirm} disabled={loading}
                className="px-5 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-medium flex items-center gap-2 shadow-sm">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Supprimer définitivement
            </button>
        </div>
    </ModalWrapper>
);
