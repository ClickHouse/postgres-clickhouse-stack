
CREATE EXTENSION IF NOT EXISTS pg_clickhouse;
CREATE SERVER clickhouse_svr FOREIGN DATA WRAPPER clickhouse_fdw OPTIONS(dbname 'expense', host 'host.docker.internal');
CREATE USER MAPPING FOR CURRENT_USER SERVER clickhouse_svr OPTIONS (user 'default', password '');
CREATE SCHEMA IF NOT EXISTS expense_ch;
IMPORT FOREIGN SCHEMA expense FROM SERVER clickhouse_svr INTO expense_ch;

