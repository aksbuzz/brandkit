# 5. Serve images through CloudFront with a private S3 bucket (OAC)

- Status: Accepted
- Date: 2025-10-27 (updated 2026-10-08: managed policies, API behaviour, cache headers)
- Deciders: Project maintainer

## Context

Images are viewed by users around the world and should load quickly and over HTTPS. The bucket must not
be publicly listable or writable.

## Decision

All reads go through one CloudFront distribution
([cloudfront.tf](../../infrastructure/terraform/cloudfront.tf)):

- **Images (default behaviour).** The origin is the bucket's regional domain, accessed with an Origin
  Access Control (`sigv4`, `signing_behavior = always`). It uses AWS's managed
  `CachingOptimized` cache policy (honours the origin's `Cache-Control`, compresses, ignores query
  strings and cookies) and `SecurityHeadersPolicy`, and redirects viewers to HTTPS.
- **API (`/api/*`).** A second, custom origin (the API host's Elastic IP DNS name, HTTP on 8080) with
  caching disabled, all viewer headers forwarded (including `X-Api-Key` and CORS headers), all methods
  allowed and `https-only` for viewers. See [ADR 0008](0008-single-ec2-api-server-behind-cloudfront.md).
- The bucket policy ([s3_sqs.tf](../../infrastructure/terraform/s3_sqs.tf)) grants `s3:GetObject` only to
  the CloudFront service principal, conditioned on this distribution's ARN. The bucket also has all
  public access blocked, owner-enforced ownership, SSE-S3 encryption and a lifecycle rule that aborts
  incomplete multipart uploads. Writes happen only through presigned uploads
  ([ADR 0002](0002-direct-to-s3-uploads-with-presigned-urls.md)) and the worker's IAM role.
- The distribution uses the default `*.cloudfront.net` certificate and `price_class` `PriceClass_200`
  (configurable).
- The API builds URLs as `https://{AWS_CLOUDFRONT_DOMAIN_NAME}/{s3_key}` for originals, variants and
  thumbnails ([asset controller](../../server/src/features/asset/controller.ts)).
- The worker writes variants with `Cache-Control: public, max-age=31536000, immutable`; their keys contain
  the asset and preset IDs and never change.

## Consequences

### Positive

- The bucket stays private and the only public read path is cached and HTTPS-only.
- Derived keys are immutable and now advertise it, so browsers and the CDN can cache them for a year.
- Images and API share one HTTPS domain, which avoids mixed content and CORS between them.

### Negative

- URLs are bearer URLs: anyone who has one can fetch the image, and nothing expires them.
  There is no per-asset or per-user access control. Acceptable only while assets are meant to be
  shareable brand material.
- Because the policy does not grant `s3:ListBucket`, a missing key returns 403 rather than 404.
- No custom domain (so no custom certificate or minimum TLS version beyond the CloudFront default),
  WAF, access logging or origin failover.
- Deleting an asset leaves cached copies reachable until their TTL expires unless an
  invalidation is issued ([ADR 0012](0012-async-asset-deletion-via-cleanup-worker.md)).
- Because originals are cached for the default TTL, replacing an object at the same key would show stale
  content; the design avoids that by never overwriting keys.

## Alternatives considered

- **Public bucket or S3 website hosting**: simplest, but exposes the bucket and loses HTTPS on
  a custom path.
- **Presigned GET URLs per request**: strong access control, but defeats CDN caching because
  every URL is unique.
- **CloudFront signed URLs or cookies**: the right upgrade if per-user access is required.
- **A separate distribution for the API**: cleaner separation, but two domains and CORS between them.
