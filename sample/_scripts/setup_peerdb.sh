#!/bin/bash

# Script to set up PeerDB peers and mirror
# This script creates PostgreSQL and ClickHouse peers, and sets up the mirror

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' 

# Step 1: Create PostgreSQL peer in PeerDB
echo -e "${BLUE}Creating PostgreSQL peer in PeerDB...${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" --request POST \
  --url http://localhost:3000/api/v1/peers/create \
  --header 'Content-Type: application/json' \
  --data '{
	"peer": {
		"name": "postgres",
		"type": 3,
		"postgres_config": {
			"host": "host.docker.internal",
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

# Step 2: Create ClickHouse peer in PeerDB
echo -e "${BLUE}Creating ClickHouse peer in PeerDB...${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" --request POST \
  --url http://localhost:3000/api/v1/peers/create \
  --header 'Content-Type: application/json' \
  --data '{
	"peer": {
		"name": "clickhouse",
		"type": 8,
		"clickhouse_config": {
			"host": "host.docker.internal",
			"port": 9000,
			"user": "default",
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

# Step 3: Create PeerDB mirror
echo -e "${BLUE}Creating PeerDB mirror...${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" --request POST \
  --url localhost:3000/api/v1/flows/cdc/create \
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
  "idle_timeout_seconds": 10,
  "publication_name": "",
  "do_initial_snapshot": true,
  "snapshot_num_rows_per_partition": 5000,
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
