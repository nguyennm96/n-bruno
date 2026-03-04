# Batch Operations Behavior Specification

**Generated:** 2026-03-04
**Status:** Phase 2 Design

Defines how batch operations handle partial failures, transaction boundaries, and UI feedback for cloud storage operations.

---

## PROBLEM STATEMENT

**Single Operations:** Simple error handling
- Request succeeds → return data
- Request fails → return error

**Batch Operations:** Complex error handling
- What if 7 of 10 items succeed?
- Should we rollback successful items?
- How should UI display partial success?
- Should operations be atomic or non-atomic?

**Goal:** Define clear, predictable behavior for batch operations to avoid UI state mismatches.

---

## 1. BATCH OPERATION TYPES

### 1.1 Existing Batch Operations

| Operation | Atomicity | Status |
|-----------|-----------|--------|
| **Resequence items** | Atomic | 🔄 Needs Implementation |
| **Batch save requests** | Non-atomic | 🔄 Needs Implementation |
| **Batch delete items** | Non-atomic | 🔄 Needs Design |
| **Batch move items** | Non-atomic | 🔄 Needs Design |
| **Clone collection** | Atomic | 🔄 Needs Implementation |
| **Clone folder (deep)** | Atomic | 🔄 Needs Implementation |

### 1.2 Atomicity Decision Matrix

**When to use ATOMIC (all-or-nothing):**
- ✅ Tree structure operations (resequence, clone)
- ✅ Single logical unit (clone collection with all items)
- ✅ Failure would leave inconsistent state
- ✅ Rollback is safe and fast

**When to use NON-ATOMIC (partial success allowed):**
- ✅ Independent operations (save multiple unrelated requests)
- ✅ Failure doesn't affect other items
- ✅ Rollback would lose user work
- ✅ UI can display partial success meaningfully

---

## 2. ATOMIC BATCH OPERATIONS

### 2.1 Resequence Items

**Endpoint:**
```http
PATCH /api/collections/{collection_id}/resequence
Content-Type: application/json

{
  "items": [
    { "id": "req_456", "sort_order": 1 },
    { "id": "folder_123", "sort_order": 2 },
    { "id": "req_789", "sort_order": 3 }
  ]
}
```

**Behavior: ATOMIC (All-or-Nothing)**

**Success:**
```json
{
  "data": {
    "updated": 3,
    "failed": 0
  }
}
```

**Failure:**
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Item req_456 not found",
    "details": {
      "item_id": "req_456"
    },
    "retryable": false,
    "statusCode": 400
  }
}
```

**Implementation:**
```typescript
// Database transaction
async function resequenceItems(collectionId: string, items: ResequenceItem[]) {
  const tx = await db.transaction();
  try {
    // Validate all items exist
    for (const item of items) {
      const exists = await tx.items.findUnique({ where: { id: item.id } });
      if (!exists) {
        throw new Error(`Item ${item.id} not found`);
      }
    }

    // Update all items
    for (const item of items) {
      await tx.items.update({
        where: { id: item.id },
        data: { sort_order: item.sort_order }
      });
    }

    await tx.commit();
    return { updated: items.length, failed: 0 };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}
```

**UI Handling:**
- On success: Update Redux state with new sort_order
- On failure: Show error toast, keep old state
- No partial success state needed

---

### 2.2 Clone Collection

**Endpoint:**
```http
POST /api/collections/{id}/clone
Content-Type: application/json

{
  "name": "My Collection (Clone)",
  "workspace_id": "wks_xyz789"
}
```

**Behavior: ATOMIC**

**Success:**
```json
{
  "data": {
    "id": "col_new123",
    "name": "My Collection (Clone)",
    "items": [...],
    "environments": [...],
    "created_at": "2026-03-04T10:00:00Z"
  }
}
```

**Failure:**
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to clone collection",
    "retryable": true,
    "statusCode": 500
  }
}
```

**Implementation:**
```sql
-- Single database transaction
BEGIN TRANSACTION;

-- Clone collection
INSERT INTO collections (id, workspace_id, name, ...)
VALUES ('col_new123', 'wks_xyz789', 'My Collection (Clone)', ...);

-- Clone all items (recursive CTE)
WITH RECURSIVE clone_tree AS (
  SELECT ... -- Clone root items with new UUIDs
  UNION ALL
  SELECT ... -- Clone children recursively
)
INSERT INTO items SELECT * FROM clone_tree;

-- Clone environments
INSERT INTO environments (id, collection_id, ...)
SELECT gen_random_uuid(), 'col_new123', ...
FROM environments WHERE collection_id = 'col_old123';

COMMIT;
```

**UI Handling:**
- Show loading spinner while cloning
- On success: Add cloned collection to Redux state
- On failure: Show error, retry option (retryable)
- No partial state (collection either cloned or not)

---

### 2.3 Clone Folder (Deep)

**Endpoint:**
```http
POST /api/items/{id}/clone
Content-Type: application/json

{
  "name": "Authentication (Copy)",
  "parent_item_id": null
}
```

**Behavior: ATOMIC (for folders with children)**

**Success:** Returns cloned folder with all children

**Failure:** Nothing is cloned

**Reasoning:**
- Partial folder clone (some children missing) is confusing
- User expects complete folder structure
- Rollback is safe (no user work lost)

---

## 3. NON-ATOMIC BATCH OPERATIONS

### 3.1 Batch Save Requests

**Endpoint:**
```http
POST /api/collections/{collection_id}/batch-save
Content-Type: application/json

{
  "items": [
    {
      "id": "req_456",
      "request": {
        "url": "https://api.example.com/v2/users",
        "method": "GET"
      }
    },
    {
      "id": "req_789",
      "request": {
        "url": "https://api.example.com/v2/posts",
        "method": "POST"
      }
    },
    {
      "id": "req_999",  // This item doesn't exist
      "request": { ... }
    }
  ]
}
```

**Behavior: NON-ATOMIC (Partial Success Allowed)**

**Partial Success Response:**
```json
{
  "data": {
    "success": 2,
    "failed": 1,
    "errors": [
      {
        "item_id": "req_999",
        "error": {
          "code": "NOT_FOUND",
          "message": "Item not found"
        }
      }
    ],
    "saved_items": [
      {
        "id": "req_456",
        "updated_at": "2026-03-04T10:00:00Z"
      },
      {
        "id": "req_789",
        "updated_at": "2026-03-04T10:00:00Z"
      }
    ]
  }
}
```

**Implementation:**
```typescript
async function batchSaveRequests(collectionId: string, items: SaveItem[]) {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as ErrorDetail[],
    saved_items: [] as SavedItem[]
  };

  // Process each item independently
  for (const item of items) {
    try {
      const saved = await db.items.update({
        where: { id: item.id },
        data: { request: item.request }
      });
      results.success++;
      results.saved_items.push({
        id: saved.id,
        updated_at: saved.updated_at
      });
    } catch (error) {
      results.failed++;
      results.errors.push({
        item_id: item.id,
        error: transformError(error)
      });
    }
  }

  return results;
}
```

**UI Handling:**
```typescript
// After batch save response
const { success, failed, errors, saved_items } = response.data;

// Update Redux for successful saves
dispatch(updateMultipleItems(saved_items));

// Show toast notification
if (failed === 0) {
  toast.success(`Saved ${success} requests`);
} else if (success === 0) {
  toast.error(`Failed to save all ${failed} requests`);
} else {
  toast.warning(`Saved ${success} requests, ${failed} failed`);
}

// Show detailed error list (optional)
if (errors.length > 0) {
  showErrorDialog({
    title: 'Some requests failed to save',
    errors: errors.map(e => `${e.item_id}: ${e.error.message}`)
  });
}
```

**Reasoning for Non-Atomic:**
- ✅ Each request save is independent
- ✅ Partial success preserves user work
- ✅ User can retry failed items individually
- ✅ Better UX than "all or nothing" for large batches

---

### 3.2 Batch Delete Items

**Endpoint:**
```http
POST /api/collections/{collection_id}/batch-delete
Content-Type: application/json

{
  "item_ids": ["req_456", "folder_123", "req_789", "req_999"]
}
```

**Behavior: NON-ATOMIC**

**Response:**
```json
{
  "data": {
    "deleted": 3,
    "failed": 1,
    "errors": [
      {
        "item_id": "req_999",
        "error": {
          "code": "NOT_FOUND",
          "message": "Item not found"
        }
      }
    ]
  }
}
```

**Special Case: Folder with Children**
- Deleting folder cascades to children
- If folder delete succeeds, all children deleted atomically
- If folder delete fails, children remain

**UI Handling:**
```typescript
// Before delete: confirm with user
const itemCount = selectedItems.length;
const folderCount = selectedItems.filter(i => i.type === 'folder').length;
const childCount = selectedItems.flatMap(i => i.items || []).length;

const confirmMessage = folderCount > 0
  ? `Delete ${itemCount} items (including ${childCount} items in folders)?`
  : `Delete ${itemCount} items?`;

if (!confirm(confirmMessage)) return;

// After delete: update UI
const { deleted, failed, errors } = response.data;

// Remove deleted items from Redux
dispatch(removeMultipleItems(item_ids.filter(id => !errors.find(e => e.item_id === id))));

// Show notification
if (failed === 0) {
  toast.success(`Deleted ${deleted} items`);
} else {
  toast.warning(`Deleted ${deleted} items, ${failed} failed`);
}
```

**Reasoning for Non-Atomic:**
- ✅ Better to delete what we can than fail entirely
- ✅ User can retry failed deletes
- ✅ Common pattern in file managers (partial delete allowed)

---

### 3.3 Batch Move Items

**Endpoint:**
```http
POST /api/collections/{collection_id}/batch-move
Content-Type: application/json

{
  "moves": [
    {
      "item_id": "req_456",
      "parent_item_id": "folder_new",
      "sort_order": 1
    },
    {
      "item_id": "req_789",
      "parent_item_id": "folder_new",
      "sort_order": 2
    }
  ]
}
```

**Behavior: NON-ATOMIC**

**Response:** (same format as batch save)

**UI Handling:**
- Drag-drop multiple items into folder
- Show loading spinner for all
- Update positions for successful moves
- Show error for failed moves
- User can see which items moved and which didn't

**Reasoning for Non-Atomic:**
- ✅ Moves are independent operations
- ✅ Partial move is meaningful (some items in new location)
- ✅ Better UX than failing entire drag-drop

---

## 4. ERROR HANDLING PATTERNS

### 4.1 Atomic Operation Errors

```typescript
try {
  const result = await api.collections.resequence(items);
  // All succeeded
  dispatch(updateItemsOrder(items));
  toast.success('Reordered items');
} catch (error) {
  // All failed
  const { code, message } = error.error;
  toast.error(`Failed to reorder: ${message}`);
  // Keep old state
}
```

### 4.2 Non-Atomic Operation Errors

```typescript
const result = await api.collections.batchSave(items);

// Always succeeds (HTTP 200), check data.failed
if (result.failed === 0) {
  // Full success
  dispatch(updateMultipleItems(result.saved_items));
  toast.success(`Saved ${result.success} items`);
} else if (result.success === 0) {
  // Full failure
  toast.error('Failed to save any items');
  showErrorDetails(result.errors);
} else {
  // Partial success
  dispatch(updateMultipleItems(result.saved_items));
  toast.warning(`Saved ${result.success} items, ${result.failed} failed`);
  showErrorDetails(result.errors);
}
```

### 4.3 Retry Strategy

**Atomic Operations:**
```typescript
async function resequenceWithRetry(items: ResequenceItem[], maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await api.collections.resequence(items);
    } catch (error) {
      if (error.error.retryable && i < maxRetries - 1) {
        await sleep(1000 * Math.pow(2, i)); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
}
```

**Non-Atomic Operations:**
```typescript
async function batchSaveWithRetry(items: SaveItem[]) {
  let result = await api.collections.batchSave(items);

  // Retry failed items
  if (result.failed > 0) {
    const failedItems = items.filter(item =>
      result.errors.some(e => e.item_id === item.id && e.error.retryable)
    );

    if (failedItems.length > 0) {
      await sleep(1000);
      const retryResult = await api.collections.batchSave(failedItems);

      // Merge results
      result.success += retryResult.success;
      result.failed = retryResult.failed;
      result.errors = retryResult.errors;
      result.saved_items.push(...retryResult.saved_items);
    }
  }

  return result;
}
```

---

## 5. OPTIMISTIC UI UPDATES

### 5.1 Atomic Operations

**Don't use optimistic updates** for atomic operations:
- If rollback happens, UI needs full revert
- Wait for server confirmation

```typescript
// ❌ Bad: optimistic resequence
dispatch(updateItemsOrder(newOrder)); // Immediate
await api.collections.resequence(items); // Might fail!

// ✅ Good: wait for confirmation
const result = await api.collections.resequence(items);
dispatch(updateItemsOrder(newOrder)); // After success
```

### 5.2 Non-Atomic Operations

**Use optimistic updates** for non-atomic operations:
- Partial success is acceptable
- Better perceived performance

```typescript
// ✅ Good: optimistic batch save
dispatch(updateMultipleItems(items)); // Immediate UI update
const result = await api.collections.batchSave(items);

// Revert failed items
if (result.failed > 0) {
  const failedIds = result.errors.map(e => e.item_id);
  dispatch(revertItems(failedIds)); // Undo optimistic update for failed items
}
```

---

## 6. PARTIAL FAILURE UI PATTERNS

### 6.1 Toast Notifications

```typescript
// Full success
toast.success('Saved 10 requests');

// Full failure
toast.error('Failed to save requests');

// Partial success
toast.warning('Saved 7 requests, 3 failed', {
  action: {
    label: 'View Details',
    onClick: () => showErrorDialog(errors)
  }
});
```

### 6.2 Error Dialog

```typescript
function showErrorDialog(errors: ErrorDetail[]) {
  return (
    <Dialog>
      <DialogTitle>Some items failed</DialogTitle>
      <DialogContent>
        <ul>
          {errors.map(error => (
            <li key={error.item_id}>
              <strong>{getItemName(error.item_id)}</strong>: {error.error.message}
            </li>
          ))}
        </ul>
      </DialogContent>
      <DialogActions>
        <Button onClick={retryFailed}>Retry Failed</Button>
        <Button onClick={close}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
```

### 6.3 Inline Error Indicators

```typescript
// Show error icon next to failed items in tree
<TreeItem
  label={item.name}
  icon={failedItems.includes(item.id) ? <ErrorIcon /> : <CheckIcon />}
  tooltip={failedItems.includes(item.id) ? 'Failed to save' : 'Saved'}
/>
```

---

## 7. TRANSACTION BOUNDARIES

### 7.1 Database Transactions

**Atomic Operations:**
```sql
BEGIN TRANSACTION;
  UPDATE items SET sort_order = 1 WHERE id = 'req_456';
  UPDATE items SET sort_order = 2 WHERE id = 'folder_123';
  UPDATE items SET sort_order = 3 WHERE id = 'req_789';
COMMIT;
-- All updates succeed or all rollback
```

**Non-Atomic Operations:**
```sql
-- No transaction wrapper
UPDATE items SET request = '...' WHERE id = 'req_456'; -- Might succeed
UPDATE items SET request = '...' WHERE id = 'req_789'; -- Might succeed
UPDATE items SET request = '...' WHERE id = 'req_999'; -- Might fail
-- Each update independent
```

### 7.2 Nested Transactions

For complex operations (e.g., clone collection):

```typescript
async function cloneCollection(collectionId: string) {
  const tx = await db.transaction();
  try {
    // Clone collection
    const newCollection = await tx.collections.create({ ... });

    // Clone items (nested transaction)
    const items = await cloneItemsRecursive(tx, collectionId, newCollection.id);

    // Clone environments
    const envs = await cloneEnvironments(tx, collectionId, newCollection.id);

    await tx.commit();
    return newCollection;
  } catch (error) {
    await tx.rollback(); // Rollback everything
    throw error;
  }
}
```

---

## 8. PERFORMANCE CONSIDERATIONS

### 8.1 Batch Size Limits

**Recommendation:**
- Resequence: Max 1000 items per request
- Batch save: Max 100 items per request
- Batch delete: Max 500 items per request
- Batch move: Max 100 items per request

**Reason:** Prevent timeout, large transactions, memory issues

**UI Handling:**
```typescript
async function batchSaveWithChunking(items: SaveItem[]) {
  const CHUNK_SIZE = 100;
  const chunks = chunkArray(items, CHUNK_SIZE);

  let totalSuccess = 0;
  let totalFailed = 0;
  let allErrors = [];

  for (const chunk of chunks) {
    const result = await api.collections.batchSave(chunk);
    totalSuccess += result.success;
    totalFailed += result.failed;
    allErrors.push(...result.errors);
  }

  return { success: totalSuccess, failed: totalFailed, errors: allErrors };
}
```

### 8.2 Progress Indication

For large batches:

```typescript
<ProgressBar
  label={`Saving requests... ${completed}/${total}`}
  value={completed}
  max={total}
/>
```

---

## 9. LOCAL VS CLOUD PARITY

| Operation | Local Behavior | Cloud Behavior | Parity Status |
|-----------|---------------|----------------|---------------|
| **Resequence items** | Update .bru files (atomic via file writes) | Database transaction (atomic) | ✅ Equivalent |
| **Batch save** | Multiple file writes (non-atomic) | Multiple DB updates (non-atomic) | ✅ Equivalent |
| **Batch delete** | Multiple file deletes (non-atomic) | Multiple DB deletes (non-atomic) | ✅ Equivalent |
| **Clone collection** | Filesystem copy (atomic in OS) | Database transaction (atomic) | ✅ Equivalent |
| **Clone folder** | Filesystem copy (atomic in OS) | Database transaction (atomic) | ✅ Equivalent |

**Conclusion:** Cloud batch behavior matches local filesystem semantics.

---

## 10. IMPLEMENTATION CHECKLIST

### ✅ Design Complete
- [x] Atomicity decision matrix
- [x] Partial failure response format
- [x] Error handling patterns
- [x] UI feedback patterns
- [x] Transaction boundaries
- [x] Performance limits

### ✅ Implemented (Backend - 2026-03-04)
- [x] **Resequence items endpoint** ✨ (atomic, validates all items first)
- [x] **Clone collection endpoint** ✨ (atomic, deep clone with ID mapping)
- [x] **Clone folder endpoint** ✨ (atomic, recursive clone)

### 🔄 Needs Implementation
**Backend:**
- [ ] Batch save requests endpoint (non-atomic, partial success)
- [ ] Batch delete items endpoint (non-atomic, optional - can use single deletes)
- [ ] Batch move items endpoint (non-atomic, optional)

**Frontend:**
- [ ] UI error dialogs for partial failures
- [ ] Retry logic for batch operations
- [ ] Chunking for large batches (>100 items)
- [ ] Progress indicators for batch operations

---

## EXIT CRITERIA

Phase 2 batch operations specification is complete when:

- ✅ Atomicity is defined for each operation type
- ✅ Partial failure response format is standardized
- ✅ Error handling patterns are documented
- ✅ UI feedback patterns are specified
- ✅ Transaction boundaries are clear
- ✅ Retry strategies are defined
- ✅ Local/cloud parity is verified
- ✅ Performance limits are established

**Status:** ✅ **COMPLETE**

Ready for Phase 3 implementation.
