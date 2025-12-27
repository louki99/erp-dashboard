import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, Save, CheckCircle, AlertCircle, Workflow } from 'lucide-react';
import type { WorkflowDefinition, WorkflowTemplateCreateRequest } from '@/types/task.types';
import toast from 'react-hot-toast';

interface EnhancedWorkflowFormProps {
    workflow?: WorkflowDefinition;
    onSubmit: (data: WorkflowTemplateCreateRequest) => Promise<void>;
    onCancel: () => void;
}

export function EnhancedWorkflowForm({ workflow, onSubmit, onCancel }: EnhancedWorkflowFormProps) {
    const [submitting, setSubmitting] = useState(false);
    const [step, setStep] = useState(1);
    const isEdit = !!workflow;

    const {
        register,
        handleSubmit,
        watch,
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

    const watchedCode = watch('code');
    const watchedName = watch('name');

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

    const canProceedToStep2 = watchedCode && watchedName && !errors.code && !errors.name;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-lg">
                            <Workflow className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">
                                {isEdit ? 'Edit Workflow Template' : 'Create New Workflow Template'}
                            </h2>
                            <p className="text-sm text-gray-600 mt-0.5">
                                {isEdit ? 'Update workflow configuration' : 'Define a reusable workflow for your business process'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Progress Steps (only for create) */}
                {!isEdit && (
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-center justify-between max-w-md mx-auto">
                            <div className="flex items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                                }`}>
                                    {step > 1 ? <CheckCircle className="w-5 h-5" /> : '1'}
                                </div>
                                <span className="ml-2 text-sm font-medium text-gray-700">Basic Info</span>
                            </div>
                            <div className="flex-1 h-0.5 bg-gray-300 mx-4"></div>
                            <div className="flex items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                                }`}>
                                    2
                                </div>
                                <span className="ml-2 text-sm font-medium text-gray-700">Configuration</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit(onFormSubmit)} className="flex-1 overflow-y-auto">
                    <div className="p-6 space-y-6">
                        {/* Step 1: Basic Information */}
                        {(isEdit || step === 1) && (
                            <>
                                {/* Code */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Workflow Code <span className="text-red-500">*</span>
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
                                        <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
                                            <AlertCircle className="w-4 h-4" />
                                            {errors.code.message}
                                        </div>
                                    )}
                                    {isEdit ? (
                                        <p className="mt-1 text-xs text-gray-500">Code cannot be changed after creation</p>
                                    ) : (
                                        <p className="mt-1 text-xs text-gray-500">
                                            Use a short, unique identifier (e.g., BC for Bon de Commande)
                                        </p>
                                    )}
                                </div>

                                {/* Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Workflow Name <span className="text-red-500">*</span>
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
                                        <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
                                            <AlertCircle className="w-4 h-4" />
                                            {errors.name.message}
                                        </div>
                                    )}
                                    <p className="mt-1 text-xs text-gray-500">
                                        A descriptive name that explains the workflow's purpose
                                    </p>
                                </div>
                            </>
                        )}

                        {/* Step 2: Configuration */}
                        {(isEdit || step === 2) && (
                            <>
                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Description
                                    </label>
                                    <textarea
                                        {...register('description')}
                                        rows={4}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Describe the purpose of this workflow, when it should be used, and what it accomplishes..."
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Provide context for users who will work with this workflow
                                    </p>
                                </div>

                                {/* Active Status */}
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            id="is_active"
                                            {...register('is_active')}
                                            className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <div className="flex-1">
                                            <label htmlFor="is_active" className="text-sm font-medium text-gray-900 cursor-pointer">
                                                Active Workflow
                                            </label>
                                            <p className="text-xs text-gray-600 mt-1">
                                                When active, this workflow can be used to create new task instances. 
                                                Inactive workflows are preserved but cannot be used for new processes.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Info Box */}
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                                        <div className="flex-1">
                                            <h4 className="text-sm font-semibold text-blue-900 mb-1">
                                                Next Steps
                                            </h4>
                                            <ul className="text-xs text-blue-800 space-y-1">
                                                <li>• After creating the workflow, you can add task templates</li>
                                                <li>• Define dependencies between tasks to control execution order</li>
                                                <li>• Add validation rules to ensure data quality</li>
                                                <li>• Use the visualization tab to see your workflow structure</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={submitting}
                            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>

                        <div className="flex items-center gap-3">
                            {!isEdit && step === 2 && (
                                <button
                                    type="button"
                                    onClick={() => setStep(1)}
                                    disabled={submitting}
                                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
                                >
                                    Back
                                </button>
                            )}

                            {!isEdit && step === 1 ? (
                                <button
                                    type="button"
                                    onClick={() => setStep(2)}
                                    disabled={!canProceedToStep2}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next Step
                                </button>
                            ) : (
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
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
