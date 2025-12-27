import { useWorkflowProgress } from '@/hooks/tasks';
import { CheckCircle, Clock, Circle, XCircle, AlertCircle } from 'lucide-react';
import type { WorkflowType } from '@/types/task.types';

interface WorkflowTaskListProps {
    workflowType: WorkflowType;
    entityType: string;
    entityId: number;
    compact?: boolean;
}

export const WorkflowTaskList: React.FC<WorkflowTaskListProps> = ({
    workflowType,
    entityType,
    entityId,
    compact = false,
}) => {
    const { progress, loading } = useWorkflowProgress(workflowType, entityType, entityId);

    if (loading) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
            </div>
        );
    }

    if (!progress || progress.tasks.length === 0) {
        return null;
    }

    const statusConfig = {
        pending: { icon: Circle, color: 'text-gray-400', bg: 'bg-gray-100', label: 'En attente' },
        ready: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Prêt' },
        in_progress: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'En cours' },
        completed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'Terminé' },
        failed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Échoué' },
        cancelled: { icon: XCircle, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Annulé' },
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-white border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 text-sm">Progression du workflow</h3>
                    <span className="text-sm font-bold text-blue-600">
                        {Math.round(progress.progress_percentage)}%
                    </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${progress.progress_percentage}%` }}
                    />
                </div>
            </div>

            <div className={`divide-y divide-gray-100 ${compact ? 'max-h-64 overflow-y-auto' : ''}`}>
                {progress.tasks.map((task, index) => {
                    const config = statusConfig[task.status];
                    const Icon = config.icon;
                    const isActive = task.status === 'in_progress' || task.status === 'ready';

                    return (
                        <div
                            key={task.id}
                            className={`px-4 py-3 ${isActive ? 'bg-blue-50/50' : ''} hover:bg-gray-50 transition-colors`}
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div className={`flex-shrink-0 w-6 h-6 rounded-full ${config.bg} flex items-center justify-center`}>
                                        <Icon className={`w-4 h-4 ${config.color}`} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                                            <h4 className={`text-sm font-medium truncate ${isActive ? 'text-gray-900' : 'text-gray-700'}`}>
                                                {task.name}
                                            </h4>
                                        </div>
                                        {!compact && task.description && (
                                            <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">
                                                {task.description}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color} font-medium`}>
                                                {config.label}
                                            </span>
                                            {task.assignments.length > 0 && task.assignments[0].role_name && (
                                                <span className="text-xs text-gray-500">
                                                    {task.assignments[0].role_name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {task.completed_at && (
                                    <span className="text-xs text-gray-500 flex-shrink-0">
                                        {new Date(task.completed_at).toLocaleDateString('fr-FR')}
                                    </span>
                                )}
                            </div>

                            {task.error_message && (
                                <div className="mt-2 flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded p-2">
                                    <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                    <span>{task.error_message}</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {!compact && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div>
                            <div className="font-semibold text-gray-900">{progress.completed}</div>
                            <div className="text-gray-600">Terminées</div>
                        </div>
                        <div>
                            <div className="font-semibold text-gray-900">{progress.in_progress}</div>
                            <div className="text-gray-600">En cours</div>
                        </div>
                        <div>
                            <div className="font-semibold text-gray-900">{progress.ready}</div>
                            <div className="text-gray-600">Prêtes</div>
                        </div>
                        <div>
                            <div className="font-semibold text-gray-900">{progress.pending}</div>
                            <div className="text-gray-600">En attente</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
