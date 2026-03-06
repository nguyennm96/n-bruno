# Public Documentation for Collections - Implementation Plan

## Context

Bruno currently has a "Generate Documentation" feature that exports collections as standalone HTML files with embedded OpenCollection YAML. Users must download and self-host these files. This plan adds **Bruno-hosted public documentation** similar to Postman's published docs - each collection gets a unique public URL (e.g., `docs.bruno.com/p/abc123`) with user-managed permissions and an interactive API playground.

**Why this is needed:**
- Self-hosting HTML files creates friction for teams wanting to share API documentation
- No centralized place to manage documentation permissions
- Missing ability to share docs with external partners/clients without giving workspace access
- Users want Postman-like public documentation URLs

**Current Architecture:**
- **Backend**: Rust server (bruno-server) with MongoDB, workspace-based collections, JWT auth
- **Frontend**: React app with Redux, unified storage layer (cloud + local modes)
- **Existing**: OpenCollection converter, standalone HTML export, Documentation component
- **Cloud Mode**: Collections stored in MongoDB, IndexedDB cache, WebSocket for real-time updates

---

## Implementation Approach

### Phase 1: Backend API - Public Documentation Endpoints

#### 1.1 Database Schema

**Add to `collections` MongoDB collection:**
```rust
pub struct PublicDocs {
    pub enabled: bool,              // Is public docs enabled?
    pub slug: String,                // Unique slug (e.g., "my-api-v2")
    pub published_at: DateTime<Utc>,
    pub visibility: DocVisibility,   // Permissions
    pub settings: DocSettings,       // Customization
}

pub enum DocVisibility {
    Public,                          // Anyone with link
    Password { hash: String },       // Password-protected
    WorkspaceMembers,                // Workspace-only
    CustomList { user_ids: Vec<String> }, // Specific users
}

pub struct DocSettings {
    pub show_examples: bool,
    pub show_auth: bool,
    pub custom_css: Option<String>,
    pub custom_logo_url: Option<String>,
}
```

**Files to modify:**
- `packages/bruno-server/src/models/collection.rs` - Add `public_docs` field
- Create `packages/bruno-server/src/models/public_docs.rs` - Define structs above

#### 1.2 API Endpoints

**Protected Endpoints (require workspace authentication):**

1. **POST** `/api/collections/:id/docs/publish`
   - Enable public docs, generate unique slug
   - Request: `{ visibility, settings }`
   - Response: `{ slug, public_url, published_at }`

2. **PATCH** `/api/collections/:id/docs`
   - Update docs settings/visibility
   - Request: `{ visibility?, settings? }`

3. **DELETE** `/api/collections/:id/docs/unpublish`
   - Disable public docs, invalidate slug

4. **GET** `/api/collections/:id/docs/status`
   - Check publication status
   - Response: `{ enabled, slug?, public_url?, stats: { views } }`

**Public Endpoints (no auth required):**

5. **GET** `/api/public/docs/:slug`
   - Fetch published collection data
   - Check visibility permissions
   - Return OpenCollection YAML + metadata
   - Response: `{ collection, settings, published_at }`

6. **POST** `/api/public/docs/:slug/verify-password`
   - For password-protected docs
   - Request: `{ password }`
   - Response: `{ token }` (JWT with read access)

**Files to create:**
- `packages/bruno-server/src/handlers/public_docs.rs` - Handler implementations
- `packages/bruno-server/src/services/public_docs.rs` - Business logic

**Files to modify:**
- `packages/bruno-server/src/router.rs` - Add routes
- `packages/bruno-server/src/handlers/collection.rs` - Import public_docs handler

#### 1.3 Slug Generation & Uniqueness

**Algorithm:**
1. Generate slug from collection name: `sanitize(name).toLowerCase().replace(/\s+/g, '-')`
2. Append random suffix if collision: `my-api-v2-x7k9`
3. Store in `public_docs.slug` field
4. Create MongoDB unique index on `public_docs.slug`

**Implementation:**
```rust
// In packages/bruno-server/src/services/public_docs.rs
pub async fn generate_unique_slug(&self, collection_name: &str) -> String {
    let base_slug = sanitize_slug(collection_name);
    let mut slug = base_slug.clone();
    let mut attempt = 0;

    while self.slug_exists(&slug).await.unwrap_or(false) {
        slug = format!("{}-{}", base_slug, generate_random_suffix());
        attempt += 1;
        if attempt > 10 { panic!("Failed to generate unique slug"); }
    }

    slug
}
```

---

### Phase 2: Frontend - Publishing UI

#### 2.1 Publish Modal Component

**Create:** `packages/bruno-app/src/components/Sidebar/Collections/Collection/PublishDocumentation/index.js`

**Features:**
- "Publish Documentation" button in collection dropdown menu (next to "Generate Documentation")
- Modal with:
  - Preview of public URL: `docs.bruno.com/p/{slug}`
  - Visibility selector (radio buttons):
    - ○ Public (anyone with link)
    - ○ Password-protected (show password input)
    - ○ Workspace members only
    - ○ Custom list (show user selector)
  - Settings toggles:
    - ☑ Show examples
    - ☑ Show authentication details
  - Publish / Update / Unpublish buttons
  - Copy URL button
  - View Documentation link (opens in new tab)

**State Management:**
- Add to Redux `collections` slice:
  ```js
  publicDocs: {
    enabled: false,
    slug: null,
    publicUrl: null,
    visibility: 'public',
    settings: { showExamples: true, showAuth: true }
  }
  ```

**API Integration:**
- Call `POST /api/collections/:id/docs/publish` on first publish
- Call `PATCH /api/collections/:id/docs` on updates
- Call `DELETE /api/collections/:id/docs/unpublish` on unpublish

**Files to create:**
- `packages/bruno-app/src/components/Sidebar/Collections/Collection/PublishDocumentation/index.js`
- `packages/bruno-app/src/components/Sidebar/Collections/Collection/PublishDocumentation/StyledWrapper.js`

**Files to modify:**
- `packages/bruno-app/src/components/Sidebar/Collections/Collection/index.js` - Add menu item
- `packages/bruno-app/src/providers/ReduxStore/slices/collections/index.js` - Add `publicDocs` state
- `packages/bruno-app/src/providers/ReduxStore/slices/collections/actions.js` - Add publish actions

#### 2.2 Bruno API Client

**Add methods to:** `packages/bruno-api/src/collections/index.ts`

```typescript
export class CollectionsAPI {
  // ... existing methods

  async publishDocs(collectionId: string, payload: PublishDocsPayload) {
    return this.client.post(`/collections/${collectionId}/docs/publish`, payload);
  }

  async updateDocs(collectionId: string, payload: UpdateDocsPayload) {
    return this.client.patch(`/collections/${collectionId}/docs`, payload);
  }

  async unpublishDocs(collectionId: string) {
    return this.client.delete(`/collections/${collectionId}/docs/unpublish`);
  }

  async getDocsStatus(collectionId: string) {
    return this.client.get(`/collections/${collectionId}/docs/status`);
  }
}
```

**Add types to:** `packages/bruno-api/src/types/index.ts`

---

### Phase 3: Public Documentation Viewer

#### 3.1 Standalone Documentation App

**Option A: Separate Subdomain/App** (Recommended)
- Host on `docs.bruno.com` (separate from main app)
- Lightweight React app (no Redux, minimal dependencies)
- Uses OpenCollection viewer library (already exists at `cdn.opencollection.com`)

**Create:** `packages/bruno-public-docs/` (new package)

**Structure:**
```
packages/bruno-public-docs/
├── src/
│   ├── App.jsx               # Main app component
│   ├── components/
│   │   ├── PasswordPrompt.jsx
│   │   ├── ErrorPage.jsx
│   │   ├── LoadingState.jsx
│   │   └── DocViewer.jsx     # Wraps OpenCollection viewer
│   ├── hooks/
│   │   └── usePublicDoc.js   # Fetches doc data
│   └── index.jsx
├── public/
│   └── index.html
└── package.json
```

**App.jsx:**
```jsx
function App() {
  const { slug } = useParams(); // From URL: /p/:slug
  const { doc, loading, error, requiresPassword } = usePublicDoc(slug);

  if (loading) return <LoadingState />;
  if (error) return <ErrorPage error={error} />;
  if (requiresPassword) return <PasswordPrompt slug={slug} />;

  return <DocViewer collection={doc.collection} settings={doc.settings} />;
}
```

**Routing:**
- `/p/:slug` - View documentation
- `/p/:slug/password` - Password verification (if needed)

**Files to create:**
- All files in `packages/bruno-public-docs/` directory
- `packages/bruno-public-docs/vite.config.js` - Build config
- `packages/bruno-public-docs/Dockerfile` - For deployment

#### 3.2 DocViewer Component

**Reuse existing OpenCollection viewer:**
- Load `docs.js` and `docs.css` from `cdn.opencollection.com` (already exists)
- Pass OpenCollection YAML data
- Add interactive playground for testing endpoints

**Key Features:**
- Render collection structure (folders, requests)
- Display request details (method, URL, params, headers, body, auth)
- Show documentation markdown (from `request.docs` field)
- Interactive "Try it" button for each request
- Code examples (cURL, JavaScript, Python) - use existing snippet generator

**Files to create:**
- `packages/bruno-public-docs/src/components/DocViewer.jsx`
- `packages/bruno-public-docs/src/components/InteractivePlayground.jsx`
- `packages/bruno-public-docs/src/utils/codeGenerator.js` (copy from main app)

---

### Phase 4: Permissions & Security

#### 4.1 Password Protection

**Backend:**
```rust
// In packages/bruno-server/src/handlers/public_docs.rs

pub async fn verify_password(
    Path(slug): Path<String>,
    Json(payload): Json<VerifyPasswordPayload>,
) -> AppResult<Json<VerifyPasswordResponse>> {
    let doc = self.service.get_by_slug(&slug).await?;

    match doc.visibility {
        DocVisibility::Password { hash } => {
            if verify_password(&payload.password, &hash)? {
                // Generate short-lived JWT token for this doc
                let token = generate_doc_token(&slug, 24 * 60 * 60)?; // 24h
                Ok(Json(VerifyPasswordResponse { token }))
            } else {
                Err(AppError::Unauthorized("Invalid password".into()))
            }
        }
        _ => Err(AppError::BadRequest("Not password-protected".into()))
    }
}
```

**Frontend:**
- Show password input modal
- Store token in localStorage
- Include token in `Authorization` header when fetching doc

**Files to modify:**
- `packages/bruno-server/src/handlers/public_docs.rs` - Add verify_password handler
- `packages/bruno-public-docs/src/components/PasswordPrompt.jsx` - Password UI
- `packages/bruno-public-docs/src/hooks/usePublicDoc.js` - Token handling

#### 4.2 Workspace Members Only

**Backend:**
```rust
pub async fn get_public_doc(
    Path(slug): Path<String>,
    auth_header: Option<TypedHeader<Authorization<Bearer>>>,
) -> AppResult<Json<PublicDocResponse>> {
    let doc = self.service.get_by_slug(&slug).await?;

    match doc.visibility {
        DocVisibility::WorkspaceMembers => {
            // Require valid JWT token for workspace member
            let token = auth_header
                .ok_or(AppError::Unauthorized("Authentication required".into()))?;
            let user_id = verify_jwt_token(&token.token())?;

            // Check if user is workspace member
            self.workspace_service.verify_membership(&doc.workspace_uid, user_id).await?;
        }
        DocVisibility::Public => {}, // No check needed
        DocVisibility::Password { .. } => {
            // Check for doc token in header
            let token = auth_header
                .ok_or(AppError::Unauthorized("Password required".into()))?;
            verify_doc_token(&token.token(), &slug)?;
        }
        _ => {}
    }

    Ok(Json(doc.to_response()))
}
```

---

### Phase 5: Integration & Polish

#### 5.1 Collection List Indicator

**Show published status in collection list:**
- Add "Published" badge/icon next to collection name
- Show public URL on hover
- Quick copy URL button

**Files to modify:**
- `packages/bruno-app/src/components/Sidebar/Collections/Collection/index.js`
- Add published indicator UI

#### 5.2 Analytics (Optional - Future Enhancement)

**Track in MongoDB:**
- View count
- Last viewed timestamp
- Unique visitors (by IP hash)

**Add to collection model:**
```rust
pub struct DocAnalytics {
    pub views: i32,
    pub unique_visitors: i32,
    pub last_viewed: DateTime<Utc>,
}
```

#### 5.3 Slug Customization

**Allow users to customize slug:**
- Show editable slug field in publish modal
- Validate uniqueness before saving
- Show warning if slug changes (old URLs will break)

---

## Critical Files Summary

### Backend (Rust)
- **Create:**
  - `packages/bruno-server/src/models/public_docs.rs` - Data models
  - `packages/bruno-server/src/handlers/public_docs.rs` - HTTP handlers
  - `packages/bruno-server/src/services/public_docs.rs` - Business logic

- **Modify:**
  - `packages/bruno-server/src/models/collection.rs` - Add `public_docs` field
  - `packages/bruno-server/src/router.rs` - Add public doc routes
  - `packages/bruno-server/src/handlers/collection.rs` - Import handlers

### Frontend (React)
- **Create:**
  - `packages/bruno-app/src/components/Sidebar/Collections/Collection/PublishDocumentation/` - Publish modal
  - `packages/bruno-public-docs/` - New package for public viewer

- **Modify:**
  - `packages/bruno-app/src/components/Sidebar/Collections/Collection/index.js` - Add menu item
  - `packages/bruno-app/src/providers/ReduxStore/slices/collections/index.js` - Add state
  - `packages/bruno-app/src/providers/ReduxStore/slices/collections/actions.js` - Add actions
  - `packages/bruno-api/src/collections/index.ts` - Add API methods
  - `packages/bruno-api/src/types/index.ts` - Add TypeScript types

---

## Verification Steps

### Backend Testing
1. Start bruno-server: `cd packages/bruno-server && cargo run`
2. Test endpoints with cURL:
   ```bash
   # Publish docs
   curl -X POST http://localhost:3000/api/collections/{id}/docs/publish \
     -H "Authorization: Bearer {token}" \
     -d '{"visibility":"public","settings":{"showExamples":true}}'

   # Get public doc
   curl http://localhost:3000/api/public/docs/{slug}
   ```

### Frontend Testing
1. Open Bruno app in browser
2. Right-click collection → "Publish Documentation"
3. Fill form, click "Publish"
4. Verify public URL is generated
5. Copy URL and open in incognito browser
6. Test interactive playground

### End-to-End Flow
1. Create a collection with requests
2. Publish with "Public" visibility
3. Open public URL (no auth required)
4. Test "Try it" button on a request
5. Update visibility to "Password"
6. Refresh public URL → should show password prompt
7. Enter password → should show docs
8. Unpublish → public URL should show 404

---

## Future Enhancements (Post-MVP)

1. **Custom Domains** - Allow `docs.mycompany.com` to point to their published docs
2. **Version History** - Track doc changes, allow viewing previous versions
3. **Code Examples** - Auto-generate snippets in multiple languages
4. **Custom Branding** - Logo, colors, CSS injection
5. **SEO Optimization** - Meta tags, sitemap, robots.txt
6. **Webhook on Publish** - Notify external services when docs are updated
7. **Collaborative Editing** - Multiple users editing docs simultaneously
8. **Comments** - Allow feedback on specific endpoints
9. **Search** - Full-text search across all published docs
10. **Embeddable Widgets** - Embed single request in external websites

---

## Notes

- The OpenCollection format is already well-defined and used for exports
- The existing "Generate Documentation" HTML export uses `cdn.opencollection.com` - we can reuse this
- Password hashing: Use `argon2` crate in Rust (industry standard, secure)
- JWT tokens: Use existing auth infrastructure, extend for doc-specific tokens
- MongoDB indexes needed: `public_docs.slug` (unique), `public_docs.enabled`
- Rate limiting: Add to public endpoints to prevent abuse (use `tower-governor`)
