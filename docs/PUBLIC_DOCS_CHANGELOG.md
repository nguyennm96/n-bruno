# Changelog - Public Documentation Feature

## [Unreleased] - 2026-03-06

### 🎉 Added - Public Documentation Feature

A comprehensive public documentation system that allows users to publish and share beautiful, interactive API documentation with customizable permissions.

#### Backend (Rust + MongoDB)

**New Models:**
- `PublicDocs` - Documentation publication configuration
- `DocVisibility` - Enum for permission types (Public, Password, WorkspaceMembers, CustomList)
- `DocSettings` - Display preferences (show examples, auth details)
- `DocAnalytics` - View tracking and statistics

**New API Endpoints:**
- `POST /api/collections/:id/docs/publish` - Publish collection documentation
- `PATCH /api/collections/:id/docs` - Update documentation settings
- `DELETE /api/collections/:id/docs/unpublish` - Remove public access
- `GET /api/collections/:id/docs/status` - Get publication status and analytics
- `GET /api/public/docs/:slug` - View published documentation (public)
- `POST /api/public/docs/:slug/verify-password` - Verify password for protected docs

**New Services:**
- `PublicDocsService` - Business logic for documentation publishing
- Slug generation with collision detection
- Argon2 password hashing
- JWT token generation for document access
- Automatic view tracking

**Security:**
- Runtime visibility enforcement
- Password protection with Argon2 hashing
- Workspace member authentication
- Short-lived JWT tokens (24h) for password-protected docs
- MongoDB unique indexes for slug collision prevention

#### Frontend (React + Redux)

**New Components:**
- `PublishDocumentation` - Modal for publishing/managing docs
  - Three visibility modes with intuitive UI
  - Password input for protected docs
  - Settings toggles (examples, auth)
  - Public URL display with copy/open buttons
  - Update and unpublish actions
- Published badge in collection sidebar
  - Cloud icon indicator
  - Tooltip with public URL

**API Client Extensions:**
- `CollectionService.publishDocs()` - Publish with configuration
- `CollectionService.updateDocs()` - Update settings/visibility
- `CollectionService.unpublishDocs()` - Remove publication
- `CollectionService.getDocsStatus()` - Fetch status

**UI Integration:**
- "Publish Docs" menu item in collection dropdown
- Only visible when authenticated
- Published collections show badge with cloud icon
- Seamless integration with existing Redux flow

#### Public Viewer (New Package)

**New Package: `bruno-public-docs`**
- Standalone React application for viewing published docs
- Lightweight SPA with Vite
- Routes: `/p/:slug` for documentation URLs

**Components:**
- `DocViewer` - Main viewer with OpenCollection integration
- `PasswordPrompt` - Password entry for protected docs
- `LoadingState` - Loading spinner with branding
- `ErrorPage` - User-friendly error messages

**Features:**
- Beautiful, responsive documentation viewer
- Password protection with token storage
- Error handling for 404, 401, 403
- OpenCollection library integration for rendering
- Automatic token management in localStorage
- Support for workspace authentication

**Custom Hooks:**
- `usePublicDoc` - Data fetching and authentication
  - Handles loading, error states
  - Detects password requirements
  - Auto-retry with stored tokens
  - Exposes `verifyPassword()` method

#### Documentation & Scripts

**Documentation:**
- `PUBLIC_DOCS_SETUP.md` - Complete setup and testing guide
- `PUBLIC_DOCS_IMPLEMENTATION_SUMMARY.md` - Technical overview
- `bruno-public-docs/README.md` - Viewer deployment guide

**Scripts:**
- `start-public-docs.sh` - Automated service startup
- `stop-public-docs.sh` - Graceful service shutdown

#### Configuration

**Backend:**
- Added `PUBLIC_DOCS_BASE_URL` environment variable
- Updated CORS configuration for viewer domain

**Viewer:**
- `VITE_BRUNO_SERVER_URL` for API endpoint configuration

### 🔄 Changed

**Backend:**
- Extended `Collection` model with `public_docs` field
- Updated `CollectionResponse` to include public documentation status
- Added `PublicDocsService` to `AppState`

**Frontend:**
- Modified collection menu to include "Publish Docs" option
- Updated collection rendering to show published badge

### 📦 Dependencies

**Added:**
- `react-router-dom` (v6.20.0) - Routing for viewer app
- `js-yaml` (v4.1.0) - YAML parsing
- `axios` (v1.6.2) - HTTP client for viewer

**Backend (already present):**
- `argon2` (v0.5) - Password hashing
- `jsonwebtoken` (v9) - JWT tokens

---

## Migration Notes

### Database Migration

No explicit migration needed. The `public_docs` field is optional and will be `null` for existing collections.

When a collection is first published, the field will be populated:
```javascript
{
  "_id": ObjectId("..."),
  "uid": "collection-uid",
  "name": "My API",
  "public_docs": {
    "enabled": true,
    "slug": "my-api-abc123",
    "published_at": ISODate("2026-03-06T12:00:00Z"),
    "visibility": { "type": "public" },
    "settings": {
      "show_examples": true,
      "show_auth": true
    },
    "analytics": {
      "views": 0,
      "unique_visitors": 0
    }
  }
}
```

### Deployment Considerations

1. **Backend**: Update environment variables to include `PUBLIC_DOCS_BASE_URL`
2. **Viewer**: Deploy `bruno-public-docs` to subdomain (e.g., `docs.yourdomain.com`)
3. **CORS**: Ensure backend allows requests from viewer domain
4. **MongoDB Indexes**: Will be created automatically on first startup

### Breaking Changes

None. This is a new feature with no impact on existing functionality.

---

## Testing

### Backend Tests
- Slug generation and collision handling
- Password hashing and verification
- Visibility enforcement
- JWT token generation
- View count tracking

### Frontend Tests
- Publishing flow
- Update and unpublish actions
- Password protection UI
- URL copying
- Badge rendering

### E2E Tests
- Complete publish → view → unpublish flow
- Password protection end-to-end
- Workspace member authentication
- Error handling (404, 401, 403)

---

## Known Issues

None at this time.

---

## Future Enhancements

See `PUBLIC_DOCS_IMPLEMENTATION_SUMMARY.md` for detailed roadmap.

**High Priority:**
- Custom CSS/logo upload
- Slug customization
- Analytics dashboard
- Preview mode

**Medium Priority:**
- Version history
- Custom domains
- Code examples (multi-language)
- Search functionality

---

## Credits

- Implementation: Claude (Anthropic)
- Design: Based on Postman and Readme.io patterns
- OpenCollection viewer: https://opencollection.com

---

## Links

- Setup Guide: `docs/PUBLIC_DOCS_SETUP.md`
- Implementation Details: `docs/PUBLIC_DOCS_IMPLEMENTATION_SUMMARY.md`
- Viewer README: `packages/bruno-public-docs/README.md`
- Original Plan: `docs/public-documentation-feature-plan.md`
