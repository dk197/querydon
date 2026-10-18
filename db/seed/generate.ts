import { fakerEN_CA, fakerEN_GB, fakerEN_US, type Faker } from "@faker-js/faker";

// Pure, deterministic generation of the sample shop: the same seed always yields the same
// rows, so eval questions keep their expected answers. Writing to the database is seed.ts.

export const SEED = 20261018;
export const PERIOD_START = new Date("2023-10-01T00:00:00Z");
export const PERIOD_END = new Date("2026-09-30T23:59:59Z");

const CUSTOMER_COUNT = 1000;
const PRODUCT_COUNT = 200;
const ORDER_COUNT = 10_000;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const ORDER_STATUSES = ["pending", "paid", "shipped", "delivered", "cancelled", "returned"] as const;
export const PAYMENT_METHODS = ["credit_card", "paypal", "invoice", "bank_transfer"] as const;
export const PAYMENT_STATUSES = ["pending", "completed", "failed", "refunded"] as const;
export const COUNTRY_CODES = ["US", "CA", "GB"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type CountryCode = (typeof COUNTRY_CODES)[number];

export interface Category {
	id: number;
	parentId: number | null;
	name: string;
	slug: string;
}
export interface Product {
	id: number;
	categoryId: number;
	sku: string;
	name: string;
	description: string | null;
	priceCents: number;
	costCents: number;
	stockQuantity: number;
	isActive: boolean;
	createdAt: Date;
}
export interface Customer {
	id: number;
	email: string;
	firstName: string;
	lastName: string;
	birthDate: string | null;
	isNewsletterSubscriber: boolean;
	createdAt: Date;
}
export interface Address {
	id: number;
	customerId: number;
	street: string;
	postalCode: string;
	city: string;
	countryCode: CountryCode;
	isDefault: boolean;
}
export interface Order {
	id: number;
	customerId: number;
	shippingAddressId: number;
	status: OrderStatus;
	orderedAt: Date;
	shippedAt: Date | null;
	deliveredAt: Date | null;
	shippingCostCents: number;
	totalCents: number;
}
export interface OrderItem {
	id: number;
	orderId: number;
	productId: number;
	quantity: number;
	unitPriceCents: number;
	discountCents: number;
}
export interface Payment {
	id: number;
	orderId: number;
	method: PaymentMethod;
	status: PaymentStatus;
	amountCents: number;
	paidAt: Date | null;
}
export interface Review {
	id: number;
	productId: number;
	customerId: number;
	rating: number;
	title: string | null;
	body: string | null;
	createdAt: Date;
}

export interface Dataset {
	categories: Category[];
	products: Product[];
	customers: Customer[];
	addresses: Address[];
	orders: Order[];
	orderItems: OrderItem[];
	payments: Payment[];
	reviews: Review[];
}

interface LeafSpec {
	name: string;
	slug: string;
	priceRange: readonly [number, number];
	nouns: readonly string[] | "book";
}
interface TopSpec {
	name: string;
	slug: string;
	leaves: readonly LeafSpec[];
}

const CATALOG: readonly TopSpec[] = [
	{
		name: "Electronics",
		slug: "electronics",
		leaves: [
			{ name: "Laptops", slug: "laptops", priceRange: [499, 2499], nouns: ["Laptop", "Notebook", "Ultrabook"] },
			{ name: "Smartphones", slug: "smartphones", priceRange: [199, 1299], nouns: ["Smartphone", "Phone"] },
			{ name: "Headphones", slug: "headphones", priceRange: [29, 399], nouns: ["Headphones", "Earbuds", "Headset"] },
			{ name: "Monitors", slug: "monitors", priceRange: [129, 899], nouns: ["Monitor", "Display"] },
		],
	},
	{
		name: "Home & Kitchen",
		slug: "home-kitchen",
		leaves: [
			{
				name: "Kitchen Appliances",
				slug: "kitchen-appliances",
				priceRange: [29, 499],
				nouns: ["Blender", "Coffee Maker", "Toaster", "Kettle", "Air Fryer"],
			},
			{ name: "Vacuum Cleaners", slug: "vacuum-cleaners", priceRange: [79, 699], nouns: ["Vacuum", "Robot Vacuum", "Stick Vacuum"] },
		],
	},
	{
		name: "Sports & Outdoors",
		slug: "sports-outdoors",
		leaves: [
			{
				name: "Fitness",
				slug: "fitness",
				priceRange: [15, 399],
				nouns: ["Yoga Mat", "Dumbbell Set", "Kettlebell", "Resistance Bands", "Treadmill"],
			},
			{ name: "Cycling", slug: "cycling", priceRange: [19, 199], nouns: ["Bike Helmet", "Bike Light", "Cycling Gloves", "Bike Lock"] },
		],
	},
	{
		name: "Fashion",
		slug: "fashion",
		leaves: [
			{ name: "Men's Clothing", slug: "mens-clothing", priceRange: [19, 199], nouns: ["T-Shirt", "Hoodie", "Jacket", "Jeans"] },
			{ name: "Women's Clothing", slug: "womens-clothing", priceRange: [19, 199], nouns: ["Dress", "Blouse", "Jacket", "Jeans"] },
			{ name: "Shoes", slug: "shoes", priceRange: [39, 249], nouns: ["Sneakers", "Running Shoes", "Boots", "Sandals"] },
		],
	},
	{
		name: "Books",
		slug: "books",
		leaves: [
			{ name: "Fiction", slug: "fiction", priceRange: [8, 25], nouns: "book" },
			{ name: "Non-Fiction", slug: "non-fiction", priceRange: [12, 45], nouns: "book" },
		],
	},
];

const BRANDS = ["Northwind", "Lumora", "Vexa", "Kronberg", "Alvia", "Tekno", "Brightline", "Solvik", "Aurex", "Pinecrest"];
const EMAIL_DOMAINS = ["gmail.com", "outlook.com", "yahoo.com", "icloud.com", "hotmail.com", "proton.me"];

// Orders per calendar month (Jan..Dec), relative: a holiday peak in November and December
const MONTH_WEIGHTS = [0.85, 0.8, 0.95, 1, 1, 0.95, 0.9, 0.95, 1, 1.05, 1.5, 1.8];
// The shop grows: order volume rises linearly from 0.6x to 1.4x over the period
const GROWTH_FROM = 0.6;
const GROWTH_TO = 1.4;
const MAX_DATE_WEIGHT = Math.max(...MONTH_WEIGHTS) * GROWTH_TO;

const FREE_SHIPPING_FROM_CENTS = 5000;
const SHIPPING_COST_CENTS = 499;

const REVIEW_TEXTS: Record<number, { titles: readonly string[]; bodies: readonly string[] }> = {
	5: {
		titles: ["Absolutely love it", "Exceeded my expectations", "Perfect", "Highly recommend", "Great value"],
		bodies: [
			"Works exactly as described and arrived quickly.",
			"Best purchase I've made this year.",
			"Great quality for the price. Would buy again.",
			"Does everything I need and more.",
		],
	},
	4: {
		titles: ["Very good", "Solid product", "Happy with it", "Good value"],
		bodies: ["Good quality, minor issues with the packaging.", "Does the job well, a bit pricey.", "Works well, setup took a while."],
	},
	3: {
		titles: ["It's okay", "Average", "Does the job"],
		bodies: ["Not bad, but not great either.", "Decent, but I expected more for the price.", "Works, but feels a bit cheap."],
	},
	2: {
		titles: ["Disappointed", "Not as described"],
		bodies: ["Quality is lower than expected.", "Stopped working properly after a few weeks."],
	},
	1: {
		titles: ["Do not buy", "Waste of money", "Broke immediately"],
		bodies: ["Arrived damaged and support was unhelpful.", "Stopped working after two days.", "Completely different from the pictures."],
	},
};

// Catalog, review texts and every other app-facing string come from the English locale;
// customer names and addresses come from the customer's country
const faker = fakerEN_US;
const LOCALES: Record<CountryCode, Faker> = { US: fakerEN_US, CA: fakerEN_CA, GB: fakerEN_GB };

export function generateDataset(seed: number = SEED): Dataset {
	for (const locale of [faker, ...Object.values(LOCALES)]) {
		locale.seed(seed);
		locale.setDefaultRefDate(PERIOD_END);
	}

	const { categories, leaves } = generateCategories();
	const { products, popularity } = generateProducts(leaves);
	const { customers, addresses, activity } = generateCustomers();
	const { orders, orderItems, payments } = generateOrders(products, popularity, customers, addresses, activity);
	const reviews = generateReviews(orders, orderItems);

	return { categories, products, customers, addresses, orders, orderItems, payments, reviews };
}

function generateCategories(): { categories: Category[]; leaves: { category: Category; spec: LeafSpec }[] } {
	const categories: Category[] = [];
	const leaves: { category: Category; spec: LeafSpec }[] = [];

	for (const top of CATALOG) {
		const parent: Category = { id: categories.length + 1, parentId: null, name: top.name, slug: top.slug };
		categories.push(parent);
		for (const spec of top.leaves) {
			const category: Category = { id: categories.length + 1, parentId: parent.id, name: spec.name, slug: spec.slug };
			categories.push(category);
			leaves.push({ category, spec });
		}
	}
	return { categories, leaves };
}

function generateProducts(leaves: readonly { category: Category; spec: LeafSpec }[]): { products: Product[]; popularity: number[] } {
	const products: Product[] = [];
	const popularity: number[] = [];

	for (let id = 1; id <= PRODUCT_COUNT; id++) {
		const { category, spec } = faker.helpers.arrayElement(leaves);
		const priceCents = faker.number.int({ min: spec.priceRange[0], max: spec.priceRange[1] }) * 100 - 1;
		const isNew = faker.datatype.boolean(0.2);

		products.push({
			id,
			categoryId: category.id,
			sku: `${spec.slug.slice(0, 3).toUpperCase()}-${String(id).padStart(5, "0")}`,
			name: spec.nouns === "book" ? faker.book.title() : productName(spec.nouns),
			description: faker.datatype.boolean(0.9) ? faker.commerce.productDescription() : null,
			priceCents,
			costCents: Math.round(priceCents * faker.number.float({ min: 0.45, max: 0.75 })),
			stockQuantity: faker.datatype.boolean(0.05) ? 0 : faker.number.int({ min: 1, max: 250 }),
			isActive: faker.datatype.boolean(0.95),
			// Most of the catalog predates the period; a fifth are new arrivals during it
			createdAt: isNew
				? faker.date.between({ from: PERIOD_START, to: new Date(PERIOD_END.getTime() - 30 * DAY) })
				: faker.date.between({ from: new Date(PERIOD_START.getTime() - 730 * DAY), to: PERIOD_START }),
		});
		// A long tail: a few bestsellers, many slow movers
		popularity.push(faker.number.float({ min: 0.02, max: 1 }) ** 2.5);
	}
	return { products, popularity };
}

function productName(nouns: readonly string[]): string {
	const model = `${faker.string.alpha({ length: 1, casing: "upper" })}${String(faker.number.int({ min: 1, max: 9 }) * 100)}`;
	return `${faker.helpers.arrayElement(BRANDS)} ${faker.helpers.arrayElement(nouns)} ${model}`;
}

function generateCustomers(): { customers: Customer[]; addresses: Address[]; activity: number[] } {
	const customers: Customer[] = [];
	const addresses: Address[] = [];
	const activity: number[] = [];

	for (let id = 1; id <= CUSTOMER_COUNT; id++) {
		const countryCode = faker.helpers.weightedArrayElement<CountryCode>([
			{ weight: 75, value: "US" },
			{ weight: 15, value: "CA" },
			{ weight: 10, value: "GB" },
		]);
		const locale = LOCALES[countryCode];
		const firstName = locale.person.firstName();
		const lastName = locale.person.lastName();

		customers.push({
			id,
			email: `${emailPart(firstName)}.${emailPart(lastName)}${String(id)}@${faker.helpers.arrayElement(EMAIL_DOMAINS)}`,
			firstName,
			lastName,
			birthDate: faker.datatype.boolean(0.85) ? isoDate(faker.date.birthdate({ mode: "age", min: 18, max: 80 })) : null,
			isNewsletterSubscriber: faker.datatype.boolean(0.35),
			createdAt: faker.date.between({ from: new Date(PERIOD_START.getTime() - 365 * DAY), to: new Date(PERIOD_END.getTime() - 7 * DAY) }),
		});
		// Repeat buyers: a few customers place many orders
		activity.push(faker.number.float({ min: 0.05, max: 1 }) ** 3);

		const addressCount = faker.helpers.weightedArrayElement([
			{ weight: 60, value: 1 },
			{ weight: 30, value: 2 },
			{ weight: 10, value: 3 },
		]);
		for (let index = 0; index < addressCount; index++) {
			addresses.push({
				id: addresses.length + 1,
				customerId: id,
				street: locale.location.streetAddress(),
				postalCode: locale.location.zipCode(),
				city: locale.location.city(),
				countryCode,
				isDefault: index === 0,
			});
		}
	}
	return { customers, addresses, activity };
}

function generateOrders(
	products: readonly Product[],
	popularity: readonly number[],
	customers: readonly Customer[],
	addresses: readonly Address[],
	activity: readonly number[],
): { orders: Order[]; orderItems: OrderItem[]; payments: Payment[] } {
	const orders: Order[] = [];
	const orderItems: OrderItem[] = [];
	const payments: Payment[] = [];

	const addressesByCustomer = new Map<number, Address[]>();
	for (const address of addresses) {
		addressesByCustomer.set(address.customerId, [...(addressesByCustomer.get(address.customerId) ?? []), address]);
	}

	// Customers sorted by registration, with running activity totals: picking a buyer for an
	// order date is a weighted draw among those registered by then
	const byRegistration = customers.map((customer, index) => ({ customer, activity: activity[index] ?? 0 }));
	byRegistration.sort((a, b) => a.customer.createdAt.getTime() - b.customer.createdAt.getTime());
	const cumulativeActivity: number[] = [];
	let runningActivity = 0;
	for (const entry of byRegistration) {
		runningActivity += entry.activity;
		cumulativeActivity.push(runningActivity);
	}

	for (let id = 1; id <= ORDER_COUNT; id++) {
		const orderedAt = sampleOrderDate();
		const customer = pickCustomer(byRegistration, cumulativeActivity, orderedAt);
		const customerAddresses = addressesByCustomer.get(customer.id) ?? [];
		const defaultAddress = customerAddresses.find((address) => address.isDefault);
		const address = defaultAddress !== undefined && faker.datatype.boolean(0.8) ? defaultAddress : faker.helpers.arrayElement(customerAddresses);

		// Line items: distinct products already in the catalog on the order date
		const available = products.filter((product) => product.createdAt <= orderedAt);
		const itemCount = Math.min(
			available.length,
			faker.helpers.weightedArrayElement([
				{ weight: 50, value: 1 },
				{ weight: 28, value: 2 },
				{ weight: 14, value: 3 },
				{ weight: 8, value: 4 },
			]),
		);
		const weighted = available.map((product) => ({ weight: popularity[product.id - 1] ?? 0, value: product }));
		const chosen = new Set<Product>();
		while (chosen.size < itemCount) {
			chosen.add(faker.helpers.weightedArrayElement(weighted));
		}

		let subtotalCents = 0;
		for (const product of chosen) {
			const quantity = faker.helpers.weightedArrayElement([
				{ weight: 75, value: 1 },
				{ weight: 18, value: 2 },
				{ weight: 7, value: 3 },
			]);
			// Prices drift over time: the historic price is near the current one, still ending in .99
			const unitPriceCents = Math.max(99, Math.round((product.priceCents * faker.number.float({ min: 0.9, max: 1.05 })) / 100) * 100 - 1);
			const discountCents = faker.datatype.boolean(0.08)
				? Math.round((quantity * unitPriceCents * faker.helpers.arrayElement([5, 10, 15, 20])) / 100)
				: 0;
			orderItems.push({ id: orderItems.length + 1, orderId: id, productId: product.id, quantity, unitPriceCents, discountCents });
			subtotalCents += quantity * unitPriceCents - discountCents;
		}
		const shippingCostCents = subtotalCents >= FREE_SHIPPING_FROM_CENTS ? 0 : SHIPPING_COST_CENTS;

		const { status, shippedAt, deliveredAt } = fulfilment(orderedAt);
		const order: Order = {
			id,
			customerId: customer.id,
			shippingAddressId: address.id,
			status,
			orderedAt,
			shippedAt,
			deliveredAt,
			shippingCostCents,
			totalCents: subtotalCents + shippingCostCents,
		};
		orders.push(order);
		for (const payment of paymentsFor(order)) {
			payments.push({ ...payment, id: payments.length + 1 });
		}
	}

	orders.sort((a, b) => a.orderedAt.getTime() - b.orderedAt.getTime());
	return { orders: renumberOrders(orders, orderItems, payments), orderItems, payments };
}

// Order IDs follow the order date, as a real shop's would
function renumberOrders(orders: Order[], orderItems: OrderItem[], payments: Payment[]): Order[] {
	const newIds = new Map(orders.map((order, index) => [order.id, index + 1]));
	for (const row of [...orderItems, ...payments]) {
		row.orderId = newIds.get(row.orderId) ?? row.orderId;
	}
	for (const rows of [orderItems, payments]) {
		rows.sort((a, b) => a.orderId - b.orderId || a.id - b.id);
		rows.forEach((row, index) => {
			row.id = index + 1;
		});
	}
	return orders.map((order, index) => ({ ...order, id: index + 1 }));
}

function sampleOrderDate(): Date {
	const span = PERIOD_END.getTime() - PERIOD_START.getTime();
	for (;;) {
		const date = faker.date.between({ from: PERIOD_START, to: PERIOD_END });
		const progress = (date.getTime() - PERIOD_START.getTime()) / span;
		const weight = (MONTH_WEIGHTS[date.getUTCMonth()] ?? 1) * (GROWTH_FROM + (GROWTH_TO - GROWTH_FROM) * progress);
		if (faker.number.float({ min: 0, max: MAX_DATE_WEIGHT }) <= weight) {
			return date;
		}
	}
}

function pickCustomer(byRegistration: readonly { customer: Customer }[], cumulativeActivity: readonly number[], orderedAt: Date): Customer {
	// Customers registered on or before the order date form a prefix of byRegistration
	const registered = firstIndexWhere(byRegistration.length, (i) => (byRegistration[i]?.customer.createdAt ?? orderedAt) > orderedAt);
	if (registered === 0) {
		throw new Error(`No customer registered by ${orderedAt.toISOString()}`);
	}
	const target = faker.number.float({ min: 0, max: cumulativeActivity[registered - 1] ?? 0 });
	// The first customer whose running activity total reaches the target, within the prefix
	const index = Math.min(
		firstIndexWhere(registered, (i) => (cumulativeActivity[i] ?? 0) >= target),
		registered - 1,
	);
	const entry = byRegistration[index];
	if (entry === undefined) {
		throw new Error(`No customer at index ${String(index)}`);
	}
	return entry.customer;
}

/** The smallest index in [0, length) where a monotone predicate turns true, or length when it never does */
function firstIndexWhere(length: number, predicate: (index: number) => boolean): number {
	let low = 0;
	let high = length;
	while (low < high) {
		const middle = Math.floor((low + high) / 2);
		if (predicate(middle)) {
			high = middle;
		} else {
			low = middle + 1;
		}
	}
	return low;
}

function fulfilment(orderedAt: Date): { status: OrderStatus; shippedAt: Date | null; deliveredAt: Date | null } {
	const ageDays = (PERIOD_END.getTime() - orderedAt.getTime()) / DAY;
	let status: OrderStatus;
	if (ageDays < 2) {
		status = faker.helpers.weightedArrayElement<OrderStatus>([
			{ weight: 40, value: "pending" },
			{ weight: 60, value: "paid" },
		]);
	} else if (ageDays < 5) {
		status = faker.helpers.weightedArrayElement<OrderStatus>([
			{ weight: 25, value: "paid" },
			{ weight: 75, value: "shipped" },
		]);
	} else if (ageDays < 12) {
		status = faker.helpers.weightedArrayElement<OrderStatus>([
			{ weight: 40, value: "shipped" },
			{ weight: 60, value: "delivered" },
		]);
	} else {
		status = faker.helpers.weightedArrayElement<OrderStatus>([
			{ weight: 88, value: "delivered" },
			{ weight: 5, value: "cancelled" },
			{ weight: 7, value: "returned" },
		]);
	}

	const shippedAt = new Date(orderedAt.getTime() + faker.number.int({ min: 12 * HOUR, max: 72 * HOUR }));
	const deliveredAt = new Date(shippedAt.getTime() + faker.number.int({ min: DAY, max: 5 * DAY }));
	// Nothing happens after the end of the period: fall back to the last reachable step
	if (status === "delivered" || status === "returned") {
		if (shippedAt > PERIOD_END) status = "paid";
		else if (deliveredAt > PERIOD_END) status = "shipped";
	} else if (status === "shipped" && shippedAt > PERIOD_END) {
		status = "paid";
	}

	const isShipped = status === "shipped" || status === "delivered" || status === "returned";
	const isDelivered = status === "delivered" || status === "returned";
	return { status, shippedAt: isShipped ? shippedAt : null, deliveredAt: isDelivered ? deliveredAt : null };
}

function paymentsFor(order: Order): Omit<Payment, "id">[] {
	const method = faker.helpers.weightedArrayElement<PaymentMethod>([
		{ weight: 40, value: "paypal" },
		{ weight: 30, value: "credit_card" },
		{ weight: 18, value: "invoice" },
		{ weight: 12, value: "bank_transfer" },
	]);
	const paidAt = new Date(Math.min(PERIOD_END.getTime(), order.orderedAt.getTime() + faker.number.int({ min: 2 * MINUTE, max: 90 * MINUTE })));
	const payment = (status: PaymentStatus): Omit<Payment, "id"> => ({
		orderId: order.id,
		method,
		status,
		amountCents: order.totalCents,
		paidAt: status === "completed" || status === "refunded" ? paidAt : null,
	});

	switch (order.status) {
		case "pending":
			return faker.datatype.boolean(0.5) ? [payment("pending")] : [];
		case "paid":
		case "shipped":
		case "delivered":
			return faker.datatype.boolean(0.06) ? [payment("failed"), payment("completed")] : [payment("completed")];
		case "cancelled":
			return [payment(faker.datatype.boolean(0.5) ? "refunded" : "failed")];
		case "returned":
			return [payment("refunded")];
	}
}

function generateReviews(orders: readonly Order[], orderItems: readonly OrderItem[]): Review[] {
	const reviews: Review[] = [];
	const reviewed = new Set<string>();
	const ordersById = new Map(orders.map((order) => [order.id, order]));

	for (const item of orderItems) {
		const order = ordersById.get(item.orderId);
		if (order?.status !== "delivered" || order.deliveredAt === null || !faker.datatype.boolean(0.12)) continue;

		const key = `${String(item.productId)}:${String(order.customerId)}`;
		const createdAt = new Date(order.deliveredAt.getTime() + faker.number.int({ min: DAY, max: 20 * DAY }));
		if (reviewed.has(key) || createdAt > PERIOD_END) continue;
		reviewed.add(key);

		const rating = faker.helpers.weightedArrayElement([
			{ weight: 45, value: 5 },
			{ weight: 30, value: 4 },
			{ weight: 12, value: 3 },
			{ weight: 7, value: 2 },
			{ weight: 6, value: 1 },
		]);
		const texts = REVIEW_TEXTS[rating];
		reviews.push({
			id: reviews.length + 1,
			productId: item.productId,
			customerId: order.customerId,
			rating,
			title: texts !== undefined && faker.datatype.boolean(0.9) ? faker.helpers.arrayElement(texts.titles) : null,
			body: texts !== undefined && faker.datatype.boolean(0.8) ? faker.helpers.arrayElement(texts.bodies) : null,
			createdAt,
		});
	}
	return reviews;
}

function emailPart(name: string): string {
	return name
		.replace(/ß/g, "ss")
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");
}

function isoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}
