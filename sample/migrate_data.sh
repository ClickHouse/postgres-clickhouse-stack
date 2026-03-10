#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Ensure we're in the project root
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  Syncing Data from PostgreSQL to ClickHouse${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Check if services are running
echo -e "${YELLOW}Checking if required services are running...${NC}"

if ! docker compose ps --status running clickhouse 2>/dev/null | grep -q clickhouse; then
    echo -e "${RED}Error: ClickHouse container is not running${NC}"
    echo -e "Please start the stack first using: ${YELLOW}./run.sh start${NC}"
    exit 1
fi

if ! docker compose ps --status running postgres 2>/dev/null | grep -q postgres; then
    echo -e "${RED}Error: PostgreSQL container is not running${NC}"
    echo -e "Please start the stack first using: ${YELLOW}./run.sh start${NC}"
    exit 1
fi

if ! docker compose ps --status running peerdb-ui 2>/dev/null | grep -q peerdb-ui; then
    echo -e "${RED}Error: PeerDB UI container is not running${NC}"
    echo -e "Please start the stack first using: ${YELLOW}./run.sh start${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All required services are running${NC}"
echo ""

# Step 1: Create ClickHouse database
echo -e "${BLUE}[1/5] Setting up ClickHouse database...${NC}"
echo -e "${BLUE}Creating 'expense' database in ClickHouse...${NC}"
if docker compose exec clickhouse clickhouse-client --host localhost --password clickhouse --query 'CREATE DATABASE IF NOT EXISTS expense'; then
    echo -e "${GREEN}✓ ClickHouse database 'expense' created${NC}"
else
    echo -e "${RED}Error: Failed to create ClickHouse database${NC}"
    exit 1
fi
echo ""

# Step 2: Set up PeerDB peers and mirror
echo -e "${BLUE}[2/5] Setting up PeerDB peers and mirror...${NC}"

# Create PostgreSQL peer
echo -e "${BLUE}Creating PostgreSQL peer in PeerDB...${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" --request POST \
  --url http://localhost:13000/api/v1/peers/create \
  --header 'Content-Type: application/json' \
  --data '{
	"peer": {
		"name": "postgres",
		"type": 3,
		"postgres_config": {
			"host": "postgres",
			"port": 5432,
			"user": "admin",
			"password": "password",
			"database": "postgres"
		}
	},
	"allow_update":false
}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    echo -e "${GREEN}✓ PostgreSQL peer created${NC}"
elif echo "$BODY" | grep -q "already exists"; then
    echo -e "${YELLOW}⚠ PostgreSQL peer already exists${NC}"
else
    echo -e "${RED}Error: Failed to create PostgreSQL peer (HTTP $HTTP_CODE)${NC}"
    echo "$BODY"
    exit 1
fi

# Create ClickHouse peer
echo -e "${BLUE}Creating ClickHouse peer in PeerDB...${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" --request POST \
  --url http://localhost:13000/api/v1/peers/create \
  --header 'Content-Type: application/json' \
  --data '{
	"peer": {
		"name": "clickhouse",
		"type": 8,
		"clickhouse_config": {
			"host": "clickhouse",
			"port": 9000,
			"user": "default",
			"password": "clickhouse",
			"database": "expense",
			"disable_tls": true
		}
	},
	"allow_update":false
}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    echo -e "${GREEN}✓ ClickHouse peer created${NC}"
elif echo "$BODY" | grep -q "already exists"; then
    echo -e "${YELLOW}⚠ ClickHouse peer already exists${NC}"
else
    echo -e "${RED}Error: Failed to create ClickHouse peer (HTTP $HTTP_CODE)${NC}"
    echo "$BODY"
    exit 1
fi

# Create PeerDB mirror
echo -e "${BLUE}Creating PeerDB mirror...${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" --request POST \
  --url localhost:13000/api/v1/flows/cdc/create \
  --header 'Content-Type: application/json' \
  --data '{
"connection_configs": {
  "flow_job_name": "mirror_api_kick_off",
  "source_name": "postgres",
  "destination_name": "clickhouse",
  "table_mappings": [
   {
      "source_table_identifier": "public.expenses",
      "destination_table_identifier": "expenses"
    }
  ],
  "max_batch_size": 1000000,
  "idle_timeout_seconds": 10,
  "publication_name": "",
  "do_initial_snapshot": true,
  "snapshot_num_rows_per_partition": 500000,
  "snapshot_max_parallel_workers": 4,
  "snapshot_num_tables_in_parallel": 4,
  "resync": false,
  "initial_snapshot_only": false,
  "soft_delete_col_name": "_peerdb_is_deleted",
  "synced_at_col_name": "_peerdb_synced_at"
}
}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    echo -e "${GREEN}✓ PeerDB mirror created${NC}"
elif echo "$BODY" | grep -q "already exists"; then
    echo -e "${YELLOW}⚠ PeerDB mirror already exists${NC}"
else
    echo -e "${RED}Error: Failed to create PeerDB mirror (HTTP $HTTP_CODE)${NC}"
    echo "$BODY"
    exit 1
fi
echo ""

# Step 3: Check data in ClickHouse
echo -e "${BLUE}[3/5] Waiting for data in ClickHouse...${NC}"

SRC_COUNT=$(docker compose exec -T postgres psql -U admin -d postgres -t -A -c "SELECT COUNT(*) FROM expenses;" 2>/dev/null | tr -d '[:space:]')
if [ -z "$SRC_COUNT" ] || [ "$SRC_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}No data in PostgreSQL yet. Run ./run.sh seed to load data.${NC}"
    echo -e "${YELLOW}PeerDB will replicate automatically once data is available.${NC}"
else
    # Wait for replication
    MAX_RETRIES=30
    RETRY_INTERVAL=2
    DATA_FOUND=false

    for i in $(seq 1 $MAX_RETRIES); do
        ROW_COUNT=$(docker compose exec clickhouse clickhouse-client --password clickhouse --query "SELECT COUNT(*) FROM expense.expenses" 2>/dev/null)

        if [ $? -eq 0 ] && [ ! -z "$ROW_COUNT" ] && [ "$ROW_COUNT" -gt 0 ]; then
            echo -e "${GREEN}✓ Data found in ClickHouse: ${ROW_COUNT} rows${NC}"
            DATA_FOUND=true
            break
        fi

        if [ $i -eq 1 ]; then
            echo -e "${YELLOW}Waiting for PeerDB to replicate ${SRC_COUNT} rows...${NC}"
        fi

        echo -ne "${YELLOW}  Attempt $i/$MAX_RETRIES...${NC}\r"
        sleep $RETRY_INTERVAL
    done

    if [ "$DATA_FOUND" = false ]; then
        echo ""
        echo -e "${RED}Error: No data in ClickHouse after $MAX_RETRIES attempts${NC}"
        echo -e "${YELLOW}Check PeerDB mirror status: http://localhost:13000${NC}"
        exit 1
    fi
fi
echo ""

# Step 4: Set up ClickHouse Foreign Data Wrapper
echo -e "${BLUE}[4/5] Setting up ClickHouse Foreign Data Wrapper...${NC}"
docker compose exec -T postgres psql -U admin -d postgres <<'EOF'
CREATE EXTENSION IF NOT EXISTS pg_clickhouse;
CREATE SERVER IF NOT EXISTS clickhouse_svr FOREIGN DATA WRAPPER clickhouse_fdw OPTIONS(dbname 'expense', host 'clickhouse');
DO $$ BEGIN
  CREATE USER MAPPING FOR CURRENT_USER SERVER clickhouse_svr OPTIONS (user 'default', password 'clickhouse');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE SCHEMA IF NOT EXISTS expense_ch;
IMPORT FOREIGN SCHEMA expense FROM SERVER clickhouse_svr INTO expense_ch;
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ ClickHouse FDW configured successfully${NC}"
else
    echo -e "${RED}Error: Failed to configure ClickHouse FDW${NC}"
    exit 1
fi
echo ""

# Step 5: Switch expense app to ClickHouse
echo -e "${BLUE}[5/5] Switching expense app to ClickHouse...${NC}"
curl -s -X POST http://localhost:18080/api/backend \
  -H 'Content-Type: application/json' \
  -d '{"backend":"clickhouse"}' > /dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Expense app now querying ClickHouse${NC}"
else
    echo -e "${RED}Error: Failed to switch backend${NC}"
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
echo -e "  2. PeerDB peers (PostgreSQL + ClickHouse)"
echo -e "  3. PeerDB mirror (PostgreSQL → ClickHouse)"
echo -e "  4. ClickHouse Foreign Data Wrapper"
echo -e "  5. Expense app switched to ClickHouse"
echo ""
echo -e "${YELLOW}Toggle backend:${NC} ./run.sh use-postgres | ./run.sh use-clickhouse"
echo ""
