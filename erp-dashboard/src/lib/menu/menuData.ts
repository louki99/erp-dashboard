import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  BarChart3,
  Database,
  FileText,
  ListTodo,
  Map,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';

export interface MenuItem {
  id: string;
  label: string;
  route: string;
  permission?: string;
  description?: string;
  keywords?: string[];
  icon?: LucideIcon;
}

export interface MenuCategory {
  id: string;
  title: string;
  items: MenuItem[];
  permission?: string;
}

export interface MenuModule {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  requiredPermission?: string;
  requiredRole?: string;
  categories: MenuCategory[];
}

// ---------------------------------------------------------------------------
// Canonical ERP menu definition.
// Each item owns its own route and optional permission. This replaces the
// previous three disconnected lookup tables (MENU_DATA, ITEM_PERMISSIONS,
// ROUTE_MAPPING) with a single source of truth.
// ---------------------------------------------------------------------------

export const MENU_MODULES: MenuModule[] = [
  {
    id: 'purch',
    label: 'Achats',
    icon: ShoppingCart,
    description: 'Achats, commandes fournisseurs et réceptions',
    requiredPermission: 'admin.procurement',
    requiredRole: 'procurement',
    categories: [
      {
        id: 'tarifs',
        title: 'Tarifs',
        items: [
          { id: 'purch:tarifs:recherche', label: "Recherche tarifs", route: '/dashboard', permission: 'admin.procurement.view' },
          { id: 'purch:tarifs:saisie', label: "Saisie des tarifs", route: '/dashboard', permission: 'admin.procurement.create' },
        ],
      },
      {
        id: 'approvisionnement',
        title: 'Approvisionnement',
        items: [
          { id: 'purch:appro:planning-global', label: 'Planning global', route: '/dashboard', permission: 'admin.procurement.planning' },
          { id: 'purch:appro:plan-travail', label: 'Plan de travail', route: '/dashboard', permission: 'admin.procurement.planning' },
          { id: 'purch:appro:plan-regroupement', label: 'Plan de regroupement', route: '/dashboard', permission: 'admin.procurement.planning' },
        ],
      },
      {
        id: 'demandes-achat',
        title: "Demandes d'achat",
        items: [
          { id: 'purch:da:demandes', label: "Demandes d'achat", route: '/dashboard', permission: 'admin.procurement.requests' },
          { id: 'purch:da:soldes', label: "Soldes demandes d'achat", route: '/dashboard', permission: 'admin.procurement.requests' },
        ],
      },
      {
        id: 'appels-offres',
        title: "Appels d'offres",
        items: [
          { id: 'purch:ao:demandes', label: 'Demandes', route: '/dashboard' },
          { id: 'purch:ao:reponses', label: 'Réponses', route: '/dashboard' },
          { id: 'purch:ao:relances', label: 'Relances', route: '/dashboard' },
        ],
      },
      {
        id: 'commandes',
        title: 'Commandes',
        items: [
          { id: 'purch:cmd:commandes', label: 'Commandes', route: '/orders', permission: 'admin.procurement.orders' },
          { id: 'purch:cmd:ouvertes', label: 'Commandes ouvertes', route: '/dashboard', permission: 'admin.procurement.orders' },
          { id: 'purch:cmd:signatures', label: 'Signatures', route: '/dashboard', permission: 'admin.procurement.approve' },
        ],
      },
      {
        id: 'receptions',
        title: 'Réceptions',
        items: [
          { id: 'purch:rec:receptions', label: 'Réceptions', route: '/dashboard', permission: 'admin.procurement.receipts' },
          { id: 'purch:rec:retours', label: 'Retours', route: '/dashboard', permission: 'admin.procurement.returns' },
        ],
      },
      {
        id: 'factures',
        title: 'Factures',
        items: [
          { id: 'purch:fac:factures', label: 'Factures', route: '/dashboard', permission: 'admin.procurement.invoices' },
          { id: 'purch:fac:avoirs', label: 'Avoirs', route: '/dashboard', permission: 'admin.procurement.credits' },
        ],
      },
    ],
  },
  {
    id: 'sales',
    label: 'Ventes',
    icon: BarChart3,
    description: 'Commandes clients, devis et gestion des livraisons',
    requiredPermission: 'admin.sales',
    requiredRole: 'sales',
    categories: [
      {
        id: 'devis',
        title: 'Devis',
        items: [
          { id: 'sales:devis:saisie', label: 'Saisie devis', route: '/dashboard', permission: 'admin.sales.quotes' },
          { id: 'sales:devis:liste', label: 'Liste devis', route: '/dashboard', permission: 'admin.sales.quotes' },
        ],
      },
      {
        id: 'commandes',
        title: 'Commandes',
        items: [
          { id: 'sales:cmd:saisie', label: 'Saisie commandes', route: '/orders', permission: 'admin.sales.orders' },
          { id: 'sales:cmd:liste', label: 'Liste commandes', route: '/orders', permission: 'admin.sales.orders' },
        ],
      },
      {
        id: 'livraisons',
        title: 'Livraisons',
        items: [
          { id: 'sales:liv:preparation', label: 'Préparation', route: '/magasinier/preparations', permission: 'admin.sales.delivery' },
          { id: 'sales:liv:validation', label: 'Validation', route: '/adv/validation', permission: 'admin.sales.approve' },
        ],
      },
      {
        id: 'marketing',
        title: 'Marketing',
        items: [
          { id: 'sales:mkt:promotions', label: 'Promotions', route: '/promotions', permission: 'admin.sales.promotions' },
        ],
      },
    ],
  },
  {
    id: 'stock',
    label: 'Stocks',
    icon: Package,
    description: 'Entrepôts, emplacements, stocks et bons de préparation',
    requiredPermission: 'admin.stock',
    requiredRole: 'stock',
    categories: [
      {
        id: 'entrepots',
        title: 'Entrepôts & Emplacements',
        items: [
          { id: 'stock:warehouses', label: 'Entrepôts (dépôts)', route: '/stock/warehouses', description: 'Gérer les dépôts et leurs emplacements de stockage' },
          { id: 'stock:consultation', label: 'Consultation Stock', route: '/stock/consultation', description: 'Vue en lecture seule des niveaux de stock par produit et emplacement' },
          { id: 'stock:preparation-bills', label: 'Bons de Préparation', route: '/stock/preparation-bills', description: 'Créer et suivre les bons de préparation (BP) pour le magasinier' },
        ],
      },
      {
        id: 'mouvements',
        title: 'Mouvements & Inventaire',
        items: [
          { id: 'stock:mvt:entrees', label: 'Entrées diverses', route: '/dashboard', permission: 'admin.stock.movements' },
          { id: 'stock:mvt:sorties', label: 'Sorties diverses', route: '/dashboard', permission: 'admin.stock.movements' },
          { id: 'stock:mvt:emplacements', label: 'Changements emplacement', route: '/dashboard', permission: 'admin.stock.movements' },
          { id: 'stock:inv:comptage', label: 'Comptage inventaire', route: '/dashboard', permission: 'admin.stock.inventory' },
          { id: 'stock:inv:validation', label: 'Validation inventaire', route: '/dashboard' },
        ],
      },
    ],
  },
  {
    id: 'adv',
    label: 'ADV',
    icon: Users,
    description: 'Administration des Ventes - Gestion partenaires, crédit et validations',
    requiredPermission: 'admin.adv',
    requiredRole: 'adv',
    categories: [
      {
        id: 'dashboard',
        title: 'Tableau de Bord',
        items: [
          { id: 'adv:dashboard', label: 'Tableau de bord ADV', route: '/adv', permission: 'admin.adv.dashboard' },
        ],
      },
      {
        id: 'partenaires',
        title: 'Gestion Partenaires',
        items: [
          { id: 'adv:part:validation', label: 'Validation Partenaires', route: '/adv/partners', permission: 'admin.adv.partners.validate' },
          { id: 'adv:part:liste', label: 'Liste Partenaires', route: '/adv/partners', permission: 'admin.adv.partners.index' },
          { id: 'adv:part:soldes', label: 'Soldes Partenaires', route: '/partners/balances', permission: 'admin.adv.partners.index' },
        ],
      },
      {
        id: 'credit',
        title: 'Gestion Crédit',
        items: [
          { id: 'adv:credit:gestion', label: 'Gestion Crédit', route: '/adv/credit', permission: 'admin.adv.credit.index' },
          { id: 'adv:credit:echeances', label: 'Échéances', route: '/adv/echeances', permission: 'admin.adv.echeances.index' },
        ],
      },
      {
        id: 'validation-bc',
        title: 'Validation BC',
        items: [
          { id: 'adv:bc:validation', label: 'Validation BC', route: '/adv/validation', permission: 'admin.adv.bc.validate' },
          { id: 'adv:bc:derogations', label: 'Dérogations Crédit', route: '/adv/derogations', permission: 'admin.adv.credit.approve-increase' },
        ],
      },
    ],
  },
  {
    id: 'dispatcher',
    label: 'Dispatcher',
    icon: Truck,
    description: 'Dispatcher - Conversion BC, gestion BL et bons de chargement',
    requiredPermission: 'admin.dispatcher',
    requiredRole: 'dispatcher',
    categories: [
      {
        id: 'dashboard',
        title: 'Tableau de Bord',
        items: [
          { id: 'dispatcher:dashboard', label: 'Tableau de bord Dispatcher', route: '/dispatcher' },
        ],
      },
      {
        id: 'commandes',
        title: 'Commandes',
        items: [
          { id: 'dispatcher:cmd:attente', label: 'Commandes en attente', route: '/dispatcher/orders' },
        ],
      },
      {
        id: 'workspaces',
        title: 'Workspaces',
        items: [
          { id: 'dispatcher:ws:missions', label: 'Workspace Missions', route: '/dispatcher/workspace/missions' },
          { id: 'dispatcher:ws:carte', label: 'Dispatcher Carte', route: '/dispatcher/workspace/map' },
          { id: 'dispatcher:ws:monitor', label: 'Moniteur Logistique', route: '/dispatcher/monitor' },
        ],
      },
      {
        id: 'bl',
        title: 'Bons de Livraison',
        items: [
          { id: 'dispatcher:bl:liste', label: 'BL (liste)', route: '/dispatcher/bons-livraisons' },
          { id: 'dispatcher:bl:brouillons', label: 'BL brouillons', route: '/dispatcher/bons-livraisons' },
        ],
      },
      {
        id: 'ruptures',
        title: 'Ruptures',
        items: [
          { id: 'dispatcher:ruptures', label: 'File de ruptures', route: '/dispatcher/shortage-queue' },
        ],
      },
      {
        id: 'decharges',
        title: 'Décharges',
        items: [
          { id: 'dispatcher:decharges', label: 'Décharges (liste)', route: '/dispatcher/decharges' },
        ],
      },
      {
        id: 'transferts',
        title: 'Transferts Entrepôt',
        items: [
          { id: 'dispatcher:transferts', label: 'Transferts entrepôt (liste)', route: '/dispatcher/warehouse-transfers' },
        ],
      },
      {
        id: 'flotte',
        title: 'Flotte & Livreurs',
        items: [
          { id: 'dispatcher:flotte', label: 'Flotte & Livreurs', route: '/dispatcher/fleet' },
        ],
      },
      {
        id: 'planification',
        title: 'Planification',
        items: [
          { id: 'dispatcher:planif', label: 'Planification auto', route: '/dispatcher/mission-planning' },
        ],
      },
    ],
  },
  {
    id: 'magasinier',
    label: 'Magasinier',
    icon: Warehouse,
    description: 'Magasinier - Préparations, stock et batch picking',
    requiredPermission: 'admin.warehouse',
    requiredRole: 'magasinier',
    categories: [
      {
        id: 'dashboard',
        title: 'Tableau de Bord',
        items: [
          { id: 'mag:dashboard', label: 'Tableau de bord Magasinier', route: '/magasinier', permission: 'admin.warehouse.dashboard' },
        ],
      },
      {
        id: 'preparations',
        title: 'Préparations',
        items: [
          { id: 'mag:prep:bons', label: 'Bons de préparation', route: '/magasinier/preparations', permission: 'admin.warehouse.picking' },
          { id: 'mag:prep:approuvees', label: 'Commandes approuvées', route: '/magasinier/orders' },
        ],
      },
      {
        id: 'stock',
        title: 'Stock',
        items: [
          { id: 'mag:stock:gestion', label: 'Gestion stock', route: '/magasinier/stock', permission: 'admin.warehouse.stock' },
          { id: 'mag:stock:mouvements', label: 'Mouvements stock', route: '/magasinier/stock', permission: 'admin.warehouse.stock' },
        ],
      },
      {
        id: 'batch-picking',
        title: 'Batch Picking',
        items: [
          { id: 'mag:batch', label: 'Préparation groupée', route: '/magasinier/batch-picking', permission: 'admin.warehouse.batch-picking' },
        ],
      },
    ],
  },
  {
    id: 'base',
    label: 'Données de base',
    icon: Database,
    description: 'Données de base : articles, tiers et sites',
    requiredPermission: 'admin.master',
    requiredRole: 'master-data',
    categories: [
      {
        id: 'articles',
        title: 'Articles',
        items: [
          { id: 'base:art:gestion', label: 'Gestion Produits', route: '/products', permission: 'admin.master.products' },
          { id: 'base:art:master-data', label: 'Données de base produits', route: '/products/master-data', permission: 'admin.master.products', description: 'Marques, catégories, unités, TVA, fournisseurs, groupes et pages' },
          { id: 'base:art:unites', label: 'Unités', route: '/products/master-data', permission: 'admin.master.units' },
        ],
      },
      {
        id: 'tiers',
        title: 'Tiers',
        items: [
          { id: 'base:tiers:clients', label: 'Clients', route: '/partners', permission: 'admin.master.customers' },
          { id: 'base:tiers:fournisseurs', label: 'Fournisseurs', route: '/products/master-data', permission: 'admin.master.suppliers' },
          { id: 'base:tiers:transporteurs', label: 'Transporteurs', route: '/dashboard', permission: 'admin.master.carriers' },
        ],
      },
    ],
  },
  {
    id: 'document-studio',
    label: 'Document Studio',
    icon: FileText,
    description: 'Modèles de documents et édition',
    requiredPermission: 'admin.view',
    categories: [
      {
        id: 'studio',
        title: 'Studio',
        items: [
          { id: 'docstudio:dashboard', label: 'Document Studio', route: '/document-studio', permission: 'admin.view' },
        ],
      },
    ],
  },
  {
    id: 'reporting',
    label: 'Reporting',
    icon: BarChart3,
    description: 'Rapports et administration des définitions',
    requiredPermission: 'admin.view',
    categories: [
      {
        id: 'reports',
        title: 'Rapports',
        items: [
          { id: 'reporting:dashboard', label: 'Tableau de bord Reporting', route: '/reporting', permission: 'admin.view' },
          { id: 'reporting:admin', label: 'Administration Reporting', route: '/reporting/admin', permission: 'admin.view' },
        ],
      },
    ],
  },
  {
    id: 'routing',
    label: 'Routing',
    icon: Map,
    description: 'Sectorisation géographique et tournées commerciales',
    requiredPermission: 'admin.routing',
    requiredRole: 'routing',
    categories: [
      {
        id: 'sectorisation',
        title: 'Sectorisation',
        items: [
          { id: 'routing:geo-governance', label: 'Gouvernance géographique', route: '/routing/geo-governance', description: 'Arborescence interactive des zones géographiques', keywords: ['zone', 'secteur', 'tree', 'géographie', 'superviseur'] },
          { id: 'routing:geo-areas', label: 'Zones (liste)', route: '/routing/geo-areas', description: 'Liste paginée des zones géographiques', keywords: ['zone', 'secteur', 'localité'] },
          { id: 'routing:itinerary-types', label: 'Types de tournée', route: '/routing/itinerary-types', description: 'Gérer les types de tournée', keywords: ['type', 'tournée', 'business nature'] },
          { id: 'routing:business-natures', label: 'Business Natures', route: '/routing/business-natures', description: 'Playbooks de visite et règles d\'action', keywords: ['playbook', 'nature', 'business', 'action', 'visite'] },
        ],
      },
      {
        id: 'tournees',
        title: 'Tournées',
        items: [
          { id: 'routing:itineraries', label: 'Gestion des tournées', route: '/routing/itineraries', description: 'CRUD tournées, partenaires et vendeurs', keywords: ['tournée', 'itinéraire', 'partenaire', 'vendeur'] },
          { id: 'routing:designer', label: 'Visual Designer', route: '/routing/designer', description: 'Designer drag-and-drop avec carte Leaflet', keywords: ['designer', 'carte', 'map', 'drag', 'lasso', 'arrêts'] },
          { id: 'routing:planning', label: 'Planning', route: '/routing/planning', description: 'Planning hebdomadaire et overrides journaliers', keywords: ['planning', 'calendrier', 'jour', 'semaine', 'override'] },
        ],
      },
    ],
  },
  {
    id: 'admin',
    label: 'Référentiel',
    icon: Settings,
    description: 'Utilisateurs, sécurité et paramètres globaux',
    requiredPermission: 'admin.view',
    categories: [
      {
        id: 'utilisateurs',
        title: 'Utilisateurs',
        items: [
          { id: 'admin:users:utilisateurs', label: 'Utilisateurs', route: '/settings', permission: 'admin.users.view' },
          { id: 'admin:users:roles', label: 'Rôles', route: '/settings', permission: 'admin.roles.view' },
          { id: 'admin:users:groupes', label: 'Groupes', route: '/settings', permission: 'admin.groups.view' },
        ],
      },
      {
        id: 'securite',
        title: 'Sécurité',
        items: [
          { id: 'admin:sec:gouvernance', label: 'Gouvernance', route: '/data-rules', permission: 'admin.access-control.data-rules.manage' },
          { id: 'admin:sec:token-series', label: 'Séries de numérotation', route: '/token-series', permission: 'admin.access-control.token-series.manage' },
          { id: 'admin:sec:device-keys', label: 'Clés devices', route: '/device-keys', permission: 'admin.access-control.device-keys.manage' },
          { id: 'admin:sec:audit', label: 'Audit', route: '/settings', permission: 'admin.audit.view' },
        ],
      },
      {
        id: 'systeme',
        title: 'Système',
        items: [
          { id: 'admin:sys:monitoring', label: 'Monitoring', route: '/admin/monitoring', permission: 'admin.monitoring.view' },
          { id: 'admin:sys:parametres', label: 'Paramètres Généraux', route: '/settings', permission: 'admin.settings.view' },
          { id: 'admin:sys:config-dyn', label: 'Configuration Dynamique', route: '/settings/configuration', permission: 'admin.settings.view' },
        ],
      },
    ],
  },
  {
    id: 'workflows',
    label: 'Workflows & Règles',
    icon: ListTodo,
    description: 'Administration du moteur de règles dynamiques',
    requiredPermission: 'admin.tasks',
    requiredRole: 'tasks',
    categories: [
      {
        id: 'admin',
        title: 'Administration',
        items: [
          { id: 'wf:admin:workflows', label: 'Gestion des workflows', route: '/workflows', permission: 'view-workflows' },
        ],
      },
      {
        id: 'tasks',
        title: 'Tâches',
        items: [
          { id: 'wf:tasks:dashboard', label: 'Tableau de bord Tâches', route: '/tasks' },
          { id: 'wf:tasks:ready', label: 'Tâches prêtes', route: '/tasks?status=ready' },
          { id: 'wf:tasks:in-progress', label: 'Tâches en cours', route: '/tasks?status=in_progress' },
          { id: 'wf:tasks:completed', label: 'Tâches terminées', route: '/tasks?status=completed' },
        ],
      },
      {
        id: 'analytics',
        title: 'Analytics',
        items: [
          { id: 'wf:analytics:progression', label: 'Progression workflows', route: '/admin/monitoring' },
          { id: 'wf:analytics:stats', label: 'Statistiques workflows', route: '/admin/monitoring' },
          { id: 'wf:analytics:gestion', label: 'Gestion des tâches', route: '/admin/monitoring' },
        ],
      },
      {
        id: 'templates',
        title: 'Templates',
        items: [
          { id: 'wf:templates:templates', label: 'Templates de workflow', route: '/workflows' },
          { id: 'wf:templates:engine-test', label: 'Workflow Engine Test', route: '/workflows/engine' },
        ],
      },
    ],
  },
  {
    id: 'import-export',
    label: 'ImpoExpo',
    icon: ArrowLeftRight,
    description: 'Gestion des imports et exports de données',
    requiredPermission: 'admin.import-export',
    requiredRole: 'import-export',
    categories: [
      {
        id: 'dashboard',
        title: 'Tableau de Bord',
        items: [
          { id: 'ie:dashboard', label: 'Tableau de bord Import/Export', route: '/import-export', permission: 'admin.import-export.dashboard' },
        ],
      },
      {
        id: 'operations',
        title: 'Opérations',
        items: [
          { id: 'ie:op:import', label: 'Importer Données', route: '/import-export/import', permission: 'admin.import-export.import' },
          { id: 'ie:op:export', label: 'Exporter Données', route: '/import-export/export', permission: 'admin.import-export.export' },
        ],
      },
      {
        id: 'gestion',
        title: 'Gestion',
        items: [
          { id: 'ie:gestion:historique', label: 'Historique des Opérations', route: '/import-export/batches', permission: 'admin.import-export.history' },
          { id: 'ie:gestion:templates', label: 'Gérer Templates', route: '/import-export/templates', permission: 'admin.import-export.templates' },
        ],
      },
    ],
  },
];

// Legacy route aliases for items that changed labels but must keep routing.
export const ROUTE_ALIASES: Record<string, string> = {
  'Tableau de bord': '/adv',
  'Partner Validation': '/adv/partners',
  'Credit Management': '/adv/credit',
  'BC Approval': '/adv/validation',
};

// Default fallback route.
export const DEFAULT_ROUTE = '/dashboard';

export function getItemRoute(item: MenuItem): string {
  return ROUTE_ALIASES[item.label] ?? item.route ?? DEFAULT_ROUTE;
}
