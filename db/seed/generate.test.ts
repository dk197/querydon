import { beforeAll, describe, expect, it } from "vitest";
import { generateDataset, PERIOD_END, PERIOD_START, type Dataset } from "./generate.ts";

// The generator must produce data the schema's constraints accept and the column comments
// describe truthfully: the LLM takes those comments at their word.

let data: Dataset;

beforeAll(() => {
	data = generateDataset();
});

describe("generateDataset", () => {
	it("is deterministic for a seed", () => {
		expect(generateDataset()).toEqual(data);
		expect(generateDataset(1).customers[0]).not.toEqual(data.customers[0]);
	});

	it("has the planned size", () => {
		expect(data.customers).toHaveLength(1000);
		expect(data.products).toHaveLength(200);
		expect(data.orders).toHaveLength(10_000);
		expect(data.categories.filter((c) => c.parentId === null)).toHaveLength(5);
	});

	it("keeps IDs sequential from 1 and orders numbered by date", () => {
		const tables: readonly (readonly { id: number }[])[] = [
			data.categories,
			data.products,
			data.customers,
			data.addresses,
			data.orders,
			data.orderItems,
			data.payments,
			data.reviews,
		];
		for (const rows of tables) {
			expect(rows.map((row) => row.id)).toEqual(rows.map((_, index) => index + 1));
		}
		const times = data.orders.map((o) => o.orderedAt.getTime());
		expect(times).toEqual([...times].sort((a, b) => a - b));
	});

	it("keeps unique columns unique", () => {
		const unique = (values: readonly string[]): boolean => new Set(values).size === values.length;
		expect(unique(data.customers.map((c) => c.email))).toBe(true);
		expect(unique(data.products.map((p) => p.sku))).toBe(true);
		expect(unique(data.categories.map((c) => c.slug))).toBe(true);
		expect(unique(data.orderItems.map((i) => `${String(i.orderId)}:${String(i.productId)}`))).toBe(true);
		expect(unique(data.reviews.map((r) => `${String(r.productId)}:${String(r.customerId)}`))).toBe(true);
	});

	it("gives every customer exactly one default address", () => {
		for (const customer of data.customers) {
			expect(data.addresses.filter((a) => a.customerId === customer.id && a.isDefault)).toHaveLength(1);
		}
	});

	it("keeps orders consistent with customers, addresses and the period", () => {
		const customers = new Map(data.customers.map((c) => [c.id, c]));
		const addresses = new Map(data.addresses.map((a) => [a.id, a]));
		for (const order of data.orders) {
			expect(addresses.get(order.shippingAddressId)?.customerId).toBe(order.customerId);
			expect(order.orderedAt >= PERIOD_START && order.orderedAt <= PERIOD_END).toBe(true);
			expect(order.orderedAt >= (customers.get(order.customerId)?.createdAt ?? PERIOD_END)).toBe(true);
		}
	});

	it("matches shipping and delivery timestamps to the status", () => {
		for (const order of data.orders) {
			const isShipped = ["shipped", "delivered", "returned"].includes(order.status);
			const isDelivered = ["delivered", "returned"].includes(order.status);
			expect(order.shippedAt !== null).toBe(isShipped);
			expect(order.deliveredAt !== null).toBe(isDelivered);
			if (order.shippedAt !== null) expect(order.shippedAt >= order.orderedAt && order.shippedAt <= PERIOD_END).toBe(true);
			if (order.deliveredAt !== null && order.shippedAt !== null) {
				expect(order.deliveredAt >= order.shippedAt && order.deliveredAt <= PERIOD_END).toBe(true);
			}
		}
	});

	it("totals each order as its line totals plus shipping", () => {
		const subtotals = new Map<number, number>();
		for (const item of data.orderItems) {
			expect(item.quantity).toBeGreaterThan(0);
			expect(item.discountCents).toBeLessThanOrEqual(item.quantity * item.unitPriceCents);
			subtotals.set(item.orderId, (subtotals.get(item.orderId) ?? 0) + item.quantity * item.unitPriceCents - item.discountCents);
		}
		for (const order of data.orders) {
			const subtotal = subtotals.get(order.id) ?? 0;
			expect(subtotal).toBeGreaterThan(0);
			expect(order.totalCents).toBe(subtotal + order.shippingCostCents);
			expect(order.shippingCostCents).toBe(subtotal >= 5000 ? 0 : 499);
		}
	});

	it("only sells products that existed on the order date", () => {
		const products = new Map(data.products.map((p) => [p.id, p]));
		const orders = new Map(data.orders.map((o) => [o.id, o]));
		for (const item of data.orderItems) {
			expect((products.get(item.productId)?.createdAt ?? PERIOD_END) <= (orders.get(item.orderId)?.orderedAt ?? PERIOD_START)).toBe(true);
		}
	});

	it("sets paid_at exactly for completed and refunded payments", () => {
		for (const payment of data.payments) {
			expect(payment.paidAt !== null).toBe(payment.status === "completed" || payment.status === "refunded");
		}
	});

	it("has a completed payment for every paid, shipped or delivered order and none for cancelled or returned ones", () => {
		const completed = new Set(data.payments.filter((p) => p.status === "completed").map((p) => p.orderId));
		for (const order of data.orders) {
			const expectsPayment = ["paid", "shipped", "delivered"].includes(order.status);
			expect(completed.has(order.id)).toBe(expectsPayment);
		}
	});

	it("only lets customers review products delivered to them, after delivery", () => {
		const delivered = new Map<string, Date>();
		const orders = new Map(data.orders.map((o) => [o.id, o]));
		for (const item of data.orderItems) {
			const order = orders.get(item.orderId);
			if (order?.status === "delivered" && order.deliveredAt !== null) {
				// The earliest delivery of a product to a customer is when a review becomes possible
				const key = `${String(item.productId)}:${String(order.customerId)}`;
				const earliest = delivered.get(key);
				if (earliest === undefined || order.deliveredAt < earliest) delivered.set(key, order.deliveredAt);
			}
		}
		for (const review of data.reviews) {
			expect(review.rating).toBeGreaterThanOrEqual(1);
			expect(review.rating).toBeLessThanOrEqual(5);
			const deliveredAt = delivered.get(`${String(review.productId)}:${String(review.customerId)}`);
			expect(deliveredAt).toBeDefined();
			expect(review.createdAt > (deliveredAt ?? PERIOD_END) && review.createdAt <= PERIOD_END).toBe(true);
		}
	});
});
