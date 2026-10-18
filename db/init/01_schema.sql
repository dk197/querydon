-- Querydon sample database: a small online shop.
-- Runs once on an empty data volume (first `pnpm db:up` or `pnpm db:reset`).
-- The COMMENTs are part of the product: schema introspection hands them to the LLM.

CREATE SCHEMA shop;
COMMENT ON SCHEMA shop IS 'Online shop data: customers, catalog, orders, payments and reviews. All amounts are in EUR.';

SET search_path TO shop;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE order_status AS ENUM ('pending', 'paid', 'shipped', 'delivered', 'cancelled', 'returned');
COMMENT ON TYPE order_status IS 'Lifecycle of an order: pending (placed, not paid) -> paid -> shipped -> delivered; or cancelled before shipping, or returned after delivery.';

CREATE TYPE payment_method AS ENUM ('credit_card', 'paypal', 'invoice', 'bank_transfer');
COMMENT ON TYPE payment_method IS 'How a payment was made.';

CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
COMMENT ON TYPE payment_status IS 'State of a payment: only completed payments count as revenue; refunded payments were paid back.';

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

CREATE TABLE customers (
	id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	email text NOT NULL UNIQUE,
	first_name text NOT NULL,
	last_name text NOT NULL,
	birth_date date,
	is_newsletter_subscriber boolean NOT NULL DEFAULT false,
	created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE customers IS 'Registered shop customers, one row per account.';
COMMENT ON COLUMN customers.id IS 'Customer ID.';
COMMENT ON COLUMN customers.email IS 'Login and contact email address, unique.';
COMMENT ON COLUMN customers.first_name IS 'Given name.';
COMMENT ON COLUMN customers.last_name IS 'Family name.';
COMMENT ON COLUMN customers.birth_date IS 'Date of birth; NULL when the customer did not provide it.';
COMMENT ON COLUMN customers.is_newsletter_subscriber IS 'True when the customer receives the marketing newsletter.';
COMMENT ON COLUMN customers.created_at IS 'When the account was registered.';

CREATE TABLE addresses (
	id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	customer_id bigint NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
	street text NOT NULL,
	postal_code text NOT NULL,
	city text NOT NULL,
	country_code char(2) NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
	is_default boolean NOT NULL DEFAULT false
);
COMMENT ON TABLE addresses IS 'Postal addresses of customers; a customer can have several, one of them marked as default.';
COMMENT ON COLUMN addresses.id IS 'Address ID.';
COMMENT ON COLUMN addresses.customer_id IS 'Customer the address belongs to (customers.id).';
COMMENT ON COLUMN addresses.street IS 'Street and house number.';
COMMENT ON COLUMN addresses.postal_code IS 'Postal code.';
COMMENT ON COLUMN addresses.city IS 'City name.';
COMMENT ON COLUMN addresses.country_code IS 'ISO 3166-1 alpha-2 country code, e.g. DE, AT, CH.';
COMMENT ON COLUMN addresses.is_default IS 'True for the customer''s default shipping address.';

CREATE UNIQUE INDEX addresses_one_default_per_customer ON addresses (customer_id) WHERE is_default;
CREATE INDEX addresses_customer_id_idx ON addresses (customer_id);

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

CREATE TABLE categories (
	id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	parent_id bigint REFERENCES categories (id),
	name text NOT NULL,
	slug text NOT NULL UNIQUE
);
COMMENT ON TABLE categories IS 'Product categories as a tree: top-level categories have parent_id NULL, subcategories point to their parent.';
COMMENT ON COLUMN categories.id IS 'Category ID.';
COMMENT ON COLUMN categories.parent_id IS 'Parent category (categories.id); NULL for top-level categories.';
COMMENT ON COLUMN categories.name IS 'Display name, e.g. "Laptops".';
COMMENT ON COLUMN categories.slug IS 'URL-friendly unique name, e.g. "laptops".';

CREATE INDEX categories_parent_id_idx ON categories (parent_id);

CREATE TABLE products (
	id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	category_id bigint NOT NULL REFERENCES categories (id),
	sku text NOT NULL UNIQUE,
	name text NOT NULL,
	description text,
	price numeric(10, 2) NOT NULL CHECK (price >= 0),
	cost numeric(10, 2) NOT NULL CHECK (cost >= 0),
	stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
	is_active boolean NOT NULL DEFAULT true,
	created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE products IS 'Products in the catalog. Each product belongs to exactly one (usually leaf) category.';
COMMENT ON COLUMN products.id IS 'Product ID.';
COMMENT ON COLUMN products.category_id IS 'Category of the product (categories.id).';
COMMENT ON COLUMN products.sku IS 'Stock keeping unit, unique article number.';
COMMENT ON COLUMN products.name IS 'Product name.';
COMMENT ON COLUMN products.description IS 'Marketing description; may be NULL.';
COMMENT ON COLUMN products.price IS 'Current gross selling price per unit in EUR. Historic order prices are in order_items.unit_price.';
COMMENT ON COLUMN products.cost IS 'Purchase cost per unit in EUR; margin = price - cost.';
COMMENT ON COLUMN products.stock_quantity IS 'Units currently in stock.';
COMMENT ON COLUMN products.is_active IS 'False when the product is discontinued and no longer sold.';
COMMENT ON COLUMN products.created_at IS 'When the product was added to the catalog.';

CREATE INDEX products_category_id_idx ON products (category_id);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

CREATE TABLE orders (
	id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	customer_id bigint NOT NULL REFERENCES customers (id),
	shipping_address_id bigint NOT NULL REFERENCES addresses (id),
	status order_status NOT NULL DEFAULT 'pending',
	ordered_at timestamptz NOT NULL DEFAULT now(),
	shipped_at timestamptz,
	delivered_at timestamptz,
	shipping_cost numeric(10, 2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
	total_amount numeric(12, 2) NOT NULL CHECK (total_amount >= 0),
	CHECK (shipped_at IS NULL OR shipped_at >= ordered_at),
	CHECK (delivered_at IS NULL OR shipped_at IS NOT NULL AND delivered_at >= shipped_at)
);
COMMENT ON TABLE orders IS 'Customer orders (one row per checkout). Line items are in order_items, payments in payments.';
COMMENT ON COLUMN orders.id IS 'Order ID.';
COMMENT ON COLUMN orders.customer_id IS 'Customer who placed the order (customers.id).';
COMMENT ON COLUMN orders.shipping_address_id IS 'Address the order was shipped to (addresses.id).';
COMMENT ON COLUMN orders.status IS 'Current order status; see type order_status. Revenue analyses usually exclude cancelled and returned orders.';
COMMENT ON COLUMN orders.ordered_at IS 'When the order was placed; use this for time-based revenue analyses.';
COMMENT ON COLUMN orders.shipped_at IS 'When the order left the warehouse; NULL if not shipped yet.';
COMMENT ON COLUMN orders.delivered_at IS 'When the order was delivered; NULL if not delivered yet.';
COMMENT ON COLUMN orders.shipping_cost IS 'Shipping fee charged to the customer in EUR.';
COMMENT ON COLUMN orders.total_amount IS 'Order total in EUR: sum of order_items line totals (quantity * unit_price - discount) plus shipping_cost.';

CREATE INDEX orders_customer_id_idx ON orders (customer_id);
CREATE INDEX orders_ordered_at_idx ON orders (ordered_at);
CREATE INDEX orders_status_idx ON orders (status);

CREATE TABLE order_items (
	id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	order_id bigint NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
	product_id bigint NOT NULL REFERENCES products (id),
	quantity integer NOT NULL CHECK (quantity > 0),
	unit_price numeric(10, 2) NOT NULL CHECK (unit_price >= 0),
	discount numeric(10, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
	UNIQUE (order_id, product_id)
);
COMMENT ON TABLE order_items IS 'Line items of orders: which product, how many, at which price. Line total = quantity * unit_price - discount.';
COMMENT ON COLUMN order_items.id IS 'Order item ID.';
COMMENT ON COLUMN order_items.order_id IS 'Order the line belongs to (orders.id).';
COMMENT ON COLUMN order_items.product_id IS 'Product ordered (products.id).';
COMMENT ON COLUMN order_items.quantity IS 'Number of units ordered.';
COMMENT ON COLUMN order_items.unit_price IS 'Price per unit in EUR at the time of the order (may differ from the current products.price).';
COMMENT ON COLUMN order_items.discount IS 'Absolute discount in EUR on the whole line, not per unit.';

CREATE INDEX order_items_product_id_idx ON order_items (product_id);

CREATE TABLE payments (
	id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	order_id bigint NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
	method payment_method NOT NULL,
	status payment_status NOT NULL DEFAULT 'pending',
	amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
	paid_at timestamptz
);
COMMENT ON TABLE payments IS 'Payment attempts for orders. An order can have several (e.g. a failed attempt followed by a completed one).';
COMMENT ON COLUMN payments.id IS 'Payment ID.';
COMMENT ON COLUMN payments.order_id IS 'Order being paid (orders.id).';
COMMENT ON COLUMN payments.method IS 'Payment method; see type payment_method.';
COMMENT ON COLUMN payments.status IS 'Payment state; see type payment_status.';
COMMENT ON COLUMN payments.amount IS 'Amount in EUR.';
COMMENT ON COLUMN payments.paid_at IS 'When the payment completed; NULL unless status is completed or refunded.';

CREATE INDEX payments_order_id_idx ON payments (order_id);

CREATE TABLE reviews (
	id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	product_id bigint NOT NULL REFERENCES products (id),
	customer_id bigint NOT NULL REFERENCES customers (id),
	rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
	title text,
	body text,
	created_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (product_id, customer_id)
);
COMMENT ON TABLE reviews IS 'Product reviews written by customers; at most one review per customer and product.';
COMMENT ON COLUMN reviews.id IS 'Review ID.';
COMMENT ON COLUMN reviews.product_id IS 'Reviewed product (products.id).';
COMMENT ON COLUMN reviews.customer_id IS 'Author of the review (customers.id).';
COMMENT ON COLUMN reviews.rating IS 'Star rating from 1 (worst) to 5 (best).';
COMMENT ON COLUMN reviews.title IS 'Short headline; may be NULL.';
COMMENT ON COLUMN reviews.body IS 'Review text; may be NULL.';
COMMENT ON COLUMN reviews.created_at IS 'When the review was written.';

CREATE INDEX reviews_customer_id_idx ON reviews (customer_id);
