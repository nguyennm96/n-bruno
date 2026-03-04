# Data Structure Comparison: Local vs Cloud

## 🚨 CRITICAL ISSUE FOUND

The UI expects a **nested structure** but cloud returns a **flat structure**!

## Collection Structure

### Local Collection (Filesystem)
```javascript
{
  uid: "uuid",
  name: "My Collection",
  pathname: "/path/to/collection",
  type: "collection",
  version: "1",
  brunoConfig: { /* settings */ },
  collapsed: false,
  items: [/* nested items */],
  environments: [/* envs */],
  activeEnvironmentUid: null
}
```

### Cloud Collection (API)
```javascript
{
  uid: "collection-id",  // ✅ Maps to id
  name: "My Collection",
  pathname: "cloud://collection-id",  // ✅ Generated
  isCloud: true,  // ✅ Flag
  collapsed: false,
  mountStatus: "mounted",
  items: [/* nested items */]
}
```

**Status**: ✅ Collections structure is compatible

---

## 🔴 Request/Item Structure - **MISMATCH!**

### Local Request (What UI Expects)
```javascript
{
  uid: "uuid",
  type: "http-request",  // or "graphql-request", "grpc-request", "ws-request"
  name: "My Request",
  filename: "my-request.bru",

  // ⚠️ NESTED request object - UI expects this!
  request: {
    method: "GET",
    url: "https://api.example.com",
    headers: [
      { name: "Content-Type", value: "application/json", enabled: true }
    ],
    params: [
      { name: "key", value: "value", type: "query", enabled: true }
    ],
    body: {
      mode: "json",  // or "none", "text", "xml", "formUrlEncoded", "multipartForm"
      json: "{}",
      text: null,
      xml: null,
      // ...
    },
    vars: {
      req: [],  // request variables
      res: []   // response variables
    },
    assertions: [
      { expr: "res.status === 200" }
    ],
    auth: {
      mode: "bearer",  // or "inherit", "basic", "digest", "oauth2"
      token: "..."
    }
  },

  settings: {
    encodeUrl: true
  },

  seq: 1,
  draft: null  // unsaved changes
}
```

### Cloud Request (What Backend Returns)
```javascript
{
  uid: "item-id",  // ✅ id mapped to uid
  type: "http-request",  // ✅ mapped from "request"
  name: "My Request",
  pathname: "cloud://collection-id/item-id",  // ✅ generated
  seq: 1.0,

  // ❌ FLAT structure - fields at top level!
  method: "GET",
  url: "https://api.example.com",

  // ❌ MISSING fields:
  // - request object (nested structure)
  // - headers
  // - params
  // - body
  // - vars
  // - assertions
  // - auth
  // - settings
  // - filename

  items: []  // for folders
}
```

**Status**: ❌ **BROKEN** - UI will crash accessing `item.request.method`!

---

## Missing Fields Analysis

### 🔴 Critical Missing (Will cause crashes)
1. **`request` object** - UI accesses `item.request.method`, `item.request.url`, etc.
2. **`request.headers`** - Array of headers
3. **`request.params`** - Query and path parameters
4. **`request.body`** - Request body with mode
5. **`request.auth`** - Authentication config
6. **`request.vars`** - Request/response variables
7. **`request.assertions`** - Test assertions

### 🟡 Important Missing (Will cause issues)
8. **`settings`** - Request settings (encodeUrl, etc.)
9. **`filename`** - Used for display/save operations
10. **`draft`** - Unsaved changes tracking

### 🟢 Less Critical
11. **`isTransient`** - Temporary request flag

---

## Folder Structure

### Local Folder
```javascript
{
  uid: "uuid",
  type: "folder",
  name: "My Folder",
  filename: "my-folder",
  items: [/* nested items */],
  seq: 1
}
```

### Cloud Folder
```javascript
{
  uid: "folder-id",
  type: "folder",  // ✅ correct
  name: "My Folder",
  pathname: "cloud://collection-id/folder-id",
  seq: 1.0,
  items: [/* nested items */]  // ✅ correct
}
```

**Status**: ⚠️ Missing `filename` but otherwise OK

---

## Workspace Structure

### Local Workspace
```javascript
{
  uid: "workspace-uuid",
  name: "My Workspace",
  pathname: "/path/to/workspace",
  type: "personal" | "team" | "default",
  collections: [
    { uid: "...", path: "/path/to/collection" }
  ]
}
```

### Cloud Workspace
```javascript
{
  id: "workspace-id",
  name: "My Workspace",
  description: "...",
  owner_id: "user-id",
  role: "owner" | "editor" | "viewer",
  created_at: "...",
  updated_at: "..."
}
```

**Status**: ✅ OK - Different structures but used separately

---

## Environment Structure

### Local Environment
```javascript
{
  uid: "env-uuid",
  name: "Production",
  variables: [
    { name: "API_URL", value: "https://api.prod.com", enabled: true }
  ]
}
```

### Cloud Environment
```javascript
{
  id: "env-id",
  workspace_id: "workspace-id",
  name: "Production",
  variables: [
    { name: "API_URL", value: "https://api.prod.com", enabled: true, secret: false }
  ],
  color: "#ff0000"
}
```

**Status**: ✅ Compatible (variables structure matches)

---

## 🚨 ACTION REQUIRED

### Immediate Fixes Needed:

1. **Backend** (`bruno-server/src/handlers/item.rs` - `build_item_tree`)
   - Transform flat items into nested structure
   - Add `request` object with method, url, headers, body, etc.
   - Add `settings` object
   - Add default empty values for missing fields

2. **OR Frontend** (Transform on receive)
   - Add transformation layer when loading cloud collections
   - Map flat structure to nested structure

3. **Backend Database Schema**
   - Store full request details (headers, body, auth, etc.)
   - Not just method and url

### Default Values Needed:
```javascript
{
  request: {
    headers: [],
    params: [],
    body: { mode: 'none', json: null, text: null, xml: null },
    vars: { req: [], res: [] },
    assertions: [],
    auth: { mode: 'inherit' }
  },
  settings: {
    encodeUrl: true
  },
  filename: item.name.toLowerCase().replace(/\s+/g, '-')
}
```

---

## Testing Checklist

After fixes, verify:
- [ ] Can view request method badge in sidebar
- [ ] Can open request in tab
- [ ] Can see request URL
- [ ] Can edit headers
- [ ] Can edit body
- [ ] Can edit auth
- [ ] Can run request
- [ ] Can save changes
- [ ] No console errors about undefined properties
