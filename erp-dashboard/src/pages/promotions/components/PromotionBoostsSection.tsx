import { useFormContext } from 'react-hook-form';
import type { Promotion } from '@/types/promotion.types';

export const PromotionBoostsSection = () => {
    const { } = useFormContext<Promotion>();

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Boosts de Promotion</h2>
                <p className="text-sm text-gray-500">Configurez des facteurs de boost pour certaines familles de produits</p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                    <strong>Info:</strong> Les boosts permettent d'augmenter ou de réduire l'impact de la promotion sur certaines familles de produits.
                </p>
            </div>

            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-gray-500">Fonctionnalité de boosts à venir</p>
            </div>
        </div>
    );
};
