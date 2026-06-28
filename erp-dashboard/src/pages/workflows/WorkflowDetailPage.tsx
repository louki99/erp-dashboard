import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { WorkflowEngineVisualization } from '@/components/workflow/WorkflowEngineVisualization';
import { workflowEngineApi } from '@/services/api/workflowEngineApi';
import type { WorkflowDefinition, WorkflowStepDefinition, TransitionRule } from '@/types/workflowEngine.types';
import { Loader2, ArrowLeft, Settings, AlertCircle, FileText, Component } from 'lucide-react';
import toast from 'react-hot-toast';
import { useWorkflowEngine } from '@/hooks/workflow/useWorkflowEngine';
import { TransitionRulesTable } from '@/components/workflow/TransitionRulesTable';
import { TransitionRuleModal } from '@/components/workflow/TransitionRuleModal';

export function WorkflowDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const workflowId = id ? parseInt(id) : null;

    const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
    const [steps, setSteps] = useState<WorkflowStepDefinition[]>([]);
    const [rules, setRules] = useState<TransitionRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingRules, setLoadingRules] = useState(false);
    const [togglingRuleId, setTogglingRuleId] = useState<number | null>(null);

    const [activeViewTab, setActiveViewTab] = useState<'diagram' | 'ledger'>('diagram');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState<any>(null);

    const { graph } = useWorkflowEngine({
        workflowId: workflowId || undefined,
        autoFetch: true,
    });

    // Load workflow definition + steps
    useEffect(() => {
        if (!workflowId) return;
        setLoading(true);
        workflowEngineApi.getWorkflowDetail(workflowId)
            .then(({ workflow: wf, steps: st }) => {
                setWorkflow(wf);
                setSteps(st || []);
            })
            .catch((err) => toast.error(err.message || 'Failed to load workflow'))
            .finally(() => setLoading(false));
    }, [workflowId]);

    // Load all rules for all steps when switching to ledger tab
    const loadRules = useCallback(async () => {
        if (!steps.length) return;
        setLoadingRules(true);
        try {
            const allRules = await Promise.all(
                steps.map(step => workflowEngineApi.getStepRules(step.id).catch(() => []))
            );
            setRules(allRules.flat());
        } catch {
            toast.error('Failed to load transition rules');
        } finally {
            setLoadingRules(false);
        }
    }, [steps]);

    useEffect(() => {
        if (activeViewTab === 'ledger' && steps.length && rules.length === 0) {
            loadRules();
        }
    }, [activeViewTab, steps.length, rules.length, loadRules]);

    const handleAddRule = () => {
        setModalData(null);
        setIsModalOpen(true);
    };

    const handleEditRule = (rule: TransitionRule) => {
        const conditions = rule.condition_group?.conditions ?? [];
        // Normalise legacy string conditions to object form
        const normalisedConditions = conditions.map(c =>
            typeof c === 'string'
                ? { class: c, parameters: {} }
                : c
        );
        setModalData({
            id: rule.id,
            // resolve source step code from step ID
            source: steps.find(s => s.id === rule.workflow_step_id)?.code ?? String(rule.workflow_step_id),
            target: rule.target_step_code,
            priority: rule.priority,
            is_active: rule.is_active,
            operator: rule.condition_group?.operator ?? 'AND',
            conditions: normalisedConditions,
        });
        setIsModalOpen(true);
    };

    const handleToggleRule = async (rule: TransitionRule) => {
        setTogglingRuleId(rule.id);
        try {
            const updated = await workflowEngineApi.updateStepRule(
                rule.workflow_step_id,
                rule.id,
                { is_active: !rule.is_active }
            );
            setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
            toast.success(`Rule ${updated.is_active ? 'activated' : 'deactivated'}`);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update rule');
        } finally {
            setTogglingRuleId(null);
        }
    };

    const handleSaveRule = async (data: any) => {
        const sourceStep = steps.find(s => s.code === data.source);
        if (!sourceStep) {
            throw new Error(`Step "${data.source}" not found`);
        }

        const payload = {
            target_step_code: data.target,
            is_active: data.is_active,
            priority: data.priority,
            condition_group: {
                operator: data.operator,
                conditions: data.conditions,
            },
        };

        if (data.id) {
            // Edit existing rule
            const updated = await workflowEngineApi.updateStepRule(sourceStep.id, data.id, payload);
            setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
            toast.success('Transition rule updated');
        } else {
            // New rule
            await workflowEngineApi.createStepRule(sourceStep.id, payload);
            await loadRules();
            toast.success('Transition rule created');
        }
        setIsModalOpen(false);
    };

    if (loading) {
        return (
            <MasterLayout
                mainContent={
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
                    </div>
                }
            />
        );
    }

    if (!workflow) {
        return (
            <MasterLayout
                mainContent={
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <AlertCircle className="w-12 h-12 text-gray-400" />
                        <h2 className="text-xl font-bold text-gray-700">Workflow Not Found</h2>
                        <button onClick={() => navigate('/workflows')} className="text-sage-600 hover:underline">
                            Back to Workflows
                        </button>
                    </div>
                }
            />
        );
    }

    return (
        <MasterLayout
            mainContent={
                <div className="flex flex-col h-full bg-white relative">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/workflows')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    {workflow.name}
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                                        {workflow.code}
                                    </span>
                                </h1>
                                <p className="text-sm text-gray-500">{workflow.description}</p>
                            </div>
                        </div>

                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => setActiveViewTab('diagram')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                    activeViewTab === 'diagram'
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <Component className="w-4 h-4" />
                                Diagram Visualizer
                            </button>
                            <button
                                onClick={() => setActiveViewTab('ledger')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                    activeViewTab === 'ledger'
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <FileText className="w-4 h-4" />
                                Rule Ledger
                                {rules.length > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-sage-100 text-sage-700 text-xs font-semibold">
                                        {rules.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-1 overflow-hidden relative bg-gray-50 p-4">
                        {activeViewTab === 'diagram' ? (
                            <div className="flex-1 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                                <div className="p-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                        <Settings className="w-4 h-4" />
                                        Workflow Diagram (Read-Only)
                                    </h3>
                                    <p className="text-xs text-gray-500">
                                        Use the Rule Ledger tab to configure transition constraints.
                                    </p>
                                </div>
                                <div className="flex-1 relative">
                                    {workflowId && (
                                        <WorkflowEngineVisualization
                                            workflowId={workflowId}
                                            height="100%"
                                        />
                                    )}
                                </div>
                            </div>
                        ) : loadingRules ? (
                            <div className="flex-1 flex items-center justify-center">
                                <Loader2 className="w-6 h-6 animate-spin text-sage-600" />
                            </div>
                        ) : (
                            <TransitionRulesTable
                                workflow={workflow}
                                graph={graph}
                                rules={rules}
                                togglingRuleId={togglingRuleId}
                                onAddRule={handleAddRule}
                                onEditRule={handleEditRule}
                                onToggleRule={handleToggleRule}
                            />
                        )}
                    </div>

                    <TransitionRuleModal
                        open={isModalOpen}
                        onOpenChange={setIsModalOpen}
                        workflow={workflow}
                        graph={graph}
                        initialData={modalData}
                        onSave={handleSaveRule}
                    />
                </div>
            }
        />
    );
}
