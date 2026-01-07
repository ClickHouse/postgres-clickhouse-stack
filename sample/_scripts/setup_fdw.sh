#!/bin/bash

# Script to set up ClickHouse Foreign Data Wrapper in PostgreSQL
# This script creates the extension, server, user mapping, and imports foreign schema

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' 

echo -e "${BLUE}Setting up ClickHouse Foreign Data Wrapper...${NC}"
PGPASSWORD=password psql -h localhost -p 5432 -U admin -d postgres <<EOF
-- Create the ClickHouse extension
CREATE EXTENSION IF NOT EXISTS pg_clickhouse;

-- Create the foreign server pointing to ClickHouse
CREATE SERVER IF NOT EXISTS clickhouse_svr FOREIGN DATA WRAPPER clickhouse_fdw OPTIONS(dbname 'expense', host 'host.docker.internal');

-- Create user mapping for the current user
DO \$\$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_user_mappings 
        WHERE srvname = 'clickhouse_svr' 
        AND usename = CURRENT_USER
    ) THEN
        CREATE USER MAPPING FOR CURRENT_USER SERVER clickhouse_svr OPTIONS (user 'default', password '');
    END IF;
END \$\$;

-- Create schema for foreign tables
CREATE SCHEMA IF NOT EXISTS expense_ch;

-- Import foreign schema from ClickHouse
IMPORT FOREIGN SCHEMA expense FROM SERVER clickhouse_svr INTO expense_ch;
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ ClickHouse FDW configured successfully${NC}"
else
    echo -e "${RED}Error: Failed to configure ClickHouse FDW${NC}"
    exit 1
fi
