# BrandKit code audit - 2026-10-07

Scope: everything tracked in the repository at commit `a7204ac` (Terraform, `server/`,
`lambdas/image-processor`, `lambdas/cleanup`, `web/`). Read in full; nothing was changed in the
code. Decisions behind the architecture are in [docs/adr](../adr/README.md).

## How this was checked

Each finding is tagged:

- **Verified**: reproduced by running something (command and result noted).
- **Code**: read directly from the source; the behaviour follows from the code but was not run.
- **Confirm**: depends on state outside the repo (AWS account, Lambda layer contents); needs a
  quick check by someone with access.

What was run (copies installed in a scratch directory so the repo stayed untouched):

| Check | Result |
| --- | --- |
| `tsc --noEmit` in `server/` | **Fails**, exit 2 (finding H3) |
| `tsc --noEmit` in `lambdas/image-processor/` | Passes, exit 0 |
| `npm run build` and `npm run lint` in `web/` | Build exit 0; ESLint printed no findings |
| Zod 4 + `pg-promise` reproduction of the preset insert and `limit` parsing | Reproduced H4 and M7 |
| `gh repo view aksbuzz/brandkit`, `git log -p -- terraform.tfvars` | Repo is **public**; `tfvars` in history since the first commit (H2) |
| `terraform fmt -check` | Exit 3: formatting drift in `s3_sqs.tf` and `terraform.tfvars` |

Not run: `terraform validate/plan/apply` (needs the AWS provider and credentials), anything
against AWS or a live database, the end-to-end upload flow, `lambdas/cleanup` build, the
contents of your `Sharp:1` layer.

## Summary

| ID | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| H1 | High | Web client never sends `X-Api-Key`, and a shared key cannot work for a browser app | Code |
| H2 | High | DB password, account ID and provider binary committed to a **public** repo | Verified |
| H3 | High | `server` fails its TypeScript build (Zod 4 `errorMap`); failure is masked at deploy | Verified |
| H4 | High | Preset creation returns 500 unless `format` and `quality` are sent; the UI's quick-add omits `quality` | Verified |
| H5 | High | Image worker is not idempotent and has several reliability gaps | Code |
| H6 | High | Lambda zip contains no `node_modules`, so `pg-promise` is not packaged | Confirm |
| H7 | High | API is public plain HTTP; browser on HTTPS cannot call it; API key travels in clear text | Code |
| H8 | High | Upload size and content are not enforced anywhere | Code |
| M1 | Medium | PostgreSQL TLS certificate is not verified (3 places) | Code |
| M2 | Medium | Master DB credential everywhere, stored in plaintext in Lambda env and EC2 user data | Code |
| M3 | Medium | IAM policies are bucket-wide | Code |
| M4 | Medium | EC2 bootstrap runs as root, ignores failures, and has no deploy path | Code |
| M5 | Medium | Frontend: no pagination, gallery loads originals, no status refresh | Code |
| M6 | Medium | S3 keys and CDN URLs are built from raw user input | Code |
| M7 | Medium | Error mapping and input validation gaps produce 500s | Verified (partly) |
| M8 | Medium | Shutdown order drops in-flight requests; health check ignores the DB | Code |
| M9 | Medium | Lifecycle gaps: presets, orphaned uploads, no delete path | Code |
| M10 | Medium | Worker concurrency, memory and image-quality issues | Code |
| M11 | Medium | Terraform and AWS hygiene (cost, durability, observability, state) | Code |
| M12 | Medium | README and examples have drifted from the code | Code |
| L1 | Low | No tests, no CI, no lint outside `web/`, formatting drift | Verified |
| L2 | Low | Duplicated code and hand-copied types | Code |
| L3 | Low | Assorted small items | Code |

## High

### H1. The web client cannot authenticate

- `server/src/index.ts:37` puts `requireApiKey` in front of every `/api/v1` route.
- `web/src/lib/api-client.ts:4-6` creates the axios instance with only a `baseURL`. A search of
  `web/` for `api-key`/`x-api` finds nothing, so every request the app makes would get `401`.
  `server/rest.http` has the same omission.
- Adding the header in the client "fixes" it but makes the key public: anything in a Vite bundle is
  readable by any visitor. See [ADR 0010](../adr/0010-shared-api-key-authentication.md).

**Fix**: decide the real model first. For a multi-user app use Cognito (or another OIDC
provider) and validate JWTs in Express; this also gives you per-user ownership. For an internal
tool, front the API and the SPA with the same CloudFront distribution and an origin secret
header, or put both behind a VPN. Keep the API key only for server-to-server callers.

### H2. Credentials and binaries in a public repository

- `infrastructure/terraform/terraform.tfvars:1-5` is tracked and contains `db_password =
  "password123"`, the AWS account ID (inside the layer ARN) and the key pair name. It has been in
  history since the initial commit (`88991e6`); the later edit is `7345d8e`.
- The EC2 `user_data` clones `https://github.com/aksbuzz/brandkit.git` with no credentials and
  `gh repo view` reports `PUBLIC`, so anyone can read it.
- `.gitignore` lists `terraform.tfvars` and `.terraform/`, but they were committed first, so
  ignoring them now changes nothing. A 16 MB `terraform-provider-archive_v2.7.1_x5.exe` is tracked
  under `.terraform/`.
- The RDS instance is private, which limits direct exploitability, but the password is trivial
  and may be reused.

**Fix**:

1. Change the RDS master password now and anywhere it was reused (`aws rds modify-db-instance`,
   or switch to RDS-managed secrets, see M2).
2. `git rm --cached infrastructure/terraform/terraform.tfvars` and `git rm -r --cached
   infrastructure/terraform/.terraform`; commit a `terraform.tfvars.example` instead.
3. Decide whether to purge history (`git filter-repo --path ... --invert-paths`, then force-push
   and tell anyone with a clone). With 7 commits this is cheap, but the secret must be treated as
   leaked either way.
4. Commit `.terraform.lock.hcl` (remove it from `.gitignore`); it holds hashes, not secrets.

### H3. The server does not pass its own build

`npm run build` in `server/` (that is, `tsc`) exits 2:

```
src/features/asset/schema.ts(9,20): error TS2769: No overload matches this call.
  ... 'errorMap' does not exist in type '{ error?: ...; message?: string }'
```

Zod 4 removed `errorMap` (`server/src/features/asset/schema.ts:9-11`). At runtime Zod simply
ignores it, so the custom "Content type must be one of ..." message is replaced by Zod's default
one. `tsc` still emits JavaScript because `noEmitOnError` is off, and `ec2.tf` has no `set -e`, so
PM2 starts the app anyway. The failure is invisible until someone reads the boot log.

**Fix**: replace `errorMap: () => ({ message: ... })` with `error: ...` (a string or a function
returning one, which is the Zod 4 syntax). In a scratch copy this one change makes `tsc --noEmit`
exit 0, so it is the only type error in `server/`. Also set `noEmitOnError: true` in
`server/tsconfig.json`, add `set -euxo pipefail` to the bootstrap script (M4), and run
`tsc --noEmit` in CI (L1).

### H4. Preset creation fails when optional fields are omitted

`server/src/middleware/validator.ts:7-11` calls `schema.parse(...)` and throws the result away,
so `req.body` is unchanged. Zod's `.default('jpeg')` and `.default(80)` therefore never reach the
handler. `server/src/features/preset/controller.ts:11-16` then runs
`INSERT ... VALUES (${name}, ${width}, ${height}, ${format}, ${quality})` with the raw body.

Reproduced: for `{ name, width, height }`, `pg-promise` throws `Property 'format' doesn't exist.`
and the error handler returns 500.

User-visible impact: `web/src/app/routes/presets.tsx:19-25` defines the "Quick Add Common
Presets" with `{ name, width, height, format }` and **no `quality`**, so every one of those
buttons hits this 500. The manual form always sends every field, which is why this was not noticed.

Related: the schema accepts `fit` (`preset/schema.ts:8`) but there is no `fit` column and
the worker always uses sharp's default, so the value is silently dropped. Unknown extra keys are
also not stripped.

**Fix**: make `validate` assign the parsed result (`const parsed = schema.parse(...);
req.body = parsed.body;` and the same for `query`/`params`; note that in Express 5 `req.query` is
a getter, so store it on `res.locals` or a typed `req.validated`). Either add a `fit` column and
use it in the worker, or remove `fit` from the schema. Add `quality` to the quick-add presets
as a belt-and-braces change.

### H5. Image worker: idempotency and reliability

`lambdas/image-processor/src/handler.ts`

- **Not idempotent (lines 45-48, 90-112).** SQS and S3 both deliver at least once, a presigned
  URL can be reused for an hour, a batch timeout redelivers the whole batch, and the worker can
  retry after partial success. On any repeat for an asset that already has variants, line 45
  flips it back to `processing`, then the plain `INSERT` hits `variants.s3_key UNIQUE`
  (`schema.sql:30`), the transaction rolls back and the asset becomes `failed` even though its
  variants exist. After 3 receives the message lands in the DLQ.
- **The catch block can throw (lines 140-145).** The `UPDATE ... 'failed'` runs inside `catch`
  without protection. If the database is the reason for the failure (down, out of connections),
  that second error escapes the handler and fails the *entire* batch, not just one record.
- **Only the first S3 record is read (line 124)**, and the `s3:TestEvent` message that S3 sends
  when a notification is configured has no `Records`. If it reaches the worker it throws and is
  retried into the DLQ, which is noise you then have to tell apart from real failures.
- **Timeouts (lambda.tf:20, 44)**: five records processed one after another inside a 300 s limit.
  A slow image can time out the whole batch.

**Fix**: skip work if the asset is already `processed`; replace the status write at line 45 with
a conditional update (`WHERE status IN ('pending','failed')`); insert variants with `ON CONFLICT
(asset_id, preset_id) DO UPDATE` and add `UNIQUE (asset_id, preset_id)` to the schema; wrap the
`failed` update in its own try/catch; iterate `Records` and ignore events without an object key;
set `batch_size = 1` (or keep 5 and make it idempotent). Also add a DLQ alarm (M11).

### H6. Lambda artifact has no dependencies (confirm)

`lambda.tf:1-5` zips `lambdas/image-processor/dist`, which contains only the `tsc` output
(`handler.js`, `db.js`). `pg-promise` is a runtime `dependency`, and nothing in the repo bundles
or layers it. `@aws-sdk/client-s3` is provided by the Node 22 runtime and `sharp` by the layer,
but `pg-promise` is in neither. The function can only work if your `Sharp:1` layer was built
with `pg-promise` in it, which the README does not tell anyone to do (it points to a
community layer containing `sharp` only).

**Confirm**: `aws lambda get-layer-version --layer-name Sharp --version-number 1` and inspect the
zip, or look at CloudWatch for `Cannot find module 'pg-promise'`.
**Fix**: bundle with esbuild (`--bundle --platform=node --target=node22 --external:sharp
--external:@aws-sdk/*`), which also removes the runtime dependency on layer contents. Add a
`build:lambda` step to the README before `terraform apply` (the `archive_file` fails if `dist/` is
missing).

### H7. Public HTTP API

- `sg.tf:6-12` opens 8080 to `0.0.0.0/0`; the server speaks plain HTTP.
- The API key, request bodies and presigned URLs cross the internet unencrypted.
- A page served over HTTPS (any real deployment of the SPA) cannot call an `http://` API:
  browsers block it as mixed content. `web/.env.example` points at an `http://ec2-...:8080` URL.
- There is no hosting for the SPA in Terraform at all; README tells people to `npm run dev`.

**Fix (cheapest)**: add the API as a second origin on the existing CloudFront distribution
(path `/api/*`, caching disabled, forward `X-Api-Key`/`Authorization`), restrict the EC2 security
group to the CloudFront managed prefix list, and host the built SPA from S3 behind the same
distribution. That gives HTTPS, one origin (no CORS) and a stable domain. The conventional
alternative is ALB + ACM.

### H8. Nothing enforces what gets uploaded

- The presigned `PUT` (`s3.service.ts:7-14`) has no size limit, and `fileSizeBytes` from the client
  (`asset/schema.ts:8`) is stored but never compared with the real object. The "up to 10MB" text
  in `web/src/features/assets/components/upload.tsx:53` is cosmetic.
- Any caller with the API key can upload arbitrarily large objects: storage cost, and a Lambda
  with 2048 MB that downloads the whole file into memory and decodes it once per preset
  (`handler.ts:57-65`). `sharp` has a default pixel limit, but not a byte limit.
- The declared `contentType` is trusted; the bytes are never checked to be an image of that type
  until `sharp` fails.

**Fix**: use a presigned `POST` with `content-length-range` and `Content-Type` conditions. In the
worker, reject early using the object size that is already present in the S3 event
(`s3.object.size`) before downloading, pass `limitInputPixels` and `failOn: 'error'` to `sharp`,
and mark the asset `failed` with a clear message.

## Medium

### M1. Database TLS is not verified

`server/src/config/database.ts:12`, `lambdas/image-processor/src/db.ts:11`,
`lambdas/cleanup/src/db.ts:11` all use `{ rejectUnauthorized: false }`. The connection is
encrypted but accepts any certificate. Ship the RDS CA bundle (`global-bundle.pem`) and use
`{ ca, rejectUnauthorized: true }`, or set `PGSSLROOTCERT`. Also set `rds.force_ssl=1` in a
parameter group.

### M2. Credentials handling and database privileges

- One master user is used by the API (`.env` on EC2) and the Lambda (environment variable).
  `ec2.tf:33-43` and `lambda.tf:30-36` embed the password in `user_data` and in the function
  configuration, where it is readable by anyone with `ec2:DescribeInstanceAttribute` or
  `lambda:GetFunctionConfiguration`, and it is also in Terraform state.
- The API and worker need very different rights.

**Fix**: set `manage_master_user_password = true` on `aws_db_instance` so RDS keeps the password
in Secrets Manager; create two database roles (`api`: select/insert/update/delete on `presets` and
`assets`, select on `variants`; `worker`: select on `presets`, update on `assets`, insert on
`variants`); give the instance profile and Lambda role `secretsmanager:GetSecretValue` on their own
secret only, or use IAM database authentication.

### M3. IAM scope

- `iam.tf:24-26`: the EC2 role has `s3:GetObject` it never uses (reads go through CloudFront), and
  `PutObject` on the whole bucket. Restrict to `PutObject` on `originals/*`.
- `iam.tf:67-70`: the worker role can read, write and delete every object. Split it:
  `GetObject` on `originals/*`, `PutObject` on `derived/*`, `DeleteObject` on both (when deletion
  ships).

### M4. EC2 bootstrap

`infrastructure/terraform/ec2.tf:15-54`

- Cloud-init runs as root, so the clone, `npm`, PM2 and the API process all run as root.
- No `set -e`: a failed `npm install` or build does not stop `pm2 start` (see H3).
- `npm install` instead of `npm ci`, and an unpinned clone of the default branch: two instances
  built a day apart can differ.
- `dnf update -y` at every first boot and a hard-coded AMI ID (`ami-06fa3f...`).
- No Elastic IP: the public IP changes on stop/start, and `web/.env.example` and `server/rest.http`
  hard-code today's hostname.
- SSH key access instead of SSM Session Manager.

**Fix**: `set -euxo pipefail`; create a `brandkit` user and a systemd unit (or run the container);
build in CI and deploy an artifact; attach an EIP or put the instance behind the CloudFront origin
from H7; look the AMI up with `data "aws_ssm_parameter"` (and `ignore_changes` on `ami`); use SSM and
drop port 22. If you want to stop managing servers, [ADR 0008](../adr/0008-single-ec2-api-server-behind-cloudfront.md)
lists the container options.

### M5. Frontend behaviour

- **No pagination.** `web/src/features/assets/api/get-assets.tsx:6-8` calls `/assets` with no
  parameters, and the server defaults to 50 (`asset/controller.ts:38`). The 51st asset and beyond are
  never shown. The API also returns no total, so paging cannot be built without a change.
- **The gallery downloads originals.** `AssetCard.tsx:33-38` uses `asset.url`, which is the
  original file, for a ~200 px grid tile. Fifty full-size images load on every visit, which defeats
  the point of the variant pipeline. Return a thumbnail variant URL in the list response (join the
  smallest or a designated preset) and use that.
- **Statuses never update.** After upload, `refetchQueries` runs once, so tiles show `pending` until
  a manual reload (`staleTime` is 60 s and `refetchOnWindowFocus` is off). Poll with
  `refetchInterval` while any asset is `pending` or `processing`.
- All dropped files upload at once with `Promise.allSettled` and no concurrency cap or per-file
  progress; there is no client-side type or size check despite `accept="image/*"` (this admits SVG,
  HEIC, TIFF, which the server rejects with a 400).
- The axios interceptor toasts `error.message` ("Request failed with status code 409"), not the
  server's `message`.
- The preset create and delete handlers have no `try/catch`; a rejection becomes an unhandled
  promise rejection (the toast still appears via the interceptor).
- `AssetStatus` (`web/src/types/asset.ts`) lacks `deleting`, so `assetStatusColor[asset.status]` is
  `undefined` if such a row ever reaches the UI.

### M6. Keys and URLs built from raw input

- `asset/controller.ts:20`: `originals/${assetId}/${filename}` uses the client's filename
  unchecked. Names with `#`, `?`, `%`, or `..` segments produce URLs that do not map back to the
  object once placed into `https://domain/${key}` (`controller.ts:7-8`), and long names can
  exceed S3's 1024-byte key limit.
- The worker puts the raw preset name in the key (`handler.ts:67`): the UI's own presets include
  spaces ("Twitter Post").
- The derived key keeps the original filename even when the preset changes the format, so a
  `.png` original produces a WebP object named `.png`.

**Fix**: store the display name only in the database and use `originals/{id}/original` and
`derived/{presetId or slug}/{id}.{format}` as keys; percent-encode path segments when building
URLs.

### M7. Error mapping and validation

- `middleware/error-handler.ts:5-9` classifies errors by substring match on `error.message`. Use
  the PostgreSQL error code (`error.code === '23503'`, `'23505'`, `'22P02'`).
- Unique violation on `presets.name` (`23505`) returns 500; it should be 409.
- A non-UUID `:assetId` or `:id` reaches Postgres and fails with `22P02`, returning 500 instead of
  400/404 (`asset/controller.ts:61`, `preset/controller.ts:35`).
- Verified: `limit=abc` gives `NaN`, which Postgres rejects, again as 500; a negative `offset`
  also errors (`asset/controller.ts:38-39`).
- `validate` supports `query` and `params`, but no route defines schemas for them.
- Deleting a preset that has variants hits `ON DELETE RESTRICT` and returns the generic
  "Conflict: This resource is still in use." message.

### M8. Process lifecycle

- `server/src/index.ts:41-53` calls `closeAllConnections()` before `close()`, which terminates
  in-flight requests; graceful shutdown is meant to do the opposite (`close()`, then
  `closeIdleConnections()`, then a timeout before forcing). The `pg-promise` pool is also never
  ended.
- `GET /health` always returns 200 and the rate limiter also applies to it. Add a `SELECT 1`
  check and mount it before the limiter.
- The `try/catch` in `startServer` (lines 61-70) cannot catch listen errors (they are emitted as
  events).

### M9. Lifecycle gaps

- Presets cannot be updated (`updatePresetSchema` is dead code), cannot be deleted once used, and
  are not applied to existing assets. See [ADR 0004](../adr/0004-eager-preset-based-variants.md).
- `pending` assets from abandoned or failed uploads accumulate with nothing to sweep them.
- There is no way to delete an asset ([ADR 0012](../adr/0012-async-asset-deletion-via-cleanup-worker.md)).
  `lambdas/cleanup/src/handler.ts:32-35` also returns early when an asset has no variants, so
  failed or never-processed assets would still never be cleaned up if it were deployed.

### M10. Worker concurrency, memory and image quality

- **Database connections.** `pg-promise` defaults to a pool of 10 per container and the SQS event
  source mapping can scale Lambda concurrency up rapidly. A `db.t3.micro` has a small connection
  limit. Set `max: 1` in the Lambda connection config, add
  `scaling_config { maximum_concurrency = N }` to `aws_lambda_event_source_mapping`, and consider
  RDS Proxy.
- **Memory.** `handler.ts:59-88` runs every preset in parallel and each call builds a fresh
  `sharp(originalBuffer)`, decoding the full image once per preset. Build `const base =
  sharp(buf, { failOn: 'error', limitInputPixels })` once and use `base.clone()`, and cap parallelism
  (for example 2 to 3).
- **Orientation.** `sharp` drops EXIF metadata by default, and there is no `.rotate()`, so
  phone photos stored with an orientation tag come out sideways.
- **Resize behaviour** is the implicit `cover` crop and may upscale small images. Add
  `withoutEnlargement` and decide whether `fit` should be a preset field (H4).
- **Caching headers.** Derived objects are put without `CacheControl`. Their keys are immutable, so
  set `public, max-age=31536000, immutable`.
- The `sharp` version in `devDependencies` (`^0.34.4`) may differ from the layer's, which matters
  for native binary compatibility.

### M11. Terraform and AWS hygiene

- **Cost.** `vpc.tf:61-70` creates a NAT gateway only so a VPC-attached Lambda can reach S3. A free
  S3 gateway endpoint (`aws_vpc_endpoint` of type `Gateway`) on the private route table removes the
  need. The NAT gateway is likely the largest fixed line in the stack (estimate; check Cost
  Explorer). CloudFront has no `price_class` set (defaults to all edge locations).
- **Durability.** `rds.tf` sets no `storage_encrypted`, `backup_retention_period`,
  `performance_insights_enabled` or `final_snapshot_identifier`. With `skip_final_snapshot =
  false` (the default) a destroy is expected to fail for lack of a snapshot identifier.
- **S3.** No `aws_s3_bucket_public_access_block`, versioning, or lifecycle rule (at least abort
  incomplete multipart uploads and expire stale `originals/` that never produced variants).
- **Observability.** No CloudWatch alarms (DLQ depth, Lambda errors, EC2 and RDS health), no log
  group with retention for the Lambda (it will be created with no expiry), no structured logs or
  request IDs in the API.
- **State and tooling.** Local state (secrets inside), no `required_version`, `random` provider
  not declared in `main.tf`, `default_tags` not used, `.terraform.lock.hcl` ignored.
  `terraform fmt` drift in `s3_sqs.tf` and `terraform.tfvars`.
- **CloudFront.** Uses the legacy `forwarded_values` block; prefer a managed cache policy
  (`CachingOptimized`) plus a response headers policy. Missing keys return 403 because the bucket
  policy lacks `s3:ListBucket`.
- **Required variables.** `api_key` and `ssh_allowed_cidr` have no defaults, and the tracked
  `terraform.tfvars` does not set them, so `terraform plan -var-file=terraform.tfvars` stops to
  prompt for them.

### M12. Documentation drift

- README Terraform steps say to run from "the root directory" and the frontend steps from
  `frontend/`; they are `infrastructure/terraform` and `web/`.
- The example `terraform.tfvars` omits `api_key` and `ssh_allowed_cidr`; its layer ARN shows
  `node18` while the text requires Node 22.
- README says the presigned URL is "one-time". It is reusable for 1 hour ([ADR 0002](../adr/0002-direct-to-s3-uploads-with-presigned-urls.md)).
- No step builds the Lambda before `terraform apply`, and none loads `schema.sql` except by hand
  over SSH. The flow list skips step 7.
- `server/.env.example` has both `DB_NAME` and `DB_DATABASE`; the server reads only
  `DB_DATABASE`.
- `web/README.md` is the stock Vite template. `web/.env.example` and `server/rest.http` contain a
  real EC2 public hostname.
- The README does not mention the cleanup Lambda or that deletion is unfinished.

## Low

### L1. Tests, CI and formatting

There are no tests anywhere and no `.github/` workflows. Only `web/` has ESLint. Minimum useful CI:
`tsc --noEmit` for all four packages, `npm run build` and `lint` for `web/`, `terraform fmt
-check` and `terraform validate`, and a scanner such as `tflint` or `checkov`. The one failing
typecheck found in this audit (H3) would have been caught on the first run.

### L2. Duplication

`db.ts` exists three times; the `Asset`, `Variant` and `Preset` shapes are re-declared by hand in
`web/src/types`. Use npm workspaces with a shared package, or generate client types from an
OpenAPI or Zod schema.

### L3. Small items

- `auth.ts:6` uses `!==` for the secret comparison; use `crypto.timingSafeEqual`.
- `cors({ credentials: true })` is unnecessary since auth is a header, not a cookie.
- `express.urlencoded` is registered but no route consumes form posts.
- Express 5 forwards rejected promises from async handlers, so the per-handler `try/catch` +
  `next(error)` is redundant.
- `SELECT *` in list and detail endpoints exposes `processing_error` and S3 keys to every client.
- `useCreateAsset` logs to the console in `onSuccess`.
- Commented-out code paths for delete in `routes.ts`, `AssetCard.tsx` and `sqs.service.ts`; keep it
  behind the ADR 0012 work or remove it.
- `asset.size_bytes && ...` in `AssetCard.tsx:60` hides a legitimate zero.

## What is already good

- All SQL is parameterised; there is no string-built query.
- RDS is private, security groups reference each other, and the bucket is private behind OAC.
- Presigned uploads keep bytes off the API, with `ContentType` bound into the signature.
- SQS has a DLQ, a visibility timeout sized for the Lambda, and the handler uses
  `ReportBatchItemFailures`.
- Variant rows and the `processed` status are written in one transaction.
- Helmet, a CORS allow-list, rate limiting and an SSH CIDR variable are already in place.
- The schema has foreign keys, cascade/restrict choices, a status enum and `updated_at` triggers.
- The web app builds cleanly and its feature-based structure is easy to follow.

## Suggested order of work

1. **Today (about an hour)**: rotate the DB password; untrack `terraform.tfvars` and
   `.terraform/`; fix the Zod `errorMap` and add `noEmitOnError` (H2, H3).
2. **This week**: make `validate` return parsed data and fix quick-add presets (H4); decide the auth
   model and wire the client (H1); confirm and fix Lambda packaging with esbuild (H6); add
   idempotency to the worker (H5).
3. **Next**: HTTPS for the API and SPA hosting through CloudFront (H7), upload limits (H8), IAM
   scoping and Secrets Manager (M2, M3), S3 gateway endpoint instead of NAT (M11).
4. **Then**: pagination, thumbnails and status polling in the UI (M5); key and URL hygiene (M6);
   error codes and validation (M7); alarms and CI (M11, L1).
5. **Later**: asset deletion (ADR 0012), preset backfill, containerised deploys, remote Terraform
   state.

## Remediation status (2026-10-08)

Work done on branch `fix/audit-groups-abc`, covering everything that does not need an AWS account.
"Verified" means a command was run and its output checked; nothing has been applied to AWS.

| ID | Status | Notes |
| --- | --- | --- |
| H1 | Partly | The web client sends `X-Api-Key` when `VITE_API_KEY` is set. The key is still public in the bundle, so the auth model decision (ADR 0010) is open. |
| H2 | Partly | `terraform.tfvars` and `.terraform/` are untracked, an example file and the lock file are committed. **Still yours:** rotate the password that is in history, and decide whether to purge history. |
| H3 | Fixed | `npm run build` in `server/` exits 0; `noEmitOnError` is on. |
| H4 | Fixed | Verified against Postgres: a preset without `format`/`quality` returns 201 with defaults; Quick Add presets now send `quality`; `fit` removed. |
| H5 | Fixed in code | Claim-and-upsert handler, permanent vs transient errors, safe failure recording, `UNIQUE (asset_id, preset_id)`. The handler was type-checked and bundled; it has not been run against S3 and SQS. |
| H6 | Fixed | Both workers are bundled with esbuild; the bundle was inspected and contains `pg-promise` and the CA bundle (only `sharp`, the AWS SDK and the optional `pg-native` are external). |
| H7 | Fixed in Terraform | API served by CloudFront over HTTPS only; origin restricted to CloudFront. Not applied. Hosting the web app itself is still not in Terraform. |
| H8 | Fixed | Presigned POST with a size and content-type policy (policy contents verified); worker re-checks size and image validity. Not tested against real S3. |
| M1 | Fixed in code | CA bundle verified in API and workers. Not tested against RDS. |
| M2 | Not done | Needs a secrets design and runtime fetching. |
| M3 | Fixed in Terraform | Prefix-scoped IAM for the API host and worker. |
| M4 | Fixed in Terraform | Template with `set -euxo pipefail`, unprivileged user, systemd, `npm ci`, pinned git ref, EIP, IMDSv2, SSM. The script has not been booted. |
| M5 | Fixed | Pagination ("Load more"), thumbnails, status polling, upload validation and concurrency cap. Web builds and lints clean; not exercised in a browser. |
| M6 | Fixed | Opaque keys and encoded URLs (ADR 0002). |
| M7 | Fixed | Verified against Postgres: 409 for duplicates, 400 for bad UUIDs, `limit=abc`, malformed JSON; 404 for unknown ids. |
| M8 | Fixed | Graceful shutdown order, pool ended, `/health` checks the database. SIGTERM exit verified; the 503 path was not exercised. |
| M9 | Partly | Cleanup worker bug fixed and bundled. Preset update/backfill, pending-asset sweep and the delete route and infrastructure are not done (ADR 0012). |
| M10 | Fixed | One DB connection per worker container, concurrency cap, one decode with `clone()`, at most 3 parallel renders, EXIF auto-rotate (verified), `Cache-Control` on variants. |
| M11 | Mostly | Done: NAT replaced by S3 endpoint, RDS encryption/backups/final snapshot, S3 public access block/lifecycle/encryption, alarms, log retention, lock file, `required_version`, `random` provider, tags, managed CloudFront policies. Not done: remote state, WAF, VPC flow logs, bucket versioning, KMS keys, multi-AZ. Checkov: 119 passed, 33 failed (the accepted trade-offs above). |
| M12 | Fixed | README rewritten; `.env.example` files, `terraform.tfvars.example` and `rest.http` updated. `web/README.md` is still the Vite template. |
| L1 | Partly | `tsc`, builds, lint, `terraform fmt` and `validate` pass locally. There is still no CI and no tests (deferred by request). |
| L2 | Not done | Shared package or generated types. |
| L3 | Mostly | Constant-time key compare, `cors` credentials and `urlencoded` removed, redundant `try/catch` removed, list endpoint selects explicit columns, size `0` shown correctly, console logging removed. The commented-out delete code stays until ADR 0012 ships. |

### Database changes to apply

Fresh databases get everything from `server/schema.sql`. Any database created earlier needs
`server/migrations/0001_variant_uniqueness_and_preset_checks.sql`.

### Behaviour changes to know about

- `POST /api/v1/assets` now returns `{ assetId, upload: { url, fields } }` (a presigned POST form) instead of `signedUrl`.
- `GET /api/v1/assets` now returns `{ items, total, limit, offset }` instead of an array, and supports `limit` and `offset`.
- New originals and variants use opaque keys (`originals/{id}/original.{ext}`, `derived/{presetId}/{id}.{ext}`).
- The preset `fit` field was removed from the API.
- Terraform inputs changed: `api_key` and `lambda_layer_arn` are required, `db_password` and `api_key` are validated, SSH is optional, and the API is reachable only via CloudFront (`api_base_url` output).
