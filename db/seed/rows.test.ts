import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { generateDataset, ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES, type Dataset } from "./generate.ts";
import { money, TABLES, toTableRows, type ColumnRow, type TableName } from "./rows.ts";

// The seed must write exactly the schema's columns, and the generator must only use the
// schema's enum values: both are read from db/init/01_schema.sql, not copied.

const SCHEMA = readFileSync(new URL("../init/01_schema.sql", import.meta.url), "utf8");

function schemaColumns(table: string): string[] {
	const body = new RegExp(`CREATE TABLE ${table} \\(([\\s\\S]*?)\\n\\);`).exec(SCHEMA)?.[1] ?? "";
	return body
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => /^[a-z_]+ [a-z]/.test(line) && !/^(UNIQUE|CHECK|FOREIGN|PRIMARY)\b/i.test(line))
		.map((line) => line.split(" ")[0] ?? "");
}

function schemaEnum(type: string): string[] {
	const values = new RegExp(`CREATE TYPE ${type} AS ENUM \\(([^)]*)\\)`).exec(SCHEMA)?.[1] ?? "";
	return [...values.matchAll(/'([^']+)'/g)].map((match) => match[1] ?? "");
}

let data: Dataset;
let rows: Record<TableName, ColumnRow[]>;

beforeAll(() => {
	data = generateDataset();
	rows = toTableRows(data);
});

describe("toTableRows", () => {
	it.each(TABLES)("writes exactly the columns of shop.%s", (table) => {
		const expected = schemaColumns(table);
		expect(expected.length).toBeGreaterThan(0);
		for (const row of rows[table]) {
			expect(Object.keys(row).sort()).toEqual([...expected].sort());
		}
	});

	it("writes every generated row", () => {
		expect(rows.categories).toHaveLength(data.categories.length);
		expect(rows.products).toHaveLength(data.products.length);
		expect(rows.customers).toHaveLength(data.customers.length);
		expect(rows.addresses).toHaveLength(data.addresses.length);
		expect(rows.orders).toHaveLength(data.orders.length);
		expect(rows.order_items).toHaveLength(data.orderItems.length);
		expect(rows.payments).toHaveLength(data.payments.length);
		expect(rows.reviews).toHaveLength(data.reviews.length);
	});

	it("puts look-alike values into their own columns", () => {
		const product = data.products[0];
		const order = data.orders.find((o) => o.deliveredAt !== null);
		expect(rows.products[0]).toMatchObject({ price: money(product?.priceCents ?? -1), cost: money(product?.costCents ?? -1) });
		expect(rows.orders[(order?.id ?? 0) - 1]).toMatchObject({ shipped_at: order?.shippedAt, delivered_at: order?.deliveredAt });
	});

	it("formats cents as exact two-decimal amounts", () => {
		expect(money(129999)).toBe("1299.99");
		expect(money(499)).toBe("4.99");
		expect(money(0)).toBe("0.00");
	});
});

describe("generator enums", () => {
	it.each([
		["order_status", ORDER_STATUSES],
		["payment_method", PAYMENT_METHODS],
		["payment_status", PAYMENT_STATUSES],
	] as const)("match the schema's %s", (type, values) => {
		expect([...values]).toEqual(schemaEnum(type));
	});
});
