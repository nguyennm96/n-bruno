# Tree Semantics Specification

**Generated:** 2026-03-04
**Status:** Phase 2 Design

Defines how hierarchical collection structures (folders, requests, ordering) work in cloud mode to achieve parity with local filesystem behavior.

---

## PROBLEM STATEMENT

**Local mode** uses filesystem hierarchy:
- Natural tree structure from directories and files
- Ordering via `seq` field in .bru files
- Parent-child implicit from file paths
- Move = filesystem move
- Clone = filesystem copy

**Cloud mode** needs to replicate this with database storage:
- Tree structure via `parent_item_id` foreign keys
- Ordering via `sort_order` numeric field
- Parent-child explicit relationships
- Move = update `parent_item_id` + `sort_order`
- Clone = recursive database insert with new UUIDs

**Risk:** Tree ordering mismatch between local and cloud could cause UI inconsistencies.

---

## 1. TREE STRUCTURE

### 1.1 Data Model

```typescript
interface Item {
  id: string;                    // UUID
  collection_id: string;         // Parent collection
  parent_item_id: string | null; // Parent folder (null = root level)
  type: 'folder' | 'request';
  name: string;
  sort_order: number;            // Ordering within parent

  // For folders
  items?: Item[];                // Children (nested tree)

  // For requests
  request?: Request;             // Request details
  settings?: Settings;

  created_at: string;
  updated_at: string;
}
```

### 1.2 Parent-Child Rules

1. **Root Items:** `parent_item_id: null`
   - Top-level folders and requests in collection
   - Can have any sort_order

2. **Child Items:** `parent_item_id: <folder_id>`
   - Must reference valid folder
   - Cannot reference a request (requests cannot have children)
   - Folder can be nested arbitrarily deep

3. **Constraints:**
   - Cannot create circular parent relationships
   - Cannot move folder into its own descendant
   - Deleting folder cascades to all children

### 1.3 Tree Response Format

API returns nested tree structure (not flat):

```json
{
  "data": {
    "id": "col_123",
    "name": "My Collection",
    "items": [
      {
        "id": "folder_1",
        "type": "folder",
        "name": "Auth",
        "sort_order": 1,
        "items": [
          {
            "id": "req_1",
            "type": "request",
            "name": "Login",
            "sort_order": 1,
            "request": { ... }
          },
          {
            "id": "req_2",
            "type": "request",
            "name": "Logout",
            "sort_order": 2,
            "request": { ... }
          }
        ]
      },
      {
        "id": "req_3",
        "type": "request",
        "name": "Get Profile",
        "sort_order": 2,
        "request": { ... }
      }
    ]
  }
}
```

**Transform layer** converts this to local schema with:
- `id` → `uid`
- `pathname: cloud://{collection_id}/{item_id}`
- `seq: sort_order`

---

## 2. ORDERING

### 2.1 Sort Order Field

**Purpose:** Define display order of items within same parent.

**Type:** `number` (float)

**Range:** `> 0`, no upper limit

**Sorting:** Items sorted by `sort_order ASC` within parent.

### 2.2 Assignment Strategy: Fractional Indexing

**Problem with Integer Sorting:**
- Inserting between items requires updating all subsequent items
- Example: Insert between sort_order 1 and 2 → need to shift 2, 3, 4, ... → N updates

**Solution: Fractional Indexing:**
- Use float values: `1.0, 2.0, 3.0, ...`
- Insert between: `1.0, 1.5, 2.0` (no updates needed)
- Can always find midpoint: `(a + b) / 2`

**Implementation:**

```typescript
function calculateSortOrder(
  previousItem: Item | null,
  nextItem: Item | null
): number {
  if (!previousItem && !nextItem) {
    // First item in parent
    return 1.0;
  }

  if (!previousItem) {
    // Insert at beginning
    return nextItem.sort_order / 2;
  }

  if (!nextItem) {
    // Insert at end
    return previousItem.sort_order + 1.0;
  }

  // Insert between
  return (previousItem.sort_order + nextItem.sort_order) / 2;
}
```

**Precision Handling:**
- Float64 has ~15 decimal digits precision
- After many inserts, precision may degrade
- **Resequence operation** (see below) resets ordering to clean integers

### 2.3 Initial Sort Order

When creating new items:

```typescript
// Get siblings at same level
const siblings = await getItemsByParent(parent_item_id);

// Assign next integer
const sort_order = siblings.length + 1;
```

**Note:** Start with integers (1, 2, 3...), use fractional only when inserting between.

---

## 3. MOVE OPERATION

### 3.1 Move Item Endpoint

```http
PATCH /api/items/{id}/move
Content-Type: application/json

{
  "parent_item_id": "folder_789",  // New parent (null = root)
  "sort_order": 3.5                // New position
}
```

**Response:** `200 OK` (updated item)

### 3.2 Move Semantics

**Simple Move (Request):**
1. Update `parent_item_id`
2. Update `sort_order`
3. Return updated item

**Folder Move (with children):**
1. Update folder's `parent_item_id`
2. Update folder's `sort_order`
3. Children remain nested under folder (no updates needed)
4. Return updated folder (with children)

**Validation:**
- Cannot move folder into itself
- Cannot move folder into its own descendant
- Cannot move item into a request (only folders have children)

### 3.3 Move Constraints

```sql
-- Prevent circular references
WITH RECURSIVE ancestors AS (
  SELECT parent_item_id FROM items WHERE id = :new_parent_id
  UNION ALL
  SELECT i.parent_item_id FROM items i
  JOIN ancestors a ON i.id = a.parent_item_id
)
SELECT COUNT(*) FROM ancestors WHERE parent_item_id = :moving_item_id;
-- If > 0, reject move (circular reference)
```

### 3.4 UI Drag-Drop Flow

```typescript
// User drags request_A into folder_B at position 2

// 1. Get target folder's children
const siblings = folder_B.items.filter(i => i.id !== request_A.id);

// 2. Calculate sort_order
const targetIndex = 2;
const previousItem = siblings[targetIndex - 1] || null;
const nextItem = siblings[targetIndex] || null;
const sort_order = calculateSortOrder(previousItem, nextItem);

// 3. Call API
await api.items.move(request_A.id, {
  parent_item_id: folder_B.id,
  sort_order: sort_order
});

// 4. Update Redux state (optimistic or after response)
```

---

## 4. RESEQUENCE OPERATION

### 4.1 Purpose

Reset sort_order to clean sequential integers after many fractional insertions.

**When to use:**
- Sort order becomes too fractional (e.g., `1.000000000001`)
- User manually reorders multiple items (drag-drop)
- Bulk import with specific order

### 4.2 Resequence Endpoint

```http
PATCH /api/collections/{collection_id}/resequence
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "items": [
    { "id": "req_456", "sort_order": 1 },
    { "id": "folder_123", "sort_order": 2 },
    { "id": "req_789", "sort_order": 3 }
  ]
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "updated": 3,
    "failed": 0
  }
}
```

### 4.3 Resequence Behavior

**Scope:** Items within **same parent**
- Only updates provided items
- Items not in request remain unchanged
- Must all share same `parent_item_id`

**Atomicity:** **Atomic** (all or nothing)
- Use database transaction
- If any update fails, rollback all
- Return error if partial failure

**Validation:**
- All items must exist
- All items must belong to same parent
- No duplicate sort_order values in request

### 4.4 Local vs Cloud Parity

**Local (resequenceItems IPC):**
```typescript
// Updates seq field in multiple .bru files
// File format:
meta {
  name: Request Name
  type: http
  seq: 2
}
```

**Cloud (resequence API):**
```typescript
// Bulk UPDATE in database
UPDATE items
SET sort_order = CASE
  WHEN id = 'req_456' THEN 1
  WHEN id = 'folder_123' THEN 2
  WHEN id = 'req_789' THEN 3
END
WHERE id IN ('req_456', 'folder_123', 'req_789');
```

**Transform layer:** `seq` (local) ↔ `sort_order` (cloud)

---

## 5. CLONE OPERATION

### 5.1 Clone Item Endpoint

```http
POST /api/items/{id}/clone
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "Login (Copy)",
  "parent_item_id": "folder_123"  // Optional: where to place clone
}
```

**Response:** `201 Created` (cloned item)

### 5.2 Clone Semantics

**Request Clone (Shallow):**
1. Copy all fields (request, settings, etc.)
2. Generate new UUID for clone
3. Set `name` to provided name (or original + " (Copy)")
4. Place in specified parent (or same parent as original)
5. Assign sort_order at end of siblings
6. Return cloned item

**Folder Clone (Deep):**
1. Copy folder metadata
2. Generate new UUID for folder
3. **Recursively clone all children:**
   - Each child gets new UUID
   - Preserve relative tree structure
   - Preserve relative ordering (sort_order)
4. Return cloned folder with all children

**Example:**
```
Original Tree:
folder_A (sort_order: 1)
├─ req_1 (sort_order: 1)
└─ req_2 (sort_order: 2)

Clone Result:
folder_A_clone (sort_order: 2, new UUID)
├─ req_1_clone (sort_order: 1, new UUID)
└─ req_2_clone (sort_order: 2, new UUID)
```

### 5.3 Clone Collection

```http
POST /api/collections/{id}/clone
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "My Collection (Clone)",
  "workspace_id": "wks_xyz789"
}
```

**Response:** `201 Created` (cloned collection)

**Behavior:**
1. Copy collection metadata (name, description, bruno_config, root)
2. Generate new UUID for collection
3. **Clone all items** (deep clone entire tree)
4. **Clone all environments** (with new UUIDs)
5. Place in specified workspace
6. Return cloned collection

---

## 6. CONCURRENT UPDATES & CONFLICTS

### 6.1 Problem: Concurrent Moves

**Scenario:**
- User A moves req_1 to folder_A
- User B simultaneously moves req_1 to folder_B

**Resolution: Last Write Wins**
- Both API calls succeed
- Final state: req_1 is in folder_B (User B's move)
- User A sees stale state until refresh

### 6.2 Optimistic Locking (Optional Future Enhancement)

Add `version` field to items:

```http
PATCH /api/items/{id}/move
Content-Type: application/json

{
  "parent_item_id": "folder_789",
  "sort_order": 3.5,
  "version": 5  // Must match current version
}
```

**Conflict Response:** `409 CONFLICT`
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Item was modified by another user",
    "details": {
      "expected_version": 5,
      "current_version": 6
    }
  }
}
```

**Status:** Not implemented yet, add in Phase 4 if needed.

### 6.3 Real-Time Updates (WebSocket)

**Phase 10 (Future):**
- WebSocket connection: `wss://api.usebruno.com/ws`
- Broadcast tree changes to all connected clients
- UI automatically reflects changes from other users

**Not in scope for Phase 2.**

---

## 7. VALIDATION RULES

### 7.1 Item Validation

**Name:**
- Min length: 1 character
- Max length: 255 characters
- No trailing/leading whitespace (trim)
- Cannot be empty string

**sort_order:**
- Must be > 0
- Can be fractional (float64)
- No NaN or Infinity

**parent_item_id:**
- Must be null or valid folder UUID
- Cannot reference a request
- Cannot create circular reference

**Type:**
- Must be `folder` or `request`
- Cannot change type after creation

### 7.2 Move Validation

```typescript
function validateMove(
  item: Item,
  newParentId: string | null,
  sortOrder: number
): ValidationResult {
  // Cannot move into request
  if (newParentId) {
    const parent = getItem(newParentId);
    if (parent.type !== 'folder') {
      return { valid: false, error: 'Cannot move into request' };
    }
  }

  // Cannot move folder into itself
  if (item.type === 'folder' && item.id === newParentId) {
    return { valid: false, error: 'Cannot move folder into itself' };
  }

  // Cannot move folder into descendant
  if (item.type === 'folder' && isDescendant(item.id, newParentId)) {
    return { valid: false, error: 'Cannot move folder into descendant' };
  }

  // sort_order must be positive
  if (sortOrder <= 0) {
    return { valid: false, error: 'sort_order must be > 0' };
  }

  return { valid: true };
}
```

---

## 8. PERFORMANCE CONSIDERATIONS

### 8.1 Tree Loading

**Problem:** Deep nested trees with 1000+ items

**Solution: Lazy Loading (Future)**
```http
GET /api/collections/{id}/items?depth=2
```
- Load only first 2 levels
- Expand folders on demand

**Current:** Load entire tree (works for <1000 items)

### 8.2 Resequence Performance

**Problem:** Resequencing 1000 items = 1000 SQL updates

**Optimization:**
```sql
-- Bulk update with CASE statement (1 query)
UPDATE items
SET sort_order = CASE
  WHEN id = 'req_1' THEN 1
  WHEN id = 'req_2' THEN 2
  ...
END
WHERE id IN ('req_1', 'req_2', ...);
```

**Limit:** Max 1000 items per resequence request (pagination if needed)

### 8.3 Clone Performance

**Problem:** Cloning folder with 100 requests = 100 inserts

**Optimization:**
```sql
-- Recursive CTE to clone tree in single query
WITH RECURSIVE clone_tree AS (
  -- Base: clone root folder
  SELECT ...
  UNION ALL
  -- Recursive: clone children
  SELECT ...
)
INSERT INTO items SELECT * FROM clone_tree;
```

**Benefit:** Atomic, fast, single database round-trip

---

## 9. LOCAL VS CLOUD PARITY SUMMARY

| Aspect | Local (Filesystem) | Cloud (Database) | Parity Status |
|--------|-------------------|------------------|---------------|
| **Tree Structure** | Directory hierarchy | parent_item_id foreign key | ✅ Equivalent |
| **Ordering** | `seq` in .bru files | `sort_order` numeric | ✅ Equivalent |
| **Move** | Filesystem move | Update parent_item_id | ✅ Equivalent |
| **Clone** | Filesystem copy | Recursive INSERT | ✅ Equivalent |
| **Resequence** | Update .bru files | Bulk UPDATE | ✅ Equivalent |
| **Nested Tree** | Natural from directories | Recursive query | ✅ Equivalent |
| **Concurrent Edits** | File locking | Last write wins | ⚠️ Different (acceptable) |
| **Real-time Updates** | File watcher | WebSocket (future) | 🔄 Future |

---

## 10. IMPLEMENTATION CHECKLIST

### ✅ Implemented (2026-03-04)
- [x] Tree structure with parent_item_id
- [x] sort_order field in database
- [x] Move item endpoint
- [x] Nested tree API response
- [x] Transform layer (seq ↔ sort_order)
- [x] **Clone item endpoint (shallow + deep)** ✨ NEW
- [x] **Clone collection endpoint** ✨ NEW
- [x] **Resequence items endpoint (bulk update)** ✨ NEW

### 🔄 Needs Implementation (Frontend)
- [ ] Fractional sort_order calculation in client (for insert between)
- [ ] UI for clone operations
- [ ] UI for resequence (drag-drop)
- [ ] Move validation UI (prevent move into descendant)
- [ ] Circular reference validation (backend has basic validation)

### 🚀 Future Enhancements (Phase 4+)
- [ ] Optimistic locking (version field)
- [ ] Lazy loading (depth parameter)
- [ ] Real-time updates (WebSocket)
- [ ] Conflict resolution UI

---

## EXIT CRITERIA

Phase 2 tree semantics specification is complete when:

- ✅ Data model is clearly defined
- ✅ Ordering strategy (fractional indexing) is documented
- ✅ Move semantics are specified
- ✅ Resequence behavior is defined (atomic, same parent)
- ✅ Clone semantics are specified (shallow vs deep)
- ✅ Validation rules are documented
- ✅ Concurrent update strategy is defined (last write wins)
- ✅ Local/cloud parity is verified
- ✅ Implementation gaps are identified

**Status:** ✅ **COMPLETE**

Ready for Phase 3 implementation.
