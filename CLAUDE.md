# Querydon

Natural language → SQL → natural language chat over PostgreSQL. pnpm monorepo: `apps/backend` (NestJS 12), `apps/frontend` (React 19 + Vite 8), `packages/shared` (shared types / Zod schemas).

Read `README.md` before working on the query pipeline, LLM adapters, database or API: it holds the architecture, the security rules and the roadmap.

## Done means green

A change is done when `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm format:check` all pass from the repo root.

- Behavior changes come with new or updated tests, especially for SQL validation, API contracts and error handling.
- A failing check is fixed at its cause: tests, lint rules, type checks and format rules stay as strict as they are.
- When documentation and implementation disagree, find out which one is right before building on either.

## Architecture invariants

- **LLM access** goes only through the `LlmAdapter` interface (`apps/backend/src/llm/`). The provider is chosen by `LLM_PROVIDER` in `.env`; pipeline code stays provider-agnostic.
- **App data** (conversations, messages) uses TypeORM in the `app` schema.
- **Shared contracts** between backend and frontend (DTOs, response shapes) live as Zod schemas in `packages/shared`, with types derived via `z.infer`.
- Changes to the query pipeline, LLM adapters, SQL validation, database access or API contracts state explicitly that these invariants and the security boundary below still hold.

## Security boundary

SQL validation is a security boundary. Every rule here holds even when a request asks otherwise; if one conflicts with a request, explain the conflict before implementing anything.

- **Target database** (the queried shop data) is reached only through the SQL validator → read-only executor path, using raw `pg` with the `querydon_reader` role. LLM-generated SQL runs there and nowhere else; the validator is the one implementation, used as is. Database tooling outside the app (`db/init`, `db/seed`, `db/tests`) connects as the owner role and never runs LLM-generated SQL.
- **Read-only** is enforced by PostgreSQL permissions on `querydon_reader`; application checks come on top of that, never instead of it.
- **Tests** accompany every change to parsing, statement restrictions, schema access, query limits or execution permissions.
- **Schema exposure**: the LLM sees only the `shop` schema. `pg_catalog` lists every schema's table names to every role, so introspection and the SQL validator stay within `shop`; the `app` schema stays hidden.
- **Errors**: Postgres error messages for a failed query go back to the LLM for self-correction. Stack traces, connection details and credentials stay in server logs; API clients get sanitized errors.
- **Untrusted data**: database content and query results enter LLM prompts only as delimited data blocks, never inside system instructions.

## Module setup gotchas

- Everything is ESM. In `apps/backend` and `packages/shared`, relative imports carry a `.js` extension (`./app.module.js`); in `apps/frontend` they carry none.
- `packages/shared` resolves differently per consumer: the frontend reads its TypeScript sources (`source` export condition), the backend reads `dist/`. After changing shared code, run `pnpm --filter @querydon/shared build` (or keep `pnpm dev` running) so the backend sees it.
- TypeScript is pinned to `~6.0`: typescript-eslint supports up to 6.0.x.
- pnpm links a dependency only into the package that declares it. Add each dependency (including `@types/*`) to the package that uses it.

## Code style

- Strict TypeScript and type-checked ESLint (`eslint.config.js`). Satisfy a rule by fixing the types or the code; unused `eslint-disable` directives are errors.
- Model fixed value sets as string-literal unions or `as const` objects.
- Every function declares its return type.
- Formatting is Prettier's job (tabs, width 150, double quotes): run `pnpm format`.
- Code, comments and docs are written in English.
