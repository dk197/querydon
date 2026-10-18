import type { Dataset } from "./generate.ts";

// Maps the generated dataset onto the shop tables' columns. Rows are keyed by column name,
// so a value cannot slip into a neighbouring column; rows.test.ts checks the names against
// db/init/01_schema.sql.

/** Shop tables in foreign-key order: each table only references tables before it */
export const TABLES = ["categories", "products", "customers", "addresses", "orders", "order_items", "payments", "reviews"] as const;

export type TableName = (typeof TABLES)[number];
export type ColumnRow = Record<string, unknown>;

export function toTableRows(dataset: Dataset): Record<TableName, ColumnRow[]> {
	return {
		categories: dataset.categories.map((c) => ({ id: c.id, parent_id: c.parentId, name: c.name, slug: c.slug })),
		products: dataset.products.map((p) => ({
			id: p.id,
			category_id: p.categoryId,
			sku: p.sku,
			name: p.name,
			description: p.description,
			price: money(p.priceCents),
			cost: money(p.costCents),
			stock_quantity: p.stockQuantity,
			is_active: p.isActive,
			created_at: p.createdAt,
		})),
		customers: dataset.customers.map((c) => ({
			id: c.id,
			email: c.email,
			first_name: c.firstName,
			last_name: c.lastName,
			birth_date: c.birthDate,
			is_newsletter_subscriber: c.isNewsletterSubscriber,
			created_at: c.createdAt,
		})),
		addresses: dataset.addresses.map((a) => ({
			id: a.id,
			customer_id: a.customerId,
			street: a.street,
			postal_code: a.postalCode,
			city: a.city,
			country_code: a.countryCode,
			is_default: a.isDefault,
		})),
		orders: dataset.orders.map((o) => ({
			id: o.id,
			customer_id: o.customerId,
			shipping_address_id: o.shippingAddressId,
			status: o.status,
			ordered_at: o.orderedAt,
			shipped_at: o.shippedAt,
			delivered_at: o.deliveredAt,
			shipping_cost: money(o.shippingCostCents),
			total_amount: money(o.totalCents),
		})),
		order_items: dataset.orderItems.map((i) => ({
			id: i.id,
			order_id: i.orderId,
			product_id: i.productId,
			quantity: i.quantity,
			unit_price: money(i.unitPriceCents),
			discount: money(i.discountCents),
		})),
		payments: dataset.payments.map((p) => ({
			id: p.id,
			order_id: p.orderId,
			method: p.method,
			status: p.status,
			amount: money(p.amountCents),
			paid_at: p.paidAt,
		})),
		reviews: dataset.reviews.map((r) => ({
			id: r.id,
			product_id: r.productId,
			customer_id: r.customerId,
			rating: r.rating,
			title: r.title,
			body: r.body,
			created_at: r.createdAt,
		})),
	};
}

/** Integer cents as the exact decimal string Postgres stores in numeric(…, 2) */
export function money(cents: number): string {
	return (cents / 100).toFixed(2);
}
