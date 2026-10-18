#!/bin/sh
# Creates the read-only role the LLM's SQL runs under and the app schema it never sees.
# Runs once on an empty data volume, after 01_schema.sql.
set -eu

psql -v ON_ERROR_STOP=1 \
	-v reader_password="$QUERYDON_READER_PASSWORD" \
	--username "$POSTGRES_USER" \
	--dbname "$POSTGRES_DB" <<'SQL'
-- Nobody gets anything by default
REVOKE ALL ON DATABASE :"DBNAME" FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- Read-only role for LLM-generated SQL: SELECT on the shop schema, nothing else
CREATE ROLE querydon_reader LOGIN PASSWORD :'reader_password'
	NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS
	CONNECTION LIMIT 20;
COMMENT ON ROLE querydon_reader IS 'Runs LLM-generated SQL: SELECT on schema shop only.';

GRANT CONNECT ON DATABASE :"DBNAME" TO querydon_reader;
GRANT USAGE ON SCHEMA shop TO querydon_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA shop TO querydon_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA shop GRANT SELECT ON TABLES TO querydon_reader;

-- Defence in depth on top of the privileges: every session is read-only and bounded
ALTER ROLE querydon_reader SET search_path = shop;
ALTER ROLE querydon_reader SET default_transaction_read_only = on;
ALTER ROLE querydon_reader SET statement_timeout = '10s';
ALTER ROLE querydon_reader SET idle_in_transaction_session_timeout = '30s';

-- App data (conversations, messages), managed by TypeORM as the owner role
CREATE SCHEMA app;
COMMENT ON SCHEMA app IS 'Querydon''s own data (conversations, messages). Hidden from querydon_reader.';
REVOKE ALL ON SCHEMA app FROM PUBLIC;
SQL
