/**
 * ADV Module Routes Configuration
 * 
 * Production routes for the ADV (Administration des Ventes) module
 * These routes are already integrated into App.tsx
 */

import {
    AdvDashboard,
    AdvValidationPage,
    AdvPartnersPage,
    AdvCreditPage,
    AdvEcheancesPage,
    AdvDerogationsPage,
} from '@/pages/adv';

/**
 * ADV Module Route Configuration
 * All routes are protected and require authentication
 */
export const advRoutes = {
    path: '/adv',
    children: [
        {
            path: '',
            element: <AdvDashboard />,
        },
        {
            path: 'validation',
            element: <AdvValidationPage />,
        },
        {
            path: 'partners',
            element: <AdvPartnersPage />,
        },
        {
            path: 'credit',
            element: <AdvCreditPage />,
        },
        {
            path: 'echeances',
            element: <AdvEcheancesPage />,
        },
        {
            path: 'derogations',
            element: <AdvDerogationsPage />,
        },
    ],
};

/**
 * Route Paths for Reference
 * 
 * /adv - ADV Dashboard
 * /adv/validation - BC Validation
 * /adv/partners - Partner Management
 * /adv/credit - Credit Management
 * /adv/echeances - Due Dates/Overdue Invoices
 * /adv/derogations - Credit Derogation Approval
 * 
 * All routes are already added to App.tsx
 * Navigation is integrated in MegaMenu.tsx
 */

