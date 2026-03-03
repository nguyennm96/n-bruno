# Phase 1 Testing Checklist ✅

## Before You Start

1. **Rebuild bruno-api package** ✅ (Already done)
2. **Restart Bruno app** (Required to load new code)
3. **Open Browser DevTools** (for verification)

---

## Test Checklist

### ✅ Test 1: New User Registration

- [ ] Click "Register" button
- [ ] See loading bar: "Creating account..."
- [ ] See loading bar: "Signing in..."
- [ ] See loading bar: "Loading workspaces..."
- [ ] See toast: "Welcome, {name}!"
- [ ] Redirected to main app
- [ ] No errors in console

**Expected Console Logs:**
```
🔄 Initializing cloud data...
✅ Cached X workspaces to IndexedDB
✅ Cached X items for workspace {id}
✅ Cloud data initialized
```

---

### ✅ Test 2: Existing User Login

- [ ] Enter valid credentials
- [ ] Click "Login"
- [ ] See loading bar: "Signing in..."
- [ ] See loading bar: "Loading workspaces..."
- [ ] See toast: "Welcome back, {name}!"
- [ ] Workspaces appear in UI
- [ ] No errors in console

**Expected Result:**
- User sees their existing workspaces
- Collections loaded automatically
- IndexedDB populated with cached data

---

### ✅ Test 3: App Restart (Saved Session)

- [ ] Close Bruno app
- [ ] Reopen Bruno app
- [ ] See loading indicator immediately
- [ ] User logged in automatically (no login screen)
- [ ] Workspaces displayed
- [ ] No errors in console

**Expected Console Logs:**
```
🔄 Initializing cloud data...
✅ Cloud data initialized
```

---

### ✅ Test 4: Global Loading Indicator

**Visual Check:**
- [ ] Top bar: Thin blue/purple progress bar (3px)
- [ ] Bottom-right: Notification with spinner
- [ ] Message shows current operation
- [ ] Auto-hides when complete

**Multiple Operations:**
- [ ] Shows count: "(2 operations)" when multiple loading

---

### ✅ Test 5: IndexedDB Cache

**Open DevTools → Application → IndexedDB → bruno-cloud-cache:**

- [ ] Database exists: `bruno-cloud-cache`
- [ ] Store exists: `workspaces`
- [ ] Store exists: `collections`
- [ ] Store exists: `metadata`
- [ ] `workspaces` contains your workspaces
- [ ] `collections` contains items
- [ ] Each record has `userId` and `cachedAt`

---

### ✅ Test 6: Logout

- [ ] Click "Logout" button
- [ ] See toast: "Logged out successfully"
- [ ] Redirected to login screen
- [ ] Redux state cleared (check Redux DevTools)
- [ ] IndexedDB cache cleared (check DevTools)

**Verify IndexedDB Cleared:**
- DevTools → Application → IndexedDB → bruno-cloud-cache
- All stores should be empty

---

### ✅ Test 7: Error Handling

**Invalid Login:**
- [ ] Enter wrong password
- [ ] See toast: "Invalid credentials"
- [ ] Loading indicator disappears
- [ ] Can try again

**Network Error (Stop bruno-server):**
1. Stop bruno-server: `Ctrl+C` in server terminal
2. Try to login
- [ ] See error message
- [ ] Loading indicator stops
- [ ] No crash

---

## Redux State Verification

**Open Redux DevTools:**

### After Login

Check `auth` slice:
- [ ] `isAuthenticated` = true
- [ ] `user` = { id, email, name }
- [ ] `accessToken` = "jwt..."
- [ ] `refreshToken` = "jwt..."

Check `cloudWorkspaces` slice:
- [ ] `workspaces` = [ ... ] (your workspaces)
- [ ] `workspaceItems` = { workspaceId: [ ... ] }
- [ ] `isLoading` = false

Check `globalLoading` slice:
- [ ] `isLoading` = false (when idle)
- [ ] `operations` = {} (empty when idle)

---

## Network Tab Verification

**Open DevTools → Network → Filter: XHR:**

### On Login
Should see these API calls:
1. POST `/api/auth/login` → 200 OK
2. GET `/api/workspaces` → 200 OK
3. GET `/api/workspaces/{id}/items` → 200 OK (for each workspace)

### Response Structure
Check `/api/workspaces` response:
```json
{
  "data": [
    {
      "id": "workspace_123",
      "name": "My API",
      "description": "...",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

---

## Common Issues & Solutions

### Issue: Loading bar doesn't appear
**Solution:**
- Check Redux DevTools → Middleware
- Verify `globalLoadingMiddleware` is registered
- Check console for errors

### Issue: Workspaces not loading
**Solution:**
- Check Network tab for API errors
- Verify bruno-server is running (port 8080)
- Check Redux DevTools → Actions → Look for `workspaces/fetch`

### Issue: IndexedDB empty
**Solution:**
- Check console for IndexedDB errors
- Try incognito mode (no quota issues)
- Clear browser data and retry

### Issue: "API client not initialized"
**Solution:**
- Check App.js initialization
- Verify `initializeBrunoCloudApi()` is called
- Check bruno-api package is built

---

## Success Criteria ✅

All of these should be true:

- [ ] ✅ Can register new account
- [ ] ✅ Can login existing account
- [ ] ✅ Can logout
- [ ] ✅ Session persists on app restart
- [ ] ✅ Loading indicator works
- [ ] ✅ Workspaces fetched on login
- [ ] ✅ Collections cached to IndexedDB
- [ ] ✅ Cache cleared on logout
- [ ] ✅ No errors in console
- [ ] ✅ Professional UX (instant feedback)

---

## Performance Benchmarks

**Expected Timings:**
- Login: ~2-3 seconds
- Fetch workspaces: ~500ms - 1s
- Fetch items: ~300ms - 500ms per workspace
- IndexedDB write: <100ms
- App restart: ~1-2 seconds

---

## Ready for Phase 2? ✅

If all tests pass, you're ready for **Phase 2: Offline Mode**!

**Phase 2 will add:**
- Online/offline detection
- Sync queue for offline changes
- Auto-sync when back online
- UI indicators for connection status
