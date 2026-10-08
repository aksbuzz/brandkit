# 4. Generate variants eagerly from named presets

- Status: Accepted
- Date: 2025-10-24 (updated 2026-10-08: key layout, validation, constraints)
- Deciders: Project maintainer

## Context

Brand teams need the same image in several fixed shapes (social post, banner, thumbnail).
The set of shapes is small and changes rarely, while images are read far more often than they
are uploaded.

## Decision

Users define **presets** (`name`, `width`, `height`, `format` in `jpeg|webp|png`, `quality`
1-100) through the API ([preset feature](../../server/src/features/preset/)). Input is validated and the
validated result is what the handler uses, so defaults apply (`format = jpeg`, `quality = 80`), unknown
keys are dropped, names are trimmed and limited to 100 characters, and each dimension is capped at 8192 px
to bound worker memory. The database repeats the basic rules as `CHECK` constraints.

Every upload is rendered once per preset by the worker ([ADR 0003](0003-event-driven-image-processing-s3-sqs-lambda.md)).
Each result is stored at `derived/{presetId}/{assetId}.{ext}` ([ADR 0002](0002-direct-to-s3-uploads-with-presigned-urls.md)
explains why keys avoid user-supplied text) and recorded as a `variants` row. A variant is linked to its
asset (`ON DELETE CASCADE`) and its preset (`ON DELETE RESTRICT`), and `UNIQUE (asset_id, preset_id)`
guarantees one variant per preset per asset ([schema.sql](../../server/schema.sql)). The row stores the
real output size reported by `sharp`.

Resizing uses `sharp`'s `cover` fit, which crops to the exact preset size. There is no per-preset `fit`
option; adding one needs a column and a worker change.

The asset list returns each asset's smallest variant as `thumbnail_url`, so the gallery does not download
originals ([asset controller](../../server/src/features/asset/controller.ts)).

## Consequences

### Positive

- Reads are plain CDN hits on stable URLs; no compute at request time and nothing to secure or
  scale on the read path.
- Output cost is predictable: number of presets x number of assets.
- Presets are data, so adding one needs no deployment.
- Re-processing an asset replaces its variants instead of duplicating them.

### Negative

- Storage and processing grow linearly with presets x assets, including shapes nobody uses.
- Presets are not applied retroactively. There is no backfill job, so assets uploaded before
  a preset existed never get that variant.
- `ON DELETE RESTRICT` means a preset that has produced any variant can no longer be deleted
  (the API answers `409`), and there is no update endpoint (`updatePresetSchema` exists but is unused).
- `cover` crops, which may not suit logos or wide banners; presets cannot choose `contain`.
- Presets are cached in the worker for 5 minutes, so a new preset can be missed by uploads
  that happen right after creating it.
- Variant URLs identify the preset by ID, not by a readable name.

## Alternatives considered

- **On-demand transformation behind the CDN** (CloudFront + Lambda@Edge or an image handler,
  or a SaaS such as imgix or Cloudinary): no wasted variants and arbitrary sizes, but adds
  request-time compute, cold starts and a cache-key design.
- **Hybrid** (eager for a few presets, lazy for the rest): more flexible, more complexity;
  a sensible next step if the preset list grows.
