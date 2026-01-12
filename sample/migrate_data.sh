#!/bin/bash 

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' 

# Get the directory where this script is located
BASE_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_DIR="${BASE_SCRIPT_DIR}/_scripts"

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  Syncing Data from PostgreSQL to ClickHouse${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check if services are running
echo -e "${YELLOW}Checking if required services are running...${NC}"

if ! docker ps | grep -q clickhouse; then
    echo -e "${RED}Error: ClickHouse container is not running${NC}"
    echo -e "Please start the stack first using: ${YELLOW}./start.sh${NC}"
    exit 1
fi

if ! docker ps | grep -q postgres; then
    echo -e "${RED}Error: PostgreSQL container is not running${NC}"
    echo -e "Please start the stack first using: ${YELLOW}./start.sh${NC}"
    exit 1
fi

if ! docker ps | grep -q peerdb-ui; then
    echo -e "${RED}Error: PeerDB UI container is not running${NC}"
    echo -e "Please start the stack first using: ${YELLOW}./start.sh${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All required services are running${NC}"
echo ""

# Step 1: Create ClickHouse database
echo -e "${BLUE}[1/5] Setting up ClickHouse database...${NC}"
if ! "$SCRIPT_DIR/setup_clickhouse_db.sh"; then
    echo -e "${RED}Error: Failed to set up ClickHouse database${NC}"
    exit 1
fi
echo ""

# Step 2: Set up PeerDB peers and mirror
echo -e "${BLUE}[2/5] Setting up PeerDB peers and mirror...${NC}"
if ! "$SCRIPT_DIR/setup_peerdb.sh"; then
    echo -e "${RED}Error: Failed to set up PeerDB${NC}"
    exit 1
fi
echo ""

# Step 3: Check data in ClickHouse
echo -e "${BLUE}[3/5] Checking data in ClickHouse...${NC}"
if ! "$SCRIPT_DIR/check_data.sh"; then
    echo -e "${RED}Error: Failed to check data in ClickHouse${NC}"
    exit 1
fi
echo ""

# Step 4: Set up ClickHouse Foreign Data Wrapper
echo -e "${BLUE}[4/5] Setting up ClickHouse Foreign Data Wrapper...${NC}"
if ! "$SCRIPT_DIR/setup_fdw.sh"; then
    echo -e "${RED}Error: Failed to set up ClickHouse FDW${NC}"
    exit 1
fi
echo ""

# Step 5: Add .env file to sample application with DB_SCHEMA=expense_ch
echo -e "${BLUE}[5/5] Creating .env file for sample application...${NC}"
if ! "$SCRIPT_DIR/setup_env.sh"; then
    echo -e "${RED}Error: Failed to create .env file${NC}"
    exit 1
fi  
echo ""

# Summary
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Migration Setup Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "${BLUE}What was configured:${NC}"
echo -e "  1. ClickHouse 'expense' database"
echo -e "  2. PostgreSQL peer in PeerDB"
echo -e "  3. ClickHouse peer in PeerDB"
echo -e "  4. PeerDB mirror (PostgreSQL → ClickHouse)"
echo -e "  5. ClickHouse Foreign Data Wrapper"
echo -e "  6. .env file for sample application with DB_SCHEMA=expense_ch"
echo ""
