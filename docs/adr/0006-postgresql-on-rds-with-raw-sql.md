# 6. Store metadata in PostgreSQL on RDS, accessed with raw SQL

- Status: Accepted
- Date: 2025-10-24 (updated 2026-10-08: verified TLS, constraints, encryption and backups)
- Deciders: Project maintainer

## Context

The system tracks assets, user-defined presets and the variants produced from them. The data
is small and relational: variants belong to an asset and a preset, and status transitions plus
variant inserts must be atomic. Three runtimes (API, image worker, cleanup worker) read and
write it.

## Decision

- **Engine**: RDS PostgreSQL 17.6, `db.t3.micro`, 20 GB, single AZ, in private subnets,
  `publicly_accessible = false`, storage encrypted, 7 days of automated backups
  (`db_backup_retention_days`), minor upgrades automatic ([rds.tf](../../infrastructure/terraform/rds.tf)).
  Deletion protection is on and a final snapshot is taken unless `skip_final_snapshot = true`, which is
  meant for throwaway environments.
- **Schema**: three tables (`presets`, `assets`, `variants`), an `asset_status` enum, indexes
  on `variants.asset_id` and `assets.status`, a trigger that maintains `updated_at`, `CHECK`s on preset
  size and format, and `UNIQUE (asset_id, preset_id)` on variants, all in
  [schema.sql](../../server/schema.sql). Later changes are plain SQL files in
  [server/migrations](../../server/migrations/), applied by hand with `psql`. The schema is loaded from a
  shell on the API host (Session Manager), see the README.
- **Access**: `pg-promise` with parameterised queries and no ORM, in the API
  ([database.ts](../../server/src/config/database.ts)) and in each Lambda (`db.ts`, one copy per
  package). `BIGINT` columns are returned as numbers. Query errors are mapped to HTTP statuses by
  PostgreSQL error code, not by message text.
- **Transport**: TLS is on (`DB_SSL=true`) and **the server certificate is verified** against the Amazon
  RDS CA bundle kept in [infrastructure/certs](../../infrastructure/certs/). The API reads it from
  `DB_SSL_CA_PATH`; the Lambda bundles it into its artifact. Without a CA path the API warns and falls
  back to unverified TLS (for local experiments only).
- **Connections**: the API pool defaults to 10 (`DB_POOL_MAX`); each Lambda container uses one connection,
  and Lambda concurrency is capped ([ADR 0003](0003-event-driven-image-processing-s3-sqs-lambda.md)).
- **Credentials**: one master user and password from Terraform variables are used by the API
  (`.env` on EC2) and by the Lambda (environment variable). The password is validated for length and
  allowed characters.

## Consequences

### Positive

- Foreign keys, cascading deletes, uniqueness and transactions give real integrity guarantees.
- Parameterised SQL keeps injection risk low and the query layer easy to read.
- The RDS instance cannot be reached from the internet; only the EC2 and Lambda security
  groups can open port 5432 ([sg.tf](../../infrastructure/terraform/sg.tf)).
- Connections are encrypted and authenticated, so an impostor inside the network cannot read credentials.
- Data is encrypted at rest and recoverable to any point in the last week.

### Negative

- No migration tool: schema changes are numbered SQL files applied by hand, and nothing records which
  have been applied.
- Every component uses the master credential, so a compromise of any one gets full database
  access; the password also sits in Lambda environment variables, EC2 user data and Terraform state.
- `db.ts` exists in three copies and can drift.
- Single AZ, no performance insights or enhanced monitoring, and no multi-AZ failover.
- A `db.t3.micro` has a small connection limit; the concurrency cap in ADR 0003 is what protects it.

## Alternatives considered

- **DynamoDB**: scales effortlessly, but the relationships and multi-row transaction fit SQL
  better.
- **Aurora Serverless v2**: managed scaling and RDS Proxy-like pooling at higher baseline cost.
- **An ORM or query builder with migrations (Drizzle, Kysely, Prisma)**: adds typed queries and
  versioned schema changes; the likeliest improvement as the schema grows.
- **RDS-managed master password in Secrets Manager plus separate API and worker roles**: removes the
  shared secret; needs code to fetch it at runtime (and a VPC endpoint for the Lambda).
