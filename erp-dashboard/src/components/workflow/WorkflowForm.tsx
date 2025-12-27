import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, Save } from 'lucide-react';
import type { WorkflowDefinition, WorkflowTemplateCreateRequest } from '@/types/task.types';
import toast from 'react-hot-toast';

interface WorkflowFormProps {
    workflow?: WorkflowDefinition;
    onSubmit: (data: WorkflowTemplateCreateRequest) => Promise<void>;
    onCancel: () => void;
}

export function WorkflowForm({ workflow, onSubmit, onCancel }: WorkflowFormProps) {
    const [submitting, setSubmitting] = useState(false);
    const isEdit = !!workflow;

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<WorkflowTemplateCreateRequest>({
        defaultValues: workflow
            ? {
                  code: workflow.code,
                  name: workflow.name,
                  description: workflow.description || '',
                  is_active: workflow.is_active,
              }
            : {
                  is_active: true,
              },
    });

    const onFormSubmit = async (data: WorkflowTemplateCreateRequest) => {
        try {
            setSubmitting(true);
            await onSubmit(data);
            toast.success(`Workflow ${isEdit ? 'updated' : 'created'} successfully`);
        } catch (error: any) {
            toast.error(error.response?.data?.message || `Failed to ${isEdit ? 'update' : 'create'} workflow`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900">
                        {isEdit ? 'Edit Workflow' : 'Create New Workflow'}
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
                    {/* Code */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Code <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            {...register('code', {
                                required: 'Code is required',
                                maxLength: { value: 50, message: 'Code must be less than 50 characters' },
                                pattern: {
                                    value: /^[A-Z0-9_]+$/,
                                    message: 'Code must contain only uppercase letters, numbers, and underscores',
                                },
                            })}
                            disabled={isEdit}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            placeholder="BC, BL, BCH, BP"
                        />
                        {errors.code && (
                            <p className="mt-1 text-sm text-red-600">{errors.code.message}</p>
                        )}
                        {isEdit && (
                            <p className="mt-1 text-xs text-gray-500">Code cannot be changed after creation</p>
                        )}
                    </div>

                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            {...register('name', {
                                required: 'Name is required',
                                maxLength: { value: 255, message: 'Name must be less than 255 characters' },
                            })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Bon de Commande Workflow"
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
                            rows={4}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Describe the purpose of this workflow..."
                        />
                    </div>

                    {/* Active Status */}
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="is_active"
                            {...register('is_active')}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                            Active (workflow can be used to create new tasks)
                        </label>
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
                                    {isEdit ? 'Update Workflow' : 'Create Workflow'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
