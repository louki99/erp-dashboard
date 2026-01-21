import { PartnerFamilySelector } from './PartnerFamilySelector';

export const PromotionPartnersSection = () => {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Ciblage Partenaires</h2>
                <p className="text-sm text-gray-500">Définissez quels partenaires peuvent bénéficier de cette promotion</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Si aucune famille de partenaires n'est sélectionnée, la promotion s'appliquera à tous les partenaires.
                </p>
            </div>

            <PartnerFamilySelector />
        </div>
    );
};
