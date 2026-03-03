# Logout Fix - Clear Collections on Logout

## Issue

After logout, the app was still showing cloud data from the logged-in user instead of switching back to anonymous/local mode.

## Root Cause

On logout, we were:
- ✅ Clearing cloudWorkspaces state
- ✅ Clearing IndexedDB cache
- ✅ Clearing auth tokens
- ❌ **NOT clearing collections state** ← This was the bug!

The `collections` Redux state still contained cloud collections, so they remained visible in the UI.

## Fix

### 1. Added `clearAllCollections` Action

**File**: `src/providers/ReduxStore/slices/collections/index.js`

```javascript
clearAllCollections: (state) => {
  state.collections = [];
}
```

### 2. Updated Logout Flow

**File**: `src/providers/ReduxStore/slices/auth.js`

```javascript
export const logout = createAsyncThunk('auth/logout', async (_, { getState, dispatch, rejectWithValue }) => {
  try {
    // ... existing logout logic ...

    // Clear cloud workspaces state
    dispatch(resetWorkspaces());

    // ✅ NEW: Clear collections state
    dispatch({ type: 'collections/clearAllCollections' });

    toast.success('Logged out successfully');
  } catch (error) {
    // Same cleanup in error case
    dispatch(resetWorkspaces());
    dispatch({ type: 'collections/clearAllCollections' });
  }
});
```

## New Logout Flow

```
User clicks "Logout"
    ↓
1. Revoke refresh token on server
    ↓
2. Clear tokens from secure storage
    ↓
3. Clear IndexedDB cache
    ↓
4. Reset cloudWorkspaces state
    ↓
5. Clear collections state ✨ NEW
    ↓
6. Clear API client tokens
    ↓
Result: Clean slate - shows anonymous/local mode
```

## Anonymous/Local Mode

After logout, the app will:
- ✅ Show empty state (no collections)
- ✅ OR show local collections from file system (if any)
- ✅ No cloud data visible
- ✅ Can browse local `.bru` files
- ✅ No sync to cloud

## Testing

### Test 1: Logout Clears Collections
1. Login with user account
2. See cloud collections in UI
3. Click "Logout"
4. **Expected**: Collections disappear, UI shows empty/local state

### Test 2: Verify Redux State
1. Login → Check Redux DevTools
   - `collections.collections` = [...cloud data...]
2. Logout → Check Redux DevTools
   - `collections.collections` = [] ✅ Empty

### Test 3: Anonymous Mode After Logout
1. Logout
2. **Expected**:
   - No cloud collections visible
   - If user has local `.bru` files, they appear
   - If no local files, shows empty state

## Files Modified

1. `src/providers/ReduxStore/slices/collections/index.js`
   - Added `clearAllCollections` reducer
   - Exported `clearAllCollections` action

2. `src/providers/ReduxStore/slices/auth.js`
   - Updated `logout` thunk to clear collections
   - Also clears collections in error case

## Status

✅ **FIXED** - Logout now properly clears all user data and shows anonymous mode
