import { PartnerFamilySelector } from './PartnerFamilySelector';
import { PromotionChronologiesSelector } from './PromotionChronologiesSelector';

export const PromotionPartnersSection = () => {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Ciblage Partenaires</h2>
                <p className="text-sm text-gray-500">Définissez quels partenaires peuvent bénéficier de cette promotion</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Sans famille NI chronologie sélectionnée, la promotion s'applique à tous les partenaires.
                    Les deux axes de ciblage sont cumulables.
                </p>
            </div>

            <PartnerFamilySelector />

            <div className="border-t border-gray-200 pt-6">
                <PromotionChronologiesSelector />
            </div>
        </div>
    );
};
