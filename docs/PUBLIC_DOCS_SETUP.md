# Public Documentation Feature - Setup & Testing Guide

## 🎉 Implementation Complete!

All phases of the public documentation feature have been implemented:

- ✅ **Phase 1**: Backend API (Database Schema, Endpoints, Services)
- ✅ **Phase 2**: Frontend Publishing UI
- ✅ **Phase 3**: Public Documentation Viewer App
- ✅ **Phase 4**: Permissions & Security
- ✅ **Phase 5**: Integration & Polish

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Setup Instructions](#setup-instructions)
3. [Environment Configuration](#environment-configuration)
4. [Testing Guide](#testing-guide)
5. [Deployment Guide](#deployment-guide)
6. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Components

```
┌─────────────────────┐
│   Bruno Desktop     │  Frontend (Electron/React)
│   - Publish Modal   │  • Create/update/unpublish docs
│   - Collection List │  • Copy public URL
└──────────┬──────────┘
           │
           │ REST API
           ▼
┌─────────────────────┐
│   Bruno Server      │  Backend (Rust/MongoDB)
│   - Auth/Perms      │  • Slug generation
│   - Public Docs API │  • Password hashing
│   - MongoDB Storage │  • Visibility control
└──────────┬──────────┘
           │
           │ HTTP
           ▼
┌─────────────────────┐
│  Public Docs Viewer │  Viewer (React SPA)
│  - Password Prompt  │  • OpenCollection rendering
│  - Doc Viewer       │  • Token management
│  - Error Handling   │  • Responsive UI
└─────────────────────┘
```

### Data Flow

1. **Publishing**: User → Bruno App → Bruno Server (creates slug, stores in MongoDB)
2. **Viewing**: Public User → Viewer App → Bruno Server → MongoDB (fetches & validates)
3. **Security**: JWT tokens for password/workspace auth, slug-based access control

---

## Setup Instructions

### 1. Install Dependencies

#### Backend (Rust)
```bash
cd packages/bruno-server
cargo build
```

#### Public Docs Viewer (React)
```bash
cd packages/bruno-public-docs
npm install
```

#### Main App (if not already installed)
```bash
cd packages/bruno-app
npm install
```

### 2. Environment Configuration

#### Backend: `packages/bruno-server/.env`
```env
# Database
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=bruno_server

# JWT
JWT_SECRET=your-secure-secret-key-min-32-chars

# Server
APP_HOST=0.0.0.0
APP_PORT=8080

# IMPORTANT: Public docs base URL (where viewer is hosted)
PUBLIC_DOCS_BASE_URL=http://localhost:3001
```

#### Viewer: `packages/bruno-public-docs/.env.local`
```env
# Bruno server API endpoint
VITE_BRUNO_SERVER_URL=http://localhost:8080
```

#### Main App: `packages/bruno-app/.env.local`
```env
# Bruno server API endpoint
VITE_BRUNO_SERVER_URL=http://localhost:8080
```

### 3. Database Setup

Ensure MongoDB is running:
```bash
# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Docker
docker run -d -p 27017:27017 --name bruno-mongo mongo:latest
```

The backend will automatically create necessary indexes on startup.

### 4. Start All Services

**Terminal 1 - Backend:**
```bash
cd packages/bruno-server
cargo run
# Server starts on http://localhost:8080
```

**Terminal 2 - Main App:**
```bash
cd packages/bruno-app
npm run dev
# App runs on http://localhost:3000
```

**Terminal 3 - Public Docs Viewer:**
```bash
cd packages/bruno-public-docs
npm run dev
# Viewer runs on http://localhost:3001
```

---

## Testing Guide

### Test 1: Publish Public Documentation

1. **Open Bruno App** (http://localhost:3000)
2. **Sign in** (create account if needed)
3. **Create a collection** with some requests
4. **Right-click collection** → "Publish Docs"
5. **Configure settings:**
   - Visibility: Public
   - ✅ Show examples
   - ✅ Show auth details
6. **Click "Publish"**
7. **Copy the public URL** (e.g., `http://localhost:3001/p/my-api-abc123`)

### Test 2: View Public Documentation

1. **Open URL in incognito/private window** (to test public access)
2. **Verify** documentation loads correctly
3. **Check** that requests, folders, and details are visible
4. **Test** the interactive playground (if implemented)

### Test 3: Password Protection

1. **Update visibility** in Bruno App:
   - Right-click collection → "Publish Docs"
   - Change to "Password Protected"
   - Enter password: `test123`
   - Click "Update"
2. **Refresh public URL** in incognito window
3. **Verify** password prompt appears
4. **Enter password**: `test123`
5. **Verify** documentation loads after correct password
6. **Try wrong password** - should show error

### Test 4: Workspace Members Only

1. **Update visibility** to "Workspace Members Only"
2. **Try accessing** in incognito window
3. **Verify** authentication required error
4. **Sign in** with workspace member account
5. **Verify** documentation loads for authenticated user

### Test 5: Unpublish

1. **In Bruno App**, right-click collection → "Publish Docs"
2. **Click "Unpublish Documentation"**
3. **Confirm** the action
4. **Try accessing** public URL
5. **Verify** "Documentation not found" error

### Test 6: Collection Badge

1. **Publish a collection**
2. **Check sidebar** - collection should show "Published" badge with cloud icon
3. **Hover over badge** - should show public URL in tooltip
4. **Unpublish** - badge should disappear

---

## API Testing (via cURL)

### Publish Documentation
```bash
curl -X POST http://localhost:8080/api/collections/{collection_uid}/docs/publish \
  -H "Authorization: Bearer {your_jwt_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "visibility": {"type": "public"},
    "settings": {
      "show_examples": true,
      "show_auth": true
    }
  }'
```

### Get Documentation Status
```bash
curl -X GET http://localhost:8080/api/collections/{collection_uid}/docs/status \
  -H "Authorization: Bearer {your_jwt_token}"
```

### View Public Documentation
```bash
curl -X GET http://localhost:8080/api/public/docs/{slug}
```

### Verify Password
```bash
curl -X POST http://localhost:8080/api/public/docs/{slug}/verify-password \
  -H "Content-Type: application/json" \
  -d '{"password": "test123"}'
```

### Update Documentation
```bash
curl -X PATCH http://localhost:8080/api/collections/{collection_uid}/docs \
  -H "Authorization: Bearer {your_jwt_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "visibility": {"type": "password", "hash": "newpassword123"},
    "settings": {"show_examples": false}
  }'
```

### Unpublish Documentation
```bash
curl -X DELETE http://localhost:8080/api/collections/{collection_uid}/docs/unpublish \
  -H "Authorization: Bearer {your_jwt_token}"
```

---

## Deployment Guide

### Backend Deployment

#### Option A: Docker
```dockerfile
# packages/bruno-server/Dockerfile
FROM rust:1.75 as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libssl3 ca-certificates
COPY --from=builder /app/target/release/bruno-server /usr/local/bin/
EXPOSE 8080
CMD ["bruno-server"]
```

```bash
docker build -t bruno-server packages/bruno-server
docker run -p 8080:8080 \
  -e MONGODB_URI=mongodb://mongo:27017 \
  -e JWT_SECRET=your-production-secret \
  -e PUBLIC_DOCS_BASE_URL=https://docs.yourdomain.com \
  bruno-server
```

#### Option B: Native (systemd)
```bash
# Build
cd packages/bruno-server
cargo build --release

# Install
sudo cp target/release/bruno-server /usr/local/bin/
sudo cp bruno-server.service /etc/systemd/system/

# Start
sudo systemctl enable bruno-server
sudo systemctl start bruno-server
```

### Viewer Deployment

#### Option A: Netlify / Vercel
```bash
cd packages/bruno-public-docs
npm run build

# Upload dist/ to Netlify/Vercel
# Configure environment variable: VITE_BRUNO_SERVER_URL
```

**Netlify `_redirects`:**
```
/*    /index.html   200
```

**Vercel `vercel.json`:**
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

#### Option B: Nginx
```nginx
server {
  listen 80;
  server_name docs.yourdomain.com;
  root /var/www/bruno-public-docs;
  index index.html;

  # SPA routing
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Proxy API to backend
  location /api/ {
    proxy_pass http://backend-server:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

#### Option C: AWS S3 + CloudFront
```bash
# Build
npm run build

# Upload to S3
aws s3 sync dist/ s3://your-bucket/ --delete

# Configure CloudFront:
# - Origin: S3 bucket
# - Behavior: Redirect all to /index.html for 404
# - Custom domain: docs.yourdomain.com
```

---

## Troubleshooting

### Issue: "Bruno Cloud API not initialized"
**Solution**: Ensure `initializeBrunoCloudApi()` is called in app startup
```javascript
// In App.jsx or main.jsx
import { initializeBrunoCloudApi } from 'services/brunoApi';
initializeBrunoCloudApi(store);
```

### Issue: CORS errors
**Solution**: Configure CORS in bruno-server
```rust
// In packages/bruno-server/src/router.rs
.layer(CorsLayer::new()
    .allow_origin("http://localhost:3001".parse::<HeaderValue>().unwrap())
    .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE])
    .allow_headers(Any))
```

### Issue: Password verification fails
**Solution**:
- Ensure password is sent as plain text to `/docs/publish` endpoint
- Backend will hash it using Argon2
- Check MongoDB to verify hash is stored: `db.collections.findOne({ "public_docs.slug": "your-slug" })`

### Issue: OpenCollection viewer not rendering
**Solution**:
- Verify CDN is accessible: https://cdn.opencollection.com/docs.js
- Check browser console for errors
- Ensure collection data format is correct (Bruno → OpenCollection conversion)

### Issue: Slugs collide
**Solution**: The backend automatically appends random suffixes. If still colliding:
- Increase suffix length in `public_docs.rs` line 58
- Check MongoDB unique index: `db.collections.getIndexes()`

### Issue: Public URL shows 404
**Solution**:
- Verify slug is correct: check `public_docs.slug` in MongoDB
- Ensure viewer app is running on correct port
- Check backend is accessible from viewer
- Verify routing is configured (SPA fallback to /index.html)

---

## File Structure Summary

### Backend (Rust)
```
packages/bruno-server/src/
├── models/
│   ├── public_docs.rs         # Data models (NEW)
│   └── collection.rs          # Updated with public_docs field
├── services/
│   └── public_docs.rs         # Business logic (NEW)
├── handlers/
│   └── public_docs.rs         # HTTP handlers (NEW)
├── router.rs                  # Routes (UPDATED)
├── state.rs                   # App state (UPDATED)
├── config/mod.rs              # Config (UPDATED)
├── main.rs                    # Initialization (UPDATED)
└── lib.rs                     # Library exports (UPDATED)
```

### Frontend (React)
```
packages/bruno-app/src/
└── components/Sidebar/Collections/Collection/
    ├── PublishDocumentation/
    │   ├── index.js           # Main component (NEW)
    │   └── StyledWrapper.js   # Styles (NEW)
    └── index.js               # Collection menu (UPDATED)

packages/bruno-api/src/
└── collections/
    └── index.ts               # API client (UPDATED)
```

### Viewer (React SPA)
```
packages/bruno-public-docs/    # Entire package (NEW)
├── src/
│   ├── App.jsx
│   ├── index.jsx
│   ├── components/
│   │   ├── DocViewer.jsx
│   │   ├── PasswordPrompt.jsx
│   │   ├── LoadingState.jsx
│   │   └── ErrorPage.jsx
│   └── hooks/
│       └── usePublicDoc.js
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

---

## Next Steps / Future Enhancements

### Immediate (Optional)
- [ ] Add analytics dashboard in Bruno App
- [ ] Slug customization UI
- [ ] Custom CSS/logo upload
- [ ] Preview docs before publishing

### Future Features
- [ ] Custom domains (docs.mycompany.com)
- [ ] Version history & rollback
- [ ] Code examples in multiple languages
- [ ] SEO optimization (meta tags, sitemap)
- [ ] Comments/feedback system
- [ ] Embeddable widgets
- [ ] Webhook on publish
- [ ] Search across docs
- [ ] Rate limiting for public endpoints
- [ ] CDN integration

---

## Support

For issues or questions:
- Check GitHub Issues: https://github.com/usebruno/bruno/issues
- Bruno Documentation: https://docs.usebruno.com
- Community Discord: https://discord.gg/KgcZUncpjq

---

## License

This feature is part of Bruno and follows the same MIT license.
