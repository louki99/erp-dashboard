import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    CheckCircle, XCircle, Pause, Play, ShieldAlert, Loader2,
    Clock, Ban, CreditCard, ArrowRight, AlertTriangle, Info,
    ChevronDown, Settings, ListChecks,
} from 'lucide-react';
import { useAdvWorkflow } from '@/hooks/adv/useAdvWorkflow';
import { WorkflowStateIndicator } from '@/components/workflow/WorkflowStateIndicator';
import type { WorkflowAction, WorkflowField } from '@/services/api/workflowStateApi';
import { cn } from '@/lib/utils';

interface BCWorkflowActionsProps {
    orderId: number;
    onSuccess?: () => void;
}

// ─── Intent → visual config ───────────────────────────────────────────────────

const INTENT_CONFIG: Record<string, { icon: React.ElementType; btn: string; badge: string }> = {
    APPROVE:          { icon: CheckCircle, btn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200 border-transparent', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    REJECT:           { icon: XCircle,     btn: 'bg-white hover:bg-red-50 text-red-700 border border-red-300',                                   badge: 'bg-red-50 text-red-700 ring-red-200' },
    HOLD:             { icon: Pause,       btn: 'bg-white hover:bg-amber-50 text-amber-700 border border-amber-300',                             badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
    RESUME:           { icon: Play,        btn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200 border-transparent', badge: 'bg-blue-50 text-blue-700 ring-blue-200' },
    CREDIT_ESCALATION:{ icon: ShieldAlert, btn: 'bg-white hover:bg-purple-50 text-purple-700 border border-purple-300',                          badge: 'bg-purple-50 text-purple-700 ring-purple-200' },
    CREDIT_MANAGE:    { icon: CreditCard,  btn: 'bg-white hover:bg-purple-50 text-purple-700 border border-purple-300',                          badge: 'bg-purple-50 text-purple-700 ring-purple-200' },
    SELL:             { icon: CheckCircle, btn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200 border-transparent', badge: 'bg-blue-50 text-blue-700 ring-blue-200' },
    CANCEL:           { icon: Ban,         btn: 'bg-white hover:bg-red-50 text-red-700 border border-red-300',                                   badge: 'bg-red-50 text-red-700 ring-red-200' },
    DEFAULT:          { icon: ArrowRight,  btn: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300',                                badge: 'bg-gray-50 text-gray-600 ring-gray-200' },
};

const getIntent = (action: WorkflowAction) => {
    const intent = action.intent?.toUpperCase() ?? '';
    if (INTENT_CONFIG[intent]) return INTENT_CONFIG[intent];
    const a = action.action.toLowerCase();
    if (a.includes('approve') || a.includes('confirm') || a.includes('finaliz') || a.includes('valid')) return INTENT_CONFIG.APPROVE;
    if (a.includes('reject') || a.includes('refuse')) return INTENT_CONFIG.REJECT;
    if (a.includes('cancel')) return INTENT_CONFIG.CANCEL;
    if (a.includes('hold') || a.includes('pause')) return INTENT_CONFIG.HOLD;
    if (a.includes('resume') || a.includes('repris')) return INTENT_CONFIG.RESUME;
    if (a.includes('derog') || a.includes('credit')) return INTENT_CONFIG.CREDIT_MANAGE;
    return INTENT_CONFIG.DEFAULT;
};

// ─── Priority tiers ───────────────────────────────────────────────────────────

const PRIMARY_INTENTS = new Set(['APPROVE']);
const HOLD_INTENTS    = new Set(['HOLD']);
const CREDIT_INTENTS  = new Set(['CREDIT_ESCALATION', 'CREDIT_MANAGE', 'SELL', 'RESUME', 'CONFIRM']);
const DANGER_INTENTS  = new Set(['REJECT', 'CANCEL']);

function tierOf(action: WorkflowAction): 'primary' | 'hold' | 'credit' | 'secondary' | 'danger' {
    const intent = action.intent?.toUpperCase() ?? '';
    if (DANGER_INTENTS.has(intent) || action.danger) return 'danger';
    if (PRIMARY_INTENTS.has(intent)) return 'primary';
    if (HOLD_INTENTS.has(intent)) return 'hold';
    if (CREDIT_INTENTS.has(intent)) return 'credit';
    const a = action.action.toLowerCase();
    if (a.includes('reject') || a.includes('refuse') || a.includes('cancel')) return 'danger';
    if (a.includes('approve')) return 'primary';
    if (a.includes('hold') || a.includes('pause')) return 'hold';
    if (a.includes('confirm') || a.includes('sell') || a.includes('resume') || a.includes('repris') || a.includes('derog') || a.includes('credit')) return 'credit';
    return 'secondary';
}

// ─── Dropdown ────────────────────────────────────────────────────────────────

function ActionDropdown({
    label, icon: BtnIcon, actions, onSelect, disabled, btnClassName,
}: {
    label: string;
    icon: React.ElementType;
    actions: WorkflowAction[];
    onSelect: (a: WorkflowAction) => void;
    disabled?: boolean;
    btnClassName?: string;
}) {
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const btnRef    = useRef<HTMLButtonElement>(null);
    const portalRef = useRef<HTMLDivElement>(null);

    const updateCoords = useCallback(() => {
        const rect = btnRef.current?.getBoundingClientRect();
        if (rect) setCoords({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX, width: rect.width });
    }, []);

    const toggle = () => {
        updateCoords();
        setOpen(v => !v);
    };

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => {
            const target = e.target as Node;
            if (btnRef.current?.contains(target) || portalRef.current?.contains(target)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', close);
        window.addEventListener('scroll', () => setOpen(false), { passive: true, capture: true });
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    if (actions.length === 0) return null;

    return (
        <>
            <button
                ref={btnRef}
                onClick={toggle}
                disabled={disabled}
                className={cn(
                    'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border',
                    'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                    btnClassName ?? 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                )}
            >
                <BtnIcon className="w-3.5 h-3.5 shrink-0" />
                {label}
                <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
            </button>

            {open && createPortal(
                <div
                    ref={portalRef}
                    style={{ position: 'absolute', top: coords.top, left: coords.left, minWidth: Math.max(coords.width, 220), zIndex: 9999 }}
                    className="bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
                >
                    {actions.map(a => {
                        const { icon: Icon } = getIntent(a);
                        return (
                            <button
                                key={a.action}
                                onClick={() => { setOpen(false); onSelect(a); }}
                                className="w-full flex items-start gap-2.5 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                            >
                                <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-semibold text-gray-800">{a.label}</p>
                                    {a.description && (
                                        <p className="text-[10px] text-gray-400 mt-0.5">{a.description}</p>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>,
                document.body
            )}
        </>
    );
}

// ─── Field renderer ───────────────────────────────────────────────────────────

interface FieldRendererProps {
    field: WorkflowField;
    value: string;
    onChange: (v: string) => void;
    error?: string;
}

const FieldRenderer = ({ field, value, onChange, error }: FieldRendererProps) => (
    <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
            {field.label}
            {field.required && <span className="text-red-500">*</span>}
        </label>

        {field.type === 'textarea' && (
            <textarea
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={field.placeholder ?? ''}
                rows={4}
                className={cn(
                    'w-full rounded-xl border px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 transition-all bg-gray-50 placeholder:text-gray-400',
                    error ? 'border-red-300 focus:ring-red-300/50 bg-red-50/30' : 'border-gray-200 focus:ring-sage-400/40 focus:border-sage-400'
                )}
            />
        )}

        {field.type === 'text' && (
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={field.placeholder ?? ''}
                className={cn(
                    'w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all bg-gray-50 placeholder:text-gray-400',
                    error ? 'border-red-300 focus:ring-red-300/50 bg-red-50/30' : 'border-gray-200 focus:ring-sage-400/40 focus:border-sage-400'
                )}
            />
        )}

        {field.type === 'number' && (
            <input
                type="number"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={field.placeholder ?? ''}
                className={cn(
                    'w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all bg-gray-50',
                    error ? 'border-red-300 focus:ring-red-300/50' : 'border-gray-200 focus:ring-sage-400/40 focus:border-sage-400'
                )}
            />
        )}

        {error && (
            <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />{error}
            </p>
        )}

        {field.min_length && !error && value && (
            <p className={cn('text-[10px] text-right', value.length >= field.min_length ? 'text-gray-400' : 'text-amber-500')}>
                {value.length}/{field.min_length} car. min
            </p>
        )}
    </div>
);

// ─── Decision dialog ──────────────────────────────────────────────────────────

interface DecisionDialogProps {
    action: WorkflowAction;
    isOpen: boolean;
    isLoading: boolean;
    onClose: () => void;
    onSubmit: (fieldValues: Record<string, string>) => void;
}

const DecisionDialog = ({ action, isOpen, isLoading, onClose, onSubmit }: DecisionDialogProps) => {
    const intent = getIntent(action);
    const Icon   = intent.icon;
    const [values, setValues] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const fields = action.fields ?? [];

    const validate = (): boolean => {
        const errs: Record<string, string> = {};
        for (const f of fields) {
            const val = (values[f.name] ?? '').trim();
            if (f.required && !val) errs[f.name] = 'Ce champ est obligatoire';
            else if (f.min_length && val.length < f.min_length)
                errs[f.name] = `Minimum ${f.min_length} caractères (${val.length}/${f.min_length})`;
        }
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = () => { if (validate()) onSubmit(values); };
    const handleClose  = () => { setValues({}); setErrors({}); onClose(); };

    if (!isOpen) return null;

    const isDanger = action.danger;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden">
                <div className={cn('px-6 py-5 border-b border-gray-100', isDanger ? 'bg-red-50/50' : 'bg-gray-50/50')}>
                    <div className="flex items-start gap-3">
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', isDanger ? 'bg-red-100' : 'bg-gray-100')}>
                            <Icon className={cn('w-5 h-5', isDanger ? 'text-red-600' : 'text-gray-600')} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900">{action.label}</h3>
                            {action.description && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{action.description}</p>}
                        </div>
                    </div>
                </div>

                <div className="px-6 py-5 space-y-4">
                    {fields.length === 0 ? (
                        <div className="flex items-center gap-2.5 p-3 bg-sage-50 border border-sage-100 rounded-xl">
                            <Info className="w-4 h-4 text-sage-500 shrink-0" />
                            <p className="text-xs text-sage-700">Confirmez-vous l'exécution de cette action ?</p>
                        </div>
                    ) : (
                        fields.map(f => (
                            <FieldRenderer
                                key={f.name}
                                field={f}
                                value={values[f.name] ?? ''}
                                onChange={v => setValues(prev => ({ ...prev, [f.name]: v }))}
                                error={errors[f.name]}
                            />
                        ))
                    )}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                    <button onClick={handleClose} disabled={isLoading}
                        className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50">
                        Annuler
                    </button>
                    <button onClick={handleSubmit} disabled={isLoading}
                        className={cn(
                            'flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50',
                            isDanger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-sage-600 hover:bg-sage-700 text-white'
                        )}>
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {action.label}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────

export function BCWorkflowActions({ orderId, onSuccess }: BCWorkflowActionsProps) {
    const { workflowState, isTransitioning, actions, isLoadingState } = useAdvWorkflow(orderId);
    const [openAction, setOpenAction] = useState<WorkflowAction | null>(null);

    const handleSubmit = async (fieldValues: Record<string, string>) => {
        if (!openAction) return;
        try {
            await actions.transition({ action: openAction.action, fields: fieldValues });
            setOpenAction(null);
            onSuccess?.();
        } catch { /* toast handled in useAdvWorkflow */ }
    };

    if (isLoadingState) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span className="text-xs">Chargement des actions...</span>
                </div>
            </div>
        );
    }

    if (!workflowState) return null;

    const allActions = workflowState.actions ?? [];
    const primary    = allActions.filter(a => tierOf(a) === 'primary');
    const hold       = allActions.filter(a => tierOf(a) === 'hold');
    const credit     = allActions.filter(a => tierOf(a) === 'credit');
    const secondary  = allActions.filter(a => tierOf(a) === 'secondary');
    const danger     = allActions.filter(a => tierOf(a) === 'danger');

    const hasMainActions = primary.length > 0 || hold.length > 0 || credit.length > 0 || secondary.length > 0;

    const statusCfg =
        workflowState.workflow_status === 'in_progress' ? { cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' } :
        workflowState.workflow_status === 'completed'   ? { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' } :
        { cls: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' };

    return (
        <>
            <div className="bg-white rounded-xl border border-gray-200">

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <ListChecks className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-semibold text-gray-800">Décisions & Actions</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-medium">Étape</span>
                        <span className={cn('inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border', statusCfg.cls)}>
                            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', statusCfg.dot)} />
                            {workflowState.current_step_name?.toUpperCase() ?? workflowState.workflow_status?.replace(/_/g, ' ').toUpperCase()}
                        </span>
                    </div>
                </div>

                {/* ── Empty state ── */}
                {!hasMainActions && danger.length === 0 && (
                    <div className="flex items-center gap-3 px-5 py-4">
                        <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                        <div>
                            <p className="text-xs font-semibold text-gray-600">Aucune action disponible</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">Ce bon de commande ne peut pas être modifié dans son état actuel.</p>
                        </div>
                    </div>
                )}

                {/* ── Main action row ── */}
                {hasMainActions && (
                    <div className="px-5 py-4 flex items-center gap-2.5 flex-wrap">

                        {/* Primary — full green buttons */}
                        {primary.map(action => {
                            const { icon: Icon } = getIntent(action);
                            return (
                                <button key={action.action}
                                    onClick={() => setOpenAction(action)}
                                    disabled={isTransitioning}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm shadow-emerald-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1">
                                    {isTransitioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4 shrink-0" />}
                                    {action.label}
                                </button>
                            );
                        })}

                        {/* Credit / Dérogation dropdown */}
                        <ActionDropdown
                            label="Dérogation / Modif"
                            icon={ShieldAlert}
                            actions={credit}
                            onSelect={setOpenAction}
                            disabled={isTransitioning}
                            btnClassName="bg-white hover:bg-purple-50 text-purple-700 border-purple-300"
                        />

                        {/* Separator */}
                        {(primary.length > 0 || credit.length > 0) && (hold.length > 0 || secondary.length > 0) && (
                            <div className="w-px h-6 bg-gray-200 mx-0.5 self-center" />
                        )}

                        {/* Hold — amber standalone */}
                        {hold.map(action => {
                            const { icon: Icon } = getIntent(action);
                            return (
                                <button key={action.action}
                                    onClick={() => setOpenAction(action)}
                                    disabled={isTransitioning}
                                    title={action.description}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-amber-50 text-amber-700 border border-amber-300 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-1">
                                    {isTransitioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5 shrink-0" />}
                                    {action.label}
                                </button>
                            );
                        })}

                        {/* Plus dropdown — remaining secondary */}
                        <ActionDropdown
                            label="Plus"
                            icon={Settings}
                            actions={secondary}
                            onSelect={setOpenAction}
                            disabled={isTransitioning}
                            btnClassName="bg-white hover:bg-gray-50 text-gray-600 border-gray-300"
                        />
                    </div>
                )}

                {/* ── Danger zone ── */}
                {danger.length > 0 && (
                    <div className="px-5 py-3.5 border-t border-dashed border-red-200 bg-red-50/20 rounded-b-xl">
                        <div className="flex items-center gap-1.5 mb-2.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Zone dangereuse</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {danger.map(action => {
                                const { icon: Icon } = getIntent(action);
                                return (
                                    <button key={action.action}
                                        onClick={() => setOpenAction(action)}
                                        disabled={isTransitioning}
                                        title={action.description}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-red-50 text-red-700 border border-red-300 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-1">
                                        {isTransitioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5 shrink-0" />}
                                        {action.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {openAction && (
                <DecisionDialog
                    action={openAction}
                    isOpen={true}
                    isLoading={isTransitioning}
                    onClose={() => setOpenAction(null)}
                    onSubmit={handleSubmit}
                />
            )}
        </>
    );
}
