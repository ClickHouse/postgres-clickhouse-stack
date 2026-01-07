#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' 

echo -e "${BLUE}Starting PeerDB + PostgreSQL + ClickHouse Stack...${NC}"
echo ""

# Start docker compose
docker compose up -d

# Wait for services to be healthy
echo ""
echo -e "${YELLOW}Waiting for services to start...${NC}"

# Function to check if a service is healthy
check_service() {
    local service_name=$1
    local max_attempts=60
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        local status=$(docker inspect --format='{{.State.Health.Status}}' "$service_name" 2>/dev/null)

        # If service doesn't have health check, check if it's running
        if [ -z "$status" ] || [ "$status" = "<no value>" ]; then
            status=$(docker inspect --format='{{.State.Status}}' "$service_name" 2>/dev/null)
            if [ "$status" = "running" ]; then
                return 0
            fi
        elif [ "$status" = "healthy" ]; then
            return 0
        fi

        attempt=$((attempt + 1))
        sleep 2
    done

    return 1
}

# Check critical services
echo -e "${YELLOW}Checking PostgreSQL...${NC}"
if check_service "postgres"; then
    echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
else
    echo -e "${YELLOW}⚠ PostgreSQL is still starting (may need more time)${NC}"
fi

echo -e "${YELLOW}Checking ClickHouse...${NC}"
if check_service "clickhouse"; then
    echo -e "${GREEN}✓ ClickHouse is ready${NC}"
else
    echo -e "${YELLOW}⚠ ClickHouse is still starting (may need more time)${NC}"
fi

echo -e "${YELLOW}Checking PeerDB UI...${NC}"
if check_service "peerdb-ui"; then
    echo -e "${GREEN}✓ PeerDB UI is ready${NC}"
else
    echo -e "${YELLOW}⚠ PeerDB UI is still starting (may need more time)${NC}"
fi

echo -e "${YELLOW}Checking Catalog...${NC}"
if check_service "catalog"; then
    echo -e "${GREEN}✓ Catalog is ready${NC}"
else
    echo -e "${YELLOW}⚠ Catalog is still starting (may need more time)${NC}"
fi

# Display access instructions
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Stack is up and running!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}PeerDB UI:${NC}"
echo -e "   URL: http://localhost:3000"
echo ""
echo -e "${BLUE}ClickHouse UI (HTTP Interface):${NC}"
echo -e "   URL: http://localhost:8123/play"
echo ""
echo -e "${BLUE}ClickHouse Client:${NC}"
echo -e "   Command: ${YELLOW}clickhouse client --host 127.0.0.1 --port 9000${NC}"
echo ""
echo -e "${BLUE}PostgreSQL:${NC}"
echo -e "   Command: ${YELLOW}psql -h localhost -p 5432 -U admin -d postgres --password${NC}"
echo -e "   Password: password"
echo ""
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}To view logs:${NC} docker compose logs -f"
echo -e "${YELLOW}To stop:${NC} docker compose down"
echo ""
