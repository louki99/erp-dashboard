import { useFormContext } from 'react-hook-form';
import type { Promotion } from '@/types/promotion.types';

export const PromotionPaymentSection = () => {
    const { watch } = useFormContext<Promotion>();
    const paymentTerms = watch('payment_terms') || [];

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

            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Conditions de Paiement Autorisées
                </label>
                <div className="space-y-2">
                    <input
                        type="text"
                        placeholder="Rechercher ou ajouter des conditions de paiement..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                    />
                    <p className="text-xs text-gray-500">
                        Séparez les codes par des virgules
                    </p>
                </div>

                {paymentTerms.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {paymentTerms.map((term: string, index: number) => (
                            <span
                                key={index}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium"
                            >
                                {term}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
