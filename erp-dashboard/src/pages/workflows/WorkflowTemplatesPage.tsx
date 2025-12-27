import { useState } from 'react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { WorkflowTemplateCard } from '@/components/workflow/WorkflowTemplateCard';
import { useWorkflowTemplates } from '@/hooks/workflow/useWorkflowTemplates';
import { Plus, Loader2, AlertCircle, Workflow } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function WorkflowTemplatesPage() {
    const navigate = useNavigate();
    const { workflows, loading, error, refetch } = useWorkflowTemplates();
    const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

    const filteredWorkflows = workflows.filter((w) => {
        if (filter === 'active') return w.is_active;
        if (filter === 'inactive') return !w.is_active;
        return true;
    });

    return (
        <MasterLayout
            mainContent={
                <div className="h-full overflow-y-auto">
                    <div className="p-6">
                        {/* Header */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                        <Workflow className="w-7 h-7 text-blue-600" />
                                        Workflow Templates
                                    </h1>
                                    <p className="text-gray-600 mt-1">
                                        Manage workflow definitions and task templates
                                    </p>
                                </div>
                                <button
                                    onClick={() => navigate('/workflows/create')}
                                    className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                                >
                                    <Plus className="w-5 h-5 mr-2" />
                                    Create Workflow
                                </button>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="flex items-center gap-2 mb-6">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                    filter === 'all'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                All ({workflows.length})
                            </button>
                            <button
                                onClick={() => setFilter('active')}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                    filter === 'active'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                Active ({workflows.filter((w) => w.is_active).length})
                            </button>
                            <button
                                onClick={() => setFilter('inactive')}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                    filter === 'inactive'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                Inactive ({workflows.filter((w) => !w.is_active).length})
                            </button>
                        </div>

                        {/* Loading State */}
                        {loading && (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            </div>
                        )}

                        {/* Error State */}
                        {error && !loading && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <div className="flex items-center gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-600" />
                                    <div>
                                        <h3 className="font-medium text-red-900">Error Loading Workflows</h3>
                                        <p className="text-sm text-red-700 mt-1">{error}</p>
                                    </div>
                                    <button
                                        onClick={refetch}
                                        className="ml-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                                    >
                                        Retry
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Workflows Grid */}
                        {!loading && !error && (
                            <>
                                {filteredWorkflows.length === 0 ? (
                                    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                                        <Workflow className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                        <h3 className="text-lg font-medium text-gray-900 mb-1">
                                            No workflows found
                                        </h3>
                                        <p className="text-gray-600 mb-4">
                                            {filter === 'all'
                                                ? 'Create your first workflow template to get started'
                                                : `No ${filter} workflows available`}
                                        </p>
                                        {filter === 'all' && (
                                            <button
                                                onClick={() => navigate('/workflows/create')}
                                                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                            >
                                                <Plus className="w-5 h-5 mr-2" />
                                                Create Workflow
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {filteredWorkflows.map((workflow) => (
                                            <WorkflowTemplateCard key={workflow.id} workflow={workflow} />
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            }
        />
    );
}
