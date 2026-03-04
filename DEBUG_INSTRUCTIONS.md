# Debug Instructions - Cloud Data Not Showing After Login

## Steps to Debug

### 1. Check Browser Console
After login, check if you see these logs:
```
🔄 Initializing cloud data...
📊 Fetched X workspaces from cloud
🌐 Fetching collections tree for workspace [ID] from cloud...
📥 Collections tree for workspace [ID] loaded from: cloud-tree
✅ Cloud data initialized successfully
```

### 2. Check Redux State
Open Redux DevTools and check:
- `state.auth.isAuthenticated` - should be `true`
- `state.auth.user` - should have user data
- `state.cloudWorkspaces.workspaces` - should have workspaces array
- `state.cloudWorkspaces.workspaceCollectionsTree` - should have data for each workspace
- `state.cloudWorkspaces.selectedWorkspaceId` - should be set
- `state.collections.collections` - check if this still has old data

### 3. Check Network Tab
Look for these API calls:
- `GET /workspaces` - should return 200
- `GET /workspaces/{id}/collections-tree` - should return 200

## Expected vs Actual Behavior

**Expected**:
- After login, cloud collections tree should be fetched and displayed
- Local anonymous collections should be cleared

**Actual**:
- Login successful, API returns data
- But UI still shows local anonymous data OR shows empty

## Possible Root Causes

1. **Collections slice not cleared properly**: Old local collections still in state
2. **Race condition**: Component renders before cloud data arrives
3. **State not updating**: fetchWorkspaceItems not updating workspaceCollectionsTree
4. **Component not re-rendering**: React not detecting state change

## Next Steps

Based on console output and Redux state, we can identify the exact issue.
