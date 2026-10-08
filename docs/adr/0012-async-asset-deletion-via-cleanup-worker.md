# 12. Delete assets asynchronously through a cleanup worker

- Status: Proposed (worker and groundwork written, not deployed or reachable)
- Date: 2025-10-24 (updated 2026-10-08: worker fixed, groundwork added)
- Deciders: Project maintainer

## Context

Deleting an asset means removing the original and every variant from S3 and then the database
rows. That is several round trips and can partly fail. The API should not hold a request open for
it, and the operation should be retryable.

## Decision

Deletion will mirror the upload pipeline ([ADR 0003](0003-event-driven-image-processing-s3-sqs-lambda.md)):

1. `DELETE /api/v1/assets/:assetId` marks the asset `deleting` (the enum value already exists in
   [schema.sql](../../server/schema.sql)) and sends `{ "assetId": "..." }` to a delete queue.
2. The `cleanup` Lambda ([handler.ts](../../lambdas/cleanup/src/handler.ts)) loads the original
   key and the variant keys, calls `DeleteObjects` in chunks of 1000 and checks the per-key errors, then
   deletes the `assets` row; `variants` follow through `ON DELETE CASCADE`. It handles assets that failed or
   never finished processing (no variants) as well as processed ones.
3. Failures are reported per message (`ReportBatchItemFailures`) so SQS retries them and they eventually
   reach a DLQ. Malformed messages are dropped.

### Current state

Already in place:

- The cleanup worker, with the fixes above, and the same bundled build as the image worker.
- The list and detail endpoints hide `deleting` assets, the web `AssetStatus` type includes `deleting`,
  and the worker role already allows `s3:DeleteObject` on `originals/*` and `derived/*`.

Still missing:

- The route and the UI delete button are commented out, and the `SendMessage` helper
  ([sqs.service.ts](../../server/src/services/sqs.service.ts)) is commented out and expects a
  `config.aws.sqs.deleteQueueUrl` that does not exist.
- Terraform has no delete queue, DLQ, cleanup Lambda, event source mapping or `sqs:SendMessage`
  permission for the EC2 role.

### To finish this ADR

- Provision the queue, DLQ, Lambda, mapping, alarm and IAM in Terraform.
- Wire the route (validate the UUID, mark `deleting`, enqueue) and the UI button.
- Decide whether to invalidate CloudFront for deleted keys or accept the cache TTL
  ([ADR 0005](0005-serve-images-through-cloudfront-with-oac.md)).
- Add a sweep for assets stuck in `pending` or `deleting`.

## Consequences

### Positive

- The API call returns quickly and deletion is retryable and idempotent in effect.
- Reuses the same operational pattern (SQS, Lambda, DLQ) as processing.

### Negative

- Another queue, Lambda and IAM surface to run and monitor.
- Eventual consistency: files may remain readable from the CDN until the TTL expires.
- Until it ships, there is no way to delete an asset, and abandoned `pending` rows and failed
  uploads are never reclaimed.

## Alternatives considered

- **Synchronous delete in the API**: simplest, but a partial failure leaves S3 and the database
  out of step and ties up a request.
- **Soft delete plus an S3 lifecycle rule**: cheap and reversible, but keeps data longer than
  users expect and needs a separate hard-delete path.
- **Database trigger or outbox table polled by a worker**: stronger consistency, more design
  than the current scale needs.
