import { useRealtimeWorkflow } from '@/hooks/workflow/useRealtimeWorkflow';
import { Loader2, CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RealtimeWorkflowMonitorProps {
    workflowType: string;
    taskableId: number;
    className?: string;
}

/**
 * Real-time workflow monitoring component
 * Follows Single Responsibility Principle - displays workflow progress only
 */
export function RealtimeWorkflowMonitor({
    workflowType,
    taskableId,
    className,
}: RealtimeWorkflowMonitorProps) {
    const { progress, isConnected, error, refetch } = useRealtimeWorkflow({
        workflowType,
        taskableId,
        enableNotifications: true,
    });

    if (error) {
        return (
            <div className={cn('bg-red-50 border border-red-200 rounded-lg p-4', className)}>
                <div className="flex items-center gap-2 text-red-700">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-medium">Failed to load workflow progress</span>
                </div>
                <button
                    onClick={refetch}
                    className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
                >
                    Try again
                </button>
            </div>
        );
    }

    if (!progress) {
        return (
            <div className={cn('flex items-center justify-center p-8', className)}>
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className={cn('space-y-4', className)}>
            {/* Connection Status */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div
                        className={cn(
                            'w-2 h-2 rounded-full',
                            isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                        )}
                    />
                    <span className="text-sm text-gray-600">
                        {isConnected ? 'Live' : 'Disconnected'}
                    </span>
                </div>
                <button
                    onClick={refetch}
                    className="text-sm text-blue-600 hover:text-blue-700"
                >
                    Refresh
                </button>
            </div>

            {/* Progress Bar */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Workflow Progress</h3>
                    <span className="text-2xl font-bold text-blue-600">
                        {progress.progress_percentage.toFixed(0)}%
                    </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                        className="bg-blue-600 h-full transition-all duration-500 ease-out"
                        style={{ width: `${progress.progress_percentage}%` }}
                    />
                </div>
                <div className="flex items-center justify-between mt-2 text-sm text-gray-600">
                    <span>{progress.completed} of {progress.total} completed</span>
                    <span>{progress.in_progress} in progress</span>
                </div>
            </div>

            {/* Task List */}
            <div className="space-y-2">
                {progress.tasks.map((task, index) => (
                    <TaskCard key={task.id} task={task} index={index} />
                ))}
            </div>
        </div>
    );
}

/**
 * Individual task card component
 * Follows Single Responsibility Principle - displays single task status
 */
function TaskCard({ task, index }: { task: any; index: number }) {
    const statusConfig = {
        completed: {
            icon: CheckCircle2,
            color: 'bg-green-50 border-green-200 text-green-700',
            iconColor: 'text-green-600',
        },
        in_progress: {
            icon: Clock,
            color: 'bg-blue-50 border-blue-200 text-blue-700',
            iconColor: 'text-blue-600',
        },
        ready: {
            icon: Clock,
            color: 'bg-orange-50 border-orange-200 text-orange-700',
            iconColor: 'text-orange-600',
        },
        pending: {
            icon: Clock,
            color: 'bg-gray-50 border-gray-200 text-gray-700',
            iconColor: 'text-gray-400',
        },
        failed: {
            icon: XCircle,
            color: 'bg-red-50 border-red-200 text-red-700',
            iconColor: 'text-red-600',
        },
    };

    const config = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
        <div className={cn('border rounded-lg p-4 transition-all', config.color)}>
            <div className="flex items-center gap-3">
                {/* Step Number */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white border-2 flex items-center justify-center font-bold text-sm">
                    {index + 1}
                </div>

                {/* Task Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="font-semibold truncate">{task.name}</h4>
                        {task.can_start && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                Can Start
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{task.code}</p>
                    {task.completed_at && (
                        <p className="text-xs text-gray-500 mt-1">
                            Completed: {new Date(task.completed_at).toLocaleString('fr-FR')}
                        </p>
                    )}
                    {task.started_at && !task.completed_at && (
                        <p className="text-xs text-gray-500 mt-1">
                            Started: {new Date(task.started_at).toLocaleString('fr-FR')}
                        </p>
                    )}
                </div>

                {/* Status Icon */}
                <Icon className={cn('w-6 h-6 flex-shrink-0', config.iconColor)} />
            </div>
        </div>
    );
}
