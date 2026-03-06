# Public Documentation Feature - Testing Guide

## Implementation Status ✅

All features have been implemented and the backend compiles successfully:

### Backend (Rust/Axum) ✅
- ✅ Models: `public_docs.rs`, updated `collection.rs`
- ✅ Services: `public_docs.rs` with full business logic
- ✅ Handlers: 11 endpoints (publish, update, unpublish, status, uploads, slug check)
- ✅ Router: All routes registered and integrated
- ✅ State: PublicDocsService initialized in AppState
- ✅ Config: Added `public_docs_base_url` environment variable
- ✅ Compilation: No errors, only minor warnings

### Frontend (React) ✅
- ✅ PublishDocumentation modal component
- ✅ PreviewModal for previewing before publishing
- ✅ StyledWrapper with complete styling
- ✅ Integration in Collection sidebar menu
- ✅ API client methods in bruno-api

### Features Implemented ✅
1. ✅ **Base Publishing** - Publish/unpublish collections with visibility controls
2. ✅ **Custom CSS Upload** - Upload and apply custom stylesheets (max 100KB)
3. ✅ **Custom Logo Upload** - Upload brand logos (max 2MB, base64 encoded)
4. ✅ **Slug Customization** - Custom slugs with real-time availability check
5. ✅ **Analytics Dashboard** - View counts, unique visitors, last viewed
6. ✅ **Preview Mode** - Preview docs before publishing with OpenCollection viewer

---

## Testing Instructions

### 1. Backend Setup

```bash
# Start the backend server
cd packages/bruno-server

# Set environment variables (create .env if needed)
export DATABASE_URL="mongodb://localhost:27017"
export JWT_SECRET="your-secret-key"
export PUBLIC_DOCS_BASE_URL="http://localhost:5173/p"

# Run the server
cargo run
```

The server should start on `http://localhost:3000` (or configured port).

### 2. Frontend Setup

```bash
# Install dependencies (if needed)
npm install

# Start the main Bruno app
cd packages/bruno-app
npm run dev
```

The app should start on `http://localhost:8080` (or configured port).

### 3. Test Scenarios

#### Scenario 1: Basic Publishing

1. **Open Bruno app** and authenticate
2. **Create a test collection** with some requests
3. **Right-click the collection** → Select "Publish Docs"
4. **Configure settings:**
   - Visibility: Public
   - ✓ Show examples
   - ✓ Show authentication details
5. **Click "Publish"**
6. **Verify:**
   - ✅ Success toast appears
   - ✅ Public URL is displayed
   - ✅ URL format: `{PUBLIC_DOCS_BASE_URL}/{slug}`

#### Scenario 2: Custom Slug

1. **Open publish modal**
2. **Enter custom slug:** "my-awesome-api"
3. **Wait for validation** (500ms debounce)
4. **Verify:**
   - ✅ Green checkmark if available
   - ✅ Red X if taken
5. **Publish with custom slug**
6. **Verify:** URL uses custom slug

#### Scenario 3: Password Protection

1. **Open publish modal** (or update existing)
2. **Select visibility:** Password-protected
3. **Enter password:** "test123"
4. **Click "Publish" or "Update"**
5. **Open public URL in incognito**
6. **Verify:**
   - ✅ Password prompt appears
   - ✅ Wrong password shows error
   - ✅ Correct password grants access
   - ✅ Token stored for 24 hours

#### Scenario 4: Custom CSS

1. **Create test CSS file:**
   ```css
   /* custom-theme.css */
   .api-doc-container {
     background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
     color: white;
   }

   .endpoint-card {
     border: 2px solid gold;
     border-radius: 8px;
   }
   ```

2. **Upload CSS:**
   - Click "Upload CSS" in Branding section
   - Select file (max 100KB)
   - Wait for success toast

3. **Verify:**
   - ✅ File name displayed
   - ✅ CSS applied to published docs

#### Scenario 5: Custom Logo

1. **Prepare logo image** (PNG/JPG, max 2MB)
2. **Upload logo:**
   - Click "Upload Logo" in Branding section
   - Select image file
   - Preview appears immediately
3. **Verify:**
   - ✅ Preview shows in modal
   - ✅ Logo appears on published docs

#### Scenario 6: Preview Before Publishing

1. **Configure all settings:**
   - Custom slug
   - Upload CSS and logo
   - Toggle show_examples, show_auth
2. **Click "Preview Documentation"**
3. **Verify:**
   - ✅ Full-screen modal opens
   - ✅ OpenCollection viewer renders
   - ✅ Custom CSS applied
   - ✅ Custom logo displayed
   - ✅ Settings respected (examples, auth)
4. **Close preview**
5. **Make changes and preview again**

#### Scenario 7: Analytics

1. **Publish documentation**
2. **Visit public URL 3-5 times** (different browsers/incognito)
3. **Open publish modal**
4. **Click "Show Details"** in Analytics section
5. **Verify:**
   - ✅ View count increments
   - ✅ Unique visitors tracked
   - ✅ Last viewed timestamp updates

#### Scenario 8: Update Settings

1. **Open publish modal** on published collection
2. **Change visibility** from Public → Workspace Members
3. **Toggle show_examples** to OFF
4. **Click "Update"**
5. **Verify:**
   - ✅ Settings saved
   - ✅ Public URL now requires auth
   - ✅ Examples hidden in viewer

#### Scenario 9: Unpublish

1. **Open publish modal**
2. **Scroll to bottom**
3. **Click "Unpublish Documentation"**
4. **Confirm in alert dialog**
5. **Verify:**
   - ✅ Success toast appears
   - ✅ Modal closes
   - ✅ Public URL returns 404
   - ✅ Slug becomes available again

---

## API Testing with cURL

### Get Auth Token
```bash
# Login to get JWT token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Save the token
export TOKEN="eyJhbGc..."
```

### Publish Documentation
```bash
curl -X POST http://localhost:3000/api/collections/{collection_id}/docs/publish \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "visibility": {"type": "public"},
    "settings": {
      "show_examples": true,
      "show_auth": true
    },
    "custom_slug": "my-api-docs"
  }'
```

### Check Slug Availability
```bash
curl http://localhost:3000/api/collections/docs/check-slug/my-api-docs
```

### Upload Custom CSS
```bash
curl -X POST http://localhost:3000/api/collections/{collection_id}/docs/upload-css \
  -H "Authorization: Bearer $TOKEN" \
  -F "css=@custom-theme.css"
```

### Upload Custom Logo
```bash
curl -X POST http://localhost:3000/api/collections/{collection_id}/docs/upload-logo \
  -H "Authorization: Bearer $TOKEN" \
  -F "logo=@logo.png"
```

### Get Documentation Status
```bash
curl http://localhost:3000/api/collections/{collection_id}/docs/status \
  -H "Authorization: Bearer $TOKEN"
```

### Get Public Documentation
```bash
curl http://localhost:3000/api/public/docs/{slug}
```

### Update Documentation
```bash
curl -X PATCH http://localhost:3000/api/collections/{collection_id}/docs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "visibility": {"type": "password", "hash": "newpassword123"},
    "settings": {
      "show_examples": false,
      "show_auth": true
    }
  }'
```

### Unpublish Documentation
```bash
curl -X DELETE http://localhost:3000/api/collections/{collection_id}/docs/unpublish \
  -H "Authorization: Bearer $TOKEN"
```

---

## Public Viewer App Setup

The standalone public documentation viewer app is in `packages/bruno-public-docs/`:

```bash
cd packages/bruno-public-docs

# Install dependencies
npm install

# Start development server
npm run dev
```

Access at `http://localhost:5173/p/{slug}`

---

## Environment Variables

Add to `packages/bruno-server/.env`:

```env
# Database
DATABASE_URL=mongodb://localhost:27017
DATABASE_NAME=bruno_cloud

# Auth
JWT_SECRET=your-super-secret-jwt-key-here

# Server
HOST=0.0.0.0
PORT=3000
APP_ENV=development

# Public Documentation
PUBLIC_DOCS_BASE_URL=http://localhost:5173/p
```

---

## Known Issues / Future Enhancements

### Current Limitations:
- Custom domain support not yet implemented
- Analytics limited to basic view counts (no graphs/charts)
- Custom user list visibility not fully tested
- No webhook notifications on publish

### Future Enhancements:
1. Custom domains (`docs.mycompany.com`)
2. Version history and rollback
3. Code snippet generator (cURL, JS, Python, etc.)
4. SEO optimization (meta tags, sitemap)
5. Embeddable widgets
6. Collaborative editing
7. Comments on endpoints
8. Full-text search
9. Advanced analytics with charts

---

## Troubleshooting

### Backend Won't Start
- Check MongoDB is running: `mongosh`
- Verify .env variables are set
- Check port 3000 isn't in use: `lsof -i :3000`

### Frontend Can't Connect
- Verify backend is running on correct port
- Check CORS settings in router.rs
- Inspect browser console for errors

### Public URL Returns 404
- Verify collection is published: check `docsStatus.enabled`
- Check slug in database: `db.collections.findOne({public_docs.slug: "your-slug"})`
- Verify PUBLIC_DOCS_BASE_URL is correct

### Custom CSS Not Applied
- Check file size < 100KB
- Verify CSS uploaded successfully (check response)
- Inspect element in browser to see if styles loaded

### Logo Not Showing
- Check image file < 2MB
- Verify image is valid (PNG/JPG/GIF/SVG)
- Check base64 encoding in database

### Slug Availability Always Shows "Checking"
- Check debounce timeout (500ms)
- Verify API endpoint responding: `/api/collections/docs/check-slug/{slug}`
- Check browser network tab for errors

---

## Success Criteria

All features are implemented. To verify complete success:

- ✅ Backend compiles without errors
- ✅ All 11 API endpoints respond correctly
- ✅ Frontend modal opens and displays all sections
- ✅ Collections can be published/updated/unpublished
- ✅ Custom CSS and logos upload and display
- ✅ Slug validation works with debouncing
- ✅ Preview modal shows OpenCollection viewer
- ✅ Analytics display view counts
- ✅ All visibility modes work (Public, Password, Workspace)
- ✅ Public viewer app renders documentation

---

## Contact

For issues or questions about this feature:
- Check implementation plan: `docs/public-documentation-feature-plan.md`
- Review code in:
  - Backend: `packages/bruno-server/src/{models,services,handlers}/public_docs.rs`
  - Frontend: `packages/bruno-app/src/components/Sidebar/Collections/Collection/PublishDocumentation/`
  - Viewer: `packages/bruno-public-docs/`
