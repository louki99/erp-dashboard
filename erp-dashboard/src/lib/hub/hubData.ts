import {
    Users, FileText, Truck, CreditCard, Tag, DollarSign,
    Package, ArrowLeftRight, Warehouse, ClipboardList, BarChart3,
    Map, Settings, Shield, Database, BookOpen, LayoutList,
    List, Clock, CheckCircle2, TrendingUp,
    UserPlus, FilePlus, PackageCheck, Banknote, Route, Layers,
    Target, AlertTriangle, Import, GitBranch,
    Calculator, Globe, Cog, FileSearch, RotateCcw, ScanLine,
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

// ─── Role-Based Workspaces ────────────────────────────────────────────────────
// 4 "étanches" workspaces, one per business profile.
// Admins bypass requiredRole and see all 4.

export const BUSINESS_DOMAINS: BusinessDomain[] = [
    // ─────────────────────────────────────────────────────────────────────────
    // 1. DISPATCHER — Logistique & Distribution
    // ─────────────────────────────────────────────────────────────────────────
    {
        id: 'dispatcher',
        label: 'Dispatcher',
        description: 'Logistique, distribution et gestion des tournées',
        icon: Truck,
        color: 'blue',
        requiredRole: ['dispatcher', 'admin', 'root'],
        processes: [
            {
                id: 'clients-logistiques',
                label: 'Clients Logistiques',
                description: 'Fiche livraison à plat — adresses, GPS et instructions de dépôt',
                route: '/partners',
                icon: Users,
                actions: [
                    { id: 'client-list',  label: 'Liste Clients',   route: '/partners',           icon: List  },
                    { id: 'client-map',   label: 'Carte GPS',       route: '/routing/geo-areas',  icon: Map   },
                    { id: 'geo-areas',    label: 'Zones Géo',       route: '/routing/geo-areas',  icon: Globe },
                ],
            },
            {
                id: 'tournees',
                label: 'Gestion des Tournées',
                description: 'Routage, fréquences et séquençage des visites clients',
                route: '/routing/itineraries',
                icon: Route,
                actions: [
                    { id: 'itinerary-list',     label: 'Toutes les Tournées', route: '/routing/itineraries',     icon: List      },
                    { id: 'itinerary-designer', label: 'Designer Tournée',    route: '/routing/designer',        icon: Map       },
                    { id: 'planning',           label: 'Planification',       route: '/routing/planning',        icon: Clock     },
                    { id: 'itinerary-types',    label: 'Types de Tournée',    route: '/routing/itinerary-types', icon: LayoutList},
                ],
            },
            {
                id: 'expeditions',
                label: 'Expéditions & Dispatch',
                description: 'Transformation BC → BL et répartition par camion',
                route: '/dispatcher/bons-livraisons',
                icon: PackageCheck,
                actions: [
                    { id: 'bl-list',   label: 'Bons de Livraison', route: '/dispatcher/bons-livraisons',       icon: FileText     },
                    { id: 'missions',  label: 'Espace Missions',   route: '/dispatcher/workspace/missions',    icon: Target       },
                    { id: 'map-live',  label: 'Carte en Direct',   route: '/dispatcher/workspace/map',         icon: Map          },
                    { id: 'fleet',     label: 'Flotte & Livreurs', route: '/dispatcher/fleet',                 icon: Truck        },
                    { id: 'shortage',  label: 'File Pénuries',     route: '/dispatcher/shortage-queue',        icon: AlertTriangle},
                ],
            },
            {
                id: 'stock-dispatch',
                label: 'Consultation Stock',
                description: 'Stock disponible à la vente par dépôt — vue temps réel',
                route: '/stock/consultation',
                icon: Database,
                actions: [
                    { id: 'stock-consult', label: 'Stock par Dépôt',       route: '/stock/consultation',             icon: FileSearch   },
                    { id: 'stock-alert',   label: 'Alertes Rupture',       route: '/stock/consultation',             icon: AlertTriangle},
                    { id: 'transfers',     label: 'Transferts Inter-Dépôts', route: '/dispatcher/warehouse-transfers', icon: ArrowLeftRight},
                ],
            },
        ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 2. ADV — Administration Des Ventes
    // ─────────────────────────────────────────────────────────────────────────
    {
        id: 'adv',
        label: 'ADV',
        description: 'Administration des ventes, crédit et tarification',
        icon: BarChart3,
        color: 'violet',
        requiredRole: ['adv', 'management', 'admin', 'root'],
        processes: [
            {
                id: 'crm-clients',
                label: 'Gestion Clients (CRM 360°)',
                description: 'Fiche client complète — identité, canaux, chronologies et tags',
                route: '/partners',
                icon: Users,
                actions: [
                    { id: 'client-create',   label: 'Nouveau Client',   route: '/partners',         icon: UserPlus  },
                    { id: 'client-list',     label: 'Liste des Clients', route: '/partners',         icon: List      },
                    { id: 'client-balances', label: 'Balances Clients',  route: '/partners/balances',icon: Calculator},
                    { id: 'adv-partners',    label: 'Partenaires ADV',   route: '/adv/partners',     icon: CheckCircle2},
                ],
            },
            {
                id: 'credit-control',
                label: 'Contrôle Financier & Crédit',
                description: 'Limites de crédit, balances d\'encours et timeline d\'audit',
                route: '/adv/credit',
                icon: Shield,
                actions: [
                    { id: 'credit-list',    label: 'Gestion du Crédit',   route: '/adv/credit',     icon: Shield    },
                    { id: 'echeances',      label: 'Échéances',           route: '/adv/echeances',  icon: Clock     },
                    { id: 'adv-dashboard',  label: 'Tableau de Bord ADV', route: '/adv',            icon: BarChart3 },
                ],
            },
            {
                id: 'derogations',
                label: 'Validation Dérogations',
                description: 'Approbation des requêtes de paiement (payment-overrides)',
                route: '/adv/derogations',
                icon: AlertTriangle,
                actions: [
                    { id: 'derogations-pending', label: 'Dérogations en Attente', route: '/adv/derogations', icon: Clock    },
                    { id: 'derogations-history', label: 'Historique',             route: '/adv/derogations', icon: FileText },
                ],
            },
            {
                id: 'commandes',
                label: 'Suivi des Commandes',
                description: 'Flux global de validation des bons de commande v5',
                route: '/orders',
                icon: ClipboardList,
                actions: [
                    { id: 'order-create', label: 'Nouvelle Commande',   route: '/orders',         icon: FilePlus    },
                    { id: 'order-list',   label: 'Toutes les Commandes', route: '/orders',         icon: List        },
                    { id: 'bc-pending',   label: 'BCs en Attente',       route: '/adv/validation', icon: Clock       },
                    { id: 'bc-validate',  label: 'Valider un BC',        route: '/adv/validation', icon: CheckCircle2},
                ],
            },
            {
                id: 'pricing',
                label: 'Tarification & Pricing',
                description: 'Listes de prix, grilles de paliers et exceptions tarifaires',
                route: '/pricing/price-lists',
                icon: DollarSign,
                actions: [
                    { id: 'price-lists',     label: 'Listes de Prix',    route: '/pricing/price-lists', icon: LayoutList},
                    { id: 'price-channels',  label: 'Canaux de Vente',   route: '/pricing/channels',    icon: Layers    },
                    { id: 'price-overrides', label: 'Dérogations Tarif', route: '/pricing/overrides',   icon: FileSearch},
                    { id: 'price-preview',   label: 'Simulateur Prix',   route: '/pricing/preview',     icon: Calculator},
                    { id: 'promotions',      label: 'Promotions',        route: '/promotions',          icon: Tag       },
                ],
            },
        ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 3. MAGASINIER — WMS / Entrepôt
    // ─────────────────────────────────────────────────────────────────────────
    {
        id: 'magasinier',
        label: 'Magasinier',
        description: 'Opérations WMS et gestion physique du dépôt',
        icon: Warehouse,
        color: 'amber',
        requiredRole: ['magasinier', 'admin', 'root'],
        processes: [
            {
                id: 'receptions',
                label: 'Réception Marchandises',
                description: 'Entrées de stock, saisie obligatoire des lots et DLUO',
                route: '/stock/preparation-bills',
                icon: PackageCheck,
                actions: [
                    { id: 'bp-list',    label: 'Bons de Préparation', route: '/stock/preparation-bills', icon: ClipboardList},
                    { id: 'bp-create',  label: 'Nouveau Bon',          route: '/stock/preparation-bills', icon: FilePlus     },
                    { id: 'warehouses', label: 'Entrepôts',            route: '/stock/warehouses',        icon: Warehouse    },
                ],
            },
            {
                id: 'pick-tasks',
                label: 'Tâches de Collecte (Pick Tasks)',
                description: 'Feuilles de picking quotidiennes par chemin d\'emplacement',
                route: '/stock/wms-pick-pack',
                icon: ClipboardList,
                actions: [
                    { id: 'wms-pick-pack', label: 'Console Pick & Pack', route: '/stock/wms-pick-pack',         icon: CheckCircle2},
                    { id: 'prep-list',     label: 'Mes Préparations',    route: '/magasinier/preparations',     icon: List        },
                    { id: 'batch-picking', label: 'Picking par Lots',    route: '/magasinier/batch-picking',    icon: Layers      },
                ],
            },
            {
                id: 'mouvements',
                label: 'Mouvements & Transferts',
                description: 'Transferts inter-entrepôts et relocalisations bac à bac',
                route: '/dispatcher/warehouse-transfers',
                icon: ArrowLeftRight,
                actions: [
                    { id: 'transfer-list', label: 'Transferts en Cours', route: '/dispatcher/warehouse-transfers', icon: List        },
                    { id: 'stock-view',    label: 'Voir le Stock',       route: '/magasinier/stock',               icon: Package     },
                    { id: 'decharges',     label: 'Décharges',           route: '/dispatcher/decharges',           icon: PackageCheck},
                ],
            },
            {
                id: 'inventaires',
                label: 'Ajustements & Inventaires',
                description: 'Écarts de stock physiques et logs d\'ajustement',
                route: '/stock/consultation',
                icon: Calculator,
                actions: [
                    { id: 'stock-consult',  label: 'Consultation Stock', route: '/stock/consultation', icon: FileSearch},
                    { id: 'stock-global',   label: 'Stock Global',       route: '/stock/consultation', icon: Database  },
                    { id: 'import-export',  label: 'Import / Export',    route: '/import-export',      icon: Import    },
                ],
            },
            {
                id: 'wms-logistique',
                label: 'WMS — Logistique Avancée',
                description: 'Matrice stocks Tier 2, Pick & Pack optimisé, lots et actions d\'entrepôt',
                route: '/stock/wms-matrix',
                icon: Database,
                actions: [
                    { id: 'wms-matrix',      label: 'Matrice des Stocks',  route: '/stock/wms-matrix',      icon: Database      },
                    { id: 'wms-pick',        label: 'Console Pick & Pack', route: '/stock/wms-pick-pack',   icon: ClipboardList },
                    { id: 'wms-batches',     label: 'Lots & Péremption',   route: '/stock/wms-batches',     icon: AlertTriangle },
                    { id: 'wms-receipt',     label: 'Nouvelle Réception',  route: '/stock/wms-receipt',     icon: PackageCheck  },
                    { id: 'wms-transfer',    label: 'Bon de Transfert',    route: '/stock/wms-transfer',    icon: ArrowLeftRight},
                    { id: 'wms-adjustment',  label: 'Ajustement Manuel',   route: '/stock/wms-adjustment',  icon: Calculator    },
                ],
            },
            {
                id: 'conventional-loading',
                label: 'Chargement Conventionnel',
                description: 'Préparer les demandes de chargement SFA et émettre les QR de confirmation',
                route: '/magasinier/conventional-loading',
                icon: Truck,
                actions: [
                    { id: 'conv-loading-list',    label: 'Demandes à préparer', route: '/magasinier/conventional-loading', icon: Package  },
                    { id: 'conv-loading-history', label: 'Historique chargements', route: '/magasinier/conventional-loading', icon: List  },
                ],
            },
            {
                id: 'decharge-reconciliation',
                label: 'Réconciliation Décharge EOD',
                description: 'Fin de journée VAN → Dépôt : scan QR, décompte physique, approbation',
                route: '/magasinier/decharge-reconciliation',
                icon: ScanLine,
                actions: [
                    { id: 'drr-confirm',  label: 'Nouvelle réconciliation', route: '/magasinier/decharge-reconciliation', icon: ScanLine     },
                    { id: 'drr-approve',  label: 'Approuver retour stock',  route: '/magasinier/decharge-reconciliation', icon: CheckCircle2 },
                ],
            },
            {
                id: 'decharges-magasinier',
                label: 'Décharges Van → Dépôt',
                description: 'Libérer le stock des marchandises non livrées retournées par le livreur',
                route: '/magasinier/decharges',
                icon: PackageCheck,
                actions: [
                    { id: 'decharge-pending', label: 'Décharges en attente', route: '/magasinier/decharges', icon: Clock        },
                    { id: 'decharge-approve', label: 'Approuver décharge',   route: '/magasinier/decharges', icon: CheckCircle2 },
                ],
            },
            {
                id: 'returns-magasinier',
                label: 'Retours Partenaires',
                description: 'Réceptionner et clôturer les retours collectés par le livreur',
                route: '/magasinier/returns',
                icon: RotateCcw,
                actions: [
                    { id: 'returns-collected', label: 'Retours à réceptionner', route: '/magasinier/returns', icon: Package    },
                    { id: 'returns-close',     label: 'Clôturer un retour',     route: '/magasinier/returns', icon: CheckCircle2 },
                ],
            },
        ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 4. ADMINISTRATION — Système & Configuration
    // ─────────────────────────────────────────────────────────────────────────
    {
        id: 'administration',
        label: 'Administration',
        description: 'Configuration système et gestion de la plateforme',
        icon: Settings,
        color: 'slate',
        requiredRole: ['admin', 'root'],
        processes: [
            {
                id: 'rbac',
                label: 'Gestion Utilisateurs & RBAC',
                description: 'Rôles, permissions et profils d\'accès',
                route: '/rbac/roles',
                icon: Shield,
                actions: [
                    { id: 'roles',               label: 'Rôles',               route: '/rbac/roles',          icon: Shield    },
                    { id: 'permissions-matrix',  label: 'Matrice Permissions', route: '/rbac/matrix',         icon: LayoutList},
                    { id: 'users-access',        label: 'Accès Utilisateurs',  route: '/rbac/users',          icon: Users     },
                    { id: 'access-profiles',     label: 'Profils d\'Accès',    route: '/rbac/access-profiles',icon: Layers    },
                ],
            },
            {
                id: 'parametres',
                label: 'Paramètres Système',
                description: 'Configurations globales et variables d\'environnement',
                route: '/settings',
                icon: Cog,
                actions: [
                    { id: 'general-settings', label: 'Paramètres Généraux',  route: '/settings',               icon: Cog      },
                    { id: 'config-settings',  label: 'Configuration',         route: '/settings/configuration', icon: Database },
                    { id: 'custom-fields',    label: 'Champs Personnalisés',  route: '/custom-fields',          icon: GitBranch},
                    { id: 'data-rules',       label: 'Règles Données',        route: '/data-rules',             icon: Cog      },
                    { id: 'workflows',        label: 'Workflows',             route: '/workflows',              icon: GitBranch},
                ],
            },
            {
                id: 'audit-logs',
                label: 'Logs d\'Audit & Traçabilité',
                description: 'Historique complet des actions système',
                route: '/settings',
                icon: FileText,
                actions: [
                    { id: 'token-series',  label: 'Séries de Tokens', route: '/token-series', icon: Target    },
                    { id: 'device-keys',   label: 'Clés Appareils',   route: '/device-keys',  icon: Shield    },
                    { id: 'translations',  label: 'Traductions',      route: '/translations', icon: Globe     },
                    { id: 'reporting',     label: 'Reporting Admin',  route: '/reporting/admin', icon: BarChart3},
                ],
            },
            {
                id: 'master-data',
                label: 'Données de Base',
                description: 'Catalogue produits, partenaires et données de référence',
                route: '/products',
                icon: Database,
                actions: [
                    { id: 'products',          label: 'Catalogue Produits',  route: '/products',               icon: Package      },
                    { id: 'products-master',   label: 'Master Data Produits', route: '/products/master-data',  icon: Database     },
                    { id: 'partners',          label: 'Partenaires',          route: '/partners',               icon: Users        },
                    { id: 'partner-balances',  label: 'Soldes Partenaires',   route: '/partners/balances',      icon: Calculator   },
                ],
            },
            {
                id: 'finance-admin',
                label: 'Finance & Trésorerie',
                description: 'Journaux de paiement, transferts et grand livre',
                route: '/finance/journals',
                icon: Banknote,
                actions: [
                    { id: 'journals',     label: 'Caisses & Comptes',    route: '/finance/journals',     icon: Banknote     },
                    { id: 'transfers',    label: 'Transferts de fonds',   route: '/finance/transfers',    icon: ArrowLeftRight},
                    { id: 'ledger',       label: 'Grand Livre',           route: '/finance/ledger',       icon: BookOpen     },
                    { id: 'settlements',  label: 'Réconciliation',        route: '/finance/settlements',  icon: CheckCircle2 },
                ],
            },
            {
                id: 'routing-admin',
                label: 'Routage & Tournées',
                description: 'Zones géographiques, tournées et planification',
                route: '/routing/geo-governance',
                icon: Map,
                actions: [
                    { id: 'geo-governance', label: 'Gouvernance Géo',   route: '/routing/geo-governance',  icon: Globe        },
                    { id: 'geo-areas',      label: 'Zones (liste)',       route: '/routing/geo-areas',       icon: Map          },
                    { id: 'itineraries',    label: 'Tournées',            route: '/routing/itineraries',     icon: Route        },
                    { id: 'planning',       label: 'Planning',            route: '/routing/planning',        icon: Clock        },
                ],
            },
            {
                id: 'import-export-admin',
                label: 'Import / Export',
                description: 'Opérations d\'import et export de données',
                route: '/import-export',
                icon: Import,
                actions: [
                    { id: 'import',     label: 'Importer Données',    route: '/import-export/import',    icon: Import       },
                    { id: 'export',     label: 'Exporter Données',    route: '/import-export/export',    icon: FileText     },
                    { id: 'batches',    label: 'Historique Imports',  route: '/import-export/batches',   icon: List         },
                    { id: 'templates',  label: 'Gérer Templates',     route: '/import-export/templates', icon: LayoutList   },
                ],
            },
            {
                id: 'document-studio-admin',
                label: 'Document Studio',
                description: 'Modèles de documents et reporting',
                route: '/document-studio',
                icon: FileText,
                actions: [
                    { id: 'doc-studio',     label: 'Document Studio',  route: '/document-studio',   icon: FileText     },
                    { id: 'reporting-dash', label: 'Reporting',         route: '/reporting',          icon: BarChart3    },
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
        { id: 'wms-pick-pack',  label: 'Console Pick & Pack', icon: ClipboardList,  route: '/stock/wms-pick-pack',             color: 'bg-teal-600'   },
        { id: 'wms-matrix',     label: 'Matrice Stocks WMS',  icon: Database,       route: '/stock/wms-matrix',                color: 'bg-indigo-500' },
        { id: 'wms-batches',    label: 'Lots & Péremption',   icon: AlertTriangle,  route: '/stock/wms-batches',               color: 'bg-red-500'    },
        { id: 'preparations',   label: 'Mes Préparations',    icon: List,           route: '/magasinier/preparations',         color: 'bg-orange-500' },
        { id: 'transfers',      label: 'Transferts',          icon: ArrowLeftRight, route: '/dispatcher/warehouse-transfers',  color: 'bg-blue-500'   },
        { id: 'prep-bills',     label: 'Bons de Prép.',       icon: FileText,       route: '/stock/preparation-bills',         color: 'bg-emerald-600'},
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
