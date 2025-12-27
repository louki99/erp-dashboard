import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { DependencyManager } from '@/components/workflow/DependencyManager';
import { ValidationRuleManager } from '@/components/workflow/ValidationRuleManager';
import { TaskTemplateForm } from '@/components/workflow/TaskTemplateForm';
import { workflowApi } from '@/services/api/workflowApi';
import { ArrowLeft, Edit, Trash2, Loader2, Settings, GitBranch, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import type { WorkflowTaskTemplate, TemplateDependencyCreateRequest, TemplateValidationRuleCreateRequest } from '@/types/task.types';

export function TaskTemplateDetailPage() {
    const { workflowId, templateId } = useParams<{ workflowId: string; templateId: string }>();
    const navigate = useNavigate();
    const [template, setTemplate] = useState<WorkflowTaskTemplate | null>(null);
    const [allTemplates, setAllTemplates] = useState<WorkflowTaskTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showEditForm, setShowEditForm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'dependencies' | 'validation'>('details');

    useEffect(() => {
        loadTemplate();
    }, [workflowId, templateId]);

    const loadTemplate = async () => {
        if (!workflowId || !templateId) return;

        try {
            setLoading(true);
            const templates = await workflowApi.getTemplates(Number(workflowId));
            setAllTemplates(templates);
            const found = templates.find((t) => t.id === Number(templateId));
            if (found) {
                setTemplate(found);
            } else {
                toast.error('Template not found');
                navigate(`/workflows/${workflowId}`);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to load template');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (data: any) => {
        if (!workflowId || !templateId) return;

        await workflowApi.updateTemplate(Number(workflowId), Number(templateId), data);
        await loadTemplate();
        setShowEditForm(false);
    };

    const handleDelete = async () => {
        if (!workflowId || !templateId || !template) return;

        const confirmed = window.confirm(
            `Are you sure you want to delete "${template.name}"? This action cannot be undone.`
        );

        if (!confirmed) return;

        try {
            setDeleting(true);
            await workflowApi.deleteTemplate(Number(workflowId), Number(templateId));
            toast.success('Template deleted successfully');
            navigate(`/workflows/${workflowId}`);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete template');
        } finally {
            setDeleting(false);
        }
    };

    const handleAddDependency = async (data: TemplateDependencyCreateRequest) => {
        if (!workflowId || !templateId) return;
        await workflowApi.addDependency(Number(workflowId), Number(templateId), data);
        await loadTemplate();
    };

    const handleRemoveDependency = async (dependencyId: number) => {
        if (!workflowId || !templateId) return;
        await workflowApi.removeDependency(Number(workflowId), Number(templateId), dependencyId);
        await loadTemplate();
    };

    const handleAddValidationRule = async (data: TemplateValidationRuleCreateRequest) => {
        if (!workflowId || !templateId) return;
        await workflowApi.addValidationRule(Number(workflowId), Number(templateId), data);
        await loadTemplate();
    };

    const handleUpdateValidationRule = async (ruleId: number, data: Partial<TemplateValidationRuleCreateRequest>) => {
        if (!workflowId || !templateId) return;
        await workflowApi.updateValidationRule(Number(workflowId), Number(templateId), ruleId, data);
        await loadTemplate();
    };

    const handleRemoveValidationRule = async (ruleId: number) => {
        if (!workflowId || !templateId) return;
        await workflowApi.deleteValidationRule(Number(workflowId), Number(templateId), ruleId);
        await loadTemplate();
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

    if (!template) {
        return null;
    }

    return (
        <MasterLayout
            mainContent={
                <div className="h-full overflow-y-auto">
                    <div className="p-6">
                        <button
                            onClick={() => navigate(`/workflows/${workflowId}`)}
                            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Workflow
                        </button>

                        {/* Header */}
                        <div className="mb-6">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h1 className="text-2xl font-bold text-gray-900">{template.name}</h1>
                                        {template.is_active ? (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                                Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                                                Inactive
                                            </span>
                                        )}
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                            {template.task_type}
                                        </span>
                                    </div>
                                    <p className="text-gray-600">{template.description || 'No description'}</p>
                                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                                        <span>Code: {template.code}</span>
                                        <span>•</span>
                                        <span>Order: {template.order}</span>
                                        {template.timeout_minutes && (
                                            <>
                                                <span>•</span>
                                                <span>Timeout: {template.timeout_minutes}min</span>
                                            </>
                                        )}
                                        <span>•</span>
                                        <span>Assignment: {template.assignment_type}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
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
                                    onClick={() => setActiveTab('details')}
                                    className={`pb-3 px-1 font-medium transition-colors relative ${
                                        activeTab === 'details'
                                            ? 'text-blue-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <Settings className="w-4 h-4 inline mr-2" />
                                    Details
                                    {activeTab === 'details' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('dependencies')}
                                    className={`pb-3 px-1 font-medium transition-colors relative ${
                                        activeTab === 'dependencies'
                                            ? 'text-blue-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <GitBranch className="w-4 h-4 inline mr-2" />
                                    Dependencies ({template.dependencies?.length || 0})
                                    {activeTab === 'dependencies' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('validation')}
                                    className={`pb-3 px-1 font-medium transition-colors relative ${
                                        activeTab === 'validation'
                                            ? 'text-blue-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <CheckCircle className="w-4 h-4 inline mr-2" />
                                    Validation Rules ({template.validation_rules?.length || 0})
                                    {activeTab === 'validation' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Tab Content */}
                        {activeTab === 'details' && (
                            <div className="bg-white border border-gray-200 rounded-lg p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Template Details</h3>
                                <dl className="grid grid-cols-2 gap-4">
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Code</dt>
                                        <dd className="mt-1 text-sm text-gray-900">{template.code}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Task Type</dt>
                                        <dd className="mt-1 text-sm text-gray-900">{template.task_type}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Order</dt>
                                        <dd className="mt-1 text-sm text-gray-900">{template.order}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Timeout</dt>
                                        <dd className="mt-1 text-sm text-gray-900">
                                            {template.timeout_minutes ? `${template.timeout_minutes} minutes` : 'No timeout'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Assignment Type</dt>
                                        <dd className="mt-1 text-sm text-gray-900">{template.assignment_type}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Assignment Target</dt>
                                        <dd className="mt-1 text-sm text-gray-900">
                                            {template.assignment_target || 'Not specified'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Auto Complete</dt>
                                        <dd className="mt-1 text-sm text-gray-900">
                                            {template.auto_complete ? 'Yes' : 'No'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-sm font-medium text-gray-500">Status</dt>
                                        <dd className="mt-1 text-sm text-gray-900">
                                            {template.is_active ? 'Active' : 'Inactive'}
                                        </dd>
                                    </div>
                                </dl>
                            </div>
                        )}

                        {activeTab === 'dependencies' && (
                            <DependencyManager
                                template={template}
                                allTemplates={allTemplates}
                                onAddDependency={handleAddDependency}
                                onRemoveDependency={handleRemoveDependency}
                            />
                        )}

                        {activeTab === 'validation' && (
                            <ValidationRuleManager
                                template={template}
                                onAddRule={handleAddValidationRule}
                                onUpdateRule={handleUpdateValidationRule}
                                onRemoveRule={handleRemoveValidationRule}
                            />
                        )}
                    </div>

                    {/* Edit Form Modal */}
                    {showEditForm && (
                        <TaskTemplateForm
                            workflowId={Number(workflowId)}
                            template={template}
                            onSubmit={handleUpdate}
                            onCancel={() => setShowEditForm(false)}
                            maxOrder={Math.max(...allTemplates.map((t) => t.order))}
                        />
                    )}
                </div>
            }
        />
    );
}
