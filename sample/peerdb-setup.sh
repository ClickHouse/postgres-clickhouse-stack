#!/bin/sh 

echo "Creating the ClickHouse database"
docker exec -it clickhouse sh -c "clickhouse-client --host localhost --query 'CREATE DATABASE IF NOT EXISTS expense'"
echo "Creating the PostgreSQL database peer"
curl --request POST \
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
}'

echo
echo "Creating the ClickHouse database peer"
curl --request POST \
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
}'
echo
echo "Creating the PeerDB mirror"
curl --request POST \
  --url localhost:3000/api/v1/flows/cdc/create \
  --header 'Content-Type: application/json' \
  --data '
{
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
}'
echo
echo "Done"

