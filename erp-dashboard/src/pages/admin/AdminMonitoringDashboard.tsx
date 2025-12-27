import { useState, useEffect } from 'react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { TaskMonitoringDashboard } from '@/components/workflow/TaskMonitoringDashboard';
import { useTaskStatistics } from '@/hooks/workflow/useTaskStatistics';
import { useWorkflowTemplates } from '@/hooks/workflow/useWorkflowTemplates';
import { taskApi } from '@/services/api/taskApi';
import { 
    Activity, 
    TrendingUp, 
    AlertTriangle, 
    CheckCircle2,
    Clock,
    XCircle,
    Loader2,
    RefreshCw,
    Search,
    Eye,
    ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { WorkflowTask, WorkflowType } from '@/types/task.types';

export function AdminMonitoringDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'workflows'>('overview');
    const [selectedWorkflowType, setSelectedWorkflowType] = useState<WorkflowType | 'all'>('all');
    const [taskFilter, setTaskFilter] = useState<'all' | 'in_progress' | 'failed' | 'ready'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [allTasks, setAllTasks] = useState<WorkflowTask[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const { statistics, loading: statsLoading, refetch: refetchStats } = useTaskStatistics({
        autoRefresh: true,
        refreshInterval: 10000
    });

    const { workflows, loading: workflowsLoading, refetch: refetchWorkflows } = useWorkflowTemplates();

    useEffect(() => {
        fetchAllTasks();
    }, [taskFilter, refreshKey]);

    const fetchAllTasks = async () => {
        setLoadingTasks(true);
        try {
            const filters: any = {};
            if (taskFilter !== 'all') {
                filters.status = taskFilter;
            }
            const response = await taskApi.tasks.getAll(filters);
            
            // Handle both paginated and flat array responses
            if (Array.isArray(response.tasks)) {
                setAllTasks(response.tasks);
            } else {
                setAllTasks(response.tasks.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch tasks:', error);
        } finally {
            setLoadingTasks(false);
        }
    };

    const handleRefresh = () => {
        setRefreshKey(prev => prev + 1);
        refetchStats();
        refetchWorkflows();
    };

    const filteredTasks = allTasks.filter(task => {
        const matchesSearch = searchQuery === '' || 
            task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            task.code.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesWorkflow = selectedWorkflowType === 'all' || task.workflow_type === selectedWorkflowType;
        
        return matchesSearch && matchesWorkflow;
    });

    const activeWorkflows = workflows.filter(w => w.is_active);
    const inProgressTasks = statistics?.in_progress || 0;
    const failedTasks = statistics?.failed || 0;
    const readyTasks = statistics?.ready || 0;

    return (
        <MasterLayout
            mainContent={
                <div className="h-full overflow-y-auto bg-gray-50">
                    <div className="p-6">
                        {/* Header */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                        <Activity className="w-7 h-7 text-blue-600" />
                                        Admin Monitoring Dashboard
                                    </h1>
                                    <p className="text-gray-600 mt-1">
                                        Real-time monitoring of all workflows and tasks
                                    </p>
                                </div>
                                <button
                                    onClick={handleRefresh}
                                    className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors"
                                >
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Refresh
                                </button>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-gray-600">Total Tasks</span>
                                    <Activity className="w-5 h-5 text-gray-400" />
                                </div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {statsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : statistics?.total || 0}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">All workflow tasks</div>
                            </div>

                            <div className="bg-white border border-blue-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-gray-600">In Progress</span>
                                    <Clock className="w-5 h-5 text-blue-400" />
                                </div>
                                <div className="text-2xl font-bold text-blue-600">
                                    {statsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : inProgressTasks}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {readyTasks} ready to start
                                </div>
                            </div>

                            <div className="bg-white border border-green-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-gray-600">Completed</span>
                                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                                </div>
                                <div className="text-2xl font-bold text-green-600">
                                    {statsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : statistics?.completed || 0}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {statistics?.total ? ((statistics.completed / statistics.total) * 100).toFixed(1) : 0}% completion rate
                                </div>
                            </div>

                            <div className="bg-white border border-red-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-gray-600">Issues</span>
                                    <AlertTriangle className="w-5 h-5 text-red-400" />
                                </div>
                                <div className="text-2xl font-bold text-red-600">
                                    {statsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : failedTasks}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {statistics?.cancelled || 0} cancelled
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="border-b border-gray-200 mb-6">
                            <div className="flex gap-6">
                                <button
                                    onClick={() => setActiveTab('overview')}
                                    className={`pb-3 px-1 font-medium transition-colors relative ${
                                        activeTab === 'overview'
                                            ? 'text-blue-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <TrendingUp className="w-4 h-4 inline mr-2" />
                                    Overview
                                    {activeTab === 'overview' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('tasks')}
                                    className={`pb-3 px-1 font-medium transition-colors relative ${
                                        activeTab === 'tasks'
                                            ? 'text-blue-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <Activity className="w-4 h-4 inline mr-2" />
                                    All Tasks ({allTasks.length})
                                    {activeTab === 'tasks' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('workflows')}
                                    className={`pb-3 px-1 font-medium transition-colors relative ${
                                        activeTab === 'workflows'
                                            ? 'text-blue-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <Activity className="w-4 h-4 inline mr-2" />
                                    Workflows ({activeWorkflows.length})
                                    {activeTab === 'workflows' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Tab Content */}
                        {activeTab === 'overview' && (
                            <div className="space-y-6">
                                <TaskMonitoringDashboard
                                    autoRefresh={true}
                                    refreshInterval={10000}
                                />

                                {/* Active Workflows Summary */}
                                <div className="bg-white border border-gray-200 rounded-lg p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Workflows</h3>
                                    {workflowsLoading ? (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {activeWorkflows.map(workflow => (
                                                <div
                                                    key={workflow.id}
                                                    onClick={() => navigate(`/workflows/${workflow.id}`)}
                                                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h4 className="font-semibold text-gray-900">{workflow.code}</h4>
                                                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                                                            Active
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-600 mb-3">{workflow.name}</p>
                                                    <div className="flex items-center justify-between text-xs text-gray-500">
                                                        <span>{workflow.templates?.length || 0} templates</span>
                                                        <span>v{workflow.version}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'tasks' && (
                            <div className="space-y-4">
                                {/* Filters */}
                                <div className="bg-white border border-gray-200 rounded-lg p-4">
                                    <div className="flex flex-col md:flex-row gap-4">
                                        <div className="flex-1">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search tasks by name or code..."
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <select
                                                value={taskFilter}
                                                onChange={(e) => setTaskFilter(e.target.value as any)}
                                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            >
                                                <option value="all">All Status</option>
                                                <option value="ready">Ready</option>
                                                <option value="in_progress">In Progress</option>
                                                <option value="failed">Failed</option>
                                            </select>
                                            <select
                                                value={selectedWorkflowType}
                                                onChange={(e) => setSelectedWorkflowType(e.target.value as any)}
                                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            >
                                                <option value="all">All Workflows</option>
                                                <option value="bc">BC - Bon de Commande</option>
                                                <option value="bl">BL - Bon de Livraison</option>
                                                <option value="bch">BCH - Bon de Chargement</option>
                                                <option value="bp">BP - Bon de Préparation</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Task List */}
                                {loadingTasks ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                    </div>
                                ) : filteredTasks.length === 0 ? (
                                    <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
                                        <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                        <h3 className="text-lg font-medium text-gray-900 mb-1">No tasks found</h3>
                                        <p className="text-gray-600">Try adjusting your filters</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {filteredTasks.map(task => (
                                            <TaskQuickCard
                                                key={task.id}
                                                task={task}
                                                onView={() => navigate(`/tasks/${task.id}`)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'workflows' && (
                            <div className="space-y-4">
                                {workflowsLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {workflows.map(workflow => (
                                            <div
                                                key={workflow.id}
                                                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-all cursor-pointer"
                                                onClick={() => navigate(`/workflows/${workflow.id}`)}
                                            >
                                                <div className="flex items-start justify-between mb-4">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-gray-900">{workflow.code}</h3>
                                                        <p className="text-sm text-gray-600 mt-1">{workflow.name}</p>
                                                    </div>
                                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                                        workflow.is_active
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-gray-100 text-gray-700'
                                                    }`}>
                                                        {workflow.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </div>

                                                {workflow.description && (
                                                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                                                        {workflow.description}
                                                    </p>
                                                )}

                                                <div className="grid grid-cols-2 gap-4 mb-4">
                                                    <div>
                                                        <div className="text-xs text-gray-500">Templates</div>
                                                        <div className="text-lg font-semibold text-gray-900">
                                                            {workflow.templates?.length || 0}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500">Version</div>
                                                        <div className="text-lg font-semibold text-gray-900">
                                                            v{workflow.version}
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/workflows/${workflow.id}`);
                                                    }}
                                                    className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                                >
                                                    <Eye className="w-4 h-4 mr-2" />
                                                    View Details
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            }
        />
    );
}

// Quick Task Card Component
function TaskQuickCard({ task, onView }: { task: WorkflowTask; onView: () => void }) {
    const navigate = useNavigate();
    const statusConfig = {
        pending: { color: 'bg-gray-100 text-gray-700', icon: Clock },
        ready: { color: 'bg-blue-100 text-blue-700', icon: Clock },
        in_progress: { color: 'bg-yellow-100 text-yellow-700', icon: Clock },
        completed: { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
        failed: { color: 'bg-red-100 text-red-700', icon: XCircle },
        cancelled: { color: 'bg-gray-100 text-gray-700', icon: XCircle },
    };

    const config = statusConfig[task.status];
    const Icon = config.icon;

    return (
        <div
            onClick={onView}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">{task.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">{task.code}</p>
                </div>
                <Icon className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
            </div>

            <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                    {task.status}
                </span>
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                    {task.workflow_type?.toUpperCase()}
                </span>
            </div>

            {task.taskable && (
                <div className="flex items-center justify-between text-xs mb-3">
                    <span className="text-gray-600">
                        {task.taskable_type} #{task.taskable_id}
                    </span>
                    {task.taskable?.id && task.taskable_type === 'Order' && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/adv/validation?bcId=${task.taskable?.id}`);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                            title="Voir le BC"
                        >
                            <ExternalLink className="w-3 h-3" />
                            BC
                        </button>
                    )}
                </div>
            )}

            <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{new Date(task.created_at).toLocaleDateString('fr-FR')}</span>
                {task.timeout_minutes && (
                    <span className="text-orange-600">⏱ {task.timeout_minutes}min</span>
                )}
            </div>
        </div>
    );
}
