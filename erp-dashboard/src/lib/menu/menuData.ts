import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Database,
  DollarSign,
  Eye,
  FileText,
  Globe,
  Grid3X3,
  Landmark,
  LayoutGrid,
  ListTodo,
  Map,
  Package,
  PackageCheck,
  Radio,
  RotateCcw,
  ScanLine,
  Settings,
  Shield,
  ShieldAlert,
  ShoppingCart,
  Sliders,
  Star,
  Tag,
  Truck,
  Users,
  Warehouse,
  Box,
  Headset,
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
    ],
  },
  {
    id: 'promotions',
    label: 'Promotions',
    icon: Tag,
    description: 'Campagnes promotionnelles, familles de produits/partenaires et boosts catalogue',
    requiredPermission: 'admin.sales.promotions',
    categories: [
      {
        id: 'campagnes',
        title: 'Campagnes',
        items: [
          {
            id: 'promo:campagnes:liste',
            label: 'Toutes les campagnes',
            route: '/promotions',
            permission: 'admin.sales.promotions',
            icon: ListTodo,
            description: 'Voir, créer et gérer les campagnes promotionnelles',
          },
        ],
      },
      {
        id: 'referentiels',
        title: 'Référentiels',
        items: [
          {
            id: 'promo:ref:product-families',
            label: 'Familles Produits',
            route: '/promotions/product-families',
            permission: 'admin.sales.promotions',
            icon: Package,
            description: 'Groupes de produits utilisés comme cibles de promotion',
          },
          {
            id: 'promo:ref:partner-families',
            label: 'Familles Partenaires',
            route: '/promotions/partner-families',
            permission: 'admin.sales.promotions',
            icon: Users,
            description: 'Segments clients auxquels les promotions s\'appliquent',
          },
        ],
      },
      {
        id: 'merchandising',
        title: 'Merchandising',
        items: [
          {
            id: 'promo:merch:boosts',
            label: 'Boosts Catalogue',
            route: '/promotions/boosts',
            permission: 'admin.sales.promotions',
            icon: Star,
            description: 'Mettre en avant des familles produit dans le catalogue vendeur',
          },
        ],
      },
    ],
  },
  {
    id: 'pricing',
    label: 'Pricing',
    icon: DollarSign,
    description: 'Listes de prix, canaux de vente et chronologies commerciales',
    categories: [
      {
        id: 'pricing-catalog',
        title: 'Tarification',
        items: [
          {
            id: 'pricing:hub',
            label: 'Tableau de bord Pricing',
            route: '/pricing',
            permission: 'manage-pricing',
            icon: LayoutGrid,
            description: 'Hub de navigation du module pricing',
          },
          {
            id: 'pricing:lists',
            label: 'Listes de prix',
            route: '/pricing/price-lists',
            permission: 'manage-pricing',
            icon: DollarSign,
            description: 'Gérer les listes de prix et leurs lignes',
          },
          {
            id: 'pricing:overrides',
            label: 'Dérogations partenaires',
            route: '/pricing/overrides',
            permission: 'manage-pricing',
            icon: Shield,
            description: 'Exceptions de prix par partenaire et produit',
          },
          {
            id: 'pricing:packaging-prices',
            label: 'Prix de conditionnement',
            route: '/pricing/packaging-prices',
            permission: 'manage-pricing',
            icon: Package,
            description: 'Prix par packaging et liste de prix',
          },
          {
            id: 'pricing:preview',
            label: 'Simulateur de prix',
            route: '/pricing/preview',
            permission: 'manage-pricing',
            icon: Eye,
            description: 'Simuler le prix effectif du moteur v5',
          },
          {
            id: 'pricing:channels',
            label: 'Canaux',
            route: '/pricing/channels',
            permission: 'manage-channels',
            icon: Radio,
            description: 'Canaux de vente et tarif de masse',
          },
          {
            id: 'pricing:chronologies',
            label: 'Chronologies',
            route: '/pricing/chronologies',
            permission: 'manage-chronologies',
            icon: Clock,
            description: 'Nature d\'activité et catalogue de tags',
          },
        ],
      },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: Landmark,
    description: 'Trésorerie, grand livre comptable et réconciliation des tournées',
    requiredPermission: 'admin.finance.journals',
    categories: [
      {
        id: 'tresorerie',
        title: 'Trésorerie',
        items: [
          {
            id: 'finance:journals',
            label: 'Caisses & Comptes',
            route: '/finance/journals',
            permission: 'admin.finance.journals',
            icon: Landmark,
            description: 'Journaux de paiement et soldes en temps réel',
          },
          {
            id: 'finance:transfers',
            label: 'Transferts de fonds',
            route: '/finance/transfers',
            permission: 'admin.finance.transfers',
            icon: ArrowLeftRight,
            description: 'Demandes, approbation et rejet de transferts',
          },
          {
            id: 'finance:settlements',
            label: 'Réconciliation tournées',
            route: '/finance/settlements',
            permission: 'admin.finance.settlements',
            icon: ClipboardCheck,
            description: 'Comptage caisse et écarts vendeurs',
          },
        ],
      },
      {
        id: 'comptabilite',
        title: 'Comptabilité',
        items: [
          {
            id: 'finance:ledger',
            label: 'Grand Livre',
            route: '/finance/ledger',
            permission: 'admin.finance.ledger',
            icon: BookOpen,
            description: 'Écritures comptables immuables — export Sage X3',
          },
        ],
      },
    ],
  },
  {
    id: 'rbac',
    label: 'Droits & Accès',
    icon: Shield,
    description: "Gestion des rôles, permissions et profils d'accès utilisateurs",
    requiredPermission: 'manage-rbac',
    categories: [
      {
        id: 'roles-perms',
        title: 'Rôles & Permissions',
        items: [
          {
            id: 'rbac:roles',
            label: 'Rôles',
            route: '/rbac/roles',
            permission: 'manage-rbac',
            icon: Shield,
            description: 'Gérer les rôles et leur composition en permissions',
          },
          {
            id: 'rbac:matrix',
            label: 'Matrice des droits',
            route: '/rbac/matrix',
            permission: 'manage-rbac',
            icon: Grid3X3,
            description: 'Vue croisée rôle × permission — cocher/décocher en masse',
          },
        ],
      },
      {
        id: 'users-access',
        title: 'Utilisateurs',
        items: [
          {
            id: 'rbac:users',
            label: 'Annuaire & Affectation',
            route: '/rbac/users',
            permission: 'manage-rbac',
            icon: Users,
            description: 'Affecter rôles, permissions directes et profil d\'accès',
          },
          {
            id: 'rbac:profiles',
            label: "Profils d'accès",
            route: '/rbac/access-profiles',
            permission: 'manage-rbac',
            icon: Sliders,
            description: 'Profils fonctionnels partagés (plafonds, scopes data)',
          },
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
        id: 'wms',
        title: 'WMS — Logistique Avancée',
        items: [
          { id: 'stock:wms:matrix',      label: 'Matrice des Stocks',  route: '/stock/wms-matrix',      description: 'Vue physique/réservé/disponible par entrepôt, emplacement et produit (Tier 2)' },
          { id: 'stock:wms:pick-pack',   label: 'Console Pick & Pack', route: '/stock/wms-pick-pack',   description: 'Tâches de collecte du magasinier triées par séquence optimisée' },
          { id: 'stock:wms:batches',     label: 'Lots & Péremption',   route: '/stock/wms-batches',     description: 'Suivi des dates de péremption et actions de quarantaine en masse' },
          { id: 'stock:wms:receipt',     label: 'Nouvelle Réception',  route: '/stock/wms-receipt',     description: 'Entrée de marchandises avec saisie obligatoire des emplacements (bins)' },
          { id: 'stock:wms:transfer',    label: 'Bon de Transfert',    route: '/stock/wms-transfer',    description: 'Transfert inter-entrepôt avec lot source FEFO optionnel' },
          { id: 'stock:wms:adjustment',  label: 'Ajustement Manuel',   route: '/stock/wms-adjustment',  description: 'Correction de stock signée — casse, perte, vol ou écart inventaire' },
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
      {
        id: 'wms-logistique',
        title: 'WMS — Logistique Avancée',
        items: [
          { id: 'mag:wms:matrix',      label: 'Matrice des Stocks',  route: '/stock/wms-matrix',      icon: Database,       description: 'Stocks physiques par emplacement — Tier 2' },
          { id: 'mag:wms:pick-pack',   label: 'Console Pick & Pack', route: '/stock/wms-pick-pack',   icon: ClipboardList,  description: 'Tâches de collecte triées par séquence optimisée (PickTaskEngine)' },
          { id: 'mag:wms:batches',     label: 'Lots & Péremption',   route: '/stock/wms-batches',     icon: Clock,          description: 'Contrôle des DLUO et mise en quarantaine en masse' },
          { id: 'mag:wms:receipt',     label: 'Nouvelle Réception',  route: '/stock/wms-receipt',     icon: PackageCheck,   description: 'Entrée de marchandises avec saisie obligatoire des emplacements (bins)' },
          { id: 'mag:wms:transfer',    label: 'Bon de Transfert',    route: '/stock/wms-transfer',    icon: ArrowLeftRight, description: 'Transfert inter-entrepôt avec lot source FEFO optionnel' },
          { id: 'mag:wms:adjustment',  label: 'Ajustement Manuel',   route: '/stock/wms-adjustment',  icon: ClipboardCheck, description: 'Correction de stock signée — casse, perte, vol ou écart inventaire' },
        ],
      },
      {
        id: 'conventional-loading',
        title: 'Chargement Conventionnel',
        items: [
          { id: 'mag:conv:loading', label: 'Demandes de chargement', route: '/magasinier/conventional-loading', icon: Truck, description: 'Préparer et émettre les QR de chargement pour les vendeurs SFA (§9)' },
        ],
      },
      {
        id: 'decharge-reconciliation',
        title: 'Réconciliation Décharge EOD',
        items: [
          { id: 'mag:drr:confirm', label: 'Réconciliation fin de journée', route: '/magasinier/decharge-reconciliation', icon: ScanLine, description: 'Scanner QR + décompte physique + approbation retour VAN → Dépôt (§10)' },
        ],
      },
      {
        id: 'decharges',
        title: 'Décharges Van → Dépôt',
        items: [
          { id: 'mag:decharge:approve', label: 'Approuver une décharge', route: '/magasinier/decharges', icon: PackageCheck, description: 'Libérer le stock des marchandises non livrées retournées au dépôt (§11)' },
        ],
      },
      {
        id: 'returns',
        title: 'Retours Partenaires',
        items: [
          { id: 'mag:returns:list', label: 'Retours à traiter', route: '/magasinier/returns', icon: RotateCcw, description: 'Réceptionner et clôturer les retours partenaires collectés par le livreur (§12)' },
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
        title: 'Articles & Produits',
        items: [
          {
            id: 'base:art:gestion',
            label: 'Catalogue Produits',
            route: '/products',
            permission: 'admin.master.products',
            icon: Package,
            description: 'Liste et gestion de tous les produits',
            keywords: ['produit', 'article', 'catalogue', 'product', 'liste'],
          },
          {
            id: 'base:art:master-data',
            label: 'Master Data Produits',
            route: '/products/master-data',
            permission: 'admin.master.products',
            icon: Database,
            description: 'Marques, catégories, unités, TVA, fournisseurs, groupes et pages',
            keywords: ['master data', 'marque', 'catégorie', 'unité', 'tva', 'fournisseur', 'groupe'],
          },
          {
            id: 'base:art:logistics',
            label: 'Profils Logistiques',
            route: '/products/logistics',
            permission: 'admin.master.products',
            icon: Truck,
            description: 'Saisir les dimensions et poids par niveau d\'emballage (UNIT / CARTON / PALLET)',
            keywords: ['logistique', 'poids', 'dimensions', 'emballage', 'colisage', 'palette', 'carton', 'volume'],
          },
          {
            id: 'base:art:packagings',
            label: 'Colisage / Conditionnements',
            route: '/products/packagings',
            permission: 'admin.master.products',
            icon: Box,
            description: 'Gérer les unités de commande par produit (Carton x12, Palette x144…) et leurs poids théoriques',
            keywords: ['colisage', 'conditionnement', 'carton', 'palette', 'unité', 'poids', 'packaging', 'has_colisage'],
          },
        ],
      },
      {
        id: 'tiers',
        title: 'Tiers & Partenaires',
        items: [
          {
            id: 'base:tiers:partenaires',
            label: 'Partenaires',
            route: '/partners',
            permission: 'admin.master.customers',
            icon: Users,
            description: 'Clients, fournisseurs et tous les partenaires',
            keywords: ['partenaire', 'client', 'fournisseur', 'tiers', 'partner'],
          },
          {
            id: 'base:tiers:soldes',
            label: 'Soldes Partenaires',
            route: '/partners/balances',
            permission: 'admin.master.customers',
            icon: BarChart3,
            description: 'Balances et encours clients',
            keywords: ['solde', 'balance', 'encours', 'client'],
          },
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
    id: 'telesales-admin',
    label: 'Télévendeur (Admin)',
    icon: Headset,
    description: 'Semainier d\'équipe, distribution de portefeuille et monitoring live des télévendeurs',
    // hasPermission() treats an undefined requiredPermission as "visible to everyone" —
    // must set one even though admin/root already bypass via the role check inside it.
    requiredPermission: 'telesales-admin.manage_schedules',
    requiredRole: 'admin',
    categories: [
      {
        id: 'planning',
        title: 'Planning',
        items: [
          { id: 'tv-admin:schedules', label: 'Semainier d\'équipe', route: '/telesales/admin/schedules', description: 'Assigner des appels aux agents, import en masse', keywords: ['planning', 'appel', 'semainier', 'télévendeur'] },
        ],
      },
      {
        id: 'portefeuille',
        title: 'Portefeuille',
        items: [
          { id: 'tv-admin:assignments', label: 'Distribution de portefeuille', route: '/telesales/admin/assignments', description: 'Attribuer des partenaires à un agent télévendeur', keywords: ['portefeuille', 'partenaire', 'assignation'] },
        ],
      },
      {
        id: 'monitoring',
        title: 'Monitoring',
        items: [
          { id: 'tv-admin:monitoring', label: 'Suivi live & KPIs', route: '/telesales/admin/monitoring', description: 'Sessions en direct, taux de conversion, ventes par agent', keywords: ['monitoring', 'kpi', 'session', 'conversion'] },
        ],
      },
    ],
  },
  {
    id: 'telesales-agent',
    label: 'Télévendeur',
    icon: Headset,
    description: 'Poste télévendeur — session, planning, prise de commande, devis',
    // Same hasPermission() caveat as telesales-admin above — undefined permission = visible to all.
    requiredPermission: 'televendeur.manage_session',
    requiredRole: 'televendeur',
    categories: [
      {
        id: 'poste',
        title: 'Poste',
        items: [
          { id: 'tv-agent:dashboard', label: 'Poste Télévendeur', route: '/telesales/dashboard', description: 'Session (start/pause/resume/end) et vue d\'ensemble', keywords: ['session', 'dashboard', 'télévendeur', 'tableau de bord'] },
          { id: 'tv-agent:planning', label: 'Semainier / Planning', route: '/telesales/planning', description: 'Appels planifiés, appel libre', keywords: ['planning', 'semainier', 'appel'] },
          { id: 'tv-agent:catalog', label: 'Catalogue produits', route: '/telesales/catalog', description: 'Recherche produit, stock, prix négocié', keywords: ['catalogue', 'produit', 'stock', 'prix'] },
          { id: 'tv-agent:devis', label: 'Mes devis', route: '/telesales/devis', description: 'Devis B2B — création, envoi, conversion en commande', keywords: ['devis', 'quote', 'b2b'] },
          { id: 'tv-agent:portfolio', label: 'Mon portefeuille', route: '/telesales/portfolio', description: 'Partenaires assignés par le superviseur', keywords: ['portefeuille', 'partenaire', 'assignation'] },
          { id: 'tv-agent:returns', label: 'Retours clients', route: '/telesales/returns', description: 'Retours commerciaux différés, approbation direction', keywords: ['retour', 'return', 'sav'] },
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
          { id: 'admin:users:utilisateurs', label: 'Utilisateurs', route: '/rbac/users', permission: 'admin.users.view' },
          { id: 'admin:users:roles', label: 'Rôles', route: '/rbac/roles', permission: 'admin.roles.view' },
          { id: 'admin:users:matrix', label: 'Matrice des droits', route: '/rbac/matrix', permission: 'admin.roles.view' },
          { id: 'admin:users:profiles', label: "Profils d'accès", route: '/rbac/access-profiles', permission: 'admin.roles.view' },
        ],
      },
      {
        id: 'securite',
        title: 'Sécurité',
        items: [
          { id: 'admin:sec:gouvernance', label: 'Gouvernance', route: '/data-rules', permission: 'admin.access-control.data-rules.manage' },
          { id: 'admin:sec:token-series', label: 'Séries de numérotation', route: '/token-series', permission: 'admin.access-control.token-series.manage' },
          { id: 'admin:sec:device-keys', label: 'Clés devices', route: '/device-keys', permission: 'admin.access-control.device-keys.manage' },
          { id: 'admin:sec:audit', label: 'Audit Trail', route: '/audit', permission: 'browse-audit-logs', icon: ShieldAlert, description: 'Journal d\'activité, anomalies, export et purge des logs' },
        ],
      },
      {
        id: 'systeme',
        title: 'Système',
        items: [
          { id: 'admin:sys:monitoring', label: 'Monitoring', route: '/reporting/admin', permission: 'admin.monitoring.view' },
          { id: 'admin:sys:parametres', label: 'Paramètres Généraux', route: '/settings', permission: 'admin.settings.view' },
          { id: 'admin:sys:config-dyn', label: 'Configuration Dynamique', route: '/settings/configuration', permission: 'admin.settings.view' },
          { id: 'admin:sys:custom-fields', label: 'Champs Personnalisés', route: '/custom-fields', permission: 'admin.settings.view' },
          { id: 'admin:sys:backup', label: 'Backup & Restore', route: '/backup', permission: 'browse-backups', icon: Database, description: 'Gestion des sauvegardes et restauration de la base de données' },
        ],
      },
      {
        id: 'localisation',
        title: 'Localisation',
        items: [
          {
            id: 'admin:i18n:translations',
            label: 'Traductions',
            route: '/translations',
            permission: 'manage-master-data',
            icon: Globe,
            description: 'Traduire les libellés métier en arabe et anglais',
          },
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
        id: 'templates',
        title: 'Templates',
        items: [
          { id: 'wf:templates:templates', label: 'Templates de workflow', route: '/workflows' },
          { id: 'wf:templates:create', label: 'Nouveau workflow', route: '/workflows/create' },
        ],
      },
      {
        id: 'analytics',
        title: 'Analytics',
        items: [
          { id: 'wf:analytics:reporting', label: 'Reporting workflows', route: '/reporting' },
          { id: 'wf:analytics:admin', label: 'Administration reporting', route: '/reporting/admin' },
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
