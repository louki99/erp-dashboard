import React, { useState } from 'react';
import { Code, LayoutList } from 'lucide-react';

interface ParametersEditorProps {
    validatorClass: string;
    value: Record<string, any>;
    onChange: (value: Record<string, any>) => void;
}

export function ParametersEditor({ validatorClass, value, onChange }: ParametersEditorProps) {
    const [mode, setMode] = useState<'ui' | 'json'>('ui');
    const [jsonError, setJsonError] = useState<string | null>(null);

    const isGenericFlexi = validatorClass.includes('GenericFlexiConstraint');
    const isCreditLimit = validatorClass.includes('CreditLimitConstraint');
    const isBcAutoValidation = validatorClass.includes('BcAutoValidationConstraint');

    const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        try {
            const parsed = JSON.parse(e.target.value);
            setJsonError(null);
            onChange(parsed);
        } catch (err: any) {
            setJsonError(err.message);
        }
    };

    const updateField = (field: string, val: any) => {
        onChange({ ...value, [field]: val });
    };

    const renderGenericFlexiForm = () => (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Target *</label>
                    <input
                        type="text"
                        value={value.target || ''}
                        onChange={(e) => updateField('target', e.target.value)}
                        placeholder="e.g. total_amount"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-sage-500 focus:border-sage-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Property</label>
                    <input
                        type="text"
                        value={value.property || ''}
                        onChange={(e) => updateField('property', e.target.value)}
                        placeholder="e.g. product_id"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-sage-500 focus:border-sage-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Operator *</label>
                    <select
                        value={value.operator || '=='}
                        onChange={(e) => updateField('operator', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-sage-500 focus:border-sage-500"
                    >
                        <option value="==">== (Equals)</option>
                        <option value="!=">!= (Not Equals)</option>
                        <option value=">">&gt; (Greater Than)</option>
                        <option value=">=">&gt;= (Greater Than or Equal)</option>
                        <option value="<">&lt; (Less Than)</option>
                        <option value="<=">&lt;= (Less Than or Equal)</option>
                        <option value="CONTAINS">CONTAINS</option>
                        <option value="NOT_CONTAINS">NOT_CONTAINS</option>
                        <option value="IN">IN</option>
                        <option value="NOT_IN">NOT_IN</option>
                        <option value="EMPTY">EMPTY</option>
                        <option value="NOT_EMPTY">NOT_EMPTY</option>
                        <option value="BETWEEN">BETWEEN</option>
                        <option value="REGEX">REGEX</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Value</label>
                    <input
                        type="text"
                        value={typeof value.value === 'object' ? JSON.stringify(value.value) : value.value || ''}
                        onChange={(e) => {
                            let val: any = e.target.value;
                            if (['IN', 'NOT_IN', 'BETWEEN'].includes(value.operator)) {
                                try { val = JSON.parse(val); } catch { /* keep as string until valid */ }
                            }
                            updateField('value', val);
                        }}
                        placeholder={['IN', 'NOT_IN', 'BETWEEN'].includes(value.operator) ? '[val1, val2]' : 'Value to compare'}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-sage-500 focus:border-sage-500"
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Label (violation message)</label>
                <input
                    type="text"
                    value={value.label || ''}
                    onChange={(e) => updateField('label', e.target.value)}
                    placeholder="Human readable error label"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-sage-500 focus:border-sage-500"
                />
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Custom message (optional)</label>
                <input
                    type="text"
                    value={value.message || ''}
                    onChange={(e) => updateField('message', e.target.value)}
                    placeholder="Override violation message"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-sage-500 focus:border-sage-500"
                />
            </div>
        </div>
    );

    const renderCreditLimitForm = () => (
        <div className="space-y-3">
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Max Amount (MAD)</label>
                <input
                    type="number"
                    value={value.max_amount ?? ''}
                    onChange={(e) => updateField('max_amount', e.target.value ? Number(e.target.value) : null)}
                    placeholder="No absolute limit"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Credit Buffer % (safety margin)</label>
                <input
                    type="number"
                    min={0}
                    max={100}
                    value={value.credit_buffer_percentage ?? 0}
                    onChange={(e) => updateField('credit_buffer_percentage', Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Bypass Payment Methods (comma-separated)</label>
                <input
                    type="text"
                    value={(value.bypass_payment_methods || []).join(', ')}
                    onChange={(e) => updateField('bypass_payment_methods', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                    placeholder="e.g. Virement, Chèque"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
            </div>
        </div>
    );

    const renderBcAutoValidationForm = () => (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Max Cash Amount (MAD)</label>
                    <input
                        type="number"
                        value={value.max_cash_amount ?? ''}
                        onChange={(e) => updateField('max_cash_amount', e.target.value ? Number(e.target.value) : null)}
                        placeholder="No cash limit"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Max BC Amount (MAD)</label>
                    <input
                        type="number"
                        value={value.max_bc_amount ?? ''}
                        onChange={(e) => updateField('max_bc_amount', e.target.value ? Number(e.target.value) : null)}
                        placeholder="No absolute limit"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Blocked Payment Methods (comma-separated)</label>
                <input
                    type="text"
                    value={(value.blocked_payment_methods || []).join(', ')}
                    onChange={(e) => updateField('blocked_payment_methods', e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                    placeholder="e.g. Espèce, cash, نقدا"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Credit Buffer % (safety margin)</label>
                <input
                    type="number"
                    min={0}
                    max={100}
                    value={value.credit_buffer_percentage ?? 0}
                    onChange={(e) => updateField('credit_buffer_percentage', Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                    <input
                        type="checkbox"
                        checked={value.require_credit_check ?? true}
                        onChange={(e) => updateField('require_credit_check', e.target.checked)}
                        className="rounded border-gray-300 text-sage-600 focus:ring-sage-500"
                    />
                    Require credit check
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                    <input
                        type="checkbox"
                        checked={value.require_partner_active ?? true}
                        onChange={(e) => updateField('require_partner_active', e.target.checked)}
                        className="rounded border-gray-300 text-sage-600 focus:ring-sage-500"
                    />
                    Require partner active
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                    <input
                        type="checkbox"
                        checked={value.require_price_list ?? false}
                        onChange={(e) => updateField('require_price_list', e.target.checked)}
                        className="rounded border-gray-300 text-sage-600 focus:ring-sage-500"
                    />
                    Require price list
                </label>
            </div>
        </div>
    );

    const showUiForm = isGenericFlexi || isCreditLimit || isBcAutoValidation;

    const renderUiForm = () => {
        if (isGenericFlexi) return renderGenericFlexiForm();
        if (isCreditLimit) return renderCreditLimitForm();
        if (isBcAutoValidation) return renderBcAutoValidationForm();
        return null;
    };

    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <div className="flex items-center justify-between bg-gray-50 border-b border-gray-200 px-3 py-2">
                <span className="text-xs font-medium text-gray-700">Constraint Parameters</span>
                {showUiForm && (
                    <div className="flex bg-gray-200 rounded p-0.5">
                        <button
                            type="button"
                            onClick={() => setMode('ui')}
                            className={`px-2 py-1 text-xs font-medium rounded ${mode === 'ui' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <LayoutList className="w-3 h-3 inline mr-1" /> UI
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('json')}
                            className={`px-2 py-1 text-xs font-medium rounded ${mode === 'json' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Code className="w-3 h-3 inline mr-1" /> JSON
                        </button>
                    </div>
                )}
            </div>

            <div className="p-3 bg-gray-50/50">
                {mode === 'ui' && showUiForm ? renderUiForm() : (
                    <div>
                        <textarea
                            value={JSON.stringify(value, null, 2)}
                            onChange={handleJsonChange}
                            rows={6}
                            className="w-full font-mono text-xs p-2 border border-gray-300 rounded focus:ring-sage-500 focus:border-sage-500 bg-gray-900 text-gray-100"
                            placeholder="{}"
                        />
                        {jsonError && (
                            <p className="mt-1 text-xs text-red-600 font-medium">Invalid JSON: {jsonError}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
