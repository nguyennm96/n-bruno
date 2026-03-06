#!/bin/bash

# Bruno Public Documentation - Stop Script
# This script stops all public docs services

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Stopping Public Documentation Services    ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════╝${NC}"
echo ""

# Stop using PID files if they exist
if [ -f "logs/bruno-server.pid" ]; then
    BRUNO_SERVER_PID=$(cat logs/bruno-server.pid)
    if kill -0 $BRUNO_SERVER_PID 2>/dev/null; then
        echo -e "${YELLOW}→ Stopping bruno-server (PID: ${BRUNO_SERVER_PID})...${NC}"
        kill $BRUNO_SERVER_PID
        echo -e "${GREEN}✓ bruno-server stopped${NC}"
    else
        echo -e "${YELLOW}! bruno-server (PID: ${BRUNO_SERVER_PID}) not running${NC}"
    fi
    rm logs/bruno-server.pid
fi

if [ -f "logs/bruno-public-docs.pid" ]; then
    VIEWER_PID=$(cat logs/bruno-public-docs.pid)
    if kill -0 $VIEWER_PID 2>/dev/null; then
        echo -e "${YELLOW}→ Stopping bruno-public-docs (PID: ${VIEWER_PID})...${NC}"
        kill $VIEWER_PID
        echo -e "${GREEN}✓ bruno-public-docs stopped${NC}"
    else
        echo -e "${YELLOW}! bruno-public-docs (PID: ${VIEWER_PID}) not running${NC}"
    fi
    rm logs/bruno-public-docs.pid
fi

# Fallback: kill by process name
echo -e "${YELLOW}→ Checking for remaining processes...${NC}"

if pgrep -f "bruno-server" > /dev/null; then
    echo -e "${YELLOW}  Found remaining bruno-server processes, stopping...${NC}"
    pkill -f "bruno-server" || true
fi

if pgrep -f "vite.*bruno-public-docs" > /dev/null; then
    echo -e "${YELLOW}  Found remaining bruno-public-docs processes, stopping...${NC}"
    pkill -f "vite.*bruno-public-docs" || true
fi

echo ""
echo -e "${GREEN}✓ All services stopped${NC}"
echo ""
