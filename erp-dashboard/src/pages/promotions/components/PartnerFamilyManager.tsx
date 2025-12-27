import { useState, useEffect, useCallback } from 'react';
import { promotionsApi } from '@/services/api/promotionsApi';
import type { PartnerFamily } from '@/types/promotion.types';
import { Users, Search, Settings, CheckCircle2, Circle, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PartnerFamilyManagementDrawer } from './PartnerFamilyManagementDrawer';

interface PartnerFamilyManagerProps {
    selectedCodes: string[];
    onSelectionChange: (codes: string[]) => void;
}

export const PartnerFamilyManager = ({ selectedCodes, onSelectionChange }: PartnerFamilyManagerProps) => {
    const [families, setFamilies] = useState<PartnerFamily[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [isManagementDrawerOpen, setIsManagementDrawerOpen] = useState(false);

    const loadFamilies = useCallback(async () => {
        setLoading(true);
        try {
            const response = await promotionsApi.getPartnerFamilies();
            setFamilies(response.partnerFamilies || []);
        } catch (error) {
            console.error('Failed to load partner families', error);
            toast.error('Échec du chargement des familles de partenaires');
            setFamilies([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadFamilies();
    }, [loadFamilies]);

    const filteredFamilies = families.filter(f => 
        f.code?.toLowerCase().includes(search.toLowerCase()) ||
        f.name?.toLowerCase().includes(search.toLowerCase())
    );

    const handleToggleFamily = (code: string) => {
        const isSelected = selectedCodes.includes(code);
        if (isSelected) {
            onSelectionChange(selectedCodes.filter(c => c !== code));
        } else {
            onSelectionChange([...selectedCodes, code]);
        }
    };

    const handleSelectAll = () => {
        const allCodes = filteredFamilies.map(f => f.code).filter(Boolean) as string[];
        onSelectionChange(allCodes);
    };

    const handleClearAll = () => {
        onSelectionChange([]);
    };

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl p-6 border border-blue-100 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-lg">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">
                                Familles de Partenaires
                            </h3>
                            <p className="text-sm text-gray-600 mt-0.5">
                                Ciblez des groupes de partenaires spécifiques
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsManagementDrawerOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white text-blue-700 rounded-lg hover:bg-blue-50 transition-all shadow-sm border border-blue-200 font-medium"
                    >
                        <Settings className="w-4 h-4" />
                        Gérer les Familles
                    </button>
                </div>
                <div className="flex items-start gap-2 bg-blue-100/50 rounded-lg p-3 border border-blue-200">
                    <Info className="w-4 h-4 text-blue-700 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-blue-900">
                        Sélectionnez les familles de partenaires à cibler pour cette promotion. Pour créer ou modifier des familles, utilisez le bouton "Gérer les Familles".
                    </p>
                </div>
            </div>

            {/* Search and Actions Bar */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Rechercher par code ou nom..."
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                disabled={filteredFamilies.length === 0}
                                className="px-3 py-2.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Tout sélectionner
                            </button>
                            <button
                                type="button"
                                onClick={handleClearAll}
                                disabled={selectedCodes.length === 0}
                                className="px-3 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Tout désélectionner
                            </button>
                        </div>
                    </div>
                </div>

                {/* Selection Counter */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                            {filteredFamilies.length} famille(s) disponible(s)
                        </span>
                        <div className="flex items-center gap-2">
                            <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                                {selectedCodes.length} sélectionnée(s)
                            </div>
                        </div>
                    </div>
                </div>

                {/* Family Cards Grid */}
                <div className="p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                <p className="text-sm text-gray-500">Chargement...</p>
                            </div>
                        </div>
                    ) : filteredFamilies.length === 0 ? (
                        <div className="text-center py-12">
                            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500 font-medium">Aucune famille trouvée</p>
                            <p className="text-sm text-gray-400 mt-1">
                                {search ? 'Essayez une autre recherche' : 'Créez votre première famille de partenaires'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                            {filteredFamilies.map((family) => {
                                const isSelected = selectedCodes.includes(family.code || '');
                                return (
                                    <button
                                        key={family.code}
                                        type="button"
                                        onClick={() => handleToggleFamily(family.code || '')}
                                        className={`text-left p-4 rounded-lg border-2 transition-all ${
                                            isSelected
                                                ? 'border-blue-500 bg-blue-50 shadow-md'
                                                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5">
                                                {isSelected ? (
                                                    <CheckCircle2 className="w-5 h-5 text-blue-600" />
                                                ) : (
                                                    <Circle className="w-5 h-5 text-gray-300" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`font-mono text-xs px-2 py-0.5 rounded ${
                                                        isSelected
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        {family.code}
                                                    </span>
                                                </div>
                                                <h4 className={`font-semibold text-sm mb-1 truncate ${
                                                    isSelected ? 'text-blue-900' : 'text-gray-900'
                                                }`}>
                                                    {family.name}
                                                </h4>
                                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                                    {family.partner_condition && (
                                                        <span className="truncate">
                                                            {family.partner_condition}
                                                        </span>
                                                    )}
                                                    <span className={`flex items-center gap-1 ${
                                                        isSelected ? 'text-blue-600 font-medium' : ''
                                                    }`}>
                                                        <Users className="w-3 h-3" />
                                                        {family.partners_count || 0}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <PartnerFamilyManagementDrawer
                isOpen={isManagementDrawerOpen}
                onClose={() => setIsManagementDrawerOpen(false)}
                onFamiliesUpdated={loadFamilies}
            />
        </div>
    );
};

