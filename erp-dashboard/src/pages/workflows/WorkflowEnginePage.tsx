import { useState } from 'react';
import { WorkflowEngineVisualization } from '@/components/workflow/WorkflowEngineVisualization';
import { WorkflowActionPanel } from '@/components/workflow/WorkflowActionPanel';
import { useWorkflowEngine } from '@/hooks/workflow/useWorkflowEngine';
import { Loader2, Workflow, Info } from 'lucide-react';

export function WorkflowEnginePage() {
    // Example: BC Validation Workflow
    // Use workflowId directly instead of code to avoid API resolution
    const [selectedWorkflow] = useState({
        workflowId: 14, // BC Validation Workflow (matches Order 115's workflow)
        modelType: 'App\\Models\\Order',
        modelId: 117, // Example Order ID
    });

    const {
        graph,
        instance,
        currentStep,
        allowedActions,
        isLoading,
        error,
    } = useWorkflowEngine({
        workflowId: selectedWorkflow.workflowId,
        modelType: selectedWorkflow.modelType,
        modelId: selectedWorkflow.modelId,
        autoFetch: true,
    });

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Workflow className="w-8 h-8 text-sage-600" />
                        Workflow Engine Test
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Visual workflow management with React Flow
                    </p>
                </div>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900 dark:text-blue-200">
                        <strong>Demo Page:</strong> This page demonstrates the new Workflow Engine with React Flow.
                        It uses example data (BC Validation workflow, Order ID 115). Connect to the backend API to see real workflow data.
                    </div>
                </div>
            </div>

            {/* Workflow Info Card */}
            {instance && (
                <div className="p-4 bg-gradient-to-r from-sage-50 to-emerald-50 dark:from-sage-900/20 dark:to-emerald-900/20 rounded-lg border border-sage-200 dark:border-sage-800">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                                Workflow ID
                            </div>
                            <div className="text-sm font-bold text-gray-900 dark:text-white mt-1">
                                #{selectedWorkflow.workflowId}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                                Instance ID
                            </div>
                            <div className="text-sm font-bold text-gray-900 dark:text-white mt-1">
                                #{instance.id}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                                Current Step
                            </div>
                            <div className="text-sm font-bold text-sage-600 dark:text-sage-400 mt-1">
                                {currentStep?.name || 'N/A'}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                                Status
                            </div>
                            <div className="text-sm font-bold text-gray-900 dark:text-white mt-1 capitalize">
                                {instance.status.replace('_', ' ')}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Workflow Visualization */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold mb-4">Workflow Graph</h2>
                <WorkflowEngineVisualization
                    workflowId={selectedWorkflow.workflowId}
                    modelType={selectedWorkflow.modelType}
                    modelId={selectedWorkflow.modelId}
                    height="600px"
                    showMiniMap={true}
                    showControls={true}
                />
            </div>

            {/* Graph Statistics */}
            {graph && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-2xl font-bold text-sage-600">
                                {graph.nodes.length}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                                Steps
                            </div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-blue-600">
                                {graph.edges.length}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                                Transitions
                            </div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-emerald-600">
                                {allowedActions.length}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                                Available Actions
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Workflow Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold mb-4">Workflow Actions</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Execute transitions to move the workflow to the next step.
                </p>

                <WorkflowActionPanel
                    workflowId={selectedWorkflow.workflowId}
                    modelType={selectedWorkflow.modelType}
                    modelId={selectedWorkflow.modelId}
                    layout="horizontal"
                    showNotes={true}
                />
            </div>

            {/* Action Details */}
            {allowedActions.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-sm font-semibold mb-4">Action Details</h3>
                    <div className="space-y-3">
                        {allowedActions.map((action) => (
                            <div
                                key={action.action}
                                className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-sm">
                                        {action.label}
                                    </span>
                                    <span
                                        className={`text-xs px-2 py-1 rounded-full ${action.metadata.can_execute
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                            : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                            }`}
                                    >
                                        {action.metadata.can_execute ? 'Available' : 'Blocked'}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                    Action: <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded">{action.action}</code>
                                </div>
                                {action.metadata.reason && (
                                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                        Reason: {action.metadata.reason}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Loading Overlay */}
            {isLoading && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 flex items-center gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-sage-600" />
                        <span className="text-gray-900 dark:text-white">Loading workflow...</span>
                    </div>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-4">
                    <div className="text-sm text-red-900 dark:text-red-200">
                        <strong>Error:</strong> {error.message}
                    </div>
                </div>
            )}
        </div>
    );
}
