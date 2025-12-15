import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, BarChart3, Settings, Database, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ModuleData {
    id: string;
    label: string;
    icon: React.ElementType;
    description: string;
    categories: {
        title: string;
        items: string[];
    }[];
}

const MENU_DATA: ModuleData[] = [
    {
        id: 'purch',
        label: 'Achats',
        icon: ShoppingCart,
        description: 'Manage procurement, orders, and receipts',
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
        icon: BarChart3,
        description: 'Sales orders, quotes, and delivery management',
        categories: [
            { title: 'Devis', items: ['Saisie devis', 'Liste devis'] },
            { title: 'Commandes', items: ['Saisie commandes', 'Liste commandes'] },
            { title: 'Livraisons', items: ['Préparation', 'Validation'] }
        ]
    },
    {
        id: 'stock',
        label: 'Stocks',
        icon: Package,
        description: 'Inventory, transfers, and stock counts',
        categories: [
            { title: 'Mouvements', items: ['Entrées diverses', 'Sorties diverses', 'Changements emplacement'] },
            { title: 'Inventaires', items: ['Comptage', 'Validation'] }
        ]
    },
    {
        id: 'adv',
        label: 'ADV',
        icon: Package,
        description: 'Administration des Ventes - Gestion partenaires, crédit et validations',
        categories: [
            {
                title: 'Tableau de Bord',
                items: ['Tableau de bord ADV']
            },
            {
                title: 'Gestion Partenaires',
                items: ['Validation Partenaires', 'Liste Partenaires']
            },
            {
                title: 'Gestion Crédit',
                items: ['Gestion Crédit', 'Échéances']
            },
            {
                title: 'Validation BC',
                items: ['Validation BC', 'Dérogations Crédit']
            }
        ]
    },
    {
        id: 'dispatcher',
        label: 'Dispatcher',
        icon: Package,
        description: 'Dispatcher - Conversion BC, gestion BL et bons de chargement',
        categories: [
            {
                title: 'Tableau de Bord',
                items: ['Tableau de bord Dispatcher']
            },
            {
                title: 'Commandes',
                items: ['Commandes en attente']
            },
            {
                title: 'Bon de Livraison',
                items: ['BL brouillons', 'BL (liste)']
            },
            {
                title: 'Bon de Chargement',
                items: ['Créer BCH', 'BCH (liste)']
            },
            {
                title: 'Décharges',
                items: ['Décharges (liste)']
            }
        ]
    },
    {
        id: 'magasinier',
        label: 'Magasinier',
        icon: Package,
        description: 'Magasinier - Préparations, stock et batch picking',
        categories: [
            {
                title: 'Tableau de Bord',
                items: ['Tableau de bord Magasinier']
            },
            {
                title: 'Préparations',
                items: ['Bons de préparation', 'Commandes approuvées']
            },
            {
                title: 'Stock',
                items: ['Gestion stock', 'Mouvements stock']
            },
            {
                title: 'Batch Picking',
                items: ['Préparation groupée']
            }
        ]
    },
    {
        id: 'base',
        label: 'Données de base',
        icon: Database,
        description: 'Master data for products, partners, and sites',
        categories: [
            { title: 'Articles', items: ['Articles', 'Articles-site', 'Unités'] },
            { title: 'Tiers', items: ['Clients', 'Fournisseurs', 'Transporteurs'] }
        ]
    },
    {
        id: 'admin',
        label: 'Administration',
        icon: Settings,
        description: 'User management, security, and global settings',
        categories: [
            { title: 'Utilisateurs', items: ['Utilisateurs', 'Rôles', 'Groupes'] },
            { title: 'Sécurité', items: ['Gouvernance', 'Audit'] }
        ]
    }
];

interface MegaMenuProps {
    isOpen: boolean;
    onClose: () => void;
}

export const MegaMenu: React.FC<MegaMenuProps> = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const [activeModuleId, setActiveModuleId] = useState<string>('purch');
    const [searchQuery, setSearchQuery] = useState('');

    // Lock body scroll when menu is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
            setSearchQuery('');
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    const activeModule = MENU_DATA.find(m => m.id === activeModuleId);

    // Route Mapping Configuration
    const ROUTE_MAPPING: Record<string, string> = {
        // ADV Module Routes
        'Tableau de bord ADV': '/adv',
        'Validation Partenaires': '/adv/partners',
        'Liste Partenaires': '/adv/partners',
        'Gestion Crédit': '/adv/credit',
        'Échéances': '/adv/echeances',
        'Validation BC': '/adv/validation',
        'Dérogations Crédit': '/adv/derogations',

        // Dispatcher Module Routes
        'Tableau de bord Dispatcher': '/dispatcher',
        'Commandes en attente': '/dispatcher/orders',
        'BL brouillons': '/dispatcher/bon-livraisons/draft',
        'BL (liste)': '/dispatcher/bon-livraisons',
        'Créer BCH': '/dispatcher/bon-chargements/create',
        'BCH (liste)': '/dispatcher/bon-chargements',
        'Décharges (liste)': '/dispatcher/decharges',

        // Magasinier Module Routes
        'Tableau de bord Magasinier': '/magasinier',
        'Bons de préparation': '/magasinier/preparations',
        'Commandes approuvées': '/magasinier/orders',
        'Gestion stock': '/magasinier/stock',
        'Mouvements stock': '/magasinier/stock',
        'Préparation groupée': '/magasinier/batch-picking',

        // Legacy ADV mappings (keep for compatibility)
        'Tableau de bord': '/adv',
        'Partner Validation': '/adv/partners',
        'Credit Management': '/adv/credit',
        'BC Approval': '/adv/validation',

        // Orders
        'Commandes': '/orders',
        'Liste commandes': '/orders',
        'Saisie commandes': '/orders/new',

        // Partners
        'Clients': '/partners',
        'Tiers': '/partners',
        'Fournisseurs': '/partners/suppliers',

        // General Fallbacks
        'default': '/dashboard'
    };


    const handleNavigation = (itemLabel: string) => {
        onClose();
        const route = ROUTE_MAPPING[itemLabel] || ROUTE_MAPPING['default'];
        navigate(route);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                    />

                    {/* Menu Container */}
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -10, opacity: 0 }}
                        transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                        className="fixed inset-x-0 top-14 mx-auto w-full bg-white dark:bg-[#1a1a1a] shadow-2xl border-t border-gray-200 dark:border-gray-800 z-50 h-[85vh] flex flex-col"
                    >
                        <div className="flex flex-1 overflow-hidden">
                            {/* Left Sidebar: Modules */}
                            <div className="w-64 bg-gray-50 dark:bg-black/20 border-r border-gray-200 dark:border-gray-800 flex flex-col">
                                <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            autoFocus
                                            placeholder="Find a module..."
                                            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sage-500 transition-shadow"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto py-2">
                                    {MENU_DATA.map((module) => {
                                        const Icon = module.icon;
                                        const isActive = activeModuleId === module.id;
                                        return (
                                            <button
                                                key={module.id}
                                                onClick={() => setActiveModuleId(module.id)}
                                                className={cn(
                                                    "w-full text-left px-6 py-3 flex items-center gap-3 transition-colors relative border-l-4",
                                                    isActive
                                                        ? "bg-white dark:bg-gray-800 border-sage-600 text-sage-700 dark:text-sage-400 font-medium shadow-sm"
                                                        : "border-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900"
                                                )}
                                            >
                                                <Icon className={cn("w-5 h-5", isActive ? "text-sage-600" : "text-gray-400")} />
                                                <span className="text-sm">{module.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Right Content: Categories & Functions */}
                            <div className="flex-1 bg-white dark:bg-[#1a1a1a] p-8 overflow-y-auto">
                                <AnimatePresence mode="wait">
                                    {activeModule && (
                                        <motion.div
                                            key={activeModule.id}
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <div className="mb-8 border-b border-gray-100 dark:border-gray-800 pb-4">
                                                <h2 className="text-2xl font-light text-gray-900 dark:text-white flex items-center gap-3">
                                                    <activeModule.icon className="w-6 h-6 text-sage-500" />
                                                    {activeModule.label}
                                                </h2>
                                                <p className="text-sm text-gray-500 mt-1 ml-9">{activeModule.description}</p>
                                            </div>

                                            <div className="columns-1 md:columns-2 xl:columns-3 gap-8 space-y-8">
                                                {activeModule.categories.map((category) => (
                                                    <div key={category.title} className="break-inside-avoid-column">
                                                        <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm uppercase tracking-wider mb-4 border-l-2 border-sage-300 pl-3">
                                                            {category.title}
                                                        </h3>
                                                        <ul className="space-y-1">
                                                            {category.items.map((item) => (
                                                                <li key={item}>
                                                                    <button
                                                                        onClick={() => handleNavigation(item)}
                                                                        className="w-full text-left group flex items-baseline gap-2 px-3 py-2 rounded-[4px] hover:bg-sage-50 dark:hover:bg-white/5 transition-colors"
                                                                    >
                                                                        <div className="w-1 h-1 rounded-full bg-gray-300 group-hover:bg-sage-500 transition-colors" />
                                                                        <span className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-sage-700 dark:group-hover:text-sage-300 transition-colors font-medium">
                                                                            {item}
                                                                        </span>
                                                                    </button>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
