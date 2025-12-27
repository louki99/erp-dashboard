# Task Permission Access Issue - Troubleshooting Guide

## Problem
User with admin role and all task permissions gets "Accès Refusé" when accessing `/tasks` route.

## Backend Response Analysis
The login response shows:
- User has 495 permissions in `permissions.effective` array
- Task permissions ARE present in the array:
  - `admin.tasks.dashboard`
  - `admin.tasks.index`
  - `admin.tasks.show`
  - etc.

## Frontend Permission Flow

### 1. Login Process (`AuthContext.tsx`)
```typescript
// Line 84-88
const userData = response.data.user;
setUser(userData);
localStorage.setItem('erp_user', JSON.stringify(userData));
```

### 2. Permission Check (`usePermissions.ts`)
```typescript
// Line 25-27
const permissions = useMemo(() => {
    return user?.permissions?.effective || [];
}, [user]);
```

### 3. Route Protection (`App.tsx`)
```typescript
<Route path="/tasks" element={
  <ProtectedRoute requiredPermission={PERMISSIONS.TASKS.DASHBOARD}>
    <TaskDashboard />
  </ProtectedRoute>
} />
```

### 4. Permission Validation (`ProtectedRoute.tsx`)
```typescript
// Line 47-50
const hasPermission = requireAll
    ? (Array.isArray(requiredPermission) ? hasAll(requiredPermission) : hasAny([requiredPermission]))
    : (Array.isArray(requiredPermission) ? hasAny(requiredPermission) : hasAny([requiredPermission]));
```

## Debugging Steps

### Step 1: Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Check for any errors during route navigation

### Step 2: Check LocalStorage
1. Open DevTools > Application tab
2. Go to Local Storage
3. Check `erp_user` key
4. Verify `permissions.effective` array exists and contains task permissions

### Step 3: Use Debug Component
The `PermissionDebug` component has been added to TaskDashboard. It will show:
- Total permissions count
- Whether permissions is an array
- Individual task permission checks
- Raw permissions object

### Step 4: Check Permission Constants
Verify that `PERMISSIONS.TASKS.DASHBOARD` matches the backend permission string:
- Frontend: `admin.tasks.dashboard`
- Backend: `admin.tasks.dashboard`
- They MUST match exactly (case-sensitive)

## Potential Issues & Solutions

### Issue 1: Permissions not in localStorage
**Symptom:** User object in localStorage doesn't have `permissions.effective`

**Solution:**
```typescript
// After login, manually verify:
const storedUser = JSON.parse(localStorage.getItem('erp_user'));
console.log('Stored permissions:', storedUser?.permissions?.effective);
```

### Issue 2: Permission string mismatch
**Symptom:** Permission exists but with different casing or format

**Solution:**
Check exact permission strings in both frontend and backend

### Issue 3: User object structure mismatch
**Symptom:** Backend sends permissions in different structure

**Solution:**
Update `AuthContext.tsx` to normalize the user object:
```typescript
const userData = {
    ...response.data.user,
    permissions: {
        ...response.data.user.permissions,
        effective: response.data.user.permissions?.effective || 
                   response.data.user.permissions?.all || []
    }
};
```

## Quick Fix to Test

Add this temporary code to `App.tsx` before the routes to bypass permission check:

```typescript
// TEMPORARY DEBUG - Remove after testing
const { user } = useAuth();
useEffect(() => {
    if (user) {
        console.log('User permissions:', user.permissions?.effective);
        console.log('Has task dashboard?', user.permissions?.effective?.includes('admin.tasks.dashboard'));
    }
}, [user]);
```

## Verification Checklist

- [ ] User object in localStorage has `permissions.effective` array
- [ ] Array contains `admin.tasks.dashboard` permission
- [ ] `PERMISSIONS.TASKS.DASHBOARD` constant equals `'admin.tasks.dashboard'`
- [ ] No console errors when navigating to `/tasks`
- [ ] PermissionDebug component shows permissions correctly
- [ ] `hasAny([PERMISSIONS.TASKS.DASHBOARD])` returns true

## Next Steps

1. Run the app and navigate to `/tasks`
2. Check the PermissionDebug component output
3. Share the debug output with me
4. Based on the output, we'll identify the exact issue

## Files Modified

1. `src/lib/rbac/permissions.ts` - Updated with all backend permissions
2. `src/components/layout/MegaMenu.tsx` - Added Tasks & Workflows menu
3. `src/pages/tasks/TaskDashboard.tsx` - Added URL parameter support + debug component
4. `src/components/debug/PermissionDebug.tsx` - Created debug component
