#!/bin/sh
# Creates the read-only role the LLM's SQL runs under and the app schema it never sees.
# Runs once on an empty data volume, after 01_schema.sql. The entrypoint may source this
# file instead of executing it, so it sets no shell options; psql's ON_ERROR_STOP makes
# any failing statement abort the init.

psql -v ON_ERROR_STOP=1 \
	-v reader_password="$QUERYDON_READER_PASSWORD" \
	--username "$POSTGRES_USER" \
	--dbname "$POSTGRES_DB" <<'SQL'
-- Nobody gets anything by default. Extensions therefore go into schema shop, not public.
REVOKE ALL ON DATABASE :"DBNAME" FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- Functions every role may call by default that write or change session state from inside
-- a plain SELECT: set_config could switch the read-only default off, the large-object
-- functions write to pg_largeobject, pg_notify sends to other sessions.
REVOKE EXECUTE ON FUNCTION
	set_config(text, text, boolean),
	pg_notify(text, text),
	lo_create(oid),
	lo_creat(integer),
	lo_from_bytea(oid, bytea),
	lo_put(oid, bigint, bytea),
	lo_open(oid, integer),
	lowrite(integer, bytea),
	lo_truncate(integer, integer),
	lo_truncate64(integer, bigint),
	lo_unlink(oid)
FROM PUBLIC;

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

-- App data (conversations, messages), managed by TypeORM as the owner role.
-- Its data is unreachable for querydon_reader; its table names stay readable through
-- pg_catalog like every catalog entry, so introspection and the SQL validator stay in shop.
CREATE SCHEMA app;
COMMENT ON SCHEMA app IS 'Querydon''s own data (conversations, messages). Hidden from querydon_reader.';
REVOKE ALL ON SCHEMA app FROM PUBLIC;
SQL
