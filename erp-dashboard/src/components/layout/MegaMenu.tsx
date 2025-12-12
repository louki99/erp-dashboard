import React, { useState, useEffect } from 'react';
import { Search, X, LayoutGrid, Package, BarChart3, Settings, Database, ShoppingCart } from 'lucide-react';
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
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
                    />

                    {/* Menu Container */}
                    <motion.div
                        initial={{ y: -50, opacity: 0, scale: 0.98 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: -20, opacity: 0, scale: 0.98 }}
                        transition={{ type: "spring", duration: 0.4, bounce: 0.2 }}
                        className="fixed inset-x-0 top-16 mx-auto max-w-[90rem] h-[80vh] bg-background/95 backdrop-blur-md border border-white/20 dark:border-white/10 shadow-2xl rounded-xl z-50 flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="h-16 border-b border-border flex items-center px-8 shrink-0 bg-muted/30">
                            <div className="flex items-center gap-3 text-sage-600 dark:text-sage-400">
                                <LayoutGrid className="w-6 h-6" />
                                <span className="font-bold text-lg tracking-tight">Navigation</span>
                            </div>

                            <div className="flex-1 max-w-xl mx-8 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Search modules, functions, or reports..."
                                    className="w-full bg-background border border-input rounded-md pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500/50 transition-all placeholder:text-muted-foreground"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors ml-auto">
                                <X className="w-5 h-5 text-muted-foreground" />
                            </button>
                        </div>

                        <div className="flex flex-1 overflow-hidden">
                            {/* Sidebar Modules */}
                            <div className="w-72 bg-muted/50 border-r border-border overflow-y-auto py-6 px-4 space-y-2">
                                {MENU_DATA.map((module) => {
                                    const Icon = module.icon;
                                    const isActive = activeModuleId === module.id;
                                    return (
                                        <button
                                            key={module.id}
                                            onClick={() => setActiveModuleId(module.id)}
                                            className={cn(
                                                "w-full text-left px-4 py-3 rounded-lg flex items-start gap-3 transition-all duration-200 group",
                                                isActive
                                                    ? "bg-sage-500/10 text-sage-900 dark:text-sage-100 ring-1 ring-sage-500/20 shadow-sm"
                                                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <Icon className={cn("w-5 h-5 mt-0.5 transition-colors", isActive ? "text-sage-600 dark:text-sage-400" : "text-muted-foreground group-hover:text-foreground")} />
                                            <div>
                                                <div className="font-semibold text-sm">{module.label}</div>
                                                <div className="text-xs text-muted-foreground/80 font-medium line-clamp-1 mt-0.5">{module.description}</div>
                                            </div>
                                            {isActive && (
                                                <motion.div layoutId="active-indicator" className="ml-auto w-1 h-1 rounded-full bg-sage-500 mt-2" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Content Area */}
                            <div className="flex-1 overflow-y-auto bg-background/50 p-8">
                                <AnimatePresence mode="wait">
                                    {activeModule && (
                                        <motion.div
                                            key={activeModule.id}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <div className="flex items-center gap-4 mb-8">
                                                <div className="p-3 rounded-xl bg-sage-500/10 text-sage-600 dark:text-sage-400">
                                                    <activeModule.icon className="w-8 h-8" />
                                                </div>
                                                <div>
                                                    <h2 className="text-2xl font-bold tracking-tight text-foreground">{activeModule.label}</h2>
                                                    <p className="text-muted-foreground">{activeModule.description}</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                                {activeModule.categories.map((category, idx) => (
                                                    <motion.div
                                                        key={category.title}
                                                        initial={{ opacity: 0, y: 20 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: idx * 0.05 }}
                                                        className="flex flex-col h-full bg-sage-50/50 dark:bg-sage-900/10 rounded-xl border border-sage-100 dark:border-sage-800/50 overflow-hidden group hover:shadow-md transition-all duration-300"
                                                    >
                                                        {/* Card Header */}
                                                        <div className="px-5 py-3 bg-sage-100/50 dark:bg-sage-900/30 border-b border-sage-200/50 dark:border-sage-800/50 flex items-center justify-between">
                                                            <h3 className="font-bold text-sage-900 dark:text-sage-100 text-sm tracking-wide uppercase">
                                                                {category.title}
                                                            </h3>
                                                        </div>

                                                        {/* Card Content */}
                                                        <div className="p-5 flex-1 bg-white/50 dark:bg-transparent">
                                                            <ul className="space-y-1">
                                                                {category.items.map((item) => (
                                                                    <li key={item}>
                                                                        <a href="#" className="flex items-center px-2 py-1.5 -mx-2 rounded-md group/item text-sm text-sage-700 dark:text-sage-300 hover:bg-white dark:hover:bg-sage-800 hover:text-sage-900 dark:hover:text-sage-100 transition-all">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-sage-300 group-hover/item:bg-sage-500 mr-2.5 transition-colors"></span>
                                                                            {item}
                                                                        </a>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </motion.div>
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
