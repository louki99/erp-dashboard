import { useState } from 'react';
import {
    CheckCircle, XCircle, Pause, Play, ShieldAlert, Loader2,
    Clock, Ban, CreditCard, ArrowRight, AlertTriangle, Info,
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
    APPROVE: {
        icon: CheckCircle,
        btn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200 border-transparent',
        badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    },
    REJECT: {
        icon: XCircle,
        btn: 'bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-200 border-transparent',
        badge: 'bg-red-50 text-red-700 ring-red-200',
    },
    HOLD: {
        icon: Pause,
        btn: 'bg-white hover:bg-amber-50 text-amber-700 border border-amber-300',
        badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    },
    RESUME: {
        icon: Play,
        btn: 'bg-white hover:bg-blue-50 text-blue-700 border border-blue-300',
        badge: 'bg-blue-50 text-blue-700 ring-blue-200',
    },
    CREDIT_ESCALATION: {
        icon: ShieldAlert,
        btn: 'bg-white hover:bg-purple-50 text-purple-700 border border-purple-300',
        badge: 'bg-purple-50 text-purple-700 ring-purple-200',
    },
    CREDIT_MANAGE: {
        icon: CreditCard,
        btn: 'bg-white hover:bg-purple-50 text-purple-700 border border-purple-300',
        badge: 'bg-purple-50 text-purple-700 ring-purple-200',
    },
    SELL: {
        icon: CreditCard,
        btn: 'bg-white hover:bg-blue-50 text-blue-700 border border-blue-300',
        badge: 'bg-blue-50 text-blue-700 ring-blue-200',
    },
    CANCEL: {
        icon: Ban,
        btn: 'bg-red-600 hover:bg-red-700 text-white border-transparent',
        badge: 'bg-red-50 text-red-700 ring-red-200',
    },
    DEFAULT: {
        icon: ArrowRight,
        btn: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300',
        badge: 'bg-gray-50 text-gray-600 ring-gray-200',
    },
};

const getIntent = (action: WorkflowAction) => {
    const intent = action.intent?.toUpperCase() ?? '';
    if (INTENT_CONFIG[intent]) return INTENT_CONFIG[intent];

    // Fallback: infer from action name
    const a = action.action.toLowerCase();
    if (a.includes('approve') || a.includes('confirm') || a.includes('finaliz') || a.includes('valid')) return INTENT_CONFIG.APPROVE;
    if (a.includes('reject') || a.includes('refuse')) return INTENT_CONFIG.REJECT;
    if (a.includes('cancel')) return INTENT_CONFIG.CANCEL;
    if (a.includes('hold') || a.includes('pause')) return INTENT_CONFIG.HOLD;
    if (a.includes('resume') || a.includes('repris')) return INTENT_CONFIG.RESUME;
    if (a.includes('derog') || a.includes('credit')) return INTENT_CONFIG.CREDIT_MANAGE;
    return INTENT_CONFIG.DEFAULT;
};

// ─── Dynamic field renderer ────────────────────────────────────────────────────

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

        {(field.type === 'textarea') && (
            <textarea
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={field.placeholder ?? ''}
                rows={4}
                className={cn(
                    'w-full rounded-xl border px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 transition-all bg-gray-50 placeholder:text-gray-400',
                    error
                        ? 'border-red-300 focus:ring-red-300/50 bg-red-50/30'
                        : 'border-gray-200 focus:ring-sage-400/40 focus:border-sage-400'
                )}
            />
        )}

        {(field.type === 'text') && (
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={field.placeholder ?? ''}
                className={cn(
                    'w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all bg-gray-50 placeholder:text-gray-400',
                    error
                        ? 'border-red-300 focus:ring-red-300/50 bg-red-50/30'
                        : 'border-gray-200 focus:ring-sage-400/40 focus:border-sage-400'
                )}
            />
        )}

        {(field.type === 'number') && (
            <input
                type="number"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={field.placeholder ?? ''}
                className={cn(
                    'w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all bg-gray-50',
                    error
                        ? 'border-red-300 focus:ring-red-300/50'
                        : 'border-gray-200 focus:ring-sage-400/40 focus:border-sage-400'
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

// ─── Decision dialog ───────────────────────────────────────────────────────────

interface DecisionDialogProps {
    action: WorkflowAction;
    isOpen: boolean;
    isLoading: boolean;
    onClose: () => void;
    onSubmit: (fieldValues: Record<string, string>) => void;
}

const DecisionDialog = ({ action, isOpen, isLoading, onClose, onSubmit }: DecisionDialogProps) => {
    const intent = getIntent(action);
    const Icon = intent.icon;
    const [values, setValues] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const fields = action.fields ?? [];

    const validate = (): boolean => {
        const errs: Record<string, string> = {};
        for (const f of fields) {
            const val = (values[f.name] ?? '').trim();
            if (f.required && !val) {
                errs[f.name] = `Ce champ est obligatoire`;
            } else if (f.min_length && val.length < f.min_length) {
                errs[f.name] = `Minimum ${f.min_length} caractères (${val.length}/${f.min_length})`;
            }
        }
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = () => {
        if (!validate()) return;
        onSubmit(values);
    };

    const handleClose = () => {
        setValues({});
        setErrors({});
        onClose();
    };

    if (!isOpen) return null;

    const isDanger = action.danger;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className={cn('px-6 py-5 border-b border-gray-100', isDanger ? 'bg-red-50/50' : 'bg-gray-50/50')}>
                    <div className="flex items-start gap-3">
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                            isDanger ? 'bg-red-100' : 'bg-gray-100')}>
                            <Icon className={cn('w-5 h-5', isDanger ? 'text-red-600' : 'text-gray-600')} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900">{action.label}</h3>
                            {action.description && (
                                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{action.description}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Fields */}
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

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                    <button onClick={handleClose} disabled={isLoading}
                        className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50">
                        Annuler
                    </button>
                    <button onClick={handleSubmit} disabled={isLoading}
                        className={cn(
                            'flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50',
                            isDanger
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-sage-600 hover:bg-sage-700 text-white'
                        )}>
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {action.label}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Main component ────────────────────────────────────────────────────────────

export function BCWorkflowActions({ orderId, onSuccess }: BCWorkflowActionsProps) {
    const { workflowState, isTransitioning, actions, isLoadingState } = useAdvWorkflow(orderId);
    const [openAction, setOpenAction] = useState<WorkflowAction | null>(null);

    const handleOpenDialog = (action: WorkflowAction) => {
        setOpenAction(action);
    };

    const handleSubmit = async (fieldValues: Record<string, string>) => {
        if (!openAction) return;
        try {
            await actions.transition({
                action: openAction.action,
                fields: fieldValues,
            });
            setOpenAction(null);
            onSuccess?.();
        } catch {
            // toast handled in useAdvWorkflow
        }
    };

    if (isLoadingState) {
        return (
            <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Chargement des actions...</span>
            </div>
        );
    }

    if (!workflowState) return null;

    const availableActions = workflowState.actions ?? [];

    return (
        <>
            {/* State indicator */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <WorkflowStateIndicator state={workflowState.current_state} />
                    <span className="text-xs text-gray-400">{workflowState.current_step_name}</span>
                </div>
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1',
                    workflowState.workflow_status === 'in_progress' ? 'bg-sage-50 text-sage-600 ring-sage-200'
                        : workflowState.workflow_status === 'completed' ? 'bg-emerald-50 text-emerald-600 ring-emerald-200'
                            : 'bg-gray-50 text-gray-500 ring-gray-200'
                )}>
                    {workflowState.workflow_status?.replace('_', ' ')}
                </span>
            </div>

            {/* Action buttons */}
            {availableActions.length === 0 ? (
                <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                    <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                    <p className="text-xs text-gray-500">Aucune action disponible pour cet état.</p>
                </div>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {availableActions.map(action => {
                        const intent = getIntent(action);
                        const Icon = intent.icon;
                        return (
                            <button
                                key={action.action}
                                onClick={() => handleOpenDialog(action)}
                                disabled={isTransitioning}
                                className={cn(
                                    'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all',
                                    'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300',
                                    'disabled:opacity-40 disabled:cursor-not-allowed',
                                    intent.btn
                                )}
                                title={action.description}
                            >
                                {isTransitioning
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <Icon className="w-3.5 h-3.5 shrink-0" />}
                                {action.label}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Dialog */}
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
