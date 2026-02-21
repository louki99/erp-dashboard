import React from 'react';
import {
    Loader2, Plus, X, AlertTriangle, Edit, Shield, Ban, CreditCard,
} from 'lucide-react';
import type {
    Partner,
    PartnerStatus,
    CreatePartnerRequest,
    UpdateStatusRequest,
    BlockPartnerRequest,
    UpdateCreditRequest,
    PaymentTermOption,
} from '@/types/partner.types';

// ─── Shared modal primitives ────────────────────────────────────────────────

const ModalWrapper: React.FC<{ onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ onClose, children, wide }) => (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
        <div className={`bg-white rounded-xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
            {children}
        </div>
    </div>
);

const ModalHeader: React.FC<{ icon: React.ElementType; title: string; onClose: () => void; iconColor?: string }> = ({ icon: Icon, title, onClose, iconColor = 'bg-blue-50 text-blue-600' }) => (
    <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconColor.includes('bg-') ? iconColor : 'bg-blue-50 text-blue-600'}`}>
                <Icon className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
    </div>
);

const ModalFooter: React.FC<{
    onClose: () => void;
    onSubmit: () => void;
    loading: boolean;
    label: string;
    variant?: 'primary' | 'danger';
}> = ({ onClose, onSubmit, loading, label, variant = 'primary' }) => (
    <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">Annuler</button>
        <button onClick={onSubmit} disabled={loading}
            className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 ${variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {label}
        </button>
    </div>
);

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode; className?: string }> = ({ label, required, children, className }) => (
    <div className={className}>
        <label className="block text-xs text-gray-500 mb-1 font-medium">{label}{required && ' *'}</label>
        {children}
    </div>
);

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";
const selectCls = `${inputCls} bg-white`;

// ═══════════════════════════════════════════════════════════════════════════════
// Create / Edit Partner
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_OPTIONS: { value: PartnerStatus; label: string }[] = [
    { value: 'ACTIVE', label: 'Actif' },
    { value: 'ON_HOLD', label: 'En attente' },
    { value: 'BLOCKED', label: 'Bloqué' },
    { value: 'CLOSED', label: 'Fermé' },
];

const TYPE_OPTIONS = ['CUSTOMER', 'SUPPLIER', 'BOTH'];
const CHANNEL_OPTIONS = ['OTHER', 'B2B', 'B2C', 'ECOMMERCE', 'RETAIL'];

interface ModalCreateEditProps {
    editing: Partner | null;
    form: Partial<CreatePartnerRequest>;
    setForm: (fn: any) => void;
    onClose: () => void;
    onSubmit: () => void;
    loading: boolean;
    priceLists?: { id: number; code: string; name: string }[];
    paymentTerms?: PaymentTermOption[];
}

export const ModalCreateEdit: React.FC<ModalCreateEditProps> = ({
    editing, form, setForm, onClose, onSubmit, loading, priceLists = [], paymentTerms = [],
}) => (
    <ModalWrapper onClose={onClose} wide>
        <ModalHeader icon={editing ? Edit : Plus} title={editing ? 'Modifier le partenaire' : 'Nouveau partenaire'} onClose={onClose} />
        <div className="p-4 space-y-4">
            {/* Identity */}
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Identité</div>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Code">
                    <input type="text" value={form.code || ''} onChange={e => setForm((p: any) => ({ ...p, code: e.target.value }))} className={`${inputCls} font-mono`} placeholder="Auto-généré" />
                </Field>
                <Field label="Nom" required>
                    <input type="text" value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} className={inputCls} placeholder="Nom du partenaire" />
                </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
                <Field label="Statut">
                    <select value={form.status || 'ACTIVE'} onChange={e => setForm((p: any) => ({ ...p, status: e.target.value }))} className={selectCls}>
                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </Field>
                <Field label="Type">
                    <select value={form.partner_type || 'CUSTOMER'} onChange={e => setForm((p: any) => ({ ...p, partner_type: e.target.value }))} className={selectCls}>
                        {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </Field>
                <Field label="Canal">
                    <select value={form.channel || 'OTHER'} onChange={e => setForm((p: any) => ({ ...p, channel: e.target.value }))} className={selectCls}>
                        {CHANNEL_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </Field>
            </div>

            {/* Contact */}
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">Contact</div>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Email">
                    <input type="email" value={form.email || ''} onChange={e => setForm((p: any) => ({ ...p, email: e.target.value }))} className={inputCls} placeholder="email@example.com" />
                </Field>
                <Field label="Téléphone">
                    <input type="tel" value={form.phone || ''} onChange={e => setForm((p: any) => ({ ...p, phone: e.target.value }))} className={inputCls} placeholder="+212..." />
                </Field>
            </div>

            {/* Address */}
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">Adresse</div>
            <Field label="Adresse">
                <input type="text" value={form.address_line1 || ''} onChange={e => setForm((p: any) => ({ ...p, address_line1: e.target.value }))} className={inputCls} placeholder="123 Rue..." />
            </Field>
            <div className="grid grid-cols-3 gap-3">
                <Field label="Ville">
                    <input type="text" value={form.city || ''} onChange={e => setForm((p: any) => ({ ...p, city: e.target.value }))} className={inputCls} />
                </Field>
                <Field label="Région">
                    <input type="text" value={form.region || ''} onChange={e => setForm((p: any) => ({ ...p, region: e.target.value }))} className={inputCls} />
                </Field>
                <Field label="Pays">
                    <input type="text" value={form.country || ''} onChange={e => setForm((p: any) => ({ ...p, country: e.target.value }))} className={inputCls} placeholder="Maroc" />
                </Field>
            </div>

            {/* Commercial */}
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">Commercial</div>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Liste de prix">
                    <select value={form.price_list_id || ''} onChange={e => setForm((p: any) => ({ ...p, price_list_id: Number(e.target.value) || undefined }))} className={selectCls}>
                        <option value="">-- Aucune --</option>
                        {priceLists.map(pl => <option key={pl.id} value={pl.id}>{pl.code} - {pl.name}</option>)}
                    </select>
                </Field>
                <Field label="Condition de paiement">
                    <select value={form.payment_term_id || ''} onChange={e => setForm((p: any) => ({ ...p, payment_term_id: Number(e.target.value) || undefined }))} className={selectCls}>
                        <option value="">-- Aucune --</option>
                        {paymentTerms.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                    </select>
                </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Limite de crédit">
                    <input type="number" value={form.credit_limit ?? ''} onChange={e => setForm((p: any) => ({ ...p, credit_limit: Number(e.target.value) }))} className={inputCls} min={0} />
                </Field>
                <Field label="Remise par défaut (%)">
                    <input type="number" value={form.default_discount_rate ?? ''} onChange={e => setForm((p: any) => ({ ...p, default_discount_rate: Number(e.target.value) }))} className={inputCls} min={0} max={100} />
                </Field>
            </div>

            {/* Tax */}
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">Fiscalité</div>
            <div className="grid grid-cols-2 gap-3">
                <Field label="ICE">
                    <input type="text" value={form.tax_number_ice || ''} onChange={e => setForm((p: any) => ({ ...p, tax_number_ice: e.target.value }))} className={inputCls} />
                </Field>
                <Field label="IF">
                    <input type="text" value={form.tax_number_if || ''} onChange={e => setForm((p: any) => ({ ...p, tax_number_if: e.target.value }))} className={inputCls} />
                </Field>
            </div>
        </div>
        <ModalFooter onClose={onClose} onSubmit={onSubmit} loading={loading} label={editing ? 'Enregistrer' : 'Créer'} />
    </ModalWrapper>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Delete Confirmation
// ═══════════════════════════════════════════════════════════════════════════════

interface ModalDeleteProps {
    partner: Partner;
    onClose: () => void;
    onConfirm: () => void;
    loading: boolean;
}

export const ModalDelete: React.FC<ModalDeleteProps> = ({ partner, onClose, onConfirm, loading }) => (
    <ModalWrapper onClose={onClose}>
        <ModalHeader icon={AlertTriangle} title="Supprimer le partenaire" onClose={onClose} iconColor="bg-red-50 text-red-600" />
        <div className="p-4">
            <div className="flex items-start gap-3 bg-red-50 rounded-lg p-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-medium text-red-800">Cette action est irréversible</p>
                    <p className="text-sm text-red-600 mt-1">
                        Le partenaire <strong>{partner.code} - {partner.name}</strong> et ses champs personnalisés seront supprimés définitivement.
                    </p>
                </div>
            </div>
        </div>
        <ModalFooter onClose={onClose} onSubmit={onConfirm} loading={loading} label="Supprimer" variant="danger" />
    </ModalWrapper>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Update Status with Reason
// ═══════════════════════════════════════════════════════════════════════════════

interface ModalStatusProps {
    partner: Partner;
    form: Partial<UpdateStatusRequest>;
    setForm: (fn: any) => void;
    onClose: () => void;
    onSubmit: () => void;
    loading: boolean;
}

export const ModalStatus: React.FC<ModalStatusProps> = ({ partner, form, setForm, onClose, onSubmit, loading }) => (
    <ModalWrapper onClose={onClose}>
        <ModalHeader icon={Shield} title="Changer le statut" onClose={onClose} iconColor="bg-amber-50 text-amber-600" />
        <div className="p-4 space-y-4">
            <div className="text-sm text-gray-500">
                Partenaire: <strong>{partner.code} - {partner.name}</strong>
                <span className="ml-2 text-xs">(actuel: {partner.status})</span>
            </div>
            <Field label="Nouveau statut" required>
                <select value={form.new_status || ''} onChange={e => setForm((p: any) => ({ ...p, new_status: e.target.value }))} className={selectCls}>
                    <option value="">-- Sélectionner --</option>
                    {STATUS_OPTIONS.filter(o => o.value !== partner.status).map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
            </Field>
            <Field label="Raison" required>
                <textarea value={form.status_change_reason || ''} onChange={e => setForm((p: any) => ({ ...p, status_change_reason: e.target.value }))}
                    className={`${inputCls} min-h-[80px]`} placeholder="Raison du changement..." maxLength={500} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={form.notify_partner || false} onChange={e => setForm((p: any) => ({ ...p, notify_partner: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                Notifier le partenaire
            </label>
        </div>
        <ModalFooter onClose={onClose} onSubmit={onSubmit} loading={loading} label="Confirmer" />
    </ModalWrapper>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Block Partner
// ═══════════════════════════════════════════════════════════════════════════════

interface ModalBlockProps {
    partner: Partner;
    form: Partial<BlockPartnerRequest>;
    setForm: (fn: any) => void;
    onClose: () => void;
    onSubmit: () => void;
    loading: boolean;
}

export const ModalBlock: React.FC<ModalBlockProps> = ({ partner, form, setForm, onClose, onSubmit, loading }) => (
    <ModalWrapper onClose={onClose}>
        <ModalHeader icon={Ban} title="Bloquer le partenaire" onClose={onClose} iconColor="bg-red-50 text-red-600" />
        <div className="p-4 space-y-4">
            <div className="text-sm text-gray-500">
                Partenaire: <strong>{partner.code} - {partner.name}</strong>
            </div>
            <Field label="Bloqué jusqu'au">
                <input type="date" value={form.blocked_until || ''} onChange={e => setForm((p: any) => ({ ...p, blocked_until: e.target.value }))}
                    className={inputCls} min={new Date().toISOString().split('T')[0]} />
            </Field>
            <Field label="Raison du blocage">
                <textarea value={form.block_reason || ''} onChange={e => setForm((p: any) => ({ ...p, block_reason: e.target.value }))}
                    className={`${inputCls} min-h-[80px]`} placeholder="Raison du blocage..." maxLength={500} />
            </Field>
        </div>
        <ModalFooter onClose={onClose} onSubmit={onSubmit} loading={loading} label="Bloquer" variant="danger" />
    </ModalWrapper>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Update Credit Limit
// ═══════════════════════════════════════════════════════════════════════════════

interface ModalCreditProps {
    partner: Partner;
    form: Partial<UpdateCreditRequest>;
    setForm: (fn: any) => void;
    onClose: () => void;
    onSubmit: () => void;
    loading: boolean;
}

export const ModalCredit: React.FC<ModalCreditProps> = ({ partner, form, setForm, onClose, onSubmit, loading }) => (
    <ModalWrapper onClose={onClose}>
        <ModalHeader icon={CreditCard} title="Modifier la limite de crédit" onClose={onClose} iconColor="bg-emerald-50 text-emerald-600" />
        <div className="p-4 space-y-4">
            <div className="text-sm text-gray-500">
                Partenaire: <strong>{partner.code} - {partner.name}</strong>
            </div>
            <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-lg p-3">
                <div className="text-center">
                    <div className="text-xs text-gray-500">Limite actuelle</div>
                    <div className="text-lg font-bold text-gray-900">{partner.credit_limit?.toLocaleString()}</div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-gray-500">Utilisé</div>
                    <div className="text-lg font-bold text-amber-600">{partner.credit_used?.toLocaleString()}</div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-gray-500">Disponible</div>
                    <div className="text-lg font-bold text-emerald-600">{partner.credit_available?.toLocaleString()}</div>
                </div>
            </div>
            <Field label="Nouvelle limite de crédit" required>
                <input type="number" value={form.credit_limit ?? ''} onChange={e => setForm((p: any) => ({ ...p, credit_limit: Number(e.target.value) }))}
                    className={inputCls} min={0} />
            </Field>
            <Field label="Raison">
                <textarea value={form.reason || ''} onChange={e => setForm((p: any) => ({ ...p, reason: e.target.value }))}
                    className={`${inputCls} min-h-[60px]`} placeholder="Raison de la modification..." maxLength={500} />
            </Field>
        </div>
        <ModalFooter onClose={onClose} onSubmit={onSubmit} loading={loading} label="Mettre à jour" />
    </ModalWrapper>
);
