import { useTasks, useTaskActions } from '@/hooks/tasks';
import { ListTodo, Clock, CheckCircle, AlertCircle, ArrowRight, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { TaskFilters, WorkflowType } from '@/types/task.types';

interface TaskWidgetProps {
    workflowType?: WorkflowType;
    title?: string;
    maxTasks?: number;
    showViewAll?: boolean;
}

export const TaskWidget: React.FC<TaskWidgetProps> = ({
    workflowType,
    title = 'Mes tâches',
    maxTasks = 5,
    showViewAll = true,
}) => {
    const navigate = useNavigate();
    const filters: TaskFilters = {
        status: 'ready',
        workflow_type: workflowType,
        per_page: maxTasks,
    };

    const { tasks, loading } = useTasks(filters);
    const { claimTask, startTask } = useTaskActions();

    const handleTaskClick = async (taskId: number) => {
        navigate(`/tasks/${taskId}`);
    };

    const handleQuickStart = async (taskId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await claimTask(taskId);
            await startTask(taskId);
            navigate(`/tasks/${taskId}`);
        } catch (error) {
            console.error('Failed to start task:', error);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            </div>
        );
    }

    const safeTasks = tasks || [];
    const taskStats = {
        ready: safeTasks.filter((t) => t.status === 'ready').length,
        in_progress: safeTasks.filter((t) => t.status === 'in_progress').length,
        total: safeTasks.length,
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-white">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                        <ListTodo className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">{title}</h3>
                        <p className="text-xs text-gray-500">
                            {taskStats.ready} prêtes • {taskStats.in_progress} en cours
                        </p>
                    </div>
                </div>
                {showViewAll && (
                    <button
                        onClick={() => navigate('/tasks')}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                        Voir tout
                        <ArrowRight className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="divide-y divide-gray-100">
                {safeTasks.length === 0 ? (
                    <div className="p-8 text-center">
                        <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm text-gray-500">Aucune tâche disponible</p>
                    </div>
                ) : (
                    safeTasks.slice(0, maxTasks).map((task) => {
                        const isAssignedToMe = task.assignments.some((a) => a.status === 'claimed');
                        const statusConfig = {
                            ready: { color: 'text-blue-600', bg: 'bg-blue-100', icon: Clock },
                            in_progress: { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: Clock },
                            completed: { color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle },
                            failed: { color: 'text-red-600', bg: 'bg-red-100', icon: AlertCircle },
                        };

                        const config = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.ready;
                        const StatusIcon = config.icon;

                        return (
                            <div
                                key={task.id}
                                onClick={() => handleTaskClick(task.id)}
                                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="text-sm font-medium text-gray-900 truncate">
                                                {task.name}
                                            </h4>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                                                <StatusIcon className="w-3 h-3 inline mr-1" />
                                                {task.status === 'ready' ? 'Prêt' : task.status === 'in_progress' ? 'En cours' : task.status}
                                            </span>
                                        </div>
                                        {task.taskable && (
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="text-xs text-gray-600">
                                                    {task.taskable.bc_number || task.taskable.order_number || 'N/A'}
                                                    {task.taskable.partner && ` • ${task.taskable.partner.name}`}
                                                </p>
                                                {task.taskable?.id && task.taskable_type === 'Order' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/adv/validation?bcId=${task.taskable?.id}`);
                                                        }}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                                        title="Voir le BC"
                                                    >
                                                        <ExternalLink className="w-3 h-3" />
                                                        BC
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                            <span>{new Date(task.created_at).toLocaleDateString('fr-FR')}</span>
                                            {task.timeout_minutes && (
                                                <span className="text-orange-600">⏱ {task.timeout_minutes}min</span>
                                            )}
                                            {isAssignedToMe && (
                                                <span className="text-blue-600 font-medium">Assigné à vous</span>
                                            )}
                                        </div>
                                    </div>
                                    {task.status === 'ready' && (
                                        <button
                                            onClick={(e) => handleQuickStart(task.id, e)}
                                            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors whitespace-nowrap"
                                        >
                                            Démarrer
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {safeTasks.length > maxTasks && (
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
                    <button
                        onClick={() => navigate('/tasks')}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                        Voir {safeTasks.length - maxTasks} tâche(s) de plus
                    </button>
                </div>
            )}
        </div>
    );
};
