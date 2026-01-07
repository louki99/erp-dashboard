import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, BarChart3, Settings, Database, ShoppingCart, ListTodo, ChevronRight, Clock, X, Star, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ModuleData {
    id: string;
    label: string;
    icon: React.ElementType;
    description: string;
    requiredPermission?: string;
    requiredRole?: string;
    categories: {
        title: string;
        items: string[];
        requiredPermission?: string;
    }[];
}

interface SearchResult {
    moduleId: string;
    moduleName: string;
    categoryTitle: string;
    itemName: string;
    path: string;
}

// Permission mapping for menu items - matches backend permission format
const ITEM_PERMISSIONS: Record<string, string> = {
    // Achats (Procurement)
    'Recherche tarifs': 'admin.procurement.view',
    'Saisie des tarifs': 'admin.procurement.create',
    'Planning global': 'admin.procurement.planning',
    'Plan de travail': 'admin.procurement.planning',
    'Plan de regroupement': 'admin.procurement.planning',
    'Demandes d\'achat': 'admin.procurement.requests',
    'Soldes demandes d\'achat': 'admin.procurement.requests',
    'Commandes': 'admin.procurement.orders',
    'Commandes ouvertes': 'admin.procurement.orders',
    'Signatures': 'admin.procurement.approve',
    'Réceptions': 'admin.procurement.receipts',
    'Retours': 'admin.procurement.returns',
    'Factures': 'admin.procurement.invoices',
    'Avoirs': 'admin.procurement.credits',
    
    // Ventes (Sales)
    'Saisie devis': 'admin.sales.quotes',
    'Liste devis': 'admin.sales.quotes',
    'Saisie commandes': 'admin.sales.orders',
    'Liste commandes': 'admin.sales.orders',
    'Préparation': 'admin.sales.delivery',
    'Validation': 'admin.sales.approve',
    'Promotions': 'admin.sales.promotions',
    
    // Stock
    'Entrées diverses': 'admin.stock.movements',
    'Sorties diverses': 'admin.stock.movements',
    'Changements emplacement': 'admin.stock.movements',
    'Comptage': 'admin.stock.inventory',
    
    // ADV
    'Tableau de bord ADV': 'admin.adv.dashboard',
    'Validation Partenaires': 'admin.adv.partners.validate',
    'Liste Partenaires': 'admin.adv.partners.index',
    'Soldes Partenaires': 'admin.adv.partners.index',
    'Gestion Crédit': 'admin.adv.credit.index',
    'Échéances': 'admin.adv.echeances.index',
    'Validation BC': 'admin.adv.bc.validate',
    'Dérogations Crédit': 'admin.adv.credit.approve-increase',
    
    // Dispatcher
    'Tableau de bord Dispatcher': 'admin.dispatcher.dashboard',
    'Commandes en attente': 'admin.dispatcher.orders',
    'BL brouillons': 'admin.dispatcher.delivery.create',
    'BL (liste)': 'admin.dispatcher.delivery.index',
    'Créer BCH': 'admin.dispatcher.loading.create',
    'BCH (liste)': 'admin.dispatcher.loading.index',
    'Décharges (liste)': 'admin.dispatcher.unloading.index',
    
    // Magasinier
    'Tableau de bord Magasinier': 'admin.warehouse.dashboard',
    'Bons de préparation': 'admin.warehouse.picking',
    'Commandes approuvées': 'admin.warehouse.orders',
    'Gestion stock': 'admin.warehouse.stock',
    'Mouvements stock': 'admin.warehouse.stock',
    'Préparation groupée': 'admin.warehouse.batch-picking',
    
    // Données de Base
    'Gestion Produits': 'admin.master.products',
    'Articles': 'admin.master.products',
    'Articles-site': 'admin.master.products',
    'Unités': 'admin.master.units',
    'Clients': 'admin.master.customers',
    'Fournisseurs': 'admin.master.suppliers',
    'Transporteurs': 'admin.master.carriers',
    'Tiers': 'admin.master.partners',
    
    // Administration
    'Utilisateurs': 'admin.users.view',
    'Rôles': 'admin.roles.view',
    'Groupes': 'admin.groups.view',
    'Gouvernance': 'admin.governance.view',
    'Audit': 'admin.audit.view',
    'Monitoring': 'admin.monitoring.view',
    'Paramètres Généraux': 'admin.settings.view',
    
    // Tasks & Workflows
    'Tableau de bord Tâches': 'admin.tasks.dashboard',
    'Tâches prêtes': 'admin.tasks.my-tasks',
    'Tâches en cours': 'admin.tasks.my-tasks',
    'Tâches terminées': 'admin.tasks.my-tasks',
    'Progression workflows': 'admin.tasks.workflow.progress',
    'Statistiques workflows': 'admin.tasks.workflow.progress',
    'Templates de workflow': 'view-workflows',
    'Gestion des workflows': 'view-workflows',
    'Gestion des tâches': 'admin.tasks.index',
    'Workflow Engine Test': 'view-workflows',
    
    // Import/Export
    'Tableau de bord Import/Export': 'admin.import-export.dashboard',
    'Importer Données': 'admin.import-export.import',
    'Exporter Données': 'admin.import-export.export',
    'Historique des Opérations': 'admin.import-export.history',
    'Gérer Templates': 'admin.import-export.templates',
};

const MENU_DATA: ModuleData[] = [
    {
        id: 'purch',
        label: 'Achats',
        icon: ShoppingCart,
        description: 'Manage procurement, orders, and receipts',
        requiredPermission: 'admin.procurement',
        requiredRole: 'procurement',
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
        requiredPermission: 'admin.sales',
        requiredRole: 'sales',
        categories: [
            { title: 'Devis', items: ['Saisie devis', 'Liste devis'] },
            { title: 'Commandes', items: ['Saisie commandes', 'Liste commandes'] },
            { title: 'Livraisons', items: ['Préparation', 'Validation'] },
            { title: 'Marketing', items: ['Promotions'] }
        ]
    },
    {
        id: 'stock',
        label: 'Stocks',
        icon: Package,
        description: 'Inventory, transfers, and stock counts',
        requiredPermission: 'admin.stock',
        requiredRole: 'stock',
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
        requiredPermission: 'admin.adv',
        requiredRole: 'adv',
        categories: [
            {
                title: 'Tableau de Bord',
                items: ['Tableau de bord ADV']
            },
            {
                title: 'Gestion Partenaires',
                items: ['Validation Partenaires', 'Liste Partenaires', 'Soldes Partenaires']
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
        requiredPermission: 'admin.dispatcher',
        requiredRole: 'dispatcher',
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
        requiredPermission: 'admin.warehouse',
        requiredRole: 'magasinier',
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
        requiredPermission: 'admin.master',
        requiredRole: 'master-data',
        categories: [
            { title: 'Articles', items: ['Gestion Produits', 'Articles', 'Articles-site', 'Unités'] },
            { title: 'Tiers', items: ['Clients', 'Fournisseurs', 'Transporteurs'] }
        ]
    },
    {
        id: 'admin',
        label: 'Administration',
        icon: Settings,
        description: 'User management, security, and global settings',
        requiredPermission: 'admin.view',
        categories: [
            { title: 'Utilisateurs', items: ['Utilisateurs', 'Rôles', 'Groupes'] },
            { title: 'Sécurité', items: ['Gouvernance', 'Audit'] },
            { title: 'Système', items: ['Monitoring', 'Paramètres Généraux'] }
        ]
    },
    {
        id: 'tasks',
        label: 'Tâches & Workflows',
        icon: ListTodo,
        description: 'Gestion des tâches et workflows - Suivi et exécution des processus métier',
        requiredPermission: 'admin.tasks',
        requiredRole: 'tasks',
        categories: [
            {
                title: 'Tableau de Bord',
                items: ['Tableau de bord Tâches']
            },
            {
                title: 'Mes Tâches',
                items: ['Tâches prêtes', 'Tâches en cours', 'Tâches terminées']
            },
            {
                title: 'Workflows',
                items: ['Progression workflows', 'Statistiques workflows']
            },
            {
                title: 'Administration',
                items: ['Templates de workflow', 'Gestion des workflows', 'Gestion des tâches']
            },
            {
                title: 'Test & Demo',
                items: ['Workflow Engine Test']
            }
        ]
    },
    {
        id: 'import-export',
        label: 'Import/Export',
        icon: Database,
        description: 'Gestion des imports et exports de données',
        requiredPermission: 'admin.import-export',
        requiredRole: 'import-export',
        categories: [
            {
                title: 'Tableau de Bord',
                items: ['Tableau de bord Import/Export']
            },
            {
                title: 'Opérations',
                items: ['Importer Données', 'Exporter Données']
            },
            {
                title: 'Gestion',
                items: ['Historique des Opérations', 'Gérer Templates']
            }
        ]
    }
];

interface MegaMenuProps {
    isOpen: boolean;
    onClose: () => void;
    initialSearchQuery?: string;
    onSearchQueryChange?: (query: string) => void;
    userId?: string;
    userPermissions?: string[];
    userRoles?: string[];
}

export const MegaMenu: React.FC<MegaMenuProps> = ({ isOpen, onClose, initialSearchQuery = '', onSearchQueryChange, userId, userPermissions = [], userRoles = [] }) => {
    const navigate = useNavigate();
    const [activeModuleId, setActiveModuleId] = useState<string>('purch');
    const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
    const [selectedIndex, setSelectedIndex] = useState<number>(0);
    const [recentItems, setRecentItems] = useState<string[]>([]);
    const [favoriteItems, setFavoriteItems] = useState<string[]>([]);
    const [showFavorites, setShowFavorites] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const resultsContainerRef = useRef<HTMLDivElement>(null);

    // Generate user-specific storage keys
    const getStorageKey = (type: 'favorites' | 'recent') => {
        const userPrefix = userId ? `user-${userId}` : 'guest';
        return `megamenu-${type}-${userPrefix}`;
    };

    // Check if user has permission
    const hasPermission = (permission?: string): boolean => {
        if (!permission) return true; // No permission required
        
        // Admin role has all permissions
        if (userRoles.includes('admin') || userRoles.includes('super-admin')) {
            return true;
        }
        
        // Check exact permission match
        if (userPermissions.includes(permission)) {
            return true;
        }
        
        // Check if user has wildcard permission that covers this permission
        // e.g., user has 'admin.adv.*' and we're checking 'admin.adv.dashboard'
        const permissionParts = permission.split('.');
        for (let i = permissionParts.length; i > 0; i--) {
            const wildcardPermission = permissionParts.slice(0, i).join('.') + '.*';
            if (userPermissions.includes(wildcardPermission)) {
                return true;
            }
        }
        
        // Check if user has any permission that starts with the required permission
        // e.g., module requires 'admin.adv' and user has 'admin.adv.dashboard'
        const hasMatchingPermission = userPermissions.some(userPerm => 
            userPerm.startsWith(permission + '.')
        );
        if (hasMatchingPermission) {
            return true;
        }
        
        return false;
    };

    // Filter modules based on permissions
    const filteredMenuData = useMemo(() => {
        return MENU_DATA.filter(module => {
            // Check if user has permission to view this module
            if (!hasPermission(module.requiredPermission)) {
                return false;
            }
            
            // Filter categories and items within the module
            const filteredCategories = module.categories
                .map(category => ({
                    ...category,
                    items: category.items.filter(item => {
                        const itemPermission = ITEM_PERMISSIONS[item];
                        return hasPermission(itemPermission);
                    })
                }))
                .filter(category => category.items.length > 0); // Remove empty categories
            
            // Only include module if it has at least one accessible category
            return filteredCategories.length > 0;
        }).map(module => ({
            ...module,
            categories: module.categories
                .map(category => ({
                    ...category,
                    items: category.items.filter(item => {
                        const itemPermission = ITEM_PERMISSIONS[item];
                        return hasPermission(itemPermission);
                    })
                }))
                .filter(category => category.items.length > 0)
        }));
    }, [userPermissions, userRoles]);

    // Sync search query with parent
    useEffect(() => {
        setSearchQuery(initialSearchQuery);
    }, [initialSearchQuery]);

    // Lock body scroll when menu is open and focus search
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            setTimeout(() => searchInputRef.current?.focus(), 100);
            // Load recent items from localStorage (user-specific)
            const recentKey = getStorageKey('recent');
            const stored = localStorage.getItem(recentKey);
            if (stored) {
                try {
                    setRecentItems(JSON.parse(stored));
                } catch (e) {
                    console.error('Failed to parse recent items', e);
                }
            }
            // Load favorites from localStorage (user-specific)
            const favoritesKey = getStorageKey('favorites');
            const storedFavorites = localStorage.getItem(favoritesKey);
            if (storedFavorites) {
                try {
                    setFavoriteItems(JSON.parse(storedFavorites));
                } catch (e) {
                    console.error('Failed to parse favorites', e);
                }
            }
        } else {
            document.body.style.overflow = 'unset';
            if (!onSearchQueryChange) {
                setSearchQuery('');
            }
            setSelectedIndex(0);
            setShowFavorites(false);
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen, onSearchQueryChange, userId]);

    // Set first accessible module as active if current active is not accessible
    useEffect(() => {
        if (filteredMenuData.length > 0) {
            const currentModuleAccessible = filteredMenuData.some(m => m.id === activeModuleId);
            if (!currentModuleAccessible) {
                setActiveModuleId(filteredMenuData[0].id);
            }
        }
    }, [filteredMenuData, activeModuleId]);

    const activeModule = filteredMenuData.find(m => m.id === activeModuleId);

    // Global search across all accessible modules
    const searchResults = useMemo<SearchResult[]>(() => {
        if (!searchQuery.trim()) return [];
        
        const query = searchQuery.toLowerCase();
        const results: SearchResult[] = [];
        
        filteredMenuData.forEach(module => {
            module.categories.forEach(category => {
                category.items.forEach(item => {
                    const itemLower = item.toLowerCase();
                    const categoryLower = category.title.toLowerCase();
                    const moduleLower = module.label.toLowerCase();
                    
                    if (itemLower.includes(query) || categoryLower.includes(query) || moduleLower.includes(query)) {
                        results.push({
                            moduleId: module.id,
                            moduleName: module.label,
                            categoryTitle: category.title,
                            itemName: item,
                            path: `${module.label} > ${category.title} > ${item}`
                        });
                    }
                });
            });
        });
        
        return results.slice(0, 50); // Limit to 50 results
    }, [searchQuery, filteredMenuData]);

    // Highlight matching text
    const highlightText = (text: string, query: string) => {
        if (!query.trim()) return text;
        
        const parts = text.split(new RegExp(`(${query})`, 'gi'));
        return (
            <>
                {parts.map((part, i) => 
                    part.toLowerCase() === query.toLowerCase() ? (
                        <mark key={i} className="bg-yellow-200 dark:bg-yellow-600/40 text-gray-900 dark:text-white font-semibold px-0.5 rounded">
                            {part}
                        </mark>
                    ) : (
                        <span key={i}>{part}</span>
                    )
                )}
            </>
        );
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            
            if (searchQuery && searchResults.length > 0) {
                switch (e.key) {
                    case 'ArrowDown':
                        e.preventDefault();
                        setSelectedIndex(prev => (prev + 1) % searchResults.length);
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        setSelectedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
                        break;
                    case 'Enter':
                        e.preventDefault();
                        if (searchResults[selectedIndex]) {
                            handleNavigation(searchResults[selectedIndex].itemName);
                        }
                        break;
                    case 'Escape':
                        e.preventDefault();
                        if (searchQuery) {
                            setSearchQuery('');
                            setSelectedIndex(0);
                        } else {
                            onClose();
                        }
                        break;
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, searchQuery, searchResults, selectedIndex, onClose]);

    // Auto-scroll selected item into view
    useEffect(() => {
        if (resultsContainerRef.current && searchResults.length > 0) {
            const selectedElement = resultsContainerRef.current.children[selectedIndex] as HTMLElement;
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [selectedIndex, searchResults]);

    // Reset selected index when search changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [searchQuery]);

    // Route Mapping Configuration
    const ROUTE_MAPPING: Record<string, string> = {
        // Achats (Procurement) Module Routes - Placeholder routes
        'Recherche tarifs': '/dashboard',
        'Saisie des tarifs': '/dashboard',
        'Planning global': '/dashboard',
        'Plan de travail': '/dashboard',
        'Plan de regroupement': '/dashboard',
        'Demandes d\'achat': '/dashboard',
        'Soldes demandes d\'achat': '/dashboard',
        'Demandes': '/dashboard',
        'Réponses': '/dashboard',
        'Relances': '/dashboard',
        'Commandes ouvertes': '/dashboard',
        'Signatures': '/dashboard',
        'Réceptions': '/dashboard',
        'Retours': '/dashboard',
        'Factures': '/dashboard',
        'Avoirs': '/dashboard',

        // Ventes (Sales) Module Routes
        'Saisie devis': '/dashboard',
        'Liste devis': '/dashboard',
        'Saisie commandes': '/orders',
        'Liste commandes': '/orders',
        'Préparation': '/magasinier/preparations',
        'Validation': '/adv/validation',
        'Promotions': '/promotions',

        // Stock Module Routes
        'Entrées diverses': '/dashboard',
        'Sorties diverses': '/dashboard',
        'Changements emplacement': '/dashboard',
        'Comptage': '/dashboard',

        // ADV Module Routes
        'Tableau de bord ADV': '/adv',
        'Validation Partenaires': '/adv/partners',
        'Liste Partenaires': '/adv/partners',
        'Soldes Partenaires': '/partners/balances',
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

        // Données de Base (Master Data) Module Routes
        'Gestion Produits': '/products',
        'Articles': '/products',
        'Articles-site': '/products',
        'Unités': '/dashboard',
        'Clients': '/partners',
        'Fournisseurs': '/dashboard',
        'Transporteurs': '/dashboard',
        'Tiers': '/partners',

        // Administration Module Routes
        'Utilisateurs': '/settings',
        'Rôles': '/settings',
        'Groupes': '/settings',
        'Gouvernance': '/settings',
        'Audit': '/settings',
        'Monitoring': '/admin/monitoring',
        'Paramètres Généraux': '/settings',

        // Tasks & Workflows Module Routes
        'Tableau de bord Tâches': '/tasks',
        'Tâches prêtes': '/tasks?status=ready',
        'Tâches en cours': '/tasks?status=in_progress',
        'Tâches terminées': '/tasks?status=completed',
        'Progression workflows': '/admin/monitoring',
        'Statistiques workflows': '/admin/monitoring',
        'Templates de workflow': '/workflows',
        'Gestion des workflows': '/workflows',
        'Gestion des tâches': '/admin/monitoring',
        'Workflow Engine Test': '/workflows/engine',

        // Import/Export Module Routes
        'Tableau de bord Import/Export': '/import-export',
        'Importer Données': '/import-export/import',
        'Exporter Données': '/import-export/export',
        'Historique des Opérations': '/import-export/batches',
        'Gérer Templates': '/import-export/templates',

        // Legacy/Compatibility Routes
        'Commandes': '/orders',
        'Tableau de bord': '/adv',
        'Partner Validation': '/adv/partners',
        'Credit Management': '/adv/credit',
        'BC Approval': '/adv/validation',

        // Default Fallback
        'default': '/dashboard'
    };


    const handleNavigation = (itemLabel: string) => {
        // Save to recent items (user-specific)
        const updated = [itemLabel, ...recentItems.filter(i => i !== itemLabel)].slice(0, 5);
        setRecentItems(updated);
        const recentKey = getStorageKey('recent');
        localStorage.setItem(recentKey, JSON.stringify(updated));
        
        onClose();
        const route = ROUTE_MAPPING[itemLabel] || ROUTE_MAPPING['default'];
        navigate(route);
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        if (onSearchQueryChange) {
            onSearchQueryChange(value);
        }
    };

    const toggleFavorite = (itemLabel: string) => {
        const isFavorite = favoriteItems.includes(itemLabel);
        const updated = isFavorite
            ? favoriteItems.filter(i => i !== itemLabel)
            : [...favoriteItems, itemLabel];
        setFavoriteItems(updated);
        const favoritesKey = getStorageKey('favorites');
        localStorage.setItem(favoritesKey, JSON.stringify(updated));
        
        // Dispatch custom event for real-time sync with header (include userId)
        window.dispatchEvent(new CustomEvent('favorites-updated', { detail: { userId } }));
    };

    const removeRecentItem = (itemLabel: string) => {
        const updated = recentItems.filter(i => i !== itemLabel);
        setRecentItems(updated);
        const recentKey = getStorageKey('recent');
        localStorage.setItem(recentKey, JSON.stringify(updated));
    };

    const clearAllRecent = () => {
        setRecentItems([]);
        const recentKey = getStorageKey('recent');
        localStorage.removeItem(recentKey);
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
                        className="fixed inset-x-0 top-14 mx-auto w-full bg-white dark:bg-[#0f1419] shadow-lg border-t border-gray-200 dark:border-gray-800 z-50 h-[85vh] flex flex-col"
                    >
                        {/* Global Search Header */}
                        <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0f1419] px-6 py-4">
                            <div className="max-w-2xl">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder="Search functions, modules, categories... (Press ESC to close)"
                                        className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500 transition-colors"
                                        value={searchQuery}
                                        onChange={(e) => handleSearchChange(e.target.value)}
                                    />
                                </div>
                                {searchQuery && (
                                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-4">
                                        <span>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found</span>
                                        <span className="flex items-center gap-1">
                                            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs">↑↓</kbd>
                                            Navigate
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-xs">Enter</kbd>
                                            Select
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-1 overflow-hidden">
                            {/* Left Sidebar: Modules */}
                            {!searchQuery && (
                                <div className="w-64 bg-gray-50 dark:bg-gray-900/50 border-r border-gray-200 dark:border-gray-800 flex flex-col">
                                    {/* Favorites & Recent Tabs */}
                                    <div className="border-b border-gray-200 dark:border-gray-800">
                                        <div className="flex items-center px-4 pt-3">
                                            <button
                                                onClick={() => setShowFavorites(false)}
                                                className={cn(
                                                    "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors",
                                                    !showFavorites
                                                        ? "text-sage-600 dark:text-sage-400 border-sage-600"
                                                        : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
                                                )}
                                            >
                                                <Clock className="w-3.5 h-3.5" />
                                                Recent
                                            </button>
                                            <button
                                                onClick={() => setShowFavorites(true)}
                                                className={cn(
                                                    "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors",
                                                    showFavorites
                                                        ? "text-sage-600 dark:text-sage-400 border-sage-600"
                                                        : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
                                                )}
                                            >
                                                <Star className="w-3.5 h-3.5" />
                                                Favorites ({favoriteItems.length})
                                            </button>
                                        </div>
                                        
                                        {/* Recent Items */}
                                        {!showFavorites && recentItems.length > 0 && (
                                            <div className="px-4 py-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">Last accessed</span>
                                                    <button
                                                        onClick={clearAllRecent}
                                                        className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                        Clear all
                                                    </button>
                                                </div>
                                                <div className="space-y-1">
                                                    {recentItems.slice(0, 5).map((item, idx) => (
                                                        <div key={idx} className="group flex items-center gap-1">
                                                            <button
                                                                onClick={() => handleNavigation(item)}
                                                                className="flex-1 text-left px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 rounded transition-colors truncate"
                                                            >
                                                                {item}
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    removeRecentItem(item);
                                                                }}
                                                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                                                                title="Remove"
                                                            >
                                                                <X className="w-3 h-3 text-gray-400 hover:text-red-600" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Favorites Items */}
                                        {showFavorites && (
                                            <div className="px-4 py-3">
                                                {favoriteItems.length === 0 ? (
                                                    <div className="text-center py-6 text-xs text-gray-500 dark:text-gray-400">
                                                        <Star className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                                                        No favorites yet
                                                        <p className="mt-1">Click the star icon on any item to add it</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1">
                                                        {favoriteItems.map((item, idx) => (
                                                            <div key={idx} className="group flex items-center gap-1">
                                                                <button
                                                                    onClick={() => handleNavigation(item)}
                                                                    className="flex-1 text-left px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 rounded transition-colors truncate"
                                                                >
                                                                    {item}
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleFavorite(item);
                                                                    }}
                                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-all"
                                                                    title="Remove from favorites"
                                                                >
                                                                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {!showFavorites && recentItems.length === 0 && (
                                            <div className="px-4 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
                                                <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                                                No recent items
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 overflow-y-auto py-2">
                                        {filteredMenuData.length > 0 ? (
                                            filteredMenuData.map((module) => {
                                                const Icon = module.icon;
                                                const isActive = activeModuleId === module.id;
                                                return (
                                                    <button
                                                        key={module.id}
                                                        onClick={() => setActiveModuleId(module.id)}
                                                        className={cn(
                                                            "w-full text-left px-5 py-3 flex items-center gap-3 transition-colors relative border-l-3 group",
                                                            isActive
                                                                ? "bg-white dark:bg-gray-800 border-sage-600 text-sage-700 dark:text-sage-400 font-semibold"
                                                                : "border-transparent text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200"
                                                        )}
                                                    >
                                                        <Icon className={cn("w-5 h-5", isActive ? "text-sage-600" : "text-gray-400")} />
                                                        <span className="text-sm flex-1">{module.label}</span>
                                                        {isActive && <ChevronRight className="w-4 h-4 text-sage-500" />}
                                                    </button>
                                                );
                                            })
                                        ) : (
                                            <div className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                                <Settings className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                                                <p className="font-medium">No modules available</p>
                                                <p className="text-xs mt-1">Contact your administrator for access</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Right Content: Search Results or Categories & Functions */}
                            <div className="flex-1 bg-white dark:bg-[#0f1419] overflow-y-auto">
                                {searchQuery && searchResults.length > 0 ? (
                                    /* Search Results View */
                                    <div className="p-6" ref={resultsContainerRef}>
                                        <div className="max-w-4xl mx-auto space-y-1.5">
                                            {searchResults.map((result, index) => {
                                                const isSelected = index === selectedIndex;
                                                return (
                                                    <button
                                                        key={index}
                                                        onClick={() => handleNavigation(result.itemName)}
                                                        className={cn(
                                                            "w-full text-left p-3 rounded border transition-colors group",
                                                            isSelected
                                                                ? "bg-sage-50 dark:bg-sage-900/20 border-sage-500"
                                                                : "bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-sage-400 dark:hover:border-sage-600"
                                                        )}
                                                    >
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                                                                    {highlightText(result.itemName, searchQuery)}
                                                                </div>
                                                                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                                                    <span className="font-medium text-sage-600 dark:text-sage-400">
                                                                        {highlightText(result.moduleName, searchQuery)}
                                                                    </span>
                                                                    <ChevronRight className="w-3 h-3" />
                                                                    <span>{highlightText(result.categoryTitle, searchQuery)}</span>
                                                                </div>
                                                            </div>
                                                            <ChevronRight className={cn(
                                                                "w-4 h-4 flex-shrink-0",
                                                                isSelected ? "text-sage-600" : "text-gray-400"
                                                            )} />
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : searchQuery && searchResults.length === 0 ? (
                                    /* No Results */
                                    <div className="flex items-center justify-center h-full">
                                        <div className="text-center">
                                            <Search className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No results found</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Try searching with different keywords</p>
                                        </div>
                                    </div>
                                ) : (
                                    /* Module Categories View */
                                    <div className="p-6">
                                        <AnimatePresence mode="wait">
                                            {activeModule && (
                                                <motion.div
                                                    key={activeModule.id}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    transition={{ duration: 0.15 }}
                                                >
                                                    <div className="mb-6 border-b border-gray-200 dark:border-gray-800 pb-4">
                                                        <h2 className="text-2xl font-normal text-gray-900 dark:text-white flex items-center gap-3">
                                                            <activeModule.icon className="w-6 h-6 text-sage-600 dark:text-sage-400" />
                                                            {activeModule.label}
                                                        </h2>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 ml-9">{activeModule.description}</p>
                                                    </div>

                                                    <div className="columns-1 md:columns-2 xl:columns-3 gap-6 space-y-6">
                                                        {activeModule.categories.map((category) => (
                                                            <div key={category.title} className="break-inside-avoid-column bg-gray-50 dark:bg-gray-800/30 rounded p-4 border border-gray-200 dark:border-gray-700">
                                                                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-xs uppercase tracking-wide mb-3 flex items-center gap-2">
                                                                    <div className="w-1 h-3 bg-sage-500" />
                                                                    {category.title}
                                                                </h3>
                                                                <ul className="space-y-0.5">
                                                                    {category.items.map((item) => {
                                                                        const isFavorite = favoriteItems.includes(item);
                                                                        return (
                                                                            <li key={item}>
                                                                                <div className="group/item flex items-center gap-1">
                                                                                    <button
                                                                                        onClick={() => handleNavigation(item)}
                                                                                        className="flex-1 text-left group flex items-center gap-2 px-2 py-2 rounded hover:bg-white dark:hover:bg-gray-700 transition-colors"
                                                                                    >
                                                                                        <ChevronRight className="w-3 h-3 text-gray-400 group-hover:text-sage-600 dark:group-hover:text-sage-400" />
                                                                                        <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-sage-700 dark:group-hover:text-sage-300">
                                                                                            {item}
                                                                                        </span>
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            toggleFavorite(item);
                                                                                        }}
                                                                                        className={cn(
                                                                                            "p-1 rounded transition-all",
                                                                                            isFavorite
                                                                                                ? "text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                                                                                                : "opacity-0 group-hover/item:opacity-100 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                                                                                        )}
                                                                                        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                                                                                    >
                                                                                        <Star className={cn("w-3 h-3", isFavorite && "fill-yellow-500")} />
                                                                                    </button>
                                                                                </div>
                                                                            </li>
                                                                        );
                                                                    })}
                                                                </ul>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer with shortcuts */}
                        <div className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-black/20 px-6 py-2.5">
                            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                <span className="flex items-center gap-1.5">
                                    <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded font-mono text-xs">ESC</kbd>
                                    Close menu
                                </span>
                                {searchQuery && (
                                    <span className="flex items-center gap-1.5">
                                        <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded font-mono text-xs">↑</kbd>
                                        <kbd className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded font-mono text-xs">↓</kbd>
                                        Navigate results
                                    </span>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
