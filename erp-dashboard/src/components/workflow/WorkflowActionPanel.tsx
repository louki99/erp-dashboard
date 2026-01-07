import { useState } from 'react';
import { useWorkflowEngine } from '@/hooks/workflow/useWorkflowEngine';
import type { AllowedAction } from '@/types/workflowEngine.types';
import {
    CheckCircle,
    XCircle,
    Clock,
    Send,
    AlertCircle,
    Loader2,
    MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WorkflowActionPanelProps {
    workflowId?: number;
    workflowCode?: string;
    instanceId?: number;
    modelType?: string;
    modelId?: number;
    onTransitionComplete?: () => void;
    className?: string;
    layout?: 'horizontal' | 'vertical';
    showNotes?: boolean;
}

const getActionIcon = (action: string) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('approve') || actionLower.includes('validate')) return CheckCircle;
    if (actionLower.includes('reject') || actionLower.includes('cancel')) return XCircle;
    if (actionLower.includes('hold') || actionLower.includes('pause')) return Clock;
    return Send;
};

const getActionVariant = (variant?: string) => {
    switch (variant) {
        case 'success':
            return 'bg-emerald-600 hover:bg-emerald-700 text-white';
        case 'danger':
            return 'bg-red-600 hover:bg-red-700 text-white';
        case 'warning':
            return 'bg-amber-600 hover:bg-amber-700 text-white';
        case 'primary':
            return 'bg-sage-600 hover:bg-sage-700 text-white';
        default:
            return 'bg-gray-600 hover:bg-gray-700 text-white';
    }
};

/**
 * Workflow Action Panel Component
 * Displays allowed actions and handles transition execution
 */
export function WorkflowActionPanel({
    workflowId,
    workflowCode,
    instanceId,
    modelType,
    modelId,
    onTransitionComplete,
    className,
    layout = 'horizontal',
    showNotes = true,
}: WorkflowActionPanelProps) {
    const [notes, setNotes] = useState('');
    const [expandedAction, setExpandedAction] = useState<string | null>(null);

    const {
        allowedActions,
        isExecuting,
        executeTransition,
    } = useWorkflowEngine({
        workflowId,
        workflowCode,
        instanceId,
        modelType,
        modelId,
        autoFetch: true,
    });

    const handleActionClick = async (action: AllowedAction) => {
        if (!action.metadata.can_execute) return;

        // If notes are required or enabled, show notes input
        if (showNotes && !expandedAction) {
            setExpandedAction(action.action);
            return;
        }

        // Execute transition
        await executeTransition(action.action, notes || undefined);
        setNotes('');
        setExpandedAction(null);

        if (onTransitionComplete) {
            onTransitionComplete();
        }
    };

    const handleCancel = () => {
        setExpandedAction(null);
        setNotes('');
    };

    if (allowedActions.length === 0) {
        return (
            <div className={cn('text-center py-4', className)}>
                <AlertCircle className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No actions available</p>
            </div>
        );
    }

    return (
        <div className={cn('space-y-3', className)}>
            {/* Action Buttons */}
            <div
                className={cn(
                    'flex gap-2',
                    layout === 'vertical' ? 'flex-col' : 'flex-wrap'
                )}
            >
                {allowedActions.map((action) => {
                    const Icon = getActionIcon(action.action);
                    const isExpanded = expandedAction === action.action;
                    const canExecute = action.metadata.can_execute;

                    return (
                        <div key={action.action} className="flex-1 min-w-0">
                            <button
                                onClick={() => handleActionClick(action)}
                                disabled={!canExecute || isExecuting}
                                className={cn(
                                    'w-full px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-sm',
                                    getActionVariant(action.variant),
                                    !canExecute && 'opacity-50 cursor-not-allowed',
                                    isExecuting && 'opacity-75 cursor-wait',
                                    isExpanded && 'ring-2 ring-offset-2 ring-sage-500'
                                )}
                                title={!canExecute ? action.metadata.reason : undefined}
                            >
                                {isExecuting && expandedAction === action.action ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Icon className="w-4 h-4" />
                                )}
                                <span>{action.label}</span>
                            </button>

                            {/* Notes Input (Expanded) */}
                            {isExpanded && showNotes && (
                                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                                    <div className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                                        <MessageSquare className="w-3.5 h-3.5" />
                                        <span>Add notes (optional)</span>
                                    </div>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Enter any additional notes..."
                                        rows={3}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sage-500"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleActionClick(action)}
                                            disabled={isExecuting}
                                            className="flex-1 px-3 py-1.5 bg-sage-600 hover:bg-sage-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                                        >
                                            Confirm
                                        </button>
                                        <button
                                            onClick={handleCancel}
                                            disabled={isExecuting}
                                            className="flex-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Permission/Reason Messages */}
            {allowedActions.some(a => !a.metadata.can_execute) && (
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                    {allowedActions
                        .filter(a => !a.metadata.can_execute && a.metadata.reason)
                        .map(action => (
                            <div key={action.action} className="flex items-start gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                <span>
                                    <strong>{action.label}:</strong> {action.metadata.reason}
                                </span>
                            </div>
                        ))}
                </div>
            )}
        </div>
    );
}
