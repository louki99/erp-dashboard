import { useState, useEffect } from 'react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { TaskList, TaskFilters } from '@/components/tasks';
import { useTasks, useTaskActions } from '@/hooks/tasks';
import type { TaskFilters as TaskFiltersType } from '@/types/task.types';
import { ListTodo, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const TaskDashboard = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const statusParam = searchParams.get('status');
    
    const [filters, setFilters] = useState<TaskFiltersType>({
        status: (statusParam as any) || 'ready',
    });

    useEffect(() => {
        if (statusParam) {
            setFilters(prev => ({ ...prev, status: statusParam as any }));
        }
    }, [statusParam]);

    const { tasks, loading, pagination, fetchTasks } = useTasks(filters);
    const { claimTask, startTask } = useTaskActions();

    const handleClaim = async (taskId: number) => {
        try {
            await claimTask(taskId);
            fetchTasks();
        } catch (error) {
            console.error('Failed to claim task:', error);
        }
    };

    const handleStart = async (taskId: number) => {
        try {
            await startTask(taskId);
            navigate(`/tasks/${taskId}`);
        } catch (error) {
            console.error('Failed to start task:', error);
        }
    };

    const handleView = (taskId: number) => {
        navigate(`/tasks/${taskId}`);
    };

    const handleFiltersChange = (newFilters: TaskFiltersType) => {
        setFilters(newFilters);
    };

    const handleResetFilters = () => {
        setFilters({ status: 'ready' });
    };

    const stats = [
        {
            label: 'Tâches prêtes',
            value: tasks?.filter((t) => t.status === 'ready').length || 0,
            icon: ListTodo,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100',
        },
        {
            label: 'En cours',
            value: tasks?.filter((t) => t.status === 'in_progress').length || 0,
            icon: Clock,
            color: 'text-yellow-600',
            bgColor: 'bg-yellow-100',
        },
        {
            label: 'Terminées',
            value: tasks?.filter((t) => t.status === 'completed').length || 0,
            icon: CheckCircle,
            color: 'text-green-600',
            bgColor: 'bg-green-100',
        },
        {
            label: 'En retard',
            value: tasks?.filter((t) => t.timeout_minutes && t.status === 'in_progress').length || 0,
            icon: AlertTriangle,
            color: 'text-red-600',
            bgColor: 'bg-red-100',
        },
    ];

    return (
        <MasterLayout
            mainContent={
                <div className="h-full overflow-y-auto">
                    <div className="p-6">
                        <div className="mb-6">
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Gestion des tâches</h1>
                            <p className="text-gray-600">
                                Gérez vos tâches de workflow et suivez la progression
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            {stats.map((stat, index) => {
                                const Icon = stat.icon;
                                return (
                                    <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                                                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                                            </div>
                                            <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                                                <Icon className={`w-6 h-6 ${stat.color}`} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setFilters({ status: 'ready' })}
                                    className={`px-4 py-2 rounded-lg transition-colors ${
                                        filters.status === 'ready'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    Prêtes
                                </button>
                                <button
                                    onClick={() => setFilters({ status: 'in_progress' })}
                                    className={`px-4 py-2 rounded-lg transition-colors ${
                                        filters.status === 'in_progress'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    En cours
                                </button>
                                <button
                                    onClick={() => setFilters({ status: 'completed' })}
                                    className={`px-4 py-2 rounded-lg transition-colors ${
                                        filters.status === 'completed'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    Terminées
                                </button>
                            </div>
                            <TaskFilters
                                filters={filters}
                                onFiltersChange={handleFiltersChange}
                                onReset={handleResetFilters}
                            />
                        </div>

                        <TaskList
                            tasks={tasks}
                            loading={loading}
                            onClaim={handleClaim}
                            onStart={handleStart}
                            onView={handleView}
                        />

                        {pagination.totalPages > 1 && (
                            <div className="mt-6 flex items-center justify-center gap-2">
                                <button
                                    onClick={() => fetchTasks({ ...filters, page: pagination.currentPage - 1 })}
                                    disabled={pagination.currentPage === 1}
                                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Précédent
                                </button>
                                <span className="text-sm text-gray-600">
                                    Page {pagination.currentPage} sur {pagination.totalPages}
                                </span>
                                <button
                                    onClick={() => fetchTasks({ ...filters, page: pagination.currentPage + 1 })}
                                    disabled={pagination.currentPage === pagination.totalPages}
                                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Suivant
                                </button>
                            </div>
                        )}
                    </div>
                    {/* <PermissionDebug /> */}
                </div>
            }
        />
    );
};
