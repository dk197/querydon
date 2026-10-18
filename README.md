# Querydon

Ask your database questions in plain language. Querydon turns a chat message into SQL, runs it safely against PostgreSQL, and answers in natural language. Results can be exported as CSV or Excel.

```
Question ──► LLM ──► SQL ──► validate ──► execute (read-only) ──► LLM ──► Answer
                      ▲                       │
                      └──── error feedback ◄──┘  (max. 2 retries)
```

## Tech Stack

| Area     | Choice                                                                |
| -------- | --------------------------------------------------------------------- |
| Monorepo | pnpm workspaces                                                       |
| Backend  | NestJS + TypeScript                                                   |
| Frontend | React + TypeScript (Vite), Tailwind + shadcn/ui, TanStack Query/Table |
| Database | PostgreSQL (Docker)                                                   |
| LLM      | Pluggable adapters, selected via `.env` (start: Qwen via LM Studio)   |
| App data | TypeORM via `@nestjs/typeorm` (conversations, messages)               |
| Export   | `csv-stringify`, `exceljs`                                            |

## LLM Adapters

The backend depends only on a small interface. Each LLM API gets its own adapter, and the active one is chosen through environment variables.

```ts
interface LlmAdapter {
	complete(req: { system: string; messages: ChatMessage[]; jsonSchema?: object }): Promise<string>;
	stream(req: { system: string; messages: ChatMessage[] }): AsyncIterable<string>;
}
```

| Adapter             | SDK                  | Covers                                      |
| ------------------- | -------------------- | ------------------------------------------- |
| `openai-compatible` | `openai` + `baseURL` | LM Studio, Ollama, vLLM, OpenAI, OpenRouter |
| `anthropic`         | `@anthropic-ai/sdk`  | Claude                                      |
| _(later)_ `gemini`… | provider SDK         | other APIs                                  |

A NestJS factory provider (token `LLM_ADAPTER`) reads the config and creates the right adapter. Env vars are validated with Zod at startup. Structured output (the generated SQL) is always parsed again with Zod, because local models don't always follow the schema.

```env
LLM_PROVIDER=openai-compatible        # openai-compatible | anthropic
LLM_BASE_URL=http://localhost:1234/v1 # LM Studio
LLM_MODEL=qwen2.5-14b-instruct
LLM_API_KEY=lm-studio

TARGET_DATABASE_URL=postgres://querydon_reader:***@localhost:5433/shop
APP_DATABASE_URL=postgres://querydon:***@localhost:5433/shop
```

Default model: `qwen2.5-14b-instruct` – a good balance between SQL generation and fluent natural-language answers. Coder models (e.g. Qwen2.5-Coder) may produce better SQL but weaker prose; the eval set (see below) is used to compare them.

## Query Pipeline

1. **Schema context** – introspect `information_schema` / `pg_catalog`: tables, columns, types, foreign keys, `COMMENT ON` descriptions, sample values for enum-like columns. Cached at startup.
2. **SQL generation** – system prompt (schema + rules + few-shot examples) + chat history → `{ sql, explanation }` as JSON.
3. **Validation** – parse the SQL (`pgsql-ast-parser` / `libpg-query`); only a single `SELECT` / `WITH` statement is allowed.
4. **Execution** – read-only role, `READ ONLY` transaction, `statement_timeout` (10 s), enforced `LIMIT` (1,000 rows in chat).
5. **Self-correction** – on a database error, send the error back to the LLM (max. 2 retries).
6. **Answer** – question + SQL + truncated result (≈50 rows, column names, row count) → natural-language answer, streamed to the client via SSE.
7. **Persistence** – store question, SQL, result metadata and answer in the `app` schema.

## Security

- Dedicated PostgreSQL role `querydon_reader`: `SELECT` on schema `shop` only, sessions read-only with a 10 s statement timeout; functions that write or change session state from inside a `SELECT` (`set_config`, large objects, `pg_notify`) are revoked
- AST-based validation: single read-only statement, no DDL/DML
- Timeouts and row limits on every query
- Only a truncated result is sent to the LLM

## Project Structure

```
querydon/
├─ apps/
│  ├─ backend/                 # NestJS
│  │  └─ src/
│  │     ├─ llm/               # llm-adapter.interface.ts, adapters/, llm.module.ts
│  │     ├─ schema/            # schema introspection + cache
│  │     ├─ sql/               # validator, read-only executor
│  │     ├─ chat/              # chat controller (SSE), pipeline orchestration
│  │     ├─ export/            # CSV / XLSX
│  │     └─ persistence/       # TypeORM entities + migrations (conversations, messages)
│  └─ frontend/                # React + Vite
├─ packages/
│  └─ shared/                  # shared types / Zod schemas (API DTOs)
├─ db/
│  ├─ init/01_schema.sql       # shop schema with COMMENTs
│  ├─ init/02_roles.sh         # querydon_reader role, app schema
│  └─ seed/seed.ts             # Faker-based deterministic seed
├─ eval/                       # test questions + expected results
├─ docker-compose.yml
├─ .env.example
└─ pnpm-workspace.yaml
```

## Sample Database (Online Shop)

Tables: `customers`, `addresses`, `categories` (hierarchical), `products`, `orders` (status enum, 2–3 years of history), `order_items`, `payments`, `reviews`.

Volume: ~1,000 customers, ~200 products, ~10,000 orders – enough for meaningful aggregations and time series. Every table and column has a `COMMENT ON` description to improve SQL quality.

An eval set of ~20 questions with expected results lets us measure accuracy and compare models (e.g. Qwen vs. Claude).

## API (draft)

| Method | Endpoint                                | Purpose                                       |
| ------ | --------------------------------------- | --------------------------------------------- |
| POST   | `/query`                                | question → SQL + result (no chat, for evals)  |
| POST   | `/conversations/:id/messages`           | ask in chat, answer streamed via SSE          |
| GET    | `/conversations`, `/conversations/:id`  | chat history                                  |
| GET    | `/messages/:id/export?format=csv\|xlsx` | re-run stored SQL with higher limit, download |
| GET    | `/health/llm`                           | check that the configured model is reachable  |

## Roadmap

1. **Scaffold** – pnpm workspace, `tsconfig.base`, ESLint/Prettier, `packages/shared`, NestJS + Vite apps, `.env.example`
2. **Database** – `docker-compose.yml`, schema SQL with comments and read-only role, Faker seed (`pnpm db:reset`)
3. **LLM module** – `LlmAdapter` interface, `OpenAiCompatibleAdapter`, env-based factory, health check
4. **Schema introspection** → compact prompt text
5. **SQL generation + validator + executor** as `POST /query`; tune quality with the eval set
6. **Answer generation + chat endpoint** with SSE streaming and stored conversations (follow-up questions use history)
7. **Frontend** – chat UI, streaming, collapsible SQL view, result table
8. **Export** – CSV and XLSX
9. **More providers** – `AnthropicAdapter`, switch via `.env`
10. **Later** – charts (LLM suggests chart type, Recharts), 👍/👎 feedback reused as few-shot examples, schema RAG for large databases, auth, PDF reports

## Getting Started (planned)

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:reset          # create schema + seed sample data
pnpm dev               # starts backend and frontend
```

Start LM Studio, load a Qwen model and enable the local server (default `http://localhost:1234/v1`).

## Testing

- Unit tests for the SQL validator (`DROP`, `UPDATE`, multiple statements, `SELECT …; DELETE …` must be rejected)
- `pnpm db:test` – checks against the running container what `querydon_reader` may and may not do
- `pnpm eval` – runs all eval questions against `/query` and reports accuracy
- Manual: ask "Top 5 products by revenue in 2025", follow up with "and by category?", export as CSV/XLSX
