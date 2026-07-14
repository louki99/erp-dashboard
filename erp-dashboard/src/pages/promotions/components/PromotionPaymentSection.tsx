import { useState, useEffect, useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import { CreditCard, Search, X, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { promotionsApi } from '@/services/api/promotionsApi';
import type { Promotion } from '@/types/promotion.types';

interface PaymentTermOption {
    id: number;
    code: string;
    name: string;
    is_credit?: boolean;
    is_cash?: boolean;
}

export const PromotionPaymentSection = () => {
    const { watch, setValue } = useFormContext<Promotion>();
    const selectedCodes = watch('payment_terms') || [];

    const [terms, setTerms] = useState<PaymentTermOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    const loadTerms = useCallback(async () => {
        setLoading(true);
        try {
            setTerms(await promotionsApi.getPaymentTerms());
        } catch (error) {
            console.error('Failed to load payment terms', error);
            toast.error('Échec du chargement des conditions de paiement');
            setTerms([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTerms();
    }, [loadTerms]);

    const filteredTerms = terms.filter(t =>
        t.code?.toLowerCase().includes(search.toLowerCase()) ||
        t.name?.toLowerCase().includes(search.toLowerCase())
    );

    const toggleTerm = (code: string) => {
        const next = selectedCodes.includes(code)
            ? selectedCodes.filter((c: string) => c !== code)
            : [...selectedCodes, code];
        setValue('payment_terms', next, { shouldDirty: true });
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Conditions de Paiement</h2>
                <p className="text-sm text-gray-500">Restreignez la promotion à certaines conditions de paiement</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Si aucune condition n'est sélectionnée, la promotion s'appliquera à toutes les conditions de paiement.
                </p>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Rechercher une condition de paiement…"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 outline-none"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Selected tags */}
            {selectedCodes.length > 0 && (
                <div className="bg-sage-50 border border-sage-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-sage-900">
                            {selectedCodes.length} condition(s) sélectionnée(s) — la promo devient dépendante du paiement
                        </span>
                        <button
                            type="button"
                            onClick={() => setValue('payment_terms', [], { shouldDirty: true })}
                            className="text-xs text-sage-600 hover:text-sage-800 font-medium"
                        >
                            Tout désélectionner
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {selectedCodes.map((code: string) => {
                            const term = terms.find(t => t.code === code);
                            return (
                                <span
                                    key={code}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-sage-600 text-white rounded-lg text-sm font-medium"
                                >
                                    <span className="font-mono">{code}</span>
                                    {term && <span>• {term.name}</span>}
                                    <button
                                        type="button"
                                        onClick={() => toggleTerm(code)}
                                        className="hover:bg-sage-700 rounded-full p-0.5 transition-colors"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Available terms */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <span className="text-sm font-medium text-gray-700">
                        Conditions disponibles ({filteredTerms.length})
                    </span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600 mx-auto mb-2"></div>
                                <p className="text-sm text-gray-500">Chargement...</p>
                            </div>
                        </div>
                    ) : filteredTerms.length === 0 ? (
                        <div className="text-center py-12">
                            <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500 font-medium">Aucune condition trouvée</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {filteredTerms.map((term) => {
                                const isSelected = selectedCodes.includes(term.code);
                                return (
                                    <button
                                        key={term.code}
                                        type="button"
                                        onClick={() => toggleTerm(term.code)}
                                        className={`w-full text-left px-4 py-3 transition-colors ${
                                            isSelected ? 'bg-sage-50 hover:bg-sage-100' : 'hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {isSelected ? (
                                                <CheckCircle2 className="w-5 h-5 text-sage-600 shrink-0" />
                                            ) : (
                                                <div className="w-5 h-5 border-2 border-gray-300 rounded-full shrink-0"></div>
                                            )}
                                            <span className={`font-mono text-xs px-2 py-0.5 rounded ${
                                                isSelected ? 'bg-sage-100 text-sage-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {term.code}
                                            </span>
                                            <span className={`font-medium text-sm ${isSelected ? 'text-sage-900' : 'text-gray-900'}`}>
                                                {term.name}
                                            </span>
                                            {term.is_credit && (
                                                <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full ml-auto">Crédit</span>
                                            )}
                                            {term.is_cash && (
                                                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full ml-auto">Cash</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
