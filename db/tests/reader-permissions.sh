#!/bin/sh
# Asserts what querydon_reader may and may not do. Runs inside the postgres container:
#   pnpm db:test   (docker compose exec -T postgres sh -s < db/tests/reader-permissions.sh)
# Connects over the local socket, so the role's settings and privileges apply as for the backend.

failures=0

run() {
	psql -X -v ON_ERROR_STOP=1 -U querydon_reader -d "$POSTGRES_DB" -Atc "$1" 2>&1
}

expect_ok() {
	if output=$(run "$2"); then
		echo "ok    $1"
	else
		echo "FAIL  $1 (expected success): $output"
		failures=$((failures + 1))
	fi
}

expect_value() {
	output=$(run "$2")
	if [ "$output" = "$3" ]; then
		echo "ok    $1"
	else
		echo "FAIL  $1: expected '$3', got '$output'"
		failures=$((failures + 1))
	fi
}

expect_denied() {
	if output=$(run "$2"); then
		echo "FAIL  $1 (expected an error, got: $output)"
		failures=$((failures + 1))
	else
		echo "ok    $1"
	fi
}

for table in customers addresses categories products orders order_items payments reviews; do
	expect_ok "SELECT on shop.$table" "SELECT count(*) FROM $table"
done

expect_value "search_path is shop" "SHOW search_path" "shop"
expect_value "sessions are read-only" "SHOW default_transaction_read_only" "on"
expect_value "statement_timeout is 10s" "SHOW statement_timeout" "10s"

expect_denied "INSERT in a read-only session" "INSERT INTO categories (name, slug) VALUES ('x', 'x')"
expect_denied "INSERT after SET TRANSACTION READ WRITE" "SET TRANSACTION READ WRITE; INSERT INTO categories (name, slug) VALUES ('x', 'x')"
expect_denied "UPDATE after SET TRANSACTION READ WRITE" "SET TRANSACTION READ WRITE; UPDATE products SET price = 0"
expect_denied "DROP TABLE in shop" "SET TRANSACTION READ WRITE; DROP TABLE reviews"
expect_denied "CREATE TABLE in shop" "SET TRANSACTION READ WRITE; CREATE TABLE shop.t (id int)"
expect_denied "CREATE TABLE in public" "SET TRANSACTION READ WRITE; CREATE TABLE public.t (id int)"
expect_denied "CREATE TEMP TABLE" "SET TRANSACTION READ WRITE; CREATE TEMP TABLE t (id int)"
expect_denied "read from schema app" "SELECT * FROM app.anything"
expect_denied "CREATE TABLE in app" "SET TRANSACTION READ WRITE; CREATE TABLE app.t (id int)"

expect_denied "set_config cannot switch read-only off" "SELECT set_config('default_transaction_read_only', 'off', false)"
expect_denied "set_config cannot lift the timeout" "SELECT set_config('statement_timeout', '0', false)"
expect_denied "lo_from_bytea cannot write large objects" "SELECT lo_from_bytea(0, 'x'::bytea)"
expect_denied "lo_create cannot create large objects" "SELECT lo_create(0)"
expect_denied "pg_notify cannot signal other sessions" "SELECT pg_notify('channel', 'payload')"

if [ "$failures" -gt 0 ]; then
	echo "$failures check(s) failed"
	exit 1
fi
echo "all checks passed"
