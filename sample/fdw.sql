CREATE EXTENSION IF NOT EXISTS clickhouse_fdw;
CREATE SERVER clickhouse_svr FOREIGN DATA WRAPPER clickhouse_fdw OPTIONS(dbname 'expense', host 'host.docker.internal');
CREATE USER MAPPING FOR CURRENT_USER SERVER clickhouse_svr OPTIONS (user 'default', password '');
IMPORT FOREIGN SCHEMA "expense" FROM SERVER clickhouse_svr INTO public;
