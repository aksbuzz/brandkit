# 3. Process images with an S3 -> SQS -> Lambda pipeline

- Status: Accepted
- Date: 2025-10-24 (updated 2026-10-08: idempotent handler, bundled artifact, concurrency limits, alarms)
- Deciders: Project maintainer

## Context

Each upload must be turned into several resized variants. Resizing is CPU and memory heavy
(`sharp`), bursty, and has no need to run inside the request path. We want retries, a place for
poison messages to land, and no processing load on the API instance. SQS and S3 both deliver
at least once, so the worker has to tolerate duplicates.

## Decision

Processing is event-driven and asynchronous:

1. S3 sends `s3:ObjectCreated:*` for the `originals/` prefix to the SQS queue
   `brandkit-main-queue` ([s3_sqs.tf](../../infrastructure/terraform/s3_sqs.tf)). Queues use SQS-managed
   encryption.
2. The queue has a 1800 s visibility timeout (6x the Lambda timeout) and a redrive policy to
   `brandkit-main-dlq` after 3 receives. The DLQ keeps messages for 14 days.
3. An event source mapping invokes the `brandkit-worker` Lambda with **one message per invocation**
   (`batch_size = 1`), at most `worker_max_concurrency` (default 5) at a time, with
   `ReportBatchItemFailures` ([lambda.tf](../../infrastructure/terraform/lambda.tf)). The function runs
   Node.js 22, 2048 MB, 300 s, in the private subnets ([ADR 0007](0007-vpc-topology-public-api-private-data.md)).
4. The code is bundled with esbuild into a single `dist/handler.js` that includes `pg-promise` and the
   RDS CA bundle; only `sharp` is external (from a Lambda layer) and the AWS SDK comes from the runtime
   ([ADR 0009](0009-terraform-flat-root-module-with-local-state.md)).
5. The handler ([handler.ts](../../lambdas/image-processor/src/handler.ts)):
   - ignores messages without S3 records (such as `s3:TestEvent`) and objects whose key is not
     `originals/{uuid}/...`;
   - **claims** the asset with a conditional update (`pending`, `processing` or `failed` -> `processing`).
     An unknown asset, or one that is already `processed` or `deleting`, means a duplicate or stale
     message and is acknowledged without work;
   - rejects originals larger than `MAX_ORIGINAL_BYTES` (from the S3 event, then `ContentLength`) and
     files that do not decode as an image;
   - loads presets (5 minute in-memory cache), decodes the image once with EXIF auto-rotation, renders
     the presets with at most 3 in parallel, and uploads each to `derived/{presetId}/{assetId}.{ext}`
     with `Cache-Control: public, max-age=31536000, immutable`;
   - upserts the `variants` rows (`ON CONFLICT (asset_id, preset_id) DO UPDATE`) and sets
     `status = 'processed'` in one transaction.
6. Errors are classified. **Permanent** ones (too large, not an image, a preset that cannot be rendered)
   set `status = 'failed'` with a readable `processing_error` and acknowledge the message. **Transient**
   ones (S3, database) set `failed` with a generic message, then fail the message so SQS retries it and
   eventually moves it to the DLQ. Recording a failure never throws, so one bad record cannot fail others.

Asset states: `pending` -> `processing` -> `processed` | `failed`
(`deleting` is reserved, see [ADR 0012](0012-async-asset-deletion-via-cleanup-worker.md)).

Alarms ([monitoring.tf](../../infrastructure/terraform/monitoring.tf)) notify an SNS topic when the DLQ
is not empty, the oldest queued message is older than 15 minutes, or the function reports errors.
The worker's log group is created with a retention period.

## Consequences

### Positive

- Uploads return immediately; processing scales out and absorbs bursts in the queue.
- Duplicate events, retries and reused upload forms are harmless: a finished asset is never reset or
  failed, and variants are replaced rather than conflicting.
- A slow or broken image cannot time out or retry its neighbours, and each failure has a reason.
- Concurrency is capped and each container holds one database connection, so the worker cannot
  exhaust a small database.
- Failures reach people through alarms instead of waiting for someone to notice a `failed` asset.

### Negative

- With one message per invocation and capped concurrency, throughput is bounded (about five images at
  a time by default). Raise `worker_max_concurrency` together with the database size.
- A re-upload to the same key after the asset is `processed` is not reprocessed. Replacing an image
  means creating a new asset.
- The worker records only a generic message for transient failures, so the cause is found in CloudWatch.
- The Lambda runtime does not include `sharp`; it comes from a manually created layer.
- No tracing, and no metric for how long an asset takes from upload to `processed`.

## Alternatives considered

- **S3 -> Lambda directly**: fewer moving parts, but no buffering or concurrency control and
  only the asynchronous-invoke retry behaviour.
- **Process inside the API server**: couples request latency and instance size to image work.
- **Step Functions or EventBridge**: more observability and orchestration than a single
  step needs.
- **Larger batches**: better throughput per invocation, but a timeout would redeliver every message
  in the batch.
- **On-demand transformation at request time**: see [ADR 0004](0004-eager-preset-based-variants.md).
