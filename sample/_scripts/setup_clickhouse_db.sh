#!/bin/bash

# Script to create ClickHouse database
# This script creates the 'expense' database in ClickHouse

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' 

echo -e "${BLUE}Creating 'expense' database in ClickHouse...${NC}"
docker exec clickhouse clickhouse-client --host localhost --query 'CREATE DATABASE IF NOT EXISTS expense'

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ ClickHouse database 'expense' created${NC}"
else
    echo -e "${RED}Error: Failed to create ClickHouse database${NC}"
    exit 1
fi
