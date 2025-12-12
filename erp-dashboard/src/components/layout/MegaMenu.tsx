import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronRight, X, ChevronUp, Minimize2, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuItem {
    label: string;
    children?: MenuItem[];
}

interface ModuleData {
    id: string;
    label: string;
    categories: {
        title: string;
        items: string[];
    }[];
}

const MENU_DATA: ModuleData[] = [
    {
        id: 'admin',
        label: 'Administration',
        categories: [
            { title: 'Utilisateurs', items: ['Utilisateurs', 'Rôles', 'Groupes'] },
            { title: 'Sécurité', items: ['Gouvernance', 'Audit'] }
        ]
    },
    {
        id: 'dev',
        label: 'Développement',
        categories: []
    },
    {
        id: 'param',
        label: 'Paramétrage',
        categories: []
    },
    {
        id: 'base',
        label: 'Données de base',
        categories: [
            { title: 'Articles', items: ['Articles', 'Articles-site', 'Unités'] },
            { title: 'Tiers', items: ['Clients', 'Fournisseurs', 'Transporteurs'] }
        ]
    },
    {
        id: 'crm',
        label: 'Relation client',
        categories: []
    },
    {
        id: 'purch',
        label: 'Achats',
        categories: [
            { title: 'Tarifs', items: ['Recherche tarifs', 'Saisie des tarifs'] },
            { title: 'Approvisionnement', items: ['Planning global', 'Plan de travail', 'Plan de regroupement'] },
            { title: 'Demandes d\'achat', items: ['Demandes d\'achat', 'Soldes demandes d\'achat'] },
            { title: 'Appels d\'offres', items: ['Demandes', 'Réponses', 'Relances'] },
            { title: 'Commandes', items: ['Commandes', 'Commandes ouvertes', 'Signatures'] },
            { title: 'Réceptions', items: ['Réceptions', 'Retours'] },
            { title: 'Factures', items: ['Factures', 'Avoirs'] }
        ]
    },
    {
        id: 'sales',
        label: 'Ventes',
        categories: [
            { title: 'Devis', items: ['Saisie devis', 'Liste devis'] },
            { title: 'Commandes', items: ['Saisie commandes', 'Liste commandes'] },
            { title: 'Livraisons', items: ['Préparation', 'Validation'] }
        ]
    },
    {
        id: 'stock',
        label: 'Stocks',
        categories: []
    },
    {
        id: 'nonconf',
        label: 'Non-conformités',
        categories: []
    },
    {
        id: 'control',
        label: 'Contrôle de gestion',
        categories: []
    },
    {
        id: 'acct',
        label: 'Comptabilité',
        categories: []
    },
    {
        id: 'acct_tiers',
        label: 'Comptabilité tiers',
        categories: []
    },
    {
        id: 'decl',
        label: 'Déclarations',
        categories: []
    }
];

interface MegaMenuProps {
    isOpen: boolean;
    onClose: () => void;
}

export const MegaMenu: React.FC<MegaMenuProps> = ({ isOpen, onClose }) => {
    const [activeModuleId, setActiveModuleId] = useState<string>('purch');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

    // Initialize all categories as expanded by default for the active module
    useEffect(() => {
        if (activeModuleId) {
            const module = MENU_DATA.find(m => m.id === activeModuleId);
            if (module) {
                const initialExpanded: Record<string, boolean> = {};
                module.categories.forEach(cat => {
                    initialExpanded[cat.title] = true;
                });
                setExpandedCategories(initialExpanded);
            }
        }
    }, [activeModuleId]);

    if (!isOpen) return null;

    const activeModule = MENU_DATA.find(m => m.id === activeModuleId);

    const toggleCategory = (title: string) => {
        setExpandedCategories(prev => ({
            ...prev,
            [title]: !prev[title]
        }));
    };

    const expandAll = () => {
        if (!activeModule) return;
        const all: Record<string, boolean> = {};
        activeModule.categories.forEach(c => all[c.title] = true);
        setExpandedCategories(all);
    };

    const collapseAll = () => {
        setExpandedCategories({});
    };

    return (
        /* Backdrop */
        <div className="fixed inset-0 z-[100] flex flex-col font-sans" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/20" onClick={onClose} />

            {/* Menu Container - positioned below header usually, but we'll do fixed top for now matching image overlay style */}
            <div className="relative w-full bg-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col max-h-[85vh] mt-10 mx-auto max-w-[98%] rounded-b-lg border border-gray-200">

                {/* Header Section */}
                <div className="h-12 border-b border-gray-200 flex items-center px-4 bg-gray-50/50 shrink-0">
                    <span className="font-bold text-gray-800 mr-4">Menu</span>

                    {/* Search Bar */}
                    <div className="flex-1 max-w-2xl relative">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                className="w-full pl-9 pr-4 py-1.5 bg-white border border-gray-300 rounded-sm text-sm focus:outline-none focus:border-[#00b06b] transition-colors"
                                placeholder="Rechercher dans le menu Navigation"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
                                0 sur 0
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={collapseAll}
                            className="px-3 py-1.5 text-xs font-medium text-[#007040] hover:bg-green-50 border border-transparent hover:border-green-100 rounded transition-colors"
                        >
                            Tout réduire
                        </button>
                        <button
                            onClick={expandAll}
                            className="px-3 py-1.5 text-xs font-medium text-[#007040] border border-[#007040] bg-white hover:bg-green-50 rounded transition-colors"
                        >
                            Tout développer
                        </button>
                    </div>
                </div>

                {/* Main Body */}
                <div className="flex flex-1 overflow-hidden h-[600px]">

                    {/* Left Sidebar: Modules */}
                    <div className="w-64 bg-gray-100/50 border-r border-gray-200 overflow-y-auto py-2">
                        {MENU_DATA.map((module) => (
                            <button
                                key={module.id}
                                onClick={() => setActiveModuleId(module.id)}
                                className={cn(
                                    "w-full text-left px-4 py-2.5 text-sm font-medium transition-colors border-l-4",
                                    activeModuleId === module.id
                                        ? "bg-white border-[#00b06b] text-[#00b06b] shadow-sm"
                                        : "border-transparent text-gray-700 hover:bg-gray-200/50 hover:text-gray-900"
                                )}
                            >
                                {module.label}
                            </button>
                        ))}
                    </div>

                    {/* Right Content: Categories & Items */}
                    <div className="flex-1 overflow-y-auto bg-white p-6">
                        {activeModule && (
                            <div className="max-w-5xl">
                                <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                                    <span className={activeModule.categories.length > 0 ? "text-[#007040]" : "text-gray-400"}>
                                        {activeModule.categories.length > 0 ? <ChevronDown className="w-5 h-5" /> : null}
                                    </span>
                                    {activeModule.label}
                                </h2>

                                <div className="space-y-6 pl-4">
                                    {activeModule.categories.map((category) => (
                                        <div key={category.title} className="group">
                                            {/* Category Header */}
                                            <button
                                                onClick={() => toggleCategory(category.title)}
                                                className="flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-[#00b06b] mb-3 transition-colors select-none"
                                            >
                                                {expandedCategories[category.title] ? (
                                                    <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-[#00b06b]" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#00b06b]" />
                                                )}
                                                {category.title}
                                            </button>

                                            {/* Category Items */}
                                            {expandedCategories[category.title] && (
                                                <div className="grid grid-cols-3 gap-x-8 gap-y-3 pl-6 animate-in slide-in-from-top-1 duration-150">
                                                    {category.items.map((item) => (
                                                        <a
                                                            key={item}
                                                            href="#"
                                                            className="text-sm text-[#007040] hover:underline hover:text-[#005030] block py-0.5 truncate"
                                                        >
                                                            {item}
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {activeModule.categories.length === 0 && (
                                        <div className="text-gray-400 italic text-sm pl-6">
                                            Aucun élément disponible pour ce module.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};
