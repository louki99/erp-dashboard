import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ParametersEditor } from '@/components/workflow/ParametersEditor';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import type { WorkflowDefinition } from '@/types/workflowEngine.types';
import toast from 'react-hot-toast';

// Supported constraint classes (docs §6)
const CONSTRAINT_CLASSES = [
    { value: 'App\\Constraints\\GenericFlexiConstraint', label: 'GenericFlexiConstraint — universal evaluator' },
    { value: 'App\\Constraints\\BcAutoValidationConstraint', label: 'BcAutoValidationConstraint — composite BC validation' },
    { value: 'App\\Constraints\\CreditLimitConstraint', label: 'CreditLimitConstraint — partner credit check' },
    { value: 'App\\Constraints\\CreditExceededConstraint', label: 'CreditExceededConstraint — route to derogation' },
    { value: 'App\\Constraints\\CancellationRequestedConstraint', label: 'CancellationRequestedConstraint — seller cancel request' },
    { value: 'App\\Constraints\\StockAvailableConstraint', label: 'StockAvailableConstraint — stock availability' },
];

const DEFAULT_PARAMETERS: Record<string, Record<string, any>> = {
    'App\\Constraints\\GenericFlexiConstraint': { target: '', operator: '==', value: '', label: '' },
    'App\\Constraints\\BcAutoValidationConstraint': {
        max_cash_amount: 10000,
        blocked_payment_methods: ['Espèce', 'espece', 'cash'],
        require_credit_check: true,
        credit_buffer_percentage: 5,
        require_partner_active: true,
        require_price_list: false,
        max_bc_amount: null,
    },
    'App\\Constraints\\CreditLimitConstraint': {
        max_amount: null,
        credit_buffer_percentage: 0,
        bypass_payment_methods: [],
    },
};

interface TransitionRuleModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workflow: WorkflowDefinition;
    graph: any;
    initialData?: any | null;
    onSave: (data: any) => Promise<void>;
}

export function TransitionRuleModal({ open, onOpenChange, graph, initialData, onSave }: TransitionRuleModalProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [source, setSource] = useState('');
    const [target, setTarget] = useState('');
    const [label, setLabel] = useState('');
    const [priority, setPriority] = useState(20);
    const [isActive, setIsActive] = useState(false);
    const [operator, setOperator] = useState<'AND' | 'OR'>('AND');
    const [conditions, setConditions] = useState<any[]>([]);

    useEffect(() => {
        if (open) {
            setSource(initialData?.source || '');
            setTarget(initialData?.target || '');
            setLabel(initialData?.label || '');
            setPriority(initialData?.priority ?? 20);
            setIsActive(initialData?.is_active ?? false);
            setOperator(initialData?.operator || 'AND');
            setConditions(initialData?.conditions || []);
        }
    }, [open, initialData]);

    const handleAddCondition = () => {
        const defaultClass = 'App\\Constraints\\GenericFlexiConstraint';
        setConditions([
            ...conditions,
            { class: defaultClass, parameters: { ...DEFAULT_PARAMETERS[defaultClass] } },
        ]);
    };

    const handleRemoveCondition = (index: number) => {
        setConditions(conditions.filter((_, i) => i !== index));
    };

    const handleConditionClassChange = (index: number, newClass: string) => {
        const newConditions = [...conditions];
        newConditions[index] = {
            class: newClass,
            parameters: { ...(DEFAULT_PARAMETERS[newClass] ?? {}) },
        };
        setConditions(newConditions);
    };

    const handleConditionParamsChange = (index: number, newParams: any) => {
        const newConditions = [...conditions];
        newConditions[index] = { ...newConditions[index], parameters: newParams };
        setConditions(newConditions);
    };

    const handleSave = async () => {
        if (!source || !target) {
            toast.error('Source and Target steps are required.');
            return;
        }

        setIsSaving(true);
        try {
            await onSave({
                id: initialData?.id,
                source,
                target,
                label,
                priority,
                is_active: isActive,
                operator,
                conditions,
            });
            onOpenChange(false);
        } catch (err: any) {
            toast.error(err.message || 'Failed to save transition rule');
        } finally {
            setIsSaving(false);
        }
    };

    const stepOptions = (graph?.nodes || []).map((node: any) => ({
        value: node.id,
        label: `${node.data?.label || node.id} (${node.id})`,
    }));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        {initialData ? 'Edit Transition Rule' : 'Add Transition Rule'}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-2">
                    {/* Steps */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-800">Source Step</label>
                            <SearchableSelect
                                options={stepOptions}
                                value={source}
                                onChange={setSource}
                                placeholder="Search source step..."
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-800">Target Step</label>
                            <SearchableSelect
                                options={stepOptions}
                                value={target}
                                onChange={setTarget}
                                placeholder="Search target step..."
                            />
                        </div>
                    </div>

                    {/* Label + Priority + Active */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1 space-y-2">
                            <label className="text-sm font-semibold text-gray-800">Label (optional)</label>
                            <input
                                type="text"
                                value={label}
                                onChange={e => setLabel(e.target.value)}
                                placeholder="e.g. Approve, Reject"
                                className="w-full border border-gray-300 rounded-md bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-sage-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-800">
                                Priority
                                <span className="ml-1 font-normal text-gray-400 text-xs">(lower = first)</span>
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={priority}
                                onChange={e => setPriority(Number(e.target.value))}
                                className="w-full border border-gray-300 rounded-md bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-800">Status</label>
                            <button
                                type="button"
                                onClick={() => setIsActive(v => !v)}
                                className={`flex items-center gap-2 w-full px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                                    isActive
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                        : 'bg-gray-50 border-gray-300 text-gray-500'
                                }`}
                            >
                                <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                {isActive ? 'Active' : 'Inactive'}
                            </button>
                        </div>
                    </div>

                    {/* Constraints */}
                    <div className="border-t border-gray-200 pt-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-gray-800">Transition Constraints</h3>
                            <select
                                value={operator}
                                onChange={e => setOperator(e.target.value as 'AND' | 'OR')}
                                className="text-sm border border-gray-300 bg-white rounded-md shadow-sm focus:border-sage-500 focus:outline-none focus:ring-2 focus:ring-sage-500 py-1.5 px-3"
                            >
                                <option value="AND">ALL must match (AND)</option>
                                <option value="OR">ANY can match (OR)</option>
                            </select>
                        </div>

                        <div className="space-y-4">
                            {conditions.length === 0 ? (
                                <div className="text-center p-6 bg-gray-50 rounded-lg border border-gray-200 border-dashed">
                                    <p className="text-sm text-gray-500 mb-4">No constraints — this transition will always be available.</p>
                                    <Button type="button" variant="outline" size="sm" onClick={handleAddCondition}>
                                        <Plus className="w-4 h-4 mr-2" /> Add Constraint
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    {conditions.map((cond, idx) => (
                                        <div key={idx} className="bg-gray-50 rounded-lg border border-gray-200 p-4 relative">
                                            <div className="absolute top-2 right-2">
                                                <button
                                                    onClick={() => handleRemoveCondition(idx)}
                                                    className="p-1 text-gray-400 hover:text-red-600 rounded bg-white shadow-sm border border-gray-100"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="mb-3 flex items-center gap-2">
                                                <span className="text-xs font-semibold px-2 py-1 bg-gray-200 text-gray-700 rounded-md">
                                                    Rule #{idx + 1}
                                                </span>
                                            </div>

                                            {/* Constraint class selector */}
                                            <div className="mb-3">
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Constraint Class</label>
                                                <select
                                                    value={cond.class}
                                                    onChange={e => handleConditionClassChange(idx, e.target.value)}
                                                    className="w-full text-xs border border-gray-300 bg-white rounded-md shadow-sm focus:border-sage-500 focus:outline-none focus:ring-2 focus:ring-sage-500 py-1.5 px-2"
                                                >
                                                    {CONSTRAINT_CLASSES.map(c => (
                                                        <option key={c.value} value={c.value}>{c.label}</option>
                                                    ))}
                                                    <option value={cond.class}>{cond.class}</option>
                                                </select>
                                            </div>

                                            <ParametersEditor
                                                validatorClass={cond.class}
                                                value={cond.parameters}
                                                onChange={(newParams) => handleConditionParamsChange(idx, newParams)}
                                            />
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" className="w-full mt-2" onClick={handleAddCondition}>
                                        <Plus className="w-4 h-4 mr-2" /> Add Another Constraint
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t border-gray-100 pt-4 mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-sage-600 hover:bg-sage-700">
                        {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Save Rule
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
