import { useState, useEffect, useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import { promotionsApi } from '@/services/api/promotionsApi';
import type { PartnerFamily, Promotion } from '@/types/promotion.types';
import { Users, Search, X, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const PartnerFamilySelector = () => {
    const { watch, setValue } = useFormContext<Promotion>();
    const selectedCodes = watch('partner_families') || [];
    
    const [families, setFamilies] = useState<PartnerFamily[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

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
            setValue('partner_families', selectedCodes.filter((c: string) => c !== code), { shouldDirty: true });
        } else {
            setValue('partner_families', [...selectedCodes, code], { shouldDirty: true });
        }
    };

    const handleRemoveFamily = (code: string) => {
        setValue('partner_families', selectedCodes.filter((c: string) => c !== code), { shouldDirty: true });
    };

    const handleSelectAll = () => {
        const allCodes = filteredFamilies.map(f => f.code).filter(Boolean) as string[];
        setValue('partner_families', allCodes, { shouldDirty: true });
    };

    const handleClearAll = () => {
        setValue('partner_families', [], { shouldDirty: true });
    };

    return (
        <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Rechercher ou ajouter des familles de partenaires..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 outline-none"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Selected Families Tags */}
            {selectedCodes.length > 0 && (
                <div className="bg-sage-50 border border-sage-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-sage-900">
                            {selectedCodes.length} famille(s) sélectionnée(s)
                        </span>
                        <button
                            type="button"
                            onClick={handleClearAll}
                            className="text-xs text-sage-600 hover:text-sage-800 font-medium"
                        >
                            Tout désélectionner
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {selectedCodes.map((code: string) => {
                            const family = families.find(f => f.code === code);
                            return (
                                <span
                                    key={code}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-sage-600 text-white rounded-lg text-sm font-medium"
                                >
                                    <span className="font-mono">{code}</span>
                                    {family && <span>• {family.name}</span>}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveFamily(code)}
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

            {/* Available Families List */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                        Familles disponibles ({filteredFamilies.length})
                    </span>
                    {filteredFamilies.length > 0 && (
                        <button
                            type="button"
                            onClick={handleSelectAll}
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                        >
                            Tout sélectionner
                        </button>
                    )}
                </div>

                <div className="max-h-80 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600 mx-auto mb-2"></div>
                                <p className="text-sm text-gray-500">Chargement...</p>
                            </div>
                        </div>
                    ) : filteredFamilies.length === 0 ? (
                        <div className="text-center py-12">
                            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500 font-medium">Aucune famille trouvée</p>
                            <p className="text-sm text-gray-400 mt-1">
                                {search ? 'Essayez une autre recherche' : 'Aucune famille de partenaires disponible'}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {filteredFamilies.map((family) => {
                                const isSelected = selectedCodes.includes(family.code || '');
                                return (
                                    <button
                                        key={family.code}
                                        type="button"
                                        onClick={() => handleToggleFamily(family.code || '')}
                                        className={`w-full text-left px-4 py-3 transition-colors ${
                                            isSelected
                                                ? 'bg-sage-50 hover:bg-sage-100'
                                                : 'hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex-shrink-0">
                                                {isSelected ? (
                                                    <CheckCircle2 className="w-5 h-5 text-sage-600" />
                                                ) : (
                                                    <div className="w-5 h-5 border-2 border-gray-300 rounded-full"></div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`font-mono text-xs px-2 py-0.5 rounded ${
                                                        isSelected
                                                            ? 'bg-sage-100 text-sage-700'
                                                            : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        {family.code}
                                                    </span>
                                                    {family.partners_count !== undefined && (
                                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                                            <Users className="w-3 h-3" />
                                                            {family.partners_count}
                                                        </span>
                                                    )}
                                                </div>
                                                <h4 className={`font-medium text-sm ${
                                                    isSelected ? 'text-sage-900' : 'text-gray-900'
                                                }`}>
                                                    {family.name}
                                                </h4>
                                                {family.partner_condition && (
                                                    <p className="text-xs text-gray-500 mt-1 truncate">
                                                        {family.partner_condition}
                                                    </p>
                                                )}
                                            </div>
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
