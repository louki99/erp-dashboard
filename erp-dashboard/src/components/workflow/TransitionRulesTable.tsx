import { useState } from 'react';
import { Plus, Edit2, ArrowRight, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TransitionRule, WorkflowDefinition, WorkflowNode, WorkflowEdge } from '@/types/workflowEngine.types';

// Derive a human-readable summary for a condition_group entry
function constraintSummary(condition: string | { class: string; parameters: Record<string, any> }): string {
    if (typeof condition === 'string') {
        return condition.split('\\').pop() ?? condition;
    }
    const name = condition.class.split('\\').pop() ?? condition.class;
    const params = condition.parameters ?? {};

    if (name === 'BcAutoValidationConstraint') {
        const parts: string[] = [];
        if (params.max_cash_amount != null) parts.push(`cash ≤ ${params.max_cash_amount.toLocaleString()} MAD`);
        if (params.max_bc_amount != null) parts.push(`BC ≤ ${params.max_bc_amount.toLocaleString()} MAD`);
        if (params.require_credit_check) parts.push(`credit check (${params.credit_buffer_percentage ?? 0}% buffer)`);
        if (params.require_partner_active) parts.push('partner active');
        return parts.length ? `${name}: ${parts.join(', ')}` : name;
    }

    if (name === 'GenericFlexiConstraint') {
        const { target, operator, value, label } = params;
        if (label) return label;
        if (target && operator) return `${target} ${operator} ${JSON.stringify(value)}`;
        return name;
    }

    if (name === 'CreditLimitConstraint') {
        const parts: string[] = [];
        if (params.max_amount != null) parts.push(`max ${params.max_amount.toLocaleString()} MAD`);
        if (params.credit_buffer_percentage) parts.push(`${params.credit_buffer_percentage}% buffer`);
        return parts.length ? `${name}: ${parts.join(', ')}` : name;
    }

    return name;
}

interface TransitionRulesTableProps {
    workflow: WorkflowDefinition;
    graph: { nodes: WorkflowNode[]; edges: WorkflowEdge[] } | null;
    rules: TransitionRule[];
    togglingRuleId: number | null;
    onAddRule: () => void;
    onEditRule: (rule: TransitionRule) => void;
    onToggleRule: (rule: TransitionRule) => void;
}

// Priority range badge colour per docs §8
function priorityBadge(priority: number) {
    if (priority <= 9) return 'bg-red-100 text-red-700';
    if (priority <= 30) return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-600';
}

export function TransitionRulesTable({
    graph,
    rules,
    togglingRuleId,
    onAddRule,
    onEditRule,
    onToggleRule,
}: TransitionRulesTableProps) {
    const [expandedRow, setExpandedRow] = useState<number | null>(null);

    const getLabel = (code: string) =>
        graph?.nodes.find((n: WorkflowNode) => n.id === code)?.data?.label ?? code;

    const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

    return (
        <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900">Transition Rules Ledger</h3>
                    <p className="text-xs text-gray-500 mt-1">
                        Toggle rules on/off without redeployment. Lower priority = evaluated first.
                    </p>
                </div>
                <Button onClick={onAddRule} className="bg-sage-600 hover:bg-sage-700 h-9">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Rule
                </Button>
            </div>

            <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-white sticky top-0 z-10 shadow-sm border-b border-gray-200">
                        <tr>
                            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Prio</th>
                            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                            <th className="px-2 py-3 w-6"></th>
                            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Constraints</th>
                            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Status</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                        {sortedRules.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-10 text-center text-gray-400 text-sm">
                                    No transition rules yet. Click "Add Rule" to configure the first one.
                                </td>
                            </tr>
                        ) : (
                            sortedRules.map((rule) => {
                                const conditions = rule.condition_group?.conditions ?? [];
                                const isExpanded = expandedRow === rule.id;
                                const isToggling = togglingRuleId === rule.id;

                                return (
                                    <>
                                        <tr
                                            key={rule.id}
                                            className={`hover:bg-gray-50 transition-colors ${!rule.is_active ? 'opacity-60' : ''}`}
                                        >
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold ${priorityBadge(rule.priority)}`}>
                                                    {rule.priority}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{getLabel(rule.condition_group?.conditions?.length ? rule.target_step_code : rule.target_step_code)}</div>
                                                <div className="text-xs text-gray-400">{rule.workflow_step_id}</div>
                                            </td>
                                            <td className="px-2 py-3 text-center text-gray-300">
                                                <ArrowRight className="w-3.5 h-3.5 inline-block" />
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{getLabel(rule.target_step_code)}</div>
                                                <div className="text-xs text-gray-400">{rule.target_step_code}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {conditions.length === 0 ? (
                                                    <span className="text-xs text-gray-400 italic">No constraints (always passes)</span>
                                                ) : (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-xs text-gray-700 truncate max-w-xs" title={constraintSummary(conditions[0])}>
                                                            {constraintSummary(conditions[0])}
                                                        </span>
                                                        {conditions.length > 1 && (
                                                            <button
                                                                onClick={() => setExpandedRow(isExpanded ? null : rule.id)}
                                                                className="flex items-center gap-1 text-xs text-sage-600 hover:text-sage-800 w-fit"
                                                            >
                                                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                                {isExpanded ? 'Hide' : `+${conditions.length - 1} more`}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <button
                                                    onClick={() => onToggleRule(rule)}
                                                    disabled={isToggling}
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                                        rule.is_active
                                                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                    } disabled:opacity-50 disabled:cursor-wait`}
                                                    title={rule.is_active ? 'Click to deactivate' : 'Click to activate'}
                                                >
                                                    {isToggling ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <span className={`w-1.5 h-1.5 rounded-full ${rule.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                                    )}
                                                    {rule.is_active ? 'Active' : 'Inactive'}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => onEditRule(rule)}
                                                    className="text-sage-600 hover:text-sage-900 hover:bg-sage-50"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5 mr-1" />
                                                    Edit
                                                </Button>
                                            </td>
                                        </tr>
                                        {isExpanded && conditions.length > 1 && (
                                            <tr key={`${rule.id}-expanded`} className="bg-gray-50">
                                                <td colSpan={7} className="px-8 pb-3 pt-0">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-xs font-medium text-gray-500 uppercase mb-1">
                                                            All constraints ({rule.condition_group.operator})
                                                        </span>
                                                        {conditions.map((c, i) => (
                                                            <div key={i} className="flex items-start gap-2 text-xs text-gray-700">
                                                                <span className="shrink-0 w-4 h-4 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-medium text-[10px]">
                                                                    {i + 1}
                                                                </span>
                                                                <span>{constraintSummary(c)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
