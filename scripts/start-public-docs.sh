#!/bin/bash

# Bruno Public Documentation - Quick Start Script
# This script starts all necessary services for testing the public docs feature

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Bruno Public Documentation - Quick Start   ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════╝${NC}"
echo ""

# Check if MongoDB is running
echo -e "${YELLOW}[1/5]${NC} Checking MongoDB..."
if ! pgrep -x mongod > /dev/null; then
    echo -e "${RED}✗ MongoDB is not running${NC}"
    echo -e "  Start MongoDB with: ${GREEN}brew services start mongodb-community${NC}"
    echo -e "  Or: ${GREEN}sudo systemctl start mongod${NC}"
    echo -e "  Or: ${GREEN}docker run -d -p 27017:27017 mongo${NC}"
    exit 1
else
    echo -e "${GREEN}✓ MongoDB is running${NC}"
fi

# Check if bruno-public-docs dependencies are installed
echo -e "${YELLOW}[2/5]${NC} Checking bruno-public-docs dependencies..."
if [ ! -d "packages/bruno-public-docs/node_modules" ]; then
    echo -e "${YELLOW}! Installing bruno-public-docs dependencies...${NC}"
    cd packages/bruno-public-docs
    npm install
    cd ../..
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi

# Check if bruno-server is built
echo -e "${YELLOW}[3/5]${NC} Checking bruno-server build..."
if [ ! -f "packages/bruno-server/target/debug/bruno-server" ] && [ ! -f "packages/bruno-server/target/release/bruno-server" ]; then
    echo -e "${YELLOW}! Building bruno-server (this may take a few minutes)...${NC}"
    cd packages/bruno-server
    cargo build
    cd ../..
    echo -e "${GREEN}✓ bruno-server built${NC}"
else
    echo -e "${GREEN}✓ bruno-server already built${NC}"
fi

# Create .env files if they don't exist
echo -e "${YELLOW}[4/5]${NC} Checking environment configuration..."

# Backend .env
if [ ! -f "packages/bruno-server/.env" ]; then
    echo -e "${YELLOW}! Creating packages/bruno-server/.env${NC}"
    cat > packages/bruno-server/.env << 'EOF'
APP_ENV=development
APP_HOST=0.0.0.0
APP_PORT=8080
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=bruno_server
JWT_SECRET=development-secret-key-change-in-production-min-32-chars
JWT_ACCESS_EXPIRES_IN_MINUTES=15
JWT_REFRESH_EXPIRES_IN_DAYS=30
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
PUBLIC_DOCS_BASE_URL=http://localhost:3001
EOF
    echo -e "${GREEN}✓ Created .env file${NC}"
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi

# Viewer .env.local
if [ ! -f "packages/bruno-public-docs/.env.local" ]; then
    echo -e "${YELLOW}! Creating packages/bruno-public-docs/.env.local${NC}"
    cat > packages/bruno-public-docs/.env.local << 'EOF'
VITE_BRUNO_SERVER_URL=http://localhost:8080
EOF
    echo -e "${GREEN}✓ Created .env.local file${NC}"
else
    echo -e "${GREEN}✓ .env.local file exists${NC}"
fi

echo -e "${YELLOW}[5/5]${NC} Starting services..."
echo ""

# Start bruno-server in background
echo -e "${BLUE}→ Starting bruno-server (port 8080)...${NC}"
cd packages/bruno-server
cargo run > ../../logs/bruno-server.log 2>&1 &
BRUNO_SERVER_PID=$!
cd ../..
echo -e "${GREEN}  bruno-server PID: ${BRUNO_SERVER_PID}${NC}"

# Wait for server to start
sleep 3

# Check if server is running
if ! kill -0 $BRUNO_SERVER_PID 2>/dev/null; then
    echo -e "${RED}✗ bruno-server failed to start. Check logs/bruno-server.log${NC}"
    exit 1
fi

# Start bruno-public-docs
echo -e "${BLUE}→ Starting bruno-public-docs (port 3001)...${NC}"
cd packages/bruno-public-docs
npm run dev > ../../logs/bruno-public-docs.log 2>&1 &
VIEWER_PID=$!
cd ../..
echo -e "${GREEN}  bruno-public-docs PID: ${VIEWER_PID}${NC}"

# Wait for viewer to start
sleep 3

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║            Services Started Successfully!     ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Services:${NC}"
echo -e "  • bruno-server:      ${GREEN}http://localhost:8080${NC}"
echo -e "  • bruno-public-docs: ${GREEN}http://localhost:3001${NC}"
echo ""
echo -e "${BLUE}PIDs:${NC}"
echo -e "  • bruno-server:      ${BRUNO_SERVER_PID}"
echo -e "  • bruno-public-docs: ${VIEWER_PID}"
echo ""
echo -e "${BLUE}Logs:${NC}"
echo -e "  • bruno-server:      ${YELLOW}logs/bruno-server.log${NC}"
echo -e "  • bruno-public-docs: ${YELLOW}logs/bruno-public-docs.log${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo -e "  1. Start bruno-app (main application): ${GREEN}cd packages/bruno-app && npm run dev${NC}"
echo -e "  2. Sign in and create a collection"
echo -e "  3. Right-click collection → 'Publish Docs'"
echo -e "  4. Copy the public URL and test in incognito window"
echo ""
echo -e "${YELLOW}To stop services:${NC}"
echo -e "  kill ${BRUNO_SERVER_PID} ${VIEWER_PID}"
echo ""
echo -e "${YELLOW}Or use:${NC}"
echo -e "  pkill -f bruno-server"
echo -e "  pkill -f 'vite.*bruno-public-docs'"
echo ""

# Save PIDs to file for easy cleanup
mkdir -p logs
echo "$BRUNO_SERVER_PID" > logs/bruno-server.pid
echo "$VIEWER_PID" > logs/bruno-public-docs.pid

echo -e "${GREEN}✓ Setup complete! Services are running in the background.${NC}"
echo -e "${BLUE}  Press Ctrl+C to exit this script (services will continue running)${NC}"
echo ""

# Keep script running
wait
