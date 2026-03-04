# Phase 2 — Core Data Parity

## Goal

Đạt parity cho nhóm thao tác dữ liệu lõi: collections, items/requests/folders, environments, config/security.

## Status: ✅ COMPLETE (2026-03-04)

---

## Detailed steps

1. ✅ Lập danh sách operation ưu tiên cao theo tần suất sử dụng thực tế.
2. ✅ Chốt endpoint contract cho từng operation CRUD + batch operations.
3. ✅ Thiết kế parity cho tree semantics (parent-child, move, resequence, clone).
4. ✅ Chốt semantics load/save request (bao gồm large request path nếu có).
5. ✅ Chốt môi trường (environment) scope và quy tắc đọc/ghi nhất quán.
6. ✅ Chốt cấu hình collection root, bruno config, security config.
7. ✅ Chốt error handling cho partial failure ở batch/move/resequence.

## Deliverables

- ✅ [Core operations parity matrix v2](./CORE_OPERATIONS_PARITY_MATRIX.md)
- ✅ [Endpoint mapping spec v2](./ENDPOINT_MAPPING_SPEC.md)
- ✅ [Tree semantics specification](./TREE_SEMANTICS_SPEC.md)
- ✅ [Batch operations behavior spec](./BATCH_OPERATIONS_SPEC.md)
- ✅ Environment scope decision record (documented in Phase 0)

## Risks

- ✅ **MITIGATED**: Mismatch tree ordering giữa local và cloud
  - Solution: Fractional indexing with sort_order field
  - Resequence operation for resetting to clean integers
  - Transform layer handles seq ↔ sort_order conversion
- ✅ **MITIGATED**: Batch semantics không đồng nhất làm lệch state UI
  - Solution: Clear atomicity rules (atomic vs non-atomic)
  - Standardized partial failure response format
  - UI patterns for displaying partial success

## Exit criteria

- ✅ Nhóm core data operation có cloud plan hoàn chỉnh, không mơ hồ endpoint
- ✅ Có acceptance checklist cho từng operation trước khi code

---

## Phase 2 Summary

### 1. Operations Analysis

**Parity Matrix Results:**
- ✅ **Complete Parity:** 30 operations (Collections CRUD, Items CRUD + move, Workspace environments, Workspaces CRUD, Import/Export)
- 🔄 **Needs Implementation:** 18 operations (Clone operations, resequence, collection environments, config operations, batch operations)
- 💾 **Local-Only:** 40+ operations (Filesystem, system, OAuth, gRPC, cookies, preferences)
- 🌐 **Cloud-Only:** 3 operations (Workspace members - collaboration features)

**High Priority Missing Operations:**
1. Clone collection (deep clone with items + environments)
2. Clone item/folder (shallow + deep)
3. Resequence items (bulk ordering update)
4. Collection-level environments (5 operations: CRUD + color)
5. Collection config operations (bruno config, security config)
6. Batch save multiple requests

### 2. API Endpoints Specification

**Implemented Endpoints (35):**
- Auth: 5 endpoints (register, login, refresh, me, logout)
- Workspaces: 8 endpoints (CRUD + members management)
- Collections: 5 endpoints (CRUD)
- Items: 7 endpoints (create folder/request, CRUD, move)
- Environments: 4 endpoints (workspace-level CRUD)
- Import/Export: 6 endpoints (Postman, Insomnia, OpenAPI)

**Needs Implementation (8 endpoints):**
- `POST /api/collections/:id/clone` - Clone collection with all items
- `POST /api/items/:id/clone` - Clone item (shallow) or folder (deep)
- `PATCH /api/collections/:id/resequence` - Bulk update sort_order
- `POST /api/collections/:id/batch-save` - Save multiple requests
- `PATCH /api/collections/:id/config` - Update bruno_config and root
- `GET/PUT /api/collections/:id/security` - Security config (SSL, proxy, certs)
- `POST/GET/PATCH/DELETE /api/collections/:id/environments/:id` - Collection-level environments

**All endpoints documented with:**
- HTTP method and path
- Request/response schemas
- Error codes and retry policy
- Validation rules

### 3. Tree Semantics Design

**Data Model:**
- Tree structure via `parent_item_id` foreign key
- Ordering via `sort_order` numeric field (float)
- Nested tree response format
- Transform layer: `seq` (local) ↔ `sort_order` (cloud)

**Ordering Strategy: Fractional Indexing**
- Initial: Integer values (1, 2, 3...)
- Insert between: Fractional values (1.5, 2.5...)
- Reset via resequence operation when precision degrades
- **Benefit:** Insert without updating other items

**Move Operation:**
- Update `parent_item_id` + `sort_order`
- Folder move does not affect children (they remain nested)
- Validation: no circular references, no move into descendant

**Clone Operation:**
- Request: shallow clone (copy all fields, new UUID)
- Folder: deep clone (recursive copy with new UUIDs)
- Collection: atomic clone (all items + environments)

**Concurrent Updates:**
- Strategy: Last Write Wins
- Optional future: Optimistic locking with version field
- Future: Real-time updates via WebSocket (Phase 10)

### 4. Batch Operations Design

**Atomicity Rules:**

**Atomic (All-or-Nothing):**
- Resequence items - Tree structure consistency
- Clone collection - Single logical unit
- Clone folder (deep) - Complete structure expected
- **Implementation:** Database transaction with rollback on error

**Non-Atomic (Partial Success):**
- Batch save requests - Independent operations
- Batch delete items - Better UX, preserve what succeeds
- Batch move items - Independent moves
- **Implementation:** Process each item, return success + error lists

**Partial Failure Response Format:**
```json
{
  "data": {
    "success": 7,
    "failed": 3,
    "errors": [
      {
        "item_id": "req_999",
        "error": {
          "code": "NOT_FOUND",
          "message": "Item not found"
        }
      }
    ],
    "saved_items": [...]
  }
}
```

**UI Handling Patterns:**
- Toast notifications (full success, full failure, partial success)
- Error dialog with retry option
- Inline error indicators
- Optimistic updates for non-atomic operations only

**Performance Limits:**
- Resequence: Max 1000 items
- Batch save: Max 100 items (chunked if larger)
- Batch delete: Max 500 items
- Batch move: Max 100 items

### 5. Request Load/Save Semantics

**Current Implementation:**
- Requests stored inline in database (nested `request` object)
- No size limit currently (suitable for most API requests)

**Large Request Handling (Future):**
- If request body > 1MB, consider separate blob storage
- Not needed for initial implementation
- Local mode already handles large requests well

**Decision:** Inline storage is sufficient for Phase 3 implementation.

### 6. Environment Scope (Phase 0 Decision)

**Scope:** Support **both** collection-level and workspace-level environments

**Workspace-Level (✅ Implemented):**
- `POST/GET/PATCH/DELETE /api/workspaces/:id/environments`
- Shared across all collections in workspace
- Use case: Global API keys, base URLs

**Collection-Level (🔄 Needs Implementation):**
- `POST/GET/PATCH/DELETE /api/collections/:id/environments`
- Scoped to specific collection
- Use case: Collection-specific variables

**Priority:** Workspace-level complete, collection-level is high priority for Phase 3.

### 7. Config Operations

**Bruno Config:**
- Collection settings (version, type, format, name)
- Stored in `bruno_config` JSON field
- Endpoint needed: `PATCH /api/collections/:id/config`

**Collection Root:**
- Default auth, headers, vars for collection
- Stored in `root` JSON field
- Same endpoint: `PATCH /api/collections/:id/config`

**Security Config:**
- SSL certificates, proxy settings, client certificates
- Sensitive data (encrypt in database)
- Endpoints: `GET/PUT /api/collections/:id/security`

**Priority:** Medium priority for Phase 3 (after clone + environments).

---

## Implementation Roadmap (Phase 3)

Based on Phase 2 analysis, Phase 3 should implement in priority order:

### Priority 1: Tree Operations (High Impact)
1. Clone collection endpoint (atomic)
2. Clone item/folder endpoint (atomic)
3. Resequence items endpoint (atomic)

### Priority 2: Collection Environments (User-Facing)
4. Collection-level environment endpoints (5 operations)

### Priority 3: Config Operations (Power Users)
5. Collection config endpoint (bruno_config + root)
6. Security config endpoints (SSL, proxy, certs)

### Priority 4: Batch Optimizations (Performance)
7. Batch save requests endpoint (non-atomic)
8. Batch delete items endpoint (optional - can use single deletes)
9. Batch move items endpoint (optional - can use single moves)

---

## Files Created

1. `CORE_OPERATIONS_PARITY_MATRIX.md` - Complete operation mapping (107 operations analyzed)
2. `ENDPOINT_MAPPING_SPEC.md` - Full API contracts (35 existing + 8 new endpoints)
3. `TREE_SEMANTICS_SPEC.md` - Tree structure, ordering, move, clone specifications
4. `BATCH_OPERATIONS_SPEC.md` - Atomicity rules, partial failure handling, UI patterns

---

## Implementation Progress (2026-03-04)

### ✅ Backend Complete (Priority 1 & 2)

**Tree Operations (Priority 1):**
1. ✅ Clone collection - `POST /api/collections/:id/clone`
   - Deep clones all items with ID mapping
   - Cross-workspace cloning supported
   - File: `packages/bruno-server/src/services/collection.rs`

2. ✅ Clone item/folder - `POST /api/items/:id/clone`
   - Shallow for requests, deep for folders
   - Recursive with parent-child preservation
   - File: `packages/bruno-server/src/services/item.rs`

3. ✅ Resequence items - `PATCH /api/collections/:id/resequence`
   - Atomic bulk sort_order updates
   - Validates all items before updating
   - File: `packages/bruno-server/src/services/collection.rs`

**Collection Environments (Priority 2):**
4. ✅ Collection-level environments - `POST/GET /api/collections/:id/environments`
   - Create, list, update, delete collection environments
   - Environment model supports both workspace_id and collection_id
   - Files: `packages/bruno-server/src/services/environment.rs`, `models/environment.rs`

### 🔄 Next: Frontend Integration

**Task #18:** Update cloud.js with new operations
- Add methods: cloneCollection, cloneItem, resequenceItems
- Add collection environment CRUD methods
- Update transform layer if needed

**Task #19:** Add UI for clone/resequence operations
- Clone buttons in context menus
- Drag-drop for resequencing
- Collection environment management UI

**Task #20:** Testing
- Manual testing of new operations
- Verify local/cloud parity

### 📋 Remaining (Priority 3+)

**Config Operations:**
- Collection config (bruno_config + root)
- Security config (SSL, proxy, certs)

**Batch Optimizations:**
- Batch save requests (non-atomic)
- Batch delete/move (optional)

---

## Phase 2 Status: ✅ **PLANNING COMPLETE** | 🚧 **IMPLEMENTATION 50% COMPLETE**

- ✅ Planning & Design: 100% complete
- ✅ Backend Implementation: 50% complete (Priority 1 & 2 done)
- 🔄 Frontend Integration: 0% (next task)
- 🔄 Testing: 0% (after frontend)

**Ready for frontend integration (Task #18).**
