# 10. Protect the API with a shared API key (interim)

- Status: Accepted (interim; revisit before any multi-user or public browser deployment)
- Date: 2026-02-21 (updated 2026-10-08: client support, constant-time compare, proxy trust)
- Deciders: Project maintainer

## Context

The first version of the API had no authentication at all. A quick control was needed to stop
anonymous callers from creating presets, uploading and listing assets. There are no user
accounts in the data model.

## Decision

- `/api/v1/*` is guarded by `requireApiKey`
  ([auth.ts](../../server/src/middleware/auth.ts)): the `X-Api-Key` request header must equal
  the `API_KEY` environment variable, otherwise the API answers `401`. The comparison hashes both values
  and uses a constant-time check. `GET /health` is left open and is not rate limited.
- The key is a sensitive Terraform variable (`api_key`, at least 24 characters) written into the server's
  `.env` at boot ([ADR 0008](0008-single-ec2-api-server-behind-cloudfront.md)).
- The web client sends the header when `VITE_API_KEY` is set
  ([api-client.ts](../../web/src/lib/api-client.ts)). That value is compiled into the public JavaScript
  bundle, so this is acceptable only for an internal deployment.
- Complementary controls in [index.ts](../../server/src/index.ts): `helmet`, a CORS allow-list
  from `ALLOWED_ORIGINS` (without credentials), `express-rate-limit` at 200 requests per 15 minutes per
  client IP (in-memory), a 100 kB JSON body limit, and `TRUST_PROXY=1` so the client IP comes from CloudFront's
  forwarded header. The API host's security group accepts traffic only from CloudFront, and CloudFront serves
  the API over HTTPS only, so the key is never sent in clear text.

## Consequences

### Positive

- One small middleware, no new infrastructure, and it stops casual or automated abuse.
- Works for server-to-server callers and tools such as `curl` or the `rest.http` file.
- The key is no longer exposed on the wire.

### Negative

- It is a single shared secret: no identity, no per-user authorisation, no audit trail and no
  rotation procedure (changing it means redeploying the server and rebuilding the web app).
- A browser app cannot keep a secret. Any key given to the React app ships in the bundle and is readable by
  every visitor, so for a public or multi-user app this offers no real protection.
- The CloudFront prefix list admits any CloudFront distribution; the API key is the only thing that stops
  someone else's distribution from calling the API.
- The in-memory rate limiter is per process and keyed by IP, which is coarse behind shared NATs.

## Alternatives considered

- **User authentication with Cognito or another OIDC provider, validating JWTs in Express**:
  the proper fix for a browser client; also enables per-user ownership of assets and presets.
- **A backend-for-frontend that holds the key server-side** and authenticates users with
  cookies.
- **API Gateway with usage plans and API keys**: managed throttling and keys, but keys still
  cannot be hidden in a SPA.
- **Network-level restriction (VPN, private ALB, CloudFront with an origin secret)**: viable
  for an internal tool.
