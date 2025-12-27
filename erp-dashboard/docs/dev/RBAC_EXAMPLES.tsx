/**
 * RBAC Implementation Examples
 * Practical examples of using the RBAC system
 */

import { usePermissions } from '@/hooks/usePermissions';
import { Can, ProtectedRoute, PermissionGate } from '@/components/rbac';
import { PERMISSIONS } from '@/lib/rbac/permissions';

// ============================================================================
// EXAMPLE 1: Protected Route
// ============================================================================

// In your App.tsx or routing configuration
function AppRoutes() {
  return (
    <>
      {/* Single permission required */}
      <Route path="/adv/validation" element={
        <ProtectedRoute requiredPermission={PERMISSIONS.ADV.BC_INDEX}>
          <AdvValidationPage />
        </ProtectedRoute>
      } />

      {/* Multiple permissions (user needs ANY) */}
      <Route path="/adv/credit" element={
        <ProtectedRoute requiredPermission={[
          PERMISSIONS.ADV.CREDIT_INDEX,
          PERMISSIONS.ADV.CREDIT_HISTORY
        ]}>
          <AdvCreditPage />
        </ProtectedRoute>
      } />

      {/* Multiple permissions (user needs ALL) */}
      <Route path="/admin/settings" element={
        <ProtectedRoute 
          requiredPermission={[
            PERMISSIONS.SETTINGS.GENERAL,
            PERMISSIONS.SETTINGS.BUSINESS
          ]}
          requireAll={true}
        >
          <SettingsPage />
        </ProtectedRoute>
      } />

      {/* Role-based protection */}
      <Route path="/admin" element={
        <ProtectedRoute requiredRole="admin">
          <AdminDashboard />
        </ProtectedRoute>
      } />
    </>
  );
}

// ============================================================================
// EXAMPLE 2: Conditional UI Elements with Can Component
// ============================================================================

function BCActionPanel({ bcId }: { bcId: number }) {
  return (
    <div className="flex gap-2">
      {/* Show approve button only if user has permission */}
      <Can permission={PERMISSIONS.ADV.BC_APPROVE}>
        <button 
          onClick={() => handleApprove(bcId)}
          className="btn-success"
        >
          Approuver
        </button>
      </Can>

      {/* Show reject button only if user has permission */}
      <Can permission={PERMISSIONS.ADV.BC_REJECT}>
        <button 
          onClick={() => handleReject(bcId)}
          className="btn-danger"
        >
          Rejeter
        </button>
      </Can>

      {/* Show hold button only if user has permission */}
      <Can permission={PERMISSIONS.ADV.BC_HOLD}>
        <button 
          onClick={() => handleHold(bcId)}
          className="btn-warning"
        >
          Mettre en attente
        </button>
      </Can>

      {/* With fallback content */}
      <Can 
        permission={PERMISSIONS.ADV.BC_EXPORT}
        fallback={<span className="text-gray-400">Export non disponible</span>}
      >
        <button onClick={() => handleExport(bcId)}>
          Exporter
        </button>
      </Can>
    </div>
  );
}

// ============================================================================
// EXAMPLE 3: Using usePermissions Hook
// ============================================================================

function AdvDerogationsPage() {
  const { 
    has, 
    hasAny, 
    hasAll,
    canApproveBC,
    canBulkApproveBC,
    isAdmin 
  } = usePermissions();

  // Check single permission
  const canApprove = has(PERMISSIONS.ADV.BC_APPROVE);
  const canReject = has(PERMISSIONS.ADV.BC_REJECT);

  // Check multiple permissions (ANY)
  const canManageBC = hasAny([
    PERMISSIONS.ADV.BC_APPROVE,
    PERMISSIONS.ADV.BC_REJECT,
    PERMISSIONS.ADV.BC_HOLD
  ]);

  // Check multiple permissions (ALL)
  const canFullyManage = hasAll([
    PERMISSIONS.ADV.BC_APPROVE,
    PERMISSIONS.ADV.BC_REJECT,
    PERMISSIONS.ADV.CREDIT_UPDATE_LIMIT
  ]);

  // Use convenience capabilities
  const showBulkActions = canBulkApproveBC;
  const showAdminPanel = isAdmin();

  return (
    <div>
      <h1>Dérogations</h1>

      {/* Conditional rendering based on permissions */}
      {canManageBC && (
        <div className="management-panel">
          {canApprove && <button>Approuver</button>}
          {canReject && <button>Rejeter</button>}
        </div>
      )}

      {/* Show bulk actions only if permitted */}
      {showBulkActions && (
        <div className="bulk-actions">
          <button>Approuver en masse</button>
          <button>Rejeter en masse</button>
        </div>
      )}

      {/* Admin-only features */}
      {showAdminPanel && (
        <div className="admin-panel">
          <h2>Administration</h2>
          {/* Admin features */}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// EXAMPLE 4: Programmatic Permission Checks with Error Handling
// ============================================================================

function BCApprovalComponent() {
  const { has } = usePermissions();

  const handleApprove = async (bcId: number) => {
    // Check permission before proceeding
    if (!has(PERMISSIONS.ADV.BC_APPROVE)) {
      toast.error('Vous n\'avez pas la permission d\'approuver ce BC');
      return;
    }

    try {
      await approveBC(bcId);
      toast.success('BC approuvé avec succès');
    } catch (error) {
      toast.error('Erreur lors de l\'approbation');
    }
  };

  const handleBulkApprove = async (bcIds: number[]) => {
    // Check bulk permission
    if (!has(PERMISSIONS.ADV.BC_BULK_APPROVE)) {
      toast.error('Vous n\'avez pas la permission d\'approuver en masse');
      return;
    }

    try {
      await bulkApproveBC(bcIds);
      toast.success(`${bcIds.length} BCs approuvés`);
    } catch (error) {
      toast.error('Erreur lors de l\'approbation en masse');
    }
  };

  return (
    <div>
      <button onClick={() => handleApprove(123)}>
        Approuver BC #123
      </button>
      <button onClick={() => handleBulkApprove([1, 2, 3])}>
        Approuver sélection
      </button>
    </div>
  );
}

// ============================================================================
// EXAMPLE 5: Disabled State Based on Permissions
// ============================================================================

function ActionButtons({ bcId }: { bcId: number }) {
  const { has } = usePermissions();

  const canApprove = has(PERMISSIONS.ADV.BC_APPROVE);
  const canReject = has(PERMISSIONS.ADV.BC_REJECT);
  const canExport = has(PERMISSIONS.ADV.BC_EXPORT);

  return (
    <div className="flex gap-2">
      {/* Disable button instead of hiding it */}
      <button
        onClick={() => handleApprove(bcId)}
        disabled={!canApprove}
        title={!canApprove ? 'Permission requise pour approuver' : 'Approuver ce BC'}
        className={cn(
          "btn",
          !canApprove && "opacity-50 cursor-not-allowed"
        )}
      >
        Approuver
      </button>

      <button
        onClick={() => handleReject(bcId)}
        disabled={!canReject}
        title={!canReject ? 'Permission requise pour rejeter' : 'Rejeter ce BC'}
        className={cn(
          "btn btn-danger",
          !canReject && "opacity-50 cursor-not-allowed"
        )}
      >
        Rejeter
      </button>

      <button
        onClick={() => handleExport(bcId)}
        disabled={!canExport}
        title={!canExport ? 'Permission requise pour exporter' : 'Exporter'}
        className={cn(
          "btn btn-secondary",
          !canExport && "opacity-50 cursor-not-allowed"
        )}
      >
        Exporter
      </button>
    </div>
  );
}

// ============================================================================
// EXAMPLE 6: Permission Gate for Sections
// ============================================================================

function Dashboard() {
  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      {/* ADV Module Section */}
      <PermissionGate 
        permissions={PERMISSIONS.ADV.DASHBOARD}
        fallback={
          <div className="text-gray-500">
            Module ADV non disponible
          </div>
        }
      >
        <section className="adv-module">
          <h2>Module ADV</h2>
          <AdvDashboardContent />
        </section>
      </PermissionGate>

      {/* Payments Section */}
      <PermissionGate 
        permissions={[
          PERMISSIONS.PAYMENTS.DASHBOARD,
          PERMISSIONS.PAYMENTS.PENDING
        ]}
        onUnauthorized={() => {
          console.log('User attempted to access payments without permission');
        }}
      >
        <section className="payments-module">
          <h2>Paiements</h2>
          <PaymentsDashboardContent />
        </section>
      </PermissionGate>

      {/* Admin Section - Requires ALL permissions */}
      <PermissionGate 
        permissions={[
          PERMISSIONS.USERS.INDEX,
          PERMISSIONS.ROLES.INDEX
        ]}
        requireAll={true}
        fallback={<p>Section administration réservée</p>}
      >
        <section className="admin-module">
          <h2>Administration</h2>
          <AdminContent />
        </section>
      </PermissionGate>
    </div>
  );
}

// ============================================================================
// EXAMPLE 7: Complex Permission Logic
// ============================================================================

function AdvancedBCManagement() {
  const { has, hasAny, hasAll, isAdmin } = usePermissions();

  // Complex permission checks
  const canManageBC = hasAny([
    PERMISSIONS.ADV.BC_APPROVE,
    PERMISSIONS.ADV.BC_REJECT,
    PERMISSIONS.ADV.BC_HOLD
  ]);

  const canFullControl = hasAll([
    PERMISSIONS.ADV.BC_APPROVE,
    PERMISSIONS.ADV.BC_REJECT,
    PERMISSIONS.ADV.BC_HOLD,
    PERMISSIONS.ADV.CREDIT_UPDATE_LIMIT
  ]);

  const canBulkOperations = hasAny([
    PERMISSIONS.ADV.BC_BULK_APPROVE,
    PERMISSIONS.ADV.BC_BULK_REJECT
  ]);

  // Admin bypass
  const hasFullAccess = isAdmin() || canFullControl;

  return (
    <div>
      {/* Basic management */}
      {canManageBC && (
        <div className="basic-management">
          <h3>Gestion BC</h3>
          {/* Basic BC management UI */}
        </div>
      )}

      {/* Advanced management */}
      {canFullControl && (
        <div className="advanced-management">
          <h3>Gestion Avancée</h3>
          {/* Advanced features */}
        </div>
      )}

      {/* Bulk operations */}
      {canBulkOperations && (
        <div className="bulk-operations">
          <h3>Opérations en Masse</h3>
          {/* Bulk action UI */}
        </div>
      )}

      {/* Admin panel */}
      {hasFullAccess && (
        <div className="admin-panel">
          <h3>Panneau Administrateur</h3>
          {/* Admin-only features */}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// EXAMPLE 8: Data Grid with Permission-Based Actions
// ============================================================================

function BCDataGrid() {
  const { has } = usePermissions();

  const columnDefs = useMemo<ColDef[]>(() => [
    { field: 'order_number', headerName: 'N° BC' },
    { field: 'partner_name', headerName: 'Partenaire' },
    { field: 'amount', headerName: 'Montant' },
    {
      field: 'actions',
      headerName: 'Actions',
      cellRenderer: (params: any) => {
        const bc = params.data;
        
        return (
          <div className="flex gap-2">
            {/* Show approve button only if user has permission */}
            {has(PERMISSIONS.ADV.BC_APPROVE) && (
              <button 
                onClick={() => handleApprove(bc.id)}
                className="btn-sm btn-success"
              >
                Approuver
              </button>
            )}

            {/* Show reject button only if user has permission */}
            {has(PERMISSIONS.ADV.BC_REJECT) && (
              <button 
                onClick={() => handleReject(bc.id)}
                className="btn-sm btn-danger"
              >
                Rejeter
              </button>
            )}

            {/* Show edit button only if user has permission */}
            {has(PERMISSIONS.BON_COMMANDES.EDIT) && (
              <button 
                onClick={() => handleEdit(bc.id)}
                className="btn-sm"
              >
                Modifier
              </button>
            )}
          </div>
        );
      }
    }
  ], [has]);

  return <DataGrid columnDefs={columnDefs} rowData={bcs} />;
}

// ============================================================================
// EXAMPLE 9: Form with Permission-Based Fields
// ============================================================================

function BCForm() {
  const { has } = usePermissions();

  const canEditAmount = has(PERMISSIONS.BON_COMMANDES.EDIT);
  const canApprove = has(PERMISSIONS.ADV.BC_APPROVE);
  const canUpdateCredit = has(PERMISSIONS.ADV.CREDIT_UPDATE_LIMIT);

  return (
    <form>
      {/* Basic fields - always visible */}
      <input name="partner" placeholder="Partenaire" />
      <input name="product" placeholder="Produit" />

      {/* Amount field - editable only with permission */}
      <input 
        name="amount" 
        placeholder="Montant"
        disabled={!canEditAmount}
        title={!canEditAmount ? 'Permission requise pour modifier le montant' : ''}
      />

      {/* Credit limit field - visible only with permission */}
      {canUpdateCredit && (
        <input 
          name="credit_limit" 
          placeholder="Limite de crédit"
        />
      )}

      {/* Approval section - visible only with permission */}
      {canApprove && (
        <div className="approval-section">
          <h3>Approbation</h3>
          <textarea name="approval_comment" placeholder="Commentaire" />
          <button type="submit">Approuver</button>
        </div>
      )}
    </form>
  );
}

// ============================================================================
// EXAMPLE 10: Menu Items Based on Permissions
// ============================================================================

function NavigationMenu() {
  const { has, canAccessAdv, canAccessAdmin } = usePermissions();

  return (
    <nav>
      <ul>
        {/* Dashboard - always visible */}
        <li><a href="/">Dashboard</a></li>

        {/* ADV Module - visible if user has access */}
        {canAccessAdv && (
          <li>
            <a href="/adv">ADV</a>
            <ul>
              {has(PERMISSIONS.ADV.BC_INDEX) && (
                <li><a href="/adv/validation">Validation BC</a></li>
              )}
              {has(PERMISSIONS.ADV.CREDIT_INDEX) && (
                <li><a href="/adv/credit">Crédit</a></li>
              )}
              {has(PERMISSIONS.ADV.PARTNERS_INDEX) && (
                <li><a href="/adv/partners">Partenaires</a></li>
              )}
            </ul>
          </li>
        )}

        {/* Payments - visible if user has access */}
        {has(PERMISSIONS.PAYMENTS.DASHBOARD) && (
          <li>
            <a href="/payments">Paiements</a>
          </li>
        )}

        {/* Admin - visible only for admins */}
        {canAccessAdmin && (
          <li>
            <a href="/admin">Administration</a>
            <ul>
              {has(PERMISSIONS.USERS.INDEX) && (
                <li><a href="/admin/users">Utilisateurs</a></li>
              )}
              {has(PERMISSIONS.ROLES.INDEX) && (
                <li><a href="/admin/roles">Rôles</a></li>
              )}
              {has(PERMISSIONS.SETTINGS.GENERAL) && (
                <li><a href="/admin/settings">Paramètres</a></li>
              )}
            </ul>
          </li>
        )}
      </ul>
    </nav>
  );
}

// ============================================================================
// Helper Functions (referenced in examples)
// ============================================================================

const handleApprove = (bcId: number) => console.log('Approve', bcId);
const handleReject = (bcId: number) => console.log('Reject', bcId);
const handleHold = (bcId: number) => console.log('Hold', bcId);
const handleExport = (bcId: number) => console.log('Export', bcId);
const handleEdit = (bcId: number) => console.log('Edit', bcId);
const approveBC = async (bcId: number) => {};
const bulkApproveBC = async (bcIds: number[]) => {};
const toast = { error: console.error, success: console.log };
