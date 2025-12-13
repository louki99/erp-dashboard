# RBAC Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Import What You Need

```tsx
import { usePermissions } from '@/hooks/usePermissions';
import { Can, ProtectedRoute } from '@/components/rbac';
import { PERMISSIONS } from '@/lib/rbac/permissions';
```

### Step 2: Protect Your Routes

In your `App.tsx` or routing file:

```tsx
<Route path="/adv/validation" element={
  <ProtectedRoute requiredPermission={PERMISSIONS.ADV.BC_INDEX}>
    <AdvValidationPage />
  </ProtectedRoute>
} />
```

### Step 3: Control UI Elements

```tsx
function MyComponent() {
  return (
    <div>
      {/* Show button only if user has permission */}
      <Can permission={PERMISSIONS.ADV.BC_APPROVE}>
        <button onClick={handleApprove}>Approuver</button>
      </Can>
    </div>
  );
}
```

### Step 4: Check Permissions in Code

```tsx
function MyComponent() {
  const { has } = usePermissions();

  const handleAction = () => {
    if (!has(PERMISSIONS.ADV.BC_APPROVE)) {
      toast.error('Permission insuffisante');
      return;
    }
    // Proceed with action
  };

  return <button onClick={handleAction}>Action</button>;
}
```

## 📋 Common Use Cases

### Use Case 1: Action Buttons

```tsx
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
```

### Use Case 2: Conditional Sections

```tsx
const { canAccessAdv, canAccessAdmin } = usePermissions();

return (
  <div>
    {canAccessAdv && <AdvModule />}
    {canAccessAdmin && <AdminPanel />}
  </div>
);
```

### Use Case 3: Disabled State

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

### Use Case 4: Multiple Permissions

```tsx
const { hasAny, hasAll } = usePermissions();

// User needs ANY of these permissions
const canManage = hasAny([
  PERMISSIONS.ADV.BC_APPROVE,
  PERMISSIONS.ADV.BC_REJECT
]);

// User needs ALL of these permissions
const hasFullControl = hasAll([
  PERMISSIONS.ADV.BC_APPROVE,
  PERMISSIONS.ADV.CREDIT_UPDATE_LIMIT
]);
```

## 🎯 Available Permissions

### ADV Module
- `PERMISSIONS.ADV.DASHBOARD` - Access ADV dashboard
- `PERMISSIONS.ADV.BC_APPROVE` - Approve purchase orders
- `PERMISSIONS.ADV.BC_REJECT` - Reject purchase orders
- `PERMISSIONS.ADV.BC_HOLD` - Hold purchase orders
- `PERMISSIONS.ADV.BC_EXPORT` - Export purchase orders
- `PERMISSIONS.ADV.BC_BULK_APPROVE` - Bulk approve
- `PERMISSIONS.ADV.CREDIT_INDEX` - View credit
- `PERMISSIONS.ADV.CREDIT_UPDATE_LIMIT` - Update credit limits
- `PERMISSIONS.ADV.PARTNERS_INDEX` - View partners
- `PERMISSIONS.ADV.PARTNERS_VALIDATE` - Validate partners

### Payments
- `PERMISSIONS.PAYMENTS.DASHBOARD` - Access payments
- `PERMISSIONS.PAYMENTS.VALIDATE` - Validate payments
- `PERMISSIONS.PAYMENTS.REJECT` - Reject payments

### Partners
- `PERMISSIONS.PARTNERS.INDEX` - View partners
- `PERMISSIONS.PARTNERS.CREATE` - Create partners
- `PERMISSIONS.PARTNERS.EDIT` - Edit partners
- `PERMISSIONS.PARTNERS.DELETE` - Delete partners

### Products
- `PERMISSIONS.PRODUCTS.INDEX` - View products
- `PERMISSIONS.PRODUCTS.CREATE` - Create products
- `PERMISSIONS.PRODUCTS.EDIT` - Edit products
- `PERMISSIONS.PRODUCTS.DELETE` - Delete products

[See full list in `src/lib/rbac/permissions.ts`]

## 🔍 Debugging

### Check User Permissions

```tsx
const { permissions, roles, capabilities } = usePermissions();

console.log('Permissions:', permissions);
console.log('Roles:', roles);
console.log('Capabilities:', capabilities);
```

### Check Specific Permission

```tsx
const { has } = usePermissions();

console.log('Can approve?', has(PERMISSIONS.ADV.BC_APPROVE));
```

### View in DevTools

Open browser DevTools and check:
```javascript
// In console
JSON.parse(localStorage.getItem('erp_user'))
```

## ⚠️ Important Notes

1. **Backend Validation Required**
   - Client-side checks are for UX only
   - Always validate permissions on backend

2. **Permission Updates**
   - User must re-login to get new permissions
   - Or implement a refresh mechanism

3. **Performance**
   - Use `<Can>` component when possible
   - Memoize expensive permission checks

4. **Security**
   - Never trust client-side permission checks
   - Always validate on server

## 📚 Next Steps

- Read [RBAC_README.md](./RBAC_README.md) for complete overview
- Check [RBAC_IMPLEMENTATION_GUIDE.md](./RBAC_IMPLEMENTATION_GUIDE.md) for detailed guide
- Review [RBAC_EXAMPLES.tsx](./RBAC_EXAMPLES.tsx) for code examples

## 🆘 Need Help?

Common issues:
- **Permission not working?** Check spelling and verify user has permission
- **Route not protected?** Ensure ProtectedRoute wraps the component
- **Button still showing?** Verify permission constant is correct

---

**Ready to implement RBAC in your pages? Start with the examples above!**
