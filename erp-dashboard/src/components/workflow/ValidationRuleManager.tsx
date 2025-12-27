import { useState } from 'react';
import { Plus, Trash2, Edit, Loader2, CheckCircle, XCircle } from 'lucide-react';
import type { WorkflowTaskTemplate, TemplateValidationRuleCreateRequest } from '@/types/task.types';
import toast from 'react-hot-toast';

interface ValidationRuleManagerProps {
    template: WorkflowTaskTemplate;
    onAddRule: (data: TemplateValidationRuleCreateRequest) => Promise<void>;
    onUpdateRule: (ruleId: number, data: Partial<TemplateValidationRuleCreateRequest>) => Promise<void>;
    onRemoveRule: (ruleId: number) => Promise<void>;
}

export function ValidationRuleManager({ template, onAddRule, onUpdateRule, onRemoveRule }: ValidationRuleManagerProps) {
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState<TemplateValidationRuleCreateRequest>({
        rule_code: '',
        rule_name: '',
        description: '',
        validator_class: '',
        order: (template.validation_rules?.length || 0) + 1,
        is_required: true,
        stop_on_failure: true,
        parameters: {},
    });

    const resetForm = () => {
        setFormData({
            rule_code: '',
            rule_name: '',
            description: '',
            validator_class: '',
            order: (template.validation_rules?.length || 0) + 1,
            is_required: true,
            stop_on_failure: true,
            parameters: {},
        });
        setShowAddForm(false);
        setEditingRuleId(null);
    };

    const handleSubmit = async () => {
        if (!formData.rule_code || !formData.rule_name || !formData.validator_class) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            setSubmitting(true);
            if (editingRuleId) {
                await onUpdateRule(editingRuleId, formData);
                toast.success('Validation rule updated successfully');
            } else {
                await onAddRule(formData);
                toast.success('Validation rule added successfully');
            }
            resetForm();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to save validation rule');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (rule: any) => {
        setFormData({
            rule_code: rule.rule_code,
            rule_name: rule.rule_name,
            description: rule.description || '',
            validator_class: rule.validator_class,
            order: rule.order,
            is_required: rule.is_required,
            stop_on_failure: rule.stop_on_failure,
            parameters: rule.parameters || {},
        });
        setEditingRuleId(rule.id);
        setShowAddForm(true);
    };

    const handleRemove = async (ruleId: number) => {
        if (!confirm('Are you sure you want to remove this validation rule?')) return;

        try {
            await onRemoveRule(ruleId);
            toast.success('Validation rule removed successfully');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to remove validation rule');
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Validation Rules</h3>
                    <span className="text-sm text-gray-500">
                        ({template.validation_rules?.length || 0})
                    </span>
                </div>
                {!showAddForm && (
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Rule
                    </button>
                )}
            </div>

            {/* Add/Edit Form */}
            {showAddForm && (
                <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-3">
                        {editingRuleId ? 'Edit Validation Rule' : 'Add Validation Rule'}
                    </h4>
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Rule Code *
                                </label>
                                <input
                                    type="text"
                                    value={formData.rule_code}
                                    onChange={(e) => setFormData({ ...formData, rule_code: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    placeholder="CHECK_CREDIT"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Order *
                                </label>
                                <input
                                    type="number"
                                    value={formData.order}
                                    onChange={(e) => setFormData({ ...formData, order: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    min="1"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Rule Name *
                            </label>
                            <input
                                type="text"
                                value={formData.rule_name}
                                onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                placeholder="Check Credit Limit"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Validator Class *
                            </label>
                            <input
                                type="text"
                                value={formData.validator_class}
                                onChange={(e) => setFormData({ ...formData, validator_class: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                placeholder="App\Validators\CreditValidator"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                placeholder="Validate partner credit limit..."
                            />
                        </div>

                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={formData.is_required}
                                    onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">Required</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={formData.stop_on_failure}
                                    onChange={(e) => setFormData({ ...formData, stop_on_failure: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">Stop on Failure</span>
                            </label>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>{editingRuleId ? 'Update Rule' : 'Add Rule'}</>
                                )}
                            </button>
                            <button
                                onClick={resetForm}
                                disabled={submitting}
                                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rules List */}
            {template.validation_rules && template.validation_rules.length > 0 ? (
                <div className="space-y-2">
                    {template.validation_rules
                        .sort((a, b) => a.order - b.order)
                        .map((rule) => (
                            <div
                                key={rule.id}
                                className="flex items-start justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                            >
                                <div className="flex items-start gap-3 flex-1">
                                    <div className="mt-1">
                                        {rule.is_required ? (
                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                        ) : (
                                            <XCircle className="w-4 h-4 text-gray-400" />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-gray-900">{rule.rule_name}</span>
                                            <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded">
                                                Order: {rule.order}
                                            </span>
                                            {rule.stop_on_failure && (
                                                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
                                                    Stop on Failure
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm text-gray-600 mb-1">
                                            Code: <code className="text-xs bg-gray-200 px-1 py-0.5 rounded">{rule.rule_code}</code>
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {rule.validator_class}
                                        </div>
                                        {rule.description && (
                                            <div className="text-sm text-gray-600 mt-1">{rule.description}</div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleEdit(rule)}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Edit rule"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleRemove(rule.id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Remove rule"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                </div>
            ) : (
                <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No validation rules configured</p>
                    <p className="text-xs mt-1">Add rules to validate task execution</p>
                </div>
            )}
        </div>
    );
}
