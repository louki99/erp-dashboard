# Advanced RBAC System - Complete Implementation

## 🎯 Overview

A professional, production-ready Role-Based Access Control (RBAC) system that provides granular permission management for your ERP application. This system controls access at multiple levels:

- **Page Level** - Protect entire routes
- **Component Level** - Show/hide UI elements
- **Action Level** - Control button clicks and operations
- **Data Level** - Filter data based on permissions

## 📁 File Structure

```
src/
├── types/
│   └── rbac.types.ts                 # Type definitions for RBAC
├── lib/
│   └── rbac/
│       ├── permissions.ts            # Permission constants and mappings
│       └── rbac.utils.ts             # Core utility functions
├── hooks/
│   └── usePermissions.ts             # React hook for permissions
├── components/
│   └── rbac/
│       ├── Can.tsx                   # Conditional rendering component
│       ├── ProtectedRoute.tsx        # Route protection component
│       ├── PermissionGate.tsx        # Permission gate wrapper
│       └── index.ts                  # Exports
├── context/
│   └── AuthContext.tsx               # Updated with RBAC types
└── docs/
    ├── RBAC_README.md                # This file
    ├── RBAC_IMPLEMENTATION_GUIDE.md  # Detailed implementation guide
    └── RBAC_EXAMPLES.tsx             # Practical code examples
```

## 🚀 Quick Start

### 1. Import the necessary components

```tsx
import { usePermissions } from '@/hooks/usePermissions';
import { Can, ProtectedRoute } from '@/components/rbac';
import { PERMISSIONS } from '@/lib/rbac/permissions';
```

### 2. Protect a route

```tsx
<Route path="/adv/validation" element={
  <ProtectedRoute requiredPermission={PERMISSIONS.ADV.BC_INDEX}>
    <AdvValidationPage />
  </ProtectedRoute>
} />
```

### 3. Conditionally render UI elements

```tsx
<Can permission={PERMISSIONS.ADV.BC_APPROVE}>
  <button onClick={handleApprove}>Approuver</button>
</Can>
```

### 4. Check permissions programmatically

```tsx
const { has } = usePermissions();

if (has(PERMISSIONS.ADV.BC_APPROVE)) {
  // User can approve
}
```

## 🔑 Key Features

### ✅ Comprehensive Permission System
- 424+ predefined permissions
- Organized by module and action
- Easy to extend and maintain

### ✅ Multiple Check Methods
- Single permission: `has(permission)`
- Multiple permissions (ANY): `hasAny([perm1, perm2])`
- Multiple permissions (ALL): `hasAll([perm1, perm2])`
- Role-based: `hasRole(role)`
- Custom logic: `can((perms) => customCheck(perms))`

### ✅ React Components
- `<Can>` - Conditional rendering
- `<ProtectedRoute>` - Route protection
- `<PermissionGate>` - Section protection

### ✅ TypeScript Support
- Fully typed
- IntelliSense support
- Type-safe permission checks

### ✅ Performance Optimized
- Memoized permission arrays
- Efficient permission lookups
- Minimal re-renders

### ✅ Developer Friendly
- Clear error messages
- Debug helpers
- Comprehensive documentation

## 📚 Core Concepts

### Permission Structure

Permissions follow a hierarchical naming convention:

```
admin.{module}.{resource}.{action}
```

Examples:
- `admin.adv.bc.approve` - Approve purchase orders
- `admin.adv.credit.update-limit` - Update credit limits
- `admin.partners.edit` - Edit partner information

### Permission Types

1. **From Roles** - Permissions inherited from assigned roles
2. **Direct** - Permissions assigned directly to user
3. **All** - Combined from roles + direct
4. **Blacklisted** - Explicitly denied permissions
5. **Effective** - Final permissions (all - blacklisted)

### User Capabilities

Pre-computed boolean flags for common checks:

```typescript
{
  access_adv: boolean;
  validate_partners: boolean;
  manage_credit: boolean;
  approve_bc: boolean;
  bulk_approve_bc: boolean;
  access_dispatcher: boolean;
  access_magasinier: boolean;
  access_admin: boolean;
  is_root: boolean;
}
```

## 🛠️ API Reference

### usePermissions Hook

```typescript
const {
  // Permission arrays
  permissions,      // string[] - Effective permissions
  roles,           // string[] - User roles
  blacklist,       // string[] - Blacklisted permissions
  isRoot,          // boolean - Is root user
  capabilities,    // UserCapabilities - Pre-computed flags

  // Check functions
  can,             // (check, options?) => boolean
  has,             // (permission) => boolean
  hasAny,          // (permissions[]) => boolean
  hasAll,          // (permissions[]) => boolean
  hasRole,         // (role) => boolean
  hasAnyRole,      // (roles[]) => boolean
  hasAllRoles,     // (roles[]) => boolean
  isAdmin,         // () => boolean
  canAccessRoute,  // (routePermissions) => boolean
  canBulk,         // (action) => boolean
  isBlacklisted,   // (permission) => boolean

  // Convenience capabilities
  canAccessAdv,
  canValidatePartners,
  canManageCredit,
  canApproveBC,
  canBulkApproveBC,
  canAccessDispatcher,
  canAccessMagasinier,
  canAccessAdmin,
} = usePermissions();
```

### Can Component

```typescript
<Can
  permission={string | string[] | function}
  options={{ requireAll?: boolean, checkBlacklist?: boolean }}
  fallback={ReactNode}
>
  {children}
</Can>
```

### ProtectedRoute Component

```typescript
<ProtectedRoute
  requiredPermission={string | string[]}
  requiredRole={string | string[]}
  requireAll={boolean}
  fallbackPath={string}
  showUnauthorized={boolean}
>
  {children}
</ProtectedRoute>
```

### PermissionGate Component

```typescript
<PermissionGate
  permissions={string | string[]}
  roles={string | string[]}
  requireAll={boolean}
  fallback={ReactNode}
  onUnauthorized={() => void}
>
  {children}
</PermissionGate>
```

## 📖 Usage Patterns

### Pattern 1: Page Protection

```tsx
// Protect entire page
<Route path="/adv/validation" element={
  <ProtectedRoute requiredPermission={PERMISSIONS.ADV.BC_INDEX}>
    <AdvValidationPage />
  </ProtectedRoute>
} />
```

### Pattern 2: Conditional Buttons

```tsx
// Show button only if permitted
<Can permission={PERMISSIONS.ADV.BC_APPROVE}>
  <button onClick={handleApprove}>Approuver</button>
</Can>
```

### Pattern 3: Disabled State

```tsx
// Disable button instead of hiding
const { has } = usePermissions();
const canApprove = has(PERMISSIONS.ADV.BC_APPROVE);

<button 
  disabled={!canApprove}
  title={!canApprove ? 'Permission requise' : ''}
>
  Approuver
</button>
```

### Pattern 4: Programmatic Checks

```tsx
// Check before action
const handleApprove = () => {
  if (!has(PERMISSIONS.ADV.BC_APPROVE)) {
    toast.error('Permission insuffisante');
    return;
  }
  // Proceed
};
```

### Pattern 5: Complex Logic

```tsx
// Multiple permission checks
const canManage = hasAny([
  PERMISSIONS.ADV.BC_APPROVE,
  PERMISSIONS.ADV.BC_REJECT
]);

const hasFullControl = hasAll([
  PERMISSIONS.ADV.BC_APPROVE,
  PERMISSIONS.ADV.CREDIT_UPDATE_LIMIT
]);
```

## 🎨 UI Patterns

### Action Panels

```tsx
function ActionPanel() {
  return (
    <div className="actions">
      <Can permission={PERMISSIONS.ADV.BC_APPROVE}>
        <button>Approuver</button>
      </Can>
      <Can permission={PERMISSIONS.ADV.BC_REJECT}>
        <button>Rejeter</button>
      </Can>
      <Can permission={PERMISSIONS.ADV.BC_EXPORT}>
        <button>Exporter</button>
      </Can>
    </div>
  );
}
```

### Navigation Menus

```tsx
function Menu() {
  const { canAccessAdv, has } = usePermissions();
  
  return (
    <nav>
      {canAccessAdv && (
        <MenuItem href="/adv">
          ADV
          {has(PERMISSIONS.ADV.BC_INDEX) && (
            <SubMenuItem href="/adv/validation">Validation</SubMenuItem>
          )}
        </MenuItem>
      )}
    </nav>
  );
}
```

### Data Grids

```tsx
function Grid() {
  const { has } = usePermissions();
  
  const columns = [
    { field: 'name' },
    {
      field: 'actions',
      cellRenderer: (params) => (
        <>
          {has(PERMISSIONS.ADV.BC_APPROVE) && (
            <button onClick={() => approve(params.data.id)}>
              Approuver
            </button>
          )}
        </>
      )
    }
  ];
}
```

## 🔒 Security Best Practices

### ⚠️ Client-Side Only

**IMPORTANT**: This RBAC system is for UX only. Always validate permissions on the backend.

```tsx
// ✅ Good - Check on both client and server
const handleApprove = async () => {
  if (!has(PERMISSIONS.ADV.BC_APPROVE)) {
    toast.error('Permission insuffisante');
    return;
  }
  
  try {
    await api.approve(bcId); // Server validates again
  } catch (error) {
    // Handle server-side permission error
  }
};

// ❌ Bad - Client-side only
const handleApprove = async () => {
  await api.approve(bcId); // No client check
};
```

### 🔐 Token Management

- Permissions loaded from API on login
- Stored in AuthContext (memory)
- User data persisted in localStorage
- Token stored separately
- Cleared on logout

### 🔄 Permission Updates

If user permissions change:
1. User must re-login to get new permissions
2. Or implement a permission refresh mechanism
3. Consider WebSocket for real-time updates

### 🚫 Blacklisting

Use blacklisting for temporary access revocation:
- Blacklisted permissions override role permissions
- Useful for temporary restrictions
- Doesn't require role modification

## 🧪 Testing

### Test with Different Roles

1. **Admin** - Full access (424 permissions)
2. **ADV Staff** - ADV module only (65 permissions)
3. **Dispatcher** - Logistics only
4. **Magasinier** - Warehouse only

### Test Scenarios

- ✅ User with permission sees button
- ✅ User without permission doesn't see button
- ✅ Disabled state shows tooltip
- ✅ Protected route redirects unauthorized users
- ✅ API calls fail gracefully without permission
- ✅ Blacklisted permissions are denied
- ✅ Root user bypasses all checks

## 📊 Performance Considerations

### Optimization Tips

1. **Use Memoization**
   ```tsx
   const canApprove = useMemo(
     () => has(PERMISSIONS.ADV.BC_APPROVE),
     [has]
   );
   ```

2. **Batch Permission Checks**
   ```tsx
   const permissions = useMemo(() => ({
     canApprove: has(PERMISSIONS.ADV.BC_APPROVE),
     canReject: has(PERMISSIONS.ADV.BC_REJECT),
     canExport: has(PERMISSIONS.ADV.BC_EXPORT),
   }), [has]);
   ```

3. **Use Can Component**
   ```tsx
   // ✅ Better - Component handles memoization
   <Can permission={PERMISSIONS.ADV.BC_APPROVE}>
     <Button />
   </Can>
   
   // ❌ Slower - Hook called in every render
   {has(PERMISSIONS.ADV.BC_APPROVE) && <Button />}
   ```

## 🐛 Troubleshooting

### Permission Check Not Working

1. Check user is logged in
2. Verify permission string matches exactly
3. Check for typos in constants
4. Inspect user.permissions.effective in DevTools
5. Verify permission exists in backend

### Route Not Protected

1. Ensure ProtectedRoute wraps component
2. Check requiredPermission is correct
3. Verify user has loaded (check loading state)
4. Check console for errors

### Performance Issues

1. Use Can component instead of hook
2. Memoize expensive checks
3. Avoid checking same permission multiple times
4. Consider permission caching

## 📝 Adding New Permissions

### 1. Add to Backend

First, add the permission to your Laravel backend.

### 2. Add to Constants

```typescript
// src/lib/rbac/permissions.ts
export const PERMISSIONS = {
  ADV: {
    // ... existing
    NEW_ACTION: 'admin.adv.new-action',
  },
};
```

### 3. Add to Page Mappings (if needed)

```typescript
// src/lib/rbac/permissions.ts
export const PAGE_PERMISSIONS = {
  '/new-page': PERMISSIONS.ADV.NEW_ACTION,
};
```

### 4. Use in Components

```tsx
<Can permission={PERMISSIONS.ADV.NEW_ACTION}>
  <NewFeature />
</Can>
```

## 🚀 Deployment Checklist

- [ ] All routes protected with ProtectedRoute
- [ ] All actions checked with Can or has()
- [ ] Backend validates all permissions
- [ ] Error handling for permission failures
- [ ] Tested with different user roles
- [ ] Performance optimized
- [ ] Documentation updated
- [ ] Team trained on RBAC usage

## 📚 Additional Resources

- [Implementation Guide](./RBAC_IMPLEMENTATION_GUIDE.md) - Detailed guide
- [Code Examples](./RBAC_EXAMPLES.tsx) - Practical examples
- [API Documentation](./ADV__Module__API__Documentation__fo__React.md) - Backend API

## 🤝 Support

For questions or issues:
1. Check the documentation
2. Review code examples
3. Inspect user permissions in DevTools
4. Check backend permission configuration
5. Contact the development team

## 📄 License

Internal use only - Food Solutions ERP System

---

**Version**: 1.0.0  
**Last Updated**: December 2024  
**Maintained by**: Development Team
