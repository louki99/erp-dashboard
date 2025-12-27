import { useState } from 'react';
import { Plus, Trash2, Loader2, GitBranch } from 'lucide-react';
import type { WorkflowTaskTemplate, TemplateDependencyCreateRequest, DependencyType } from '@/types/task.types';
import toast from 'react-hot-toast';

interface DependencyManagerProps {
    template: WorkflowTaskTemplate;
    allTemplates: WorkflowTaskTemplate[];
    onAddDependency: (data: TemplateDependencyCreateRequest) => Promise<void>;
    onRemoveDependency: (dependencyId: number) => Promise<void>;
}

const DEPENDENCY_TYPES: { value: DependencyType; label: string; color: string; description: string }[] = [
    { value: 'blocking', label: 'Blocking', color: 'red', description: 'Must complete before this task can start' },
    { value: 'soft', label: 'Soft', color: 'orange', description: 'Recommended but not required' },
    { value: 'parallel', label: 'Parallel', color: 'green', description: 'Can run simultaneously' },
];

export function DependencyManager({ template, allTemplates, onAddDependency, onRemoveDependency }: DependencyManagerProps) {
    const [showAddForm, setShowAddForm] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
    const [dependencyType, setDependencyType] = useState<DependencyType>('blocking');
    const [submitting, setSubmitting] = useState(false);

    const availableTemplates = allTemplates.filter(
        (t) => t.id !== template.id && !template.dependencies?.some((d) => d.depends_on_template_id === t.id)
    );

    const handleAddDependency = async () => {
        if (!selectedTemplateId) {
            toast.error('Please select a template');
            return;
        }

        try {
            setSubmitting(true);
            await onAddDependency({
                depends_on_template_id: selectedTemplateId as number,
                dependency_type: dependencyType,
            });
            toast.success('Dependency added successfully');
            setShowAddForm(false);
            setSelectedTemplateId('');
            setDependencyType('blocking');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to add dependency');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveDependency = async (dependencyId: number) => {
        if (!confirm('Are you sure you want to remove this dependency?')) return;

        try {
            await onRemoveDependency(dependencyId);
            toast.success('Dependency removed successfully');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to remove dependency');
        }
    };

    const getDependencyColor = (type: DependencyType) => {
        const typeInfo = DEPENDENCY_TYPES.find((t) => t.value === type);
        return typeInfo?.color || 'gray';
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <GitBranch className="w-5 h-5 text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Dependencies</h3>
                    <span className="text-sm text-gray-500">
                        ({template.dependencies?.length || 0})
                    </span>
                </div>
                {!showAddForm && availableTemplates.length > 0 && (
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Dependency
                    </button>
                )}
            </div>

            {/* Add Dependency Form */}
            {showAddForm && (
                <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Depends On Template
                            </label>
                            <select
                                value={selectedTemplateId}
                                onChange={(e) => setSelectedTemplateId(e.target.value ? Number(e.target.value) : '')}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Select template...</option>
                                {availableTemplates.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name} (Order: {t.order})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Dependency Type
                            </label>
                            <div className="space-y-2">
                                {DEPENDENCY_TYPES.map((type) => (
                                    <label
                                        key={type.value}
                                        className="flex items-start gap-3 p-2 border border-gray-200 rounded hover:bg-white cursor-pointer"
                                    >
                                        <input
                                            type="radio"
                                            value={type.value}
                                            checked={dependencyType === type.value}
                                            onChange={(e) => setDependencyType(e.target.value as DependencyType)}
                                            className="mt-1"
                                        />
                                        <div className="flex-1">
                                            <div className={`font-medium text-${type.color}-700`}>{type.label}</div>
                                            <div className="text-xs text-gray-600">{type.description}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <button
                                onClick={handleAddDependency}
                                disabled={submitting || !selectedTemplateId}
                                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Adding...
                                    </>
                                ) : (
                                    'Add Dependency'
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    setShowAddForm(false);
                                    setSelectedTemplateId('');
                                }}
                                disabled={submitting}
                                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dependencies List */}
            {template.dependencies && template.dependencies.length > 0 ? (
                <div className="space-y-2">
                    {template.dependencies.map((dep) => {
                        const dependsOnTemplate = allTemplates.find((t) => t.id === dep.depends_on_template_id);
                        const color = getDependencyColor(dep.dependency_type);

                        return (
                            <div
                                key={dep.id}
                                className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                            >
                                <div className="flex items-center gap-3 flex-1">
                                    <div className={`w-2 h-2 rounded-full bg-${color}-500`}></div>
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900">
                                            {dependsOnTemplate?.name || 'Unknown Template'}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            Order: {dependsOnTemplate?.order} • Type:{' '}
                                            <span className={`font-medium text-${color}-700`}>
                                                {dep.dependency_type}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRemoveDependency(dep.id)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Remove dependency"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-8 text-gray-500">
                    <GitBranch className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No dependencies configured</p>
                    <p className="text-xs mt-1">This task can start immediately</p>
                </div>
            )}
        </div>
    );
}
