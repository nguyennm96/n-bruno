# Bruno Public Documentation Viewer

A standalone React application for viewing published Bruno API documentation.

## Features

- 🌐 **Public Access** - View documentation via unique URLs (`/p/:slug`)
- 🔒 **Password Protection** - Support for password-protected docs
- 👥 **Workspace Permissions** - Workspace member authentication
- 📚 **OpenCollection Format** - Uses OpenCollection viewer for rendering
- 🎨 **Responsive Design** - Works on desktop and mobile
- ⚡ **Fast & Lightweight** - Minimal dependencies

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Bruno server running (for API access)

### Installation

```bash
cd packages/bruno-public-docs
npm install
```

### Development

```bash
# Start development server (runs on port 3001)
npm run dev
```

The app will be available at `http://localhost:3001`

### Build for Production

```bash
# Build optimized production bundle
npm run build

# Preview production build
npm run preview
```

## Architecture

### Routes

- `/p/:slug` - View published documentation
- `/` - Landing page (shows error if accessed directly)

### Components

- **DocViewer** - Main component that loads and renders documentation
- **PasswordPrompt** - Password entry form for protected docs
- **LoadingState** - Loading spinner
- **ErrorPage** - Error display

### Hooks

- **usePublicDoc** - Fetches documentation data, handles auth/passwords

### Data Flow

1. User visits `/p/{slug}`
2. `usePublicDoc` hook fetches doc from `/api/public/docs/{slug}`
3. If password required, show `PasswordPrompt`
4. If authenticated, render `DocViewer` with OpenCollection
5. OpenCollection library renders the API documentation

## Environment Variables

Create a `.env.local` file:

```env
# Bruno server URL (default: http://localhost:8080)
VITE_BRUNO_SERVER_URL=http://localhost:8080
```

## Deployment

### Option A: Static Hosting (Netlify, Vercel, etc.)

1. Build the app: `npm run build`
2. Upload `dist/` folder to your hosting provider
3. Configure rewrites to handle SPA routing:

**Netlify** (`_redirects`):
```
/*    /index.html   200
```

**Vercel** (`vercel.json`):
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Option B: Nginx

```nginx
server {
  listen 80;
  server_name docs.yourdomain.com;
  root /path/to/dist;
  index index.html;

  # SPA routing
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Proxy API requests to backend
  location /api/ {
    proxy_pass http://bruno-server:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

### Option C: Docker

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Integration with Bruno Server

The viewer communicates with Bruno server via REST API:

- `GET /api/public/docs/:slug` - Fetch documentation
- `POST /api/public/docs/:slug/verify-password` - Verify password

Ensure CORS is configured on the server to allow requests from the viewer domain.

## Troubleshooting

### Documentation not loading

- Check that Bruno server is running
- Verify the slug is correct
- Check browser console for errors

### Password not working

- Ensure password was set correctly when publishing
- Clear localStorage and try again: `localStorage.removeItem('doc-token-{slug}')`

### OpenCollection viewer not rendering

- Verify OpenCollection CDN is accessible
- Check browser console for JavaScript errors
- Ensure collection data is in correct format

## License

MIT
