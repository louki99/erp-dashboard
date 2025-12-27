import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { WorkflowVisualization } from '@/components/workflow/WorkflowVisualization';
import { EnhancedWorkflowForm } from '@/components/workflow/EnhancedWorkflowForm';
import { TaskTemplateForm } from '@/components/workflow/TaskTemplateForm';
import { useWorkflowDetail, useWorkflowStatistics } from '@/hooks/workflow/useWorkflowTemplates';
import {
    ArrowLeft,
    Edit,
    Plus,
    Trash2,
    Loader2,
    AlertCircle,
    CheckCircle,
    XCircle,
    BarChart3,
    Settings,
    Eye,
    ListTodo,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { workflowApi } from '@/services/api/workflowApi';
import type { WorkflowTemplateCreateRequest, TaskTemplateCreateRequest } from '@/types/task.types';

export function WorkflowDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const workflowId = id ? parseInt(id) : null;
    const { workflow, loading, error, refetch } = useWorkflowDetail(workflowId);
    const { statistics, loading: statsLoading } = useWorkflowStatistics(workflowId);
    const [activeTab, setActiveTab] = useState<'visualization' | 'templates' | 'tasks' | 'statistics'>('visualization');
    const [deleting, setDeleting] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    const [showCreateTemplateForm, setShowCreateTemplateForm] = useState(false);

    const handleToggleActive = async () => {
        if (!workflow) return;

        try {
            await workflowApi.update(workflow.id, { is_active: !workflow.is_active });
            toast.success(`Workflow ${workflow.is_active ? 'deactivated' : 'activated'} successfully`);
            refetch();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update workflow');
        }
    };

    const handleDelete = async () => {
        if (!workflow) return;

        const confirmed = window.confirm(
            `Are you sure you want to delete "${workflow.name}"? This action cannot be undone.`
        );

        if (!confirmed) return;

        try {
            setDeleting(true);
            await workflowApi.delete(workflow.id);
            toast.success('Workflow deleted successfully');
            navigate('/workflows');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to delete workflow');
        } finally {
            setDeleting(false);
        }
    };

    const handleUpdateWorkflow = async (data: WorkflowTemplateCreateRequest) => {
        if (!workflow) return;
        await workflowApi.update(workflow.id, data);
        toast.success('Workflow updated successfully');
        refetch();
        setShowEditForm(false);
    };

    const handleShowCreateTemplateForm = () => {
        setShowCreateTemplateForm(true);
    };

    const handleCreateTemplate = async (data: TaskTemplateCreateRequest) => {
        if (!workflowId) return;
        await workflowApi.createTemplate(workflowId, data);
        toast.success('Template created successfully');
        refetch();
        setShowCreateTemplateForm(false);
    };

    if (loading) {
        return (
            <MasterLayout
                mainContent={
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                }
            />
        );
    }

    if (error || !workflow) {
        return (
            <MasterLayout
                mainContent={
                    <div className="p-6">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600" />
                                <div>
                                    <h3 className="font-medium text-red-900">Error Loading Workflow</h3>
                                    <p className="text-sm text-red-700 mt-1">
                                        {error || 'Workflow not found'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => navigate('/workflows')}
                                    className="ml-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                                >
                                    Back to Workflows
                                </button>
                            </div>
                        </div>
                    </div>
                }
            />
        );
    }

    const templates = workflow.templates || [];
    const activeTemplates = templates.filter((t) => t.is_active);

    return (
        <MasterLayout
            mainContent={
                <div className="h-full overflow-y-auto">
                    <div className="p-6">
                        {/* Header */}
                        <div className="mb-6">
                            <button
                                onClick={() => navigate('/workflows')}
                                className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to Workflows
                            </button>

                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h1 className="text-2xl font-bold text-gray-900">{workflow.name}</h1>
                                        {workflow.is_active ? (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                                <CheckCircle className="w-4 h-4 mr-1" />
                                                Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                                                <XCircle className="w-4 h-4 mr-1" />
                                                Inactive
                                            </span>
                                        )}
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                            Version {workflow.version}
                                        </span>
                                    </div>
                                    <p className="text-gray-600">{workflow.description || 'No description'}</p>
                                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                                        <span>Code: {workflow.code}</span>
                                        <span>•</span>
                                        <span>Templates: {activeTemplates.length}/{templates.length}</span>
                                        <span>•</span>
                                        <span>Updated: {new Date(workflow.updated_at).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleToggleActive}
                                        className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors"
                                    >
                                        <Settings className="w-4 h-4 mr-2" />
                                        {workflow.is_active ? 'Deactivate' : 'Activate'}
                                    </button>
                                    <button
                                        onClick={() => setShowEditForm(true)}
                                        className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg transition-colors"
                                    >
                                        <Edit className="w-4 h-4 mr-2" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        disabled={deleting}
                                        className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {deleting ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Trash2 className="w-4 h-4 mr-2" />
                                        )}
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="border-b border-gray-200 mb-6">
                            <div className="flex gap-6">
                                <button
                                    onClick={() => setActiveTab('visualization')}
                                    className={`pb-3 px-1 font-medium transition-colors relative ${
                                        activeTab === 'visualization'
                                            ? 'text-blue-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <Eye className="w-4 h-4 inline mr-2" />
                                    Visualization
                                    {activeTab === 'visualization' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('templates')}
                                    className={`pb-3 px-1 font-medium transition-colors relative ${
                                        activeTab === 'templates'
                                            ? 'text-blue-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <Settings className="w-4 h-4 inline mr-2" />
                                    Templates ({templates.length})
                                    {activeTab === 'templates' && (
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
                                    <ListTodo className="w-4 h-4 inline mr-2" />
                                    Tasks
                                    {activeTab === 'tasks' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('statistics')}
                                    className={`pb-3 px-1 font-medium transition-colors relative ${
                                        activeTab === 'statistics'
                                            ? 'text-blue-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <BarChart3 className="w-4 h-4 inline mr-2" />
                                    Statistics
                                    {activeTab === 'statistics' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Tab Content */}
                        {activeTab === 'visualization' && (
                            <div>
                                <div className="mb-4 flex items-center justify-between">
                                    <h2 className="text-lg font-semibold text-gray-900">Workflow Flow</h2>
                                    <button
                                        onClick={handleShowCreateTemplateForm}
                                        className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Template
                                    </button>
                                </div>
                                <WorkflowVisualization
                                    templates={templates}
                                    mode="template"
                                    onNodeClick={(nodeId) => {
                                        const template = templates.find((t) => t.id.toString() === nodeId);
                                        if (template) {
                                            navigate(`/workflows/${workflow.id}/templates/${template.id}`);
                                        }
                                    }}
                                />
                            </div>
                        )}

                        {activeTab === 'templates' && (
                            <div>
                                <div className="mb-4 flex items-center justify-between">
                                    <h2 className="text-lg font-semibold text-gray-900">Task Templates</h2>
                                    <button
                                        onClick={handleShowCreateTemplateForm}
                                        className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Template
                                    </button>
                                </div>

                                {templates.length === 0 ? (
                                    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                                        <Settings className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                        <h3 className="text-lg font-medium text-gray-900 mb-1">
                                            No templates yet
                                        </h3>
                                        <p className="text-gray-600 mb-4">
                                            Create task templates to define your workflow
                                        </p>
                                        <button
                                            onClick={handleShowCreateTemplateForm}
                                            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                        >
                                            <Plus className="w-4 h-4 mr-2" />
                                            Create First Template
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {templates.map((template) => (
                                            <div
                                                key={template.id}
                                                className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400 transition-colors cursor-pointer"
                                                onClick={() =>
                                                    navigate(`/workflows/${workflow.id}/templates/${template.id}`)
                                                }
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h3 className="font-semibold text-gray-900">
                                                                {template.name}
                                                            </h3>
                                                            {template.is_active ? (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                                    Active
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                                    Inactive
                                                                </span>
                                                            )}
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                                {template.task_type}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-gray-600">
                                                            {template.description || 'No description'}
                                                        </p>
                                                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                            <span>Order: {template.order}</span>
                                                            {template.timeout_minutes && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span>Timeout: {template.timeout_minutes}min</span>
                                                                </>
                                                            )}
                                                            <span>•</span>
                                                            <span>Assignment: {template.assignment_type}</span>
                                                            {template.dependencies && template.dependencies.length > 0 && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span>
                                                                        Dependencies: {template.dependencies.length}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'tasks' && (
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">Workflow Task Instances</h2>
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                                    <ListTodo className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                                    <h3 className="text-lg font-medium text-blue-900 mb-2">
                                        Task Instance Tracking
                                    </h3>
                                    <p className="text-sm text-blue-700 mb-4">
                                        This section shows actual task instances created from this workflow template.
                                        Task instances are created when workflows are initialized for specific entities (Orders, BL, etc.).
                                    </p>
                                    <div className="text-xs text-blue-600 space-y-1">
                                        <p>• View task instances by navigating to the Tasks Dashboard</p>
                                        <p>• Filter by workflow type to see tasks from this workflow</p>
                                        <p>• Monitor task progress and completion status</p>
                                    </div>
                                    <button
                                        onClick={() => navigate('/tasks')}
                                        className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                    >
                                        <ListTodo className="w-4 h-4 mr-2" />
                                        Go to Tasks Dashboard
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'statistics' && (
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">Workflow Statistics</h2>
                                {statsLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                    </div>
                                ) : statistics ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                                            <div className="text-sm text-gray-600 mb-1">Total Templates</div>
                                            <div className="text-2xl font-bold text-gray-900">
                                                {statistics.templates?.total || 0}
                                            </div>
                                        </div>
                                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                                            <div className="text-sm text-gray-600 mb-1">Active Templates</div>
                                            <div className="text-2xl font-bold text-green-600">
                                                {statistics.templates?.active || 0}
                                            </div>
                                        </div>
                                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                                            <div className="text-sm text-gray-600 mb-1">Total Instances</div>
                                            <div className="text-2xl font-bold text-blue-600">
                                                {statistics.usage?.total_instances || 0}
                                            </div>
                                        </div>
                                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                                            <div className="text-sm text-gray-600 mb-1">Dependencies</div>
                                            <div className="text-2xl font-bold text-purple-600">
                                                {statistics.dependencies || 0}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-gray-500">No statistics available</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Edit Workflow Form */}
                    {showEditForm && workflow && (
                        <EnhancedWorkflowForm
                            workflow={workflow}
                            onSubmit={handleUpdateWorkflow}
                            onCancel={() => setShowEditForm(false)}
                        />
                    )}

                    {/* Create Template Form */}
                    {showCreateTemplateForm && (
                        <TaskTemplateForm
                            workflowId={workflow.id}
                            onSubmit={handleCreateTemplate}
                            onCancel={() => setShowCreateTemplateForm(false)}
                            maxOrder={Math.max(...templates.map((t) => t.order), 0)}
                        />
                    )}
                </div>
            }
        />
    );
}
