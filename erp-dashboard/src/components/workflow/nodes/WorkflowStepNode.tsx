import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { CheckCircle, Circle, Flag, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WorkflowStepNodeData {
    label: string;
    is_initial?: boolean;
    is_final?: boolean;
    role_code?: string | null;
    description?: string;
    isCurrent?: boolean;
}

export interface WorkflowStepNodeProps {
    data: WorkflowStepNodeData;
    selected?: boolean;
}

/**
 * Custom node component for workflow steps
 * Displays different styles for initial, final, and current steps
 */
export const WorkflowStepNode = memo(({ data, selected }: WorkflowStepNodeProps) => {
    const { label, is_initial, is_final, role_code, description, isCurrent } = data;

    // Determine node style based on type
    const getNodeStyle = () => {
        if (isCurrent) {
            return {
                border: 'border-sage-500',
                bg: 'bg-sage-50 dark:bg-sage-900/20',
                icon: CheckCircle,
                iconColor: 'text-sage-600 dark:text-sage-400',
                iconBg: 'bg-sage-100 dark:bg-sage-900/40',
            };
        }

        if (is_initial) {
            return {
                border: 'border-blue-500',
                bg: 'bg-blue-50 dark:bg-blue-900/20',
                icon: Circle,
                iconColor: 'text-blue-600 dark:text-blue-400',
                iconBg: 'bg-blue-100 dark:bg-blue-900/40',
            };
        }

        if (is_final) {
            return {
                border: 'border-emerald-500',
                bg: 'bg-emerald-50 dark:bg-emerald-900/20',
                icon: Flag,
                iconColor: 'text-emerald-600 dark:text-emerald-400',
                iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
            };
        }

        return {
            border: 'border-gray-300 dark:border-gray-600',
            bg: 'bg-white dark:bg-gray-800',
            icon: Circle,
            iconColor: 'text-gray-500 dark:text-gray-400',
            iconBg: 'bg-gray-100 dark:bg-gray-700',
        };
    };

    const style = getNodeStyle();
    const Icon = style.icon;

    return (
        <div
            className={cn(
                'px-4 py-3 rounded-lg border-2 shadow-md transition-all duration-200',
                style.border,
                style.bg,
                selected && 'ring-2 ring-sage-500 ring-offset-2',
                isCurrent && 'ring-2 ring-sage-500 ring-offset-2 animate-pulse'
            )}
            style={{ minWidth: '220px', maxWidth: '300px' }}
        >
            {/* Handles for connections */}
            <Handle
                type="target"
                position={Position.Top}
                className="!bg-gray-400 !w-2 !h-2"
            />

            {/* Node Content */}
            <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={cn('p-2 rounded-lg shrink-0', style.iconBg)}>
                    <Icon className={cn('w-4 h-4', style.iconColor)} />
                </div>

                {/* Text Content */}
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 leading-tight mb-1">
                        {label}
                    </div>

                    {description && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                            {description}
                        </div>
                    )}

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {is_initial && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                Initial
                            </span>
                        )}

                        {is_final && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                Final
                            </span>
                        )}

                        {isCurrent && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sage-100 text-sage-700 dark:bg-sage-900/40 dark:text-sage-300">
                                Current
                            </span>
                        )}

                        {role_code && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                <Shield className="w-3 h-3" />
                                {role_code}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Handle for outgoing connections */}
            <Handle
                type="source"
                position={Position.Bottom}
                className="!bg-gray-400 !w-2 !h-2"
            />
        </div>
    );
});

WorkflowStepNode.displayName = 'WorkflowStepNode';
