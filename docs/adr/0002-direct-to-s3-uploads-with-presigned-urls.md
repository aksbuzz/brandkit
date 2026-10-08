# 2. Upload originals directly to S3 with presigned POST forms

- Status: Accepted
- Date: 2025-10-24 (updated 2026-10-08: presigned POST with size limit, opaque keys)
- Deciders: Project maintainer

## Context

Users upload images from the browser. The API runs on a single small EC2 instance
([ADR 0008](0008-single-ec2-api-server-behind-cloudfront.md)) and has no reason to see the bytes.
Images can be several megabytes each, and the UI allows multi-file drops.

The first version used a presigned `PUT`. That cannot carry a size limit, so the size the client
declared was never checked against the real object. It also put the user's filename into the S3 key,
which could yield URLs that did not map back to the object (`#`, `?`, `..`, very long names).

## Decision

The API never proxies file data. Uploading is a two-step flow:

1. `POST /api/v1/assets` with `{ filename, fileSizeBytes, contentType }`
   ([asset controller](../../server/src/features/asset/controller.ts)). The body is validated: type
   must be one of `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif`, the filename is
   trimmed and at most 255 characters, and the size must not exceed `MAX_UPLOAD_BYTES` (default 10 MiB).
2. The server generates a UUID and the key `originals/{assetId}/original.{ext}`, where the extension
   comes from the content type. It then signs an S3 **presigned POST** valid for 15 minutes
   ([s3.service.ts](../../server/src/services/s3.service.ts)) whose policy pins the key, requires
   `Content-Type` to equal the declared type, and sets `content-length-range` to `1..MAX_UPLOAD_BYTES`.
   Only after signing succeeds does it insert the `assets` row (`status = 'pending'`) and return
   `{ assetId, upload: { url, fields } }`.
3. The browser posts a multipart form (the signed fields, then the file as the last field) directly to S3
   ([use-upload-to-s3.tsx](../../web/src/hooks/use-upload-to-s3.tsx)). S3 rejects anything outside the
   policy. The browser also checks type and size before uploading and uploads at most three files at once.

The user's filename is stored only in `assets.original_filename`. It is never part of an S3 key, and URLs
are built with each path segment percent-encoded.

The bucket's CORS rule allows `POST` from `var.allowed_upload_origins` only
([s3_sqs.tf](../../infrastructure/terraform/s3_sqs.tf)). The EC2 role may only `s3:PutObject` under
`originals/*`, which is all it needs to sign forms.

The S3 upload itself is what triggers processing ([ADR 0003](0003-event-driven-image-processing-s3-sqs-lambda.md)).

## Consequences

### Positive

- The API instance carries no upload bandwidth or memory pressure and scales with S3.
- S3, not the client, enforces the size limit and content type, so oversized or mislabelled uploads
  cannot inflate storage or worker cost through this path.
- Keys are short, safe and predictable; URLs always resolve to the object.
- A signing failure cannot leave an orphan `pending` row, because the row is inserted after signing.

### Negative

- A presigned form is not one-time. It can be reused until it expires, and each `POST` to the same key
  emits another `ObjectCreated` event, so the worker must tolerate duplicates
  ([ADR 0003](0003-event-driven-image-processing-s3-sqs-lambda.md)).
- The limit is global. Per-user or per-plan limits would mean building the policy per request.
- A `pending` row is created before the upload happens. Uploads that are signed but never completed
  leave rows behind that nothing currently sweeps.
- Any API client other than the web app must send multipart form data to S3.

## Alternatives considered

- **Proxy the upload through the API (multer/busboy)**: simplest client, but ties up the EC2
  instance and caps throughput.
- **Presigned `PUT`**: simpler client, but no server-enforced size limit (the original design).
- **Multipart or resumable uploads (S3 multipart, tus)**: better for very large files, more
  client code. Not needed at the current size limits.
- **Sanitising the filename into the key**: keeps readable URLs but leaves edge cases (length,
  Unicode, collisions) to maintain.
