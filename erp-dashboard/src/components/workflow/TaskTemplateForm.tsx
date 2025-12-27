import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, Save } from 'lucide-react';
import type { WorkflowTaskTemplate, TaskTemplateCreateRequest, TaskType, AssignmentType } from '@/types/task.types';
import toast from 'react-hot-toast';

interface TaskTemplateFormProps {
    workflowId: number;
    template?: WorkflowTaskTemplate;
    onSubmit: (data: TaskTemplateCreateRequest) => Promise<void>;
    onCancel: () => void;
    maxOrder: number;
}

const TASK_TYPES: { value: TaskType; label: string }[] = [
    { value: 'creation', label: 'Creation' },
    { value: 'validation', label: 'Validation' },
    { value: 'conversion', label: 'Conversion' },
    { value: 'approval', label: 'Approval' },
    { value: 'dispatch', label: 'Dispatch' },
    { value: 'preparation', label: 'Preparation' },
    { value: 'delivery', label: 'Delivery' },
    { value: 'control', label: 'Control' },
    { value: 'notification', label: 'Notification' },
    { value: 'processing', label: 'Processing' },
];

const ASSIGNMENT_TYPES: { value: AssignmentType; label: string; description: string }[] = [
    { value: 'system', label: 'System', description: 'Auto-completed by system' },
    { value: 'role', label: 'Role', description: 'Assigned to users with specific role' },
    { value: 'user', label: 'User', description: 'Assigned to specific user ID' },
    { value: 'pool', label: 'Pool', description: 'Assigned to multiple users (first-come)' },
];

export function TaskTemplateForm({ workflowId, template, onSubmit, onCancel, maxOrder }: TaskTemplateFormProps) {
    const [submitting, setSubmitting] = useState(false);
    const isEdit = !!template;

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<TaskTemplateCreateRequest>({
        defaultValues: template
            ? {
                  code: template.code,
                  name: template.name,
                  description: template.description || '',
                  task_type: template.task_type,
                  order: template.order,
                  timeout_minutes: template.timeout_minutes || undefined,
                  auto_complete: template.auto_complete,
                  assignment_type: template.assignment_type,
                  assignment_target: template.assignment_target || '',
                  is_active: template.is_active,
              }
            : {
                  order: maxOrder + 1,
                  auto_complete: false,
                  assignment_type: 'role',
                  is_active: true,
              },
    });

    const assignmentType = watch('assignment_type');
    const autoComplete = watch('auto_complete');

    const onFormSubmit = async (data: TaskTemplateCreateRequest) => {
        try {
            setSubmitting(true);
            await onSubmit(data);
            toast.success(`Task template ${isEdit ? 'updated' : 'created'} successfully`);
        } catch (error: any) {
            toast.error(error.response?.data?.message || `Failed to ${isEdit ? 'update' : 'create'} task template`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900">
                        {isEdit ? 'Edit Task Template' : 'Create Task Template'}
                    </h2>
                    <button
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(onFormSubmit)} className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        {/* Code */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Code <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                {...register('code', {
                                    required: 'Code is required',
                                    pattern: {
                                        value: /^[A-Z0-9_]+$/,
                                        message: 'Code must contain only uppercase letters, numbers, and underscores',
                                    },
                                })}
                                disabled={isEdit}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                                placeholder="ADV_REVIEW"
                            />
                            {errors.code && (
                                <p className="mt-1 text-sm text-red-600">{errors.code.message}</p>
                            )}
                        </div>

                        {/* Task Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Task Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                {...register('task_type', { required: 'Task type is required' })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Select type...</option>
                                {TASK_TYPES.map((type) => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                            {errors.task_type && (
                                <p className="mt-1 text-sm text-red-600">{errors.task_type.message}</p>
                            )}
                        </div>
                    </div>

                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            {...register('name', { required: 'Name is required' })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="ADV Review and Validation"
                        />
                        {errors.name && (
                            <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description
                        </label>
                        <textarea
                            {...register('description')}
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Describe what this task does..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        {/* Order */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Order <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                {...register('order', {
                                    required: 'Order is required',
                                    min: { value: 1, message: 'Order must be at least 1' },
                                })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {errors.order && (
                                <p className="mt-1 text-sm text-red-600">{errors.order.message}</p>
                            )}
                        </div>

                        {/* Timeout */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Timeout (minutes)
                            </label>
                            <input
                                type="number"
                                {...register('timeout_minutes', {
                                    min: { value: 1, message: 'Timeout must be at least 1 minute' },
                                })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="30"
                            />
                            {errors.timeout_minutes && (
                                <p className="mt-1 text-sm text-red-600">{errors.timeout_minutes.message}</p>
                            )}
                        </div>
                    </div>

                    {/* Assignment Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Assignment Type <span className="text-red-500">*</span>
                        </label>
                        <div className="space-y-2">
                            {ASSIGNMENT_TYPES.map((type) => (
                                <label key={type.value} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                                    <input
                                        type="radio"
                                        value={type.value}
                                        {...register('assignment_type', { required: true })}
                                        className="mt-1"
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900">{type.label}</div>
                                        <div className="text-sm text-gray-600">{type.description}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Assignment Target */}
                    {assignmentType !== 'system' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Assignment Target
                            </label>
                            <input
                                type="text"
                                {...register('assignment_target')}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder={
                                    assignmentType === 'role'
                                        ? 'adv, dispatcher, magasinier'
                                        : assignmentType === 'user'
                                        ? 'User ID'
                                        : 'Pool name'
                                }
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                {assignmentType === 'role' && 'Enter role name (e.g., adv, dispatcher)'}
                                {assignmentType === 'user' && 'Enter user ID'}
                                {assignmentType === 'pool' && 'Enter pool name for multi-user assignment'}
                            </p>
                        </div>
                    )}

                    {/* Checkboxes */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="auto_complete"
                                {...register('auto_complete')}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="auto_complete" className="text-sm font-medium text-gray-700">
                                Auto-complete (system tasks only)
                            </label>
                        </div>

                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="is_active"
                                {...register('is_active')}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                                Active (template can be used in workflows)
                            </label>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={submitting}
                            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex items-center px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    {isEdit ? 'Updating...' : 'Creating...'}
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    {isEdit ? 'Update Template' : 'Create Template'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
