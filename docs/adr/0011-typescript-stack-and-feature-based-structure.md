# 11. Use TypeScript end to end with a feature-based layout

- Status: Accepted
- Date: 2025-10-24 (updated 2026-10-08: validation behaviour, bundled workers, web data fetching)
- Deciders: Project maintainer

## Context

Four units share one repository: an API, two Lambda workers (only one is deployed today) and a
browser app. They are maintained by one small team that wants a single language and low ceremony.

## Decision

The repository is four independent npm packages with their own `package.json` and lockfile; there
is no workspace tooling and no shared package.

| Package | Stack |
| --- | --- |
| `server/` | Node.js 20, Express 5, Zod 4, `helmet`, `cors`, `express-rate-limit`, `pg-promise`, AWS SDK v3 (`client-s3`, `s3-presigned-post`). TypeScript compiled by `tsc` to CommonJS (`noEmitOnError`). |
| `lambdas/image-processor/` | TypeScript, AWS SDK v3, `sharp` (from a layer), `pg-promise`. Type-checked with `tsc`, bundled with esbuild. |
| `lambdas/cleanup/` | TypeScript, AWS SDK v3, `pg-promise`; same build (see [ADR 0012](0012-async-asset-deletion-via-cleanup-worker.md)). |
| `web/` | React 19, Vite 7, React Router 7 data router with lazy routes, TanStack Query 5 (infinite query for assets), axios, Tailwind 4, Radix Dialog, sonner. |

Structure follows features, not layers:

- **Server**: `src/features/{asset,preset}/{routes,controller,schema}.ts`, plus `middleware/`,
  `services/` for AWS clients and `config/` for environment and database setup. Each feature owns its Zod
  schema, and controllers call `pg-promise` directly. Controllers are plain `async` functions; Express 5
  forwards rejected promises to the error handler, so there is no per-handler `try/catch`.
- **Validation**: the `validate()` middleware parses `{ body, query, params }` with the route's schema.
  The **parsed result is used**: `req.body` is replaced (defaults applied, unknown keys stripped) and the
  parsed query and params are available as `res.locals.validated`, because `req.query` is read-only in
  Express 5. Invalid input is `400`; database errors are mapped by PostgreSQL error code in one place.
- **Web**: `src/features/{assets,presets}/{api,components}`, a thin `app/` for providers and
  routes, shared `components/ui`, `hooks`, `lib` (axios and query types), `types` and `utils`.

## Consequences

### Positive

- One language and one mental model from browser to worker.
- Feature folders keep related code together and make it easy to add a resource.
- Small packages build and deploy independently, and every package type-checks and builds with one command.
- Input handling is uniform: what the handler sees is exactly what the schema allows.

### Negative

- Shared pieces are copy-pasted: `db.ts` exists in three places and the asset and preset types are
  re-declared in `web/src/types` by hand, so the API contract can drift silently.
- Nothing in the repository has tests, only `web/` has a linter, and there is no CI.
- Controllers contain SQL directly, so there is no seam for unit tests without a database.
- `updatePresetSchema` and the commented-out delete code are placeholders for unfinished features.

## Alternatives considered

- **npm workspaces or a monorepo tool (Turborepo, Nx)**: would allow a shared `db`/types package
  and one-command builds and tests.
- **Generated API types (OpenAPI or tRPC)**: removes hand-maintained client types.
- **Layered structure (controllers/, services/, repositories/)**: familiar, but spreads one
  feature over many folders at this size.
