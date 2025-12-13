/**
 * Permission Constants and Mappings
 * Central registry of all application permissions
 */

export const PERMISSIONS = {
    // Dashboard
    DASHBOARD: {
        VIEW: 'admin.dashboard.view',
        ANALYTICS: 'admin.dashboard.analytics',
        REPORTS: 'admin.dashboard.reports',
    },

    // ADV Module
    ADV: {
        DASHBOARD: 'admin.adv.dashboard',
        
        // Partners
        PARTNERS_INDEX: 'admin.adv.partners.index',
        PARTNERS_SHOW: 'admin.adv.partners.show',
        PARTNERS_PENDING: 'admin.adv.partners.pending',
        PARTNERS_VALIDATE: 'admin.adv.partners.validate',
        PARTNERS_REJECT: 'admin.adv.partners.reject',
        PARTNERS_EDIT: 'admin.adv.partners.edit',
        PARTNERS_BLOCK: 'admin.adv.partners.block',
        PARTNERS_UNBLOCK: 'admin.adv.partners.unblock',
        
        // Credit
        CREDIT_INDEX: 'admin.adv.credit.index',
        CREDIT_UPDATE_LIMIT: 'admin.adv.credit.update-limit',
        CREDIT_APPROVE_INCREASE: 'admin.adv.credit.approve-increase',
        CREDIT_HISTORY: 'admin.adv.credit.history',
        CREDIT_ALERTS: 'admin.adv.credit.alerts',
        
        // BC (Bon de Commande)
        BC_INDEX: 'admin.adv.bc.index',
        BC_SHOW: 'admin.adv.bc.show',
        BC_PENDING: 'admin.adv.bc.pending',
        BC_VALIDATE: 'admin.adv.bc.validate',
        BC_APPROVE: 'admin.adv.bc.approve',
        BC_REJECT: 'admin.adv.bc.reject',
        BC_HOLD: 'admin.adv.bc.hold',
        BC_REQUEST_INFO: 'admin.adv.bc.request-info',
        BC_BALANCE_CHECK: 'admin.adv.bc.balance-check',
        BC_EXPORT: 'admin.adv.bc.export',
        BC_BULK_APPROVE: 'admin.adv.bc.bulk-approve',
        BC_BULK_REJECT: 'admin.adv.bc.bulk-reject',
        BC_BULK_HOLD: 'admin.adv.bc.bulk-hold',
        BC_BATCH_APPROVE: 'admin.adv.bc.batch-approve',
        BC_BATCH_REJECT: 'admin.adv.bc.batch-reject',
        
        // Payment Terms
        PAYMENT_TERMS_INDEX: 'admin.adv.payment-terms.index',
        PAYMENT_TERMS_ASSIGN: 'admin.adv.payment-terms.assign',
        PAYMENT_TERMS_APPROVE: 'admin.adv.payment-terms.approve',
        
        // Echeances
        ECHEANCES_INDEX: 'admin.adv.echeances.index',
        ECHEANCES_MONITOR: 'admin.adv.echeances.monitor',
        
        // Pricing
        PRICING_OVERRIDES: 'admin.adv.pricing.overrides',
        PRICING_APPROVE: 'admin.adv.pricing.approve',
        PRICING_HISTORY: 'admin.adv.pricing.history',
        
        // Documents
        DOCUMENTS_INDEX: 'admin.adv.documents.index',
        DOCUMENTS_VALIDATE: 'admin.adv.documents.validate',
        DOCUMENTS_REQUEST: 'admin.adv.documents.request',
        
        // Analytics
        ANALYTICS_SALES: 'admin.adv.analytics.sales',
        ANALYTICS_CREDIT_USAGE: 'admin.adv.analytics.credit-usage',
        ANALYTICS_PAYMENT_BEHAVIOR: 'admin.adv.analytics.payment-behavior',
        
        // Communication
        COMMUNICATION_SEND: 'admin.adv.communication.send-notification',
        COMMUNICATION_HISTORY: 'admin.adv.communication.history',
        
        // Reports
        REPORTS_PARTNERS: 'admin.adv.reports.partners',
        REPORTS_CREDIT: 'admin.adv.reports.credit',
        REPORTS_ECHEANCES: 'admin.adv.reports.echeances',
        REPORTS_EXPORT: 'admin.adv.reports.export',
        
        // Workflow
        WORKFLOW_PENDING: 'admin.adv.workflow.pending',
        WORKFLOW_APPROVE: 'admin.adv.workflow.approve',
        WORKFLOW_REJECT: 'admin.adv.workflow.reject',
    },

    // Bon de Commandes
    BON_COMMANDES: {
        INDEX: 'admin.bon-commandes.index',
        SHOW: 'admin.bon-commandes.show',
        CREATE: 'admin.bon-commandes.create',
        EDIT: 'admin.bon-commandes.edit',
        DELETE: 'admin.bon-commandes.delete',
        APPROVE: 'admin.bon-commandes.approve',
        REJECT: 'admin.bon-commandes.reject',
        CANCEL: 'admin.bon-commandes.cancel',
        EXPORT: 'admin.bon-commandes.export',
        PRINT: 'admin.bon-commandes.print',
    },

    // Payments
    PAYMENTS: {
        DASHBOARD: 'admin.payments.dashboard',
        PENDING: 'admin.payments.pending',
        HISTORY: 'admin.payments.history',
        SHOW: 'admin.payments.show',
        CREATE: 'admin.payments.create',
        STORE: 'admin.payments.store',
        VALIDATE: 'admin.payments.validate',
        REJECT: 'admin.payments.reject',
        LETTERING_INDEX: 'admin.payments.lettering.index',
        LETTERING_CREATE: 'admin.payments.lettering.create',
        LETTERING_STORE: 'admin.payments.lettering.store',
        LETTERING_AUTO: 'admin.payments.lettering.auto',
        LETTERING_DESTROY: 'admin.payments.lettering.destroy',
    },

    // Partners
    PARTNERS: {
        INDEX: 'admin.partners.index',
        SHOW: 'admin.partners.show',
        CREATE: 'admin.partners.create',
        EDIT: 'admin.partners.edit',
        DELETE: 'admin.partners.delete',
        ACTIVATE: 'admin.partners.activate',
        DEACTIVATE: 'admin.partners.deactivate',
        CREDIT_LIMIT: 'admin.partners.credit-limit',
        PRICING: 'admin.partners.pricing',
        EXPORT: 'admin.partners.export',
    },

    // Products
    PRODUCTS: {
        INDEX: 'admin.products.index',
        SHOW: 'admin.products.show',
        CREATE: 'admin.products.create',
        EDIT: 'admin.products.edit',
        DELETE: 'admin.products.delete',
        IMPORT: 'admin.products.import',
        EXPORT: 'admin.products.export',
        PRICING: 'admin.products.pricing',
        CATEGORIES: 'admin.products.categories',
    },

    // Stock
    STOCK: {
        INDEX: 'admin.stock.index',
        SHOW: 'admin.stock.show',
        ADJUST: 'admin.stock.adjust',
        TRANSFER: 'admin.stock.transfer',
        MOVEMENTS: 'admin.stock.movements',
        LOW_STOCK: 'admin.stock.low-stock',
        INVENTORY: 'admin.stock.inventory',
        EXPORT: 'admin.stock.export',
    },

    // Users & Roles
    USERS: {
        INDEX: 'admin.users.index',
        SHOW: 'admin.users.show',
        CREATE: 'admin.users.create',
        EDIT: 'admin.users.edit',
        DELETE: 'admin.users.delete',
        ROLES: 'admin.users.roles',
        PERMISSIONS: 'admin.users.permissions',
    },

    ROLES: {
        INDEX: 'admin.roles.index',
        SHOW: 'admin.roles.show',
        CREATE: 'admin.roles.create',
        EDIT: 'admin.roles.edit',
        DELETE: 'admin.roles.delete',
        PERMISSIONS: 'admin.roles.permissions',
    },

    // Employees
    EMPLOYEES: {
        INDEX: 'admin.employee.index',
        CREATE: 'admin.employee.create',
        UPDATE: 'admin.employee.update',
        DESTROY: 'admin.employee.destroy',
        PERMISSION: 'admin.employee.permission',
        PERMISSION_UPDATE: 'admin.employee.permission.update',
        PERMISSIONS_ADVANCED: 'admin.employee.permissions-advanced',
        ASSIGN_ROLE: 'admin.employee.assign-role',
        REMOVE_ROLE: 'admin.employee.remove-role',
        GRANT_PERMISSION: 'admin.employee.grant-permission',
        REVOKE_PERMISSION: 'admin.employee.revoke-permission',
        BLACKLIST_PERMISSION: 'admin.employee.blacklist-permission',
        REMOVE_BLACKLIST: 'admin.employee.remove-blacklist',
        RESET_PASSWORD: 'admin.employee.reset-password',
    },

    // Settings
    SETTINGS: {
        GENERAL: 'admin.settings.general',
        BUSINESS: 'admin.settings.business',
        EMAIL: 'admin.settings.email',
        SMS: 'admin.settings.sms',
        PAYMENT: 'admin.settings.payment',
        SHIPPING: 'admin.settings.shipping',
        TAX: 'admin.settings.tax',
        NOTIFICATIONS: 'admin.settings.notifications',
    },
} as const;

/**
 * Page-level permission mappings
 * Maps routes to required permissions
 */
export const PAGE_PERMISSIONS: Record<string, string | string[]> = {
    // ADV Module
    '/adv': PERMISSIONS.ADV.DASHBOARD,
    '/adv/dashboard': PERMISSIONS.ADV.DASHBOARD,
    '/adv/validation': [PERMISSIONS.ADV.BC_INDEX, PERMISSIONS.ADV.BC_PENDING],
    '/adv/credit': PERMISSIONS.ADV.CREDIT_INDEX,
    '/adv/derogations': PERMISSIONS.ADV.BC_INDEX,
    '/adv/partners': PERMISSIONS.ADV.PARTNERS_INDEX,
    '/adv/echeances': PERMISSIONS.ADV.ECHEANCES_INDEX,
    
    // Payments
    '/payments': PERMISSIONS.PAYMENTS.DASHBOARD,
    '/payments/pending': PERMISSIONS.PAYMENTS.PENDING,
    '/payments/history': PERMISSIONS.PAYMENTS.HISTORY,
    
    // Partners
    '/partners': PERMISSIONS.PARTNERS.INDEX,
    
    // Products
    '/products': PERMISSIONS.PRODUCTS.INDEX,
    
    // Stock
    '/stock': PERMISSIONS.STOCK.INDEX,
    
    // Users & Roles
    '/users': PERMISSIONS.USERS.INDEX,
    '/roles': PERMISSIONS.ROLES.INDEX,
    '/employees': PERMISSIONS.EMPLOYEES.INDEX,
    
    // Settings
    '/settings': PERMISSIONS.SETTINGS.GENERAL,
};

/**
 * Action-level permission mappings
 * Maps UI actions to required permissions
 */
export const ACTION_PERMISSIONS = {
    // BC Actions
    BC_APPROVE: PERMISSIONS.ADV.BC_APPROVE,
    BC_REJECT: PERMISSIONS.ADV.BC_REJECT,
    BC_HOLD: PERMISSIONS.ADV.BC_HOLD,
    BC_BULK_APPROVE: PERMISSIONS.ADV.BC_BULK_APPROVE,
    BC_BULK_REJECT: PERMISSIONS.ADV.BC_BULK_REJECT,
    BC_EXPORT: PERMISSIONS.ADV.BC_EXPORT,
    
    // Credit Actions
    CREDIT_UPDATE_LIMIT: PERMISSIONS.ADV.CREDIT_UPDATE_LIMIT,
    CREDIT_APPROVE_INCREASE: PERMISSIONS.ADV.CREDIT_APPROVE_INCREASE,
    
    // Partner Actions
    PARTNER_VALIDATE: PERMISSIONS.ADV.PARTNERS_VALIDATE,
    PARTNER_REJECT: PERMISSIONS.ADV.PARTNERS_REJECT,
    PARTNER_BLOCK: PERMISSIONS.ADV.PARTNERS_BLOCK,
    PARTNER_EDIT: PERMISSIONS.ADV.PARTNERS_EDIT,
    
    // Payment Actions
    PAYMENT_VALIDATE: PERMISSIONS.PAYMENTS.VALIDATE,
    PAYMENT_REJECT: PERMISSIONS.PAYMENTS.REJECT,
    PAYMENT_CREATE: PERMISSIONS.PAYMENTS.CREATE,
} as const;
