import {
    ShoppingCart, Users, FileText, Truck, CreditCard, Tag, DollarSign,
    Package, ArrowLeftRight, Warehouse, ClipboardList, BarChart3,
    Map, Settings, Shield, Database, Landmark, BookOpen, LayoutList,
    PlusCircle, List, Clock, CheckCircle2, XCircle, TrendingUp,
    UserPlus, FilePlus, PackageCheck, Banknote, Route, Layers,
    Target, AlertTriangle, FileBarChart, Import, GitBranch,
    Building2, Calculator, Globe, Cog, FileSearch,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HubAction {
    id: string;
    label: string;
    route: string;
    icon: LucideIcon;
    permission?: string;
    badge?: string;
}

export interface HubProcess {
    id: string;
    label: string;
    description?: string;
    route: string;
    icon: LucideIcon;
    actions: HubAction[];
    permission?: string;
}

export interface BusinessDomain {
    id: string;
    label: string;
    description: string;
    icon: LucideIcon;
    color: DomainColor;
    processes: HubProcess[];
    permission?: string;
    requiredRole?: string[];
}

export type DomainColor = 'blue' | 'amber' | 'emerald' | 'orange' | 'violet' | 'indigo' | 'cyan' | 'slate' | 'rose';

export interface QuickAction {
    id: string;
    label: string;
    icon: LucideIcon;
    route: string;
    color: string;
    permission?: string;
}

export interface BusinessFlowStep {
    id: string;
    label: string;
    route: string;
    icon: LucideIcon;
    color: string;
}

export type HubRole = 'admin' | 'dispatcher' | 'magasinier' | 'finance' | 'management' | 'sales';

// ─── Business Domains (Level 1) ───────────────────────────────────────────────

export const BUSINESS_DOMAINS: BusinessDomain[] = [
    {
        id: 'commerce',
        label: 'Commerce',
        description: 'Clients, commandes, livraisons et paiements',
        icon: ShoppingCart,
        color: 'blue',
        processes: [
            {
                id: 'clients',
                label: 'Clients',
                description: 'Gestion du portefeuille client',
                route: '/partners',
                icon: Users,
                actions: [
                    { id: 'client-create', label: 'Nouveau Client', route: '/partners', icon: UserPlus },
                    { id: 'client-list', label: 'Liste des Clients', route: '/partners', icon: List },
                    { id: 'client-balances', label: 'Soldes Clients', route: '/partners/balances', icon: Calculator },
                ],
            },
            {
                id: 'commandes',
                label: 'Commandes',
                description: 'Saisie et suivi des commandes',
                route: '/orders',
                icon: ClipboardList,
                actions: [
                    { id: 'order-create', label: 'Nouvelle Commande', route: '/orders', icon: FilePlus },
                    { id: 'order-list', label: 'Toutes les Commandes', route: '/orders', icon: List },
                    { id: 'order-pending', label: 'En Attente Validation', route: '/adv/validation', icon: Clock },
                    { id: 'order-analytics', label: 'Analytics Commandes', route: '/reporting', icon: TrendingUp },
                ],
            },
            {
                id: 'livraisons',
                label: 'Livraisons',
                description: 'Bons de livraison et missions',
                route: '/dispatcher/bons-livraisons',
                icon: Truck,
                actions: [
                    { id: 'bl-list', label: 'Bons de Livraison', route: '/dispatcher/bons-livraisons', icon: FileText },
                    { id: 'missions', label: 'Missions de Livraison', route: '/dispatcher/workspace/missions', icon: Route },
                    { id: 'map', label: 'Carte Tournées', route: '/dispatcher/workspace/map', icon: Map },
                ],
                requiredRole: ['dispatcher', 'admin', 'root'],
            },
            {
                id: 'promotions',
                label: 'Promotions',
                description: 'Campagnes et offres commerciales',
                route: '/promotions',
                icon: Tag,
                actions: [
                    { id: 'promo-create', label: 'Nouvelle Promotion', route: '/promotions/new', icon: PlusCircle },
                    { id: 'promo-list', label: 'Toutes les Promotions', route: '/promotions', icon: List },
                    { id: 'promo-families', label: 'Familles Partenaires', route: '/promotions/partner-families', icon: Users },
                    { id: 'promo-boosts', label: 'Boosts Catalogue', route: '/promotions/boosts', icon: TrendingUp },
                ],
            },
            {
                id: 'tarification',
                label: 'Tarification',
                description: 'Listes de prix et canaux',
                route: '/pricing',
                icon: DollarSign,
                actions: [
                    { id: 'price-lists', label: 'Listes de Prix', route: '/pricing/price-lists', icon: LayoutList },
                    { id: 'price-channels', label: 'Canaux de Vente', route: '/pricing/channels', icon: Layers },
                    { id: 'price-overrides', label: 'Dérogations Tarif', route: '/pricing/overrides', icon: FileSearch },
                    { id: 'price-preview', label: 'Simulateur Prix', route: '/pricing/preview', icon: Calculator },
                ],
            },
        ],
    },
    {
        id: 'supply-chain',
        label: 'Supply Chain',
        description: 'Approvisionnement, réceptions et stocks',
        icon: Package,
        color: 'amber',
        processes: [
            {
                id: 'reception',
                label: 'Réceptions',
                description: 'Réception des marchandises fournisseurs',
                route: '/stock/preparation-bills',
                icon: PackageCheck,
                actions: [
                    { id: 'bp-list', label: 'Bons de Préparation', route: '/stock/preparation-bills', icon: ClipboardList },
                    { id: 'bp-create', label: 'Nouveau Bon', route: '/stock/preparation-bills', icon: FilePlus },
                ],
            },
            {
                id: 'stocks',
                label: 'Stocks',
                description: 'Consultation et gestion des stocks',
                route: '/stock/consultation',
                icon: Database,
                actions: [
                    { id: 'stock-consult', label: 'Consultation Stock', route: '/stock/consultation', icon: FileSearch },
                    { id: 'stock-alert', label: 'Alertes Stock', route: '/stock/consultation', icon: AlertTriangle },
                ],
            },
            {
                id: 'entrepots',
                label: 'Entrepôts',
                description: 'Gestion des entrepôts et emplacements',
                route: '/stock/warehouses',
                icon: Warehouse,
                actions: [
                    { id: 'wh-list', label: 'Liste Entrepôts', route: '/stock/warehouses', icon: List },
                    { id: 'wh-create', label: 'Nouvel Entrepôt', route: '/stock/warehouses', icon: PlusCircle },
                ],
            },
            {
                id: 'transferts',
                label: 'Transferts',
                description: 'Transferts inter-entrepôts',
                route: '/dispatcher/warehouse-transfers',
                icon: ArrowLeftRight,
                actions: [
                    { id: 'transfer-list', label: 'Transferts en Cours', route: '/dispatcher/warehouse-transfers', icon: List },
                ],
            },
            {
                id: 'import-export',
                label: 'Import / Export',
                description: 'Import et export de données',
                route: '/import-export',
                icon: Import,
                actions: [
                    { id: 'import', label: 'Importer des Données', route: '/import-export/import', icon: Import },
                    { id: 'export', label: 'Exporter des Données', route: '/import-export/export', icon: FileBarChart },
                    { id: 'batches', label: 'Historique Batches', route: '/import-export/batches', icon: Clock },
                ],
            },
        ],
    },
    {
        id: 'finance',
        label: 'Finance',
        description: 'Caisse, paiements, facturation et comptabilité',
        icon: Landmark,
        color: 'emerald',
        processes: [
            {
                id: 'caisse',
                label: 'Caisse & Journaux',
                description: 'Mouvements de caisse et journaux',
                route: '/finance/journals',
                icon: Banknote,
                actions: [
                    { id: 'journal-list', label: 'Journaux de Caisse', route: '/finance/journals', icon: BookOpen },
                ],
            },
            {
                id: 'paiements',
                label: 'Paiements',
                description: 'Règlements et virements',
                route: '/finance/transfers',
                icon: CreditCard,
                actions: [
                    { id: 'transfer-list', label: 'Virements', route: '/finance/transfers', icon: ArrowLeftRight },
                    { id: 'settlement-list', label: 'Règlements Tournée', route: '/finance/settlements', icon: CheckCircle2 },
                ],
            },
            {
                id: 'comptabilite',
                label: 'Comptabilité',
                description: 'Grand livre et export Sage X3',
                route: '/finance/ledger',
                icon: FileText,
                actions: [
                    { id: 'ledger', label: 'Grand Livre', route: '/finance/ledger', icon: BookOpen },
                ],
            },
            {
                id: 'credit-adv',
                label: 'Crédit & ADV',
                description: 'Limites de crédit et dérogations',
                route: '/adv/credit',
                icon: Shield,
                actions: [
                    { id: 'credit-list', label: 'Gestion du Crédit', route: '/adv/credit', icon: Shield },
                    { id: 'derogations', label: 'Dérogations', route: '/adv/derogations', icon: AlertTriangle },
                    { id: 'echeances', label: 'Échéances', route: '/adv/echeances', icon: Clock },
                ],
            },
        ],
    },
    {
        id: 'entrepot',
        label: 'Entrepôt',
        description: 'Préparations, picking et gestion magasin',
        icon: Warehouse,
        color: 'orange',
        requiredRole: ['magasinier', 'dispatcher', 'admin', 'root'],
        processes: [
            {
                id: 'preparations',
                label: 'Préparations',
                description: 'Bons de préparation et picking',
                route: '/magasinier/preparations',
                icon: ClipboardList,
                actions: [
                    { id: 'prep-list', label: 'Mes Préparations', route: '/magasinier/preparations', icon: List },
                    { id: 'batch-picking', label: 'Picking par Lots', route: '/magasinier/batch-picking', icon: Layers },
                ],
            },
            {
                id: 'stock-magasinier',
                label: 'Stock Magasin',
                description: 'Consultation et mouvements de stock',
                route: '/magasinier/stock',
                icon: Package,
                actions: [
                    { id: 'stock-view', label: 'Voir le Stock', route: '/magasinier/stock', icon: Database },
                    { id: 'stock-consult2', label: 'Consultation Stock', route: '/stock/consultation', icon: FileSearch },
                ],
            },
            {
                id: 'decharges',
                label: 'Décharges',
                description: 'Réceptions et décharges',
                route: '/dispatcher/decharges',
                icon: PackageCheck,
                actions: [
                    { id: 'decharge-list', label: 'Liste des Décharges', route: '/dispatcher/decharges', icon: List },
                ],
            },
        ],
    },
    {
        id: 'crm',
        label: 'CRM & ADV',
        description: 'Relation client, validation et crédit',
        icon: Users,
        color: 'violet',
        processes: [
            {
                id: 'adv-dashboard',
                label: 'Tableau de Bord ADV',
                description: 'Vue d\'ensemble ADV',
                route: '/adv',
                icon: BarChart3,
                actions: [
                    { id: 'adv-home', label: 'Dashboard ADV', route: '/adv', icon: BarChart3 },
                ],
            },
            {
                id: 'validation-bc',
                label: 'Validation BC',
                description: 'Validation des bons de commande',
                route: '/adv/validation',
                icon: CheckCircle2,
                actions: [
                    { id: 'bc-pending', label: 'BCs en Attente', route: '/adv/validation', icon: Clock },
                    { id: 'bc-validate', label: 'Valider un BC', route: '/adv/validation', icon: CheckCircle2 },
                ],
            },
            {
                id: 'partenaires-adv',
                label: 'Partenaires ADV',
                description: 'Validation et gestion des partenaires',
                route: '/adv/partners',
                icon: Users,
                actions: [
                    { id: 'partner-validate', label: 'Partenaires à Valider', route: '/adv/partners', icon: CheckCircle2 },
                ],
            },
        ],
    },
    {
        id: 'analytics',
        label: 'Analytics',
        description: 'Rapports, KPIs et tableaux de bord',
        icon: BarChart3,
        color: 'indigo',
        processes: [
            {
                id: 'reporting',
                label: 'Reporting',
                description: 'Rapports et exports',
                route: '/reporting',
                icon: FileBarChart,
                actions: [
                    { id: 'reports-list', label: 'Tous les Rapports', route: '/reporting', icon: List },
                    { id: 'reports-admin', label: 'Admin Reporting', route: '/reporting/admin', icon: Cog },
                ],
            },
            {
                id: 'documents',
                label: 'Document Studio',
                description: 'Modèles et templates de documents',
                route: '/document-studio',
                icon: FileText,
                actions: [
                    { id: 'doc-studio', label: 'Document Studio', route: '/document-studio', icon: FileText },
                ],
            },
            {
                id: 'produits',
                label: 'Catalogue Produits',
                description: 'Produits et données de base',
                route: '/products',
                icon: Package,
                actions: [
                    { id: 'product-list', label: 'Catalogue Produits', route: '/products', icon: List },
                    { id: 'product-master', label: 'Données de Base', route: '/products/master-data', icon: Database },
                ],
            },
        ],
    },
    {
        id: 'routing',
        label: 'Tournées',
        description: 'Itinéraires, zones géographiques et planification',
        icon: Route,
        color: 'cyan',
        requiredRole: ['routing', 'admin', 'root', 'dispatcher'],
        processes: [
            {
                id: 'itineraires',
                label: 'Itinéraires',
                description: 'Gestion des tournées de visite',
                route: '/routing/itineraries',
                icon: Route,
                actions: [
                    { id: 'itinerary-list', label: 'Toutes les Tournées', route: '/routing/itineraries', icon: List },
                    { id: 'itinerary-designer', label: 'Designer Tournée', route: '/routing/designer', icon: Map },
                    { id: 'planning', label: 'Planification', route: '/routing/planning', icon: Clock },
                ],
            },
            {
                id: 'zones',
                label: 'Zones Géographiques',
                description: 'Gouvernance et découpage géographique',
                route: '/routing/geo-areas',
                icon: Globe,
                actions: [
                    { id: 'geo-areas', label: 'Zones Géo', route: '/routing/geo-areas', icon: Map },
                    { id: 'geo-governance', label: 'Gouvernance Géo', route: '/routing/geo-governance', icon: Globe },
                    { id: 'itinerary-types', label: 'Types de Tournée', route: '/routing/itinerary-types', icon: LayoutList },
                    { id: 'business-natures', label: 'Natures Métier', route: '/routing/business-natures', icon: Building2 },
                ],
            },
            {
                id: 'fleet',
                label: 'Flotte & Livreurs',
                description: 'Véhicules et agents de livraison',
                route: '/dispatcher/fleet',
                icon: Truck,
                actions: [
                    { id: 'fleet-list', label: 'Flotte Véhicules', route: '/dispatcher/fleet', icon: Truck },
                    { id: 'mission-planning', label: 'Planning Missions', route: '/dispatcher/mission-planning', icon: ClipboardList },
                ],
            },
        ],
    },
    {
        id: 'administration',
        label: 'Administration',
        description: 'Droits d\'accès, paramètres et configuration',
        icon: Settings,
        color: 'slate',
        processes: [
            {
                id: 'rbac',
                label: 'Droits & Accès',
                description: 'Rôles, permissions et utilisateurs',
                route: '/rbac/roles',
                icon: Shield,
                actions: [
                    { id: 'roles', label: 'Rôles', route: '/rbac/roles', icon: Shield },
                    { id: 'permissions-matrix', label: 'Matrice Permissions', route: '/rbac/matrix', icon: LayoutList },
                    { id: 'users-access', label: 'Accès Utilisateurs', route: '/rbac/users', icon: Users },
                    { id: 'access-profiles', label: 'Profils d\'Accès', route: '/rbac/access-profiles', icon: Layers },
                ],
            },
            {
                id: 'settings',
                label: 'Paramètres',
                description: 'Configuration système',
                route: '/settings',
                icon: Cog,
                actions: [
                    { id: 'general-settings', label: 'Paramètres Généraux', route: '/settings', icon: Cog },
                    { id: 'config-settings', label: 'Configuration', route: '/settings/configuration', icon: Database },
                ],
            },
            {
                id: 'donnees-base',
                label: 'Données de Base',
                description: 'Référentiels et champs personnalisés',
                route: '/custom-fields',
                icon: Database,
                actions: [
                    { id: 'custom-fields', label: 'Champs Personnalisés', route: '/custom-fields', icon: GitBranch },
                    { id: 'token-series', label: 'Séries de Tokens', route: '/token-series', icon: Target },
                    { id: 'device-keys', label: 'Clés Appareils', route: '/device-keys', icon: Shield },
                    { id: 'translations', label: 'Traductions', route: '/translations', icon: Globe },
                    { id: 'data-rules', label: 'Règles Données', route: '/data-rules', icon: Cog },
                ],
            },
            {
                id: 'workflows-admin',
                label: 'Workflows',
                description: 'Moteur de workflows et règles',
                route: '/workflows',
                icon: GitBranch,
                actions: [
                    { id: 'workflow-list', label: 'Templates Workflow', route: '/workflows', icon: List },
                    { id: 'workflow-create', label: 'Créer un Workflow', route: '/workflows/create', icon: PlusCircle },
                ],
            },
        ],
    },
];

// ─── Quick Actions by Role ─────────────────────────────────────────────────────

export const QUICK_ACTIONS_BY_ROLE: Record<HubRole, QuickAction[]> = {
    management: [
        { id: 'new-client', label: 'Nouveau Client', icon: UserPlus, route: '/partners', color: 'bg-blue-500' },
        { id: 'new-order', label: 'Nouvelle Commande', icon: FilePlus, route: '/orders', color: 'bg-sage-600' },
        { id: 'receive-goods', label: 'Réception Marchandises', icon: PackageCheck, route: '/stock/preparation-bills', color: 'bg-amber-500' },
        { id: 'new-payment', label: 'Nouveau Paiement', icon: Banknote, route: '/finance/journals', color: 'bg-emerald-600' },
        { id: 'stock-transfer', label: 'Transfert Stock', icon: ArrowLeftRight, route: '/dispatcher/warehouse-transfers', color: 'bg-orange-500' },
        { id: 'view-reports', label: 'Mes Rapports', icon: BarChart3, route: '/reporting', color: 'bg-indigo-500' },
    ],
    admin: [
        { id: 'new-client', label: 'Nouveau Client', icon: UserPlus, route: '/partners', color: 'bg-blue-500' },
        { id: 'users-access', label: 'Gérer les Accès', icon: Shield, route: '/rbac/users', color: 'bg-red-500' },
        { id: 'new-order', label: 'Nouvelle Commande', icon: FilePlus, route: '/orders', color: 'bg-sage-600' },
        { id: 'receive-goods', label: 'Réception Marchandises', icon: PackageCheck, route: '/stock/preparation-bills', color: 'bg-amber-500' },
        { id: 'view-reports', label: 'Analytics', icon: BarChart3, route: '/reporting', color: 'bg-indigo-500' },
        { id: 'settings', label: 'Paramètres', icon: Cog, route: '/settings', color: 'bg-slate-500' },
    ],
    dispatcher: [
        { id: 'pending-orders', label: 'Commandes en Attente', icon: Clock, route: '/dispatcher/orders', color: 'bg-amber-500' },
        { id: 'bl-list', label: 'Bons de Livraison', icon: FileText, route: '/dispatcher/bons-livraisons', color: 'bg-blue-500' },
        { id: 'missions', label: 'Espace Missions', icon: Route, route: '/dispatcher/workspace/missions', color: 'bg-sage-600' },
        { id: 'map', label: 'Carte en Direct', icon: Map, route: '/dispatcher/workspace/map', color: 'bg-emerald-600' },
        { id: 'fleet', label: 'Flotte & Livreurs', icon: Truck, route: '/dispatcher/fleet', color: 'bg-indigo-500' },
        { id: 'shortage', label: 'File Pénuries', icon: AlertTriangle, route: '/dispatcher/shortage-queue', color: 'bg-red-500' },
    ],
    magasinier: [
        { id: 'preparations', label: 'Mes Préparations', icon: ClipboardList, route: '/magasinier/preparations', color: 'bg-orange-500' },
        { id: 'batch-picking', label: 'Picking par Lots', icon: Layers, route: '/magasinier/batch-picking', color: 'bg-amber-500' },
        { id: 'stock-view', label: 'Consultation Stock', icon: Package, route: '/magasinier/stock', color: 'bg-sage-600' },
        { id: 'transfers', label: 'Transferts', icon: ArrowLeftRight, route: '/dispatcher/warehouse-transfers', color: 'bg-blue-500' },
        { id: 'stock-consult', label: 'Stock Global', icon: Database, route: '/stock/consultation', color: 'bg-indigo-500' },
        { id: 'prep-bills', label: 'Bons de Prép.', icon: FileText, route: '/stock/preparation-bills', color: 'bg-emerald-600' },
    ],
    finance: [
        { id: 'bc-pending', label: 'BCs en Attente', icon: Clock, route: '/adv/validation', color: 'bg-amber-500' },
        { id: 'credit-manage', label: 'Gestion Crédit', icon: Shield, route: '/adv/credit', color: 'bg-red-500' },
        { id: 'derogations', label: 'Dérogations', icon: AlertTriangle, route: '/adv/derogations', color: 'bg-orange-500' },
        { id: 'echeances', label: 'Échéances', icon: CreditCard, route: '/adv/echeances', color: 'bg-blue-500' },
        { id: 'journals', label: 'Journaux Caisse', icon: Banknote, route: '/finance/journals', color: 'bg-emerald-600' },
        { id: 'ledger', label: 'Grand Livre', icon: BookOpen, route: '/finance/ledger', color: 'bg-indigo-500' },
    ],
    sales: [
        { id: 'new-order', label: 'Nouvelle Commande', icon: FilePlus, route: '/orders', color: 'bg-sage-600' },
        { id: 'new-client', label: 'Nouveau Client', icon: UserPlus, route: '/partners', color: 'bg-blue-500' },
        { id: 'client-list', label: 'Mes Clients', icon: Users, route: '/partners', color: 'bg-indigo-500' },
        { id: 'promotions', label: 'Promotions', icon: Tag, route: '/promotions', color: 'bg-violet-500' },
        { id: 'price-check', label: 'Vérifier un Prix', icon: Calculator, route: '/pricing/preview', color: 'bg-amber-500' },
        { id: 'reports', label: 'Mes Résultats', icon: TrendingUp, route: '/reporting', color: 'bg-emerald-600' },
    ],
};

// ─── Business Flow ─────────────────────────────────────────────────────────────

export const BUSINESS_FLOW: BusinessFlowStep[] = [
    { id: 'lead', label: 'Lead', route: '/partners', icon: Target, color: 'text-gray-500 bg-gray-100' },
    { id: 'client', label: 'Client', route: '/partners', icon: Users, color: 'text-blue-600 bg-blue-50' },
    { id: 'devis', label: 'Devis', route: '/orders', icon: FileText, color: 'text-violet-600 bg-violet-50' },
    { id: 'commande', label: 'Commande', route: '/orders', icon: ClipboardList, color: 'text-sage-700 bg-sage-50' },
    { id: 'picking', label: 'Picking', route: '/magasinier/preparations', icon: Package, color: 'text-orange-600 bg-orange-50' },
    { id: 'livraison', label: 'Livraison', route: '/dispatcher/bons-livraisons', icon: Truck, color: 'text-amber-700 bg-amber-50' },
    { id: 'facture', label: 'Facture', route: '/finance/journals', icon: FileText, color: 'text-indigo-600 bg-indigo-50' },
    { id: 'paiement', label: 'Paiement', route: '/finance/transfers', icon: CreditCard, color: 'text-emerald-700 bg-emerald-50' },
    { id: 'sav', label: 'SAV', route: '/partners', icon: CheckCircle2, color: 'text-teal-600 bg-teal-50' },
];

// ─── Domain color helpers ──────────────────────────────────────────────────────

export const DOMAIN_COLOR_MAP: Record<DomainColor, { bg: string; text: string; border: string; iconBg: string; badge: string }> = {
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    iconBg: 'bg-blue-100',    badge: 'bg-blue-500' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   iconBg: 'bg-amber-100',   badge: 'bg-amber-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', iconBg: 'bg-emerald-100', badge: 'bg-emerald-500' },
    orange:  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  iconBg: 'bg-orange-100',  badge: 'bg-orange-500' },
    violet:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  iconBg: 'bg-violet-100',  badge: 'bg-violet-500' },
    indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200',  iconBg: 'bg-indigo-100',  badge: 'bg-indigo-500' },
    cyan:    { bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200',    iconBg: 'bg-cyan-100',    badge: 'bg-cyan-500' },
    slate:   { bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-200',   iconBg: 'bg-slate-100',   badge: 'bg-slate-500' },
    rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    iconBg: 'bg-rose-100',    badge: 'bg-rose-500' },
};
