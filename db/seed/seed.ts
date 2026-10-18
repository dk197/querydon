import { fileURLToPath } from "node:url";
import pg from "pg";
import { generateDataset } from "./generate.ts";
import { TABLES, toTableRows, type ColumnRow } from "./rows.ts";

// Replaces all shop data with the generated sample dataset, in one transaction.
// Database tooling, not the app: it connects as the owner role, since the reader cannot write.
// Only data changes here; schema and column comments change with `pnpm db:reset`.

const ENV_FILE = fileURLToPath(new URL("../../.env", import.meta.url));
// Postgres caps a statement at 65535 bind parameters
const MAX_PARAMS = 65_000;

try {
	process.loadEnvFile(ENV_FILE);
} catch {
	// No .env: the defaults below match docker-compose.yml
}

const client = new pg.Client({
	host: process.env["POSTGRES_HOST"] ?? "localhost",
	port: Number(process.env["POSTGRES_PORT"] ?? "5433"),
	user: process.env["POSTGRES_USER"] ?? "querydon",
	password: process.env["POSTGRES_PASSWORD"] ?? "querydon",
	database: process.env["POSTGRES_DB"] ?? "shop",
});

const tableRows = toTableRows(generateDataset());

await client.connect();
try {
	await client.query("BEGIN");
	try {
		await client.query(`TRUNCATE ${TABLES.map((table) => `shop.${table}`).join(", ")}`);
		for (const table of TABLES) {
			await insert(client, table, tableRows[table]);
			// The inserts bring their own IDs; move each identity sequence past them
			await client.query(`SELECT setval(pg_get_serial_sequence('shop.${table}', 'id'), (SELECT max(id) FROM shop.${table}))`);
		}
		await client.query("COMMIT");
	} catch (error) {
		// Keep the original error even when the connection is already gone
		await client.query("ROLLBACK").catch(() => undefined);
		throw error;
	}
	await client.query("ANALYZE");
} finally {
	await client.end();
}

process.stdout.write(`Seeded shop: ${TABLES.map((table) => `${String(tableRows[table].length)} ${table}`).join(", ")}\n`);

async function insert(db: pg.Client, table: string, rows: readonly ColumnRow[]): Promise<void> {
	const columns = Object.keys(rows[0] ?? {});
	const batchSize = Math.floor(MAX_PARAMS / Math.max(columns.length, 1));
	for (let start = 0; start < rows.length; start += batchSize) {
		const batch = rows.slice(start, start + batchSize);
		const placeholders = batch.map((_, r) => `(${columns.map((_, c) => `$${String(r * columns.length + c + 1)}`).join(", ")})`).join(", ");
		const values = batch.flatMap((row) => columns.map((column) => row[column]));
		await db.query(`INSERT INTO shop.${table} (${columns.join(", ")}) OVERRIDING SYSTEM VALUE VALUES ${placeholders}`, values);
	}
}
