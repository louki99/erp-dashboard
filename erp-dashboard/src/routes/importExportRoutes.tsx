/**
 * Import/Export Module Routes Configuration
 * 
 * Production routes for the Import/Export module
 * Dynamic data import and export with template management
 */

import { ImportExportPage } from '@/pages/import-export/ImportExportPage';
import { ImportPage } from '@/pages/import-export/ImportPage';
import { ExportPage } from '@/pages/import-export/ExportPage';
import { BatchHistoryPage } from '@/pages/import-export/BatchHistoryPage';
import { TemplatesPage } from '@/pages/import-export/TemplatesPage';

/**
 * Import/Export Module Route Configuration
 * All routes are protected and require authentication
 */
export const importExportRoutes = {
    path: '/import-export',
    children: [
        {
            path: '',
            element: <ImportExportPage />,
        },
        {
            path: 'import',
            element: <ImportPage />,
        },
        {
            path: 'export',
            element: <ExportPage />,
        },
        {
            path: 'batches',
            element: <BatchHistoryPage />,
        },
        {
            path: 'templates',
            element: <TemplatesPage />,
        },
    ],
};

/**
 * Route Paths for Reference
 * 
 * /import-export - Dashboard with statistics and recent activity
 * /import-export/import - Import data wizard
 * /import-export/export - Export data wizard
 * /import-export/batches - Batch operation history
 * /import-export/templates - Template management
 * 
 * Features:
 * - File upload (CSV, XLSX, XLS)
 * - Real-time progress tracking
 * - Error reporting and validation
 * - Template-based configuration
 * - Batch processing with queue support
 * - Export with filters
 * - Statistics and monitoring
 */
