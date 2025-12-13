# RBAC Implementation Guide

## Overview

This application implements a comprehensive Role-Based Access Control (RBAC) system that controls access to pages, actions, and UI elements based on user permissions and roles.

## Architecture

### Core Components

1. **Types** (`src/types/rbac.types.ts`)
   - Permission and role type definitions
   - User capabilities interface
   - Permission check options

2. **Utilities** (`src/lib/rbac/rbac.utils.ts`)
   - Core permission checking functions
   - Role validation
   - Permission grouping and filtering

3. **Hooks** (`src/hooks/usePermissions.ts`)
   - React hook for permission checks
   - Memoized permission arrays
   - Convenience methods

4. **Components** (`src/components/rbac/`)
   - `Can` - Conditional rendering based on permissions
   - `ProtectedRoute` - Route-level protection
   - `PermissionGate` - Higher-order permission wrapper

5. **Constants** (`src/lib/rbac/permissions.ts`)
   - Centralized permission definitions
   - Page and action permission mappings

## Usage Examples

### 1. Protecting Routes

```tsx
import { ProtectedRoute } from '@/components/rbac';
import { PERMISSIONS } from '@/lib/rbac/permissions';

// Single permission
<ProtectedRoute requiredPermission={PERMISSIONS.ADV.DASHBOARD}>
  <AdvDashboard />
</ProtectedRoute>

// Multiple permissions (ANY)
<ProtectedRoute requiredPermission={[
  PERMISSIONS.ADV.BC_APPROVE,
  PERMISSIONS.ADV.BC_REJECT
]}>
  <BCManagement />
</ProtectedRoute>

// Multiple permissions (ALL)
<ProtectedRoute 
  requiredPermission={[
    PERMISSIONS.ADV.BC_APPROVE,
    PERMISSIONS.ADV.CREDIT_UPDATE_LIMIT
  ]}
  requireAll={true}
>
  <AdvancedManagement />
</ProtectedRoute>

// Role-based protection
<ProtectedRoute requiredRole="admin">
  <AdminPanel />
</ProtectedRoute>
```

### 2. Conditional UI Rendering

```tsx
import { Can } from '@/components/rbac';
import { PERMISSIONS } from '@/lib/rbac/permissions';

function BCActionPanel() {
  return (
    <div>
      {/* Show approve button only if user has permission */}
      <Can permission={PERMISSIONS.ADV.BC_APPROVE}>
        <button onClick={handleApprove}>Approuver</button>
      </Can>

      {/* Show reject button only if user has permission */}
      <Can permission={PERMISSIONS.ADV.BC_REJECT}>
        <button onClick={handleReject}>Rejeter</button>
      </Can>

      {/* Show bulk actions only if user has permission */}
      <Can permission={PERMISSIONS.ADV.BC_BULK_APPROVE}>
        <button onClick={handleBulkApprove}>Approuver en masse</button>
      </Can>

      {/* With fallback content */}
      <Can 
        permission={PERMISSIONS.ADV.BC_EXPORT}
        fallback={<p>Export non disponible</p>}
      >
        <button onClick={handleExport}>Exporter</button>
      </Can>
    </div>
  );
}
```

### 3. Using the usePermissions Hook

```tsx
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/permissions';

function MyComponent() {
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
  if (canApproveBC) {
    // Show approve UI
  }

  if (isAdmin()) {
    // Show admin features
  }

  return (
    <div>
      {canApprove && <button>Approuver</button>}
      {canManageBC && <div>BC Management Panel</div>}
    </div>
  );
}
```

### 4. Programmatic Permission Checks

```tsx
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/permissions';

function handleAction() {
  const { has } = usePermissions();

  if (!has(PERMISSIONS.ADV.BC_APPROVE)) {
    toast.error('Vous n\'avez pas la permission d\'approuver');
    return;
  }

  // Proceed with action
  approveBC();
}
```

### 5. Permission Gate Component

```tsx
import { PermissionGate } from '@/components/rbac';
import { PERMISSIONS } from '@/lib/rbac/permissions';

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      
      <PermissionGate 
        permissions={PERMISSIONS.ADV.DASHBOARD}
        fallback={<p>Accès refusé au module ADV</p>}
      >
        <AdvModule />
      </PermissionGate>

      <PermissionGate 
        permissions={[PERMISSIONS.PAYMENTS.DASHBOARD, PERMISSIONS.PAYMENTS.PENDING]}
        onUnauthorized={() => console.log('User tried to access payments')}
      >
        <PaymentsModule />
      </PermissionGate>
    </div>
  );
}
```

## Permission Structure

### Permission Naming Convention

Permissions follow the pattern: `admin.{module}.{resource}.{action}`

Examples:
- `admin.adv.bc.approve` - Approve purchase orders in ADV module
- `admin.adv.credit.update-limit` - Update credit limits
- `admin.partners.edit` - Edit partner information
- `admin.products.delete` - Delete products

### Available Permission Categories

1. **ADV Module**
   - Dashboard, Partners, Credit, BC, Payment Terms, Echeances, Pricing, Documents, Analytics, Communication, Reports, Workflow

2. **Bon de Commandes**
   - Index, Show, Create, Edit, Delete, Approve, Reject, Cancel, Export, Print

3. **Payments**
   - Dashboard, Pending, History, Show, Create, Validate, Reject, Lettering

4. **Partners**
   - Index, Show, Create, Edit, Delete, Activate, Deactivate, Credit Limit, Pricing, Export

5. **Products**
   - Index, Show, Create, Edit, Delete, Import, Export, Pricing, Categories

6. **Stock**
   - Index, Show, Adjust, Transfer, Movements, Low Stock, Inventory, Export

7. **Users & Roles**
   - Full CRUD operations on users, roles, and permissions

8. **Settings**
   - General, Business, Email, SMS, Payment, Shipping, Tax, Notifications

## User Response Structure

The login API returns a comprehensive user object with permissions:

```json
{
  "user": {
    "id": 2,
    "name": "Admin",
    "email": "admin@foodsolutions.ma",
    "roles": {
      "all": ["admin"],
      "primary": "admin",
      "count": 1,
      "details": [...]
    },
    "permissions": {
      "from_roles": [...],
      "direct": [...],
      "all": [...],
      "blacklisted": [],
      "effective": [...],
      "summary": {
        "total_from_roles": 424,
        "total_direct": 0,
        "total_all": 424,
        "total_blacklisted": 0,
        "total_effective": 424
      }
    },
    "can": {
      "access_adv": true,
      "validate_partners": true,
      "manage_credit": true,
      "approve_bc": true,
      "bulk_approve_bc": true,
      "access_dispatcher": true,
      "access_magasinier": true,
      "access_admin": true,
      "is_root": false
    }
  }
}
```

## Best Practices

### 1. Use Constants
Always use permission constants from `PERMISSIONS` object instead of hardcoding strings:

```tsx
// ✅ Good
<Can permission={PERMISSIONS.ADV.BC_APPROVE}>

// ❌ Bad
<Can permission="admin.adv.bc.approve">
```

### 2. Granular Permissions
Apply permissions at the most specific level:

```tsx
// ✅ Good - Specific action permissions
<Can permission={PERMISSIONS.ADV.BC_APPROVE}>
  <button>Approuver</button>
</Can>

// ❌ Bad - Too broad
<Can permission={PERMISSIONS.ADV.DASHBOARD}>
  <button>Approuver</button>
</Can>
```

### 3. Combine with UI State
Disable buttons instead of hiding them when appropriate:

```tsx
const { has } = usePermissions();
const canApprove = has(PERMISSIONS.ADV.BC_APPROVE);

<button 
  disabled={!canApprove}
  title={!canApprove ? 'Permission requise' : ''}
>
  Approuver
</button>
```

### 4. Handle Permission Errors
Always provide feedback when actions fail due to permissions:

```tsx
const handleApprove = () => {
  if (!has(PERMISSIONS.ADV.BC_APPROVE)) {
    toast.error('Permission insuffisante pour approuver');
    return;
  }
  // Proceed
};
```

### 5. Test with Different Roles
Test your UI with different user roles to ensure proper access control:
- Admin (all permissions)
- ADV Staff (limited to ADV module)
- Dispatcher (logistics only)
- Magasinier (warehouse only)

## Security Considerations

1. **Client-side Only**
   - RBAC on frontend is for UX only
   - Always validate permissions on backend
   - Never trust client-side permission checks for security

2. **Token Management**
   - Permissions are loaded from API on login
   - Stored in AuthContext
   - Cleared on logout

3. **Permission Updates**
   - If permissions change, user must re-login
   - Consider implementing permission refresh mechanism

4. **Blacklisted Permissions**
   - System supports permission blacklisting
   - Blacklisted permissions override role permissions
   - Use for temporary access revocation

## Troubleshooting

### Permission Check Not Working

1. Verify user is logged in: `const { isAuthenticated } = useAuth();`
2. Check permission exists: `console.log(permissions);`
3. Verify permission string matches exactly
4. Check for typos in permission constants

### Route Protection Not Working

1. Ensure ProtectedRoute wraps the component
2. Verify requiredPermission is correct
3. Check user has loaded: `const { loading } = useAuth();`
4. Inspect user permissions in DevTools

### Performance Issues

1. Use `useMemo` for expensive permission checks
2. Avoid checking same permission multiple times
3. Use `Can` component instead of hook when possible
4. Consider permission caching for complex checks

## Migration Guide

### Updating Existing Pages

1. Import RBAC components:
```tsx
import { ProtectedRoute, Can } from '@/components/rbac';
import { PERMISSIONS } from '@/lib/rbac/permissions';
```

2. Wrap route in App.tsx:
```tsx
<Route path="/adv/validation" element={
  <ProtectedRoute requiredPermission={PERMISSIONS.ADV.BC_INDEX}>
    <AdvValidationPage />
  </ProtectedRoute>
} />
```

3. Add permission checks to actions:
```tsx
<Can permission={PERMISSIONS.ADV.BC_APPROVE}>
  <button onClick={handleApprove}>Approuver</button>
</Can>
```

4. Update handlers:
```tsx
const { has } = usePermissions();

const handleApprove = () => {
  if (!has(PERMISSIONS.ADV.BC_APPROVE)) {
    toast.error('Permission insuffisante');
    return;
  }
  // Proceed with approval
};
```

## API Integration

The RBAC system expects the backend API to return user permissions in the login response. Ensure your backend includes:

- `user.roles.all` - Array of role names
- `user.permissions.effective` - Array of permission strings
- `user.permissions.blacklisted` - Array of blacklisted permissions
- `user.can` - Object with capability flags

Example backend response structure is documented in the User Response Structure section above.
