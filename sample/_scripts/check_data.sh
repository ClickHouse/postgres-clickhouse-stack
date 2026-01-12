#!/bin/bash

# Script to check if data has been replicated to ClickHouse
# This ensures PeerDB has successfully mirrored data before setting up FDW

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}Checking if data exists in ClickHouse...${NC}"

# Maximum number of retries
MAX_RETRIES=30
RETRY_INTERVAL=2

# Function to check row count in ClickHouse
check_clickhouse_data() {
    docker exec clickhouse clickhouse-client --query "SELECT COUNT(*) FROM expense.expenses" 2>/dev/null
}

# Retry loop
for i in $(seq 1 $MAX_RETRIES); do
    ROW_COUNT=$(check_clickhouse_data)
    
    if [ $? -eq 0 ] && [ ! -z "$ROW_COUNT" ] && [ "$ROW_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✓ Data found in ClickHouse: ${ROW_COUNT} rows${NC}"
        exit 0
    fi
    
    if [ $i -eq 1 ]; then
        echo -e "${YELLOW}Waiting for PeerDB to replicate data to ClickHouse...${NC}"
        echo -e "${YELLOW}This may take a few moments for initial sync${NC}"
    fi
    
    echo -e "${YELLOW}Attempt $i/$MAX_RETRIES: No data yet, waiting ${RETRY_INTERVAL}s...${NC}"
    sleep $RETRY_INTERVAL
done

# If we get here, we've exhausted all retries
echo -e "${RED}Error: No data found in ClickHouse after $MAX_RETRIES attempts${NC}"
echo -e "${YELLOW}Troubleshooting tips:${NC}"
echo -e "  1. Check PeerDB mirror status: http://localhost:3000"
echo -e "  2. Check PeerDB logs: docker logs flow-worker"
echo -e "  3. Verify PostgreSQL has data: psql -h localhost -p 5432 -U admin -d postgres -c 'SELECT COUNT(*) FROM expenses;'"
exit 1
