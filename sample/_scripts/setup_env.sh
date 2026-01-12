#!/bin/bash

# Script to create .env file for the sample application
# This sets up the database schema to use the ClickHouse foreign tables

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/../pg-expense-direct"

echo -e "${BLUE}Creating .env file for sample application...${NC}"

# Create .env file
cat > "$APP_DIR/.env" <<EOF
# Use the ClickHouse foreign data wrapper schema
# This makes the app query ClickHouse tables instead of local PostgreSQL tables
DB_SCHEMA=expense_ch
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ .env file created successfully${NC}"
    echo -e "${YELLOW}Application will now use schema: expense_ch${NC}"
else
    echo -e "${RED}Error: Failed to create .env file${NC}"
    exit 1
fi
