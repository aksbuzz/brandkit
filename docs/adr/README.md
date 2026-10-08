# Architecture Decision Records

Short records of the architecture decisions behind BrandKit: what was decided, why, and what it
costs. Process and format are defined in [ADR 0001](0001-record-architecture-decisions.md) and
[0000-template.md](0000-template.md).

ADRs 0002 to 0012 were first written on 2026-10-07 from the code and git history, not from original
design notes, so context and alternatives are reconstructed; correct them if they differ from what
was actually intended. They were updated on 2026-10-08 to match the code after the audit fixes.
Nothing is deployed yet, so ADRs are edited in place until the first deployment (see ADR 0001).

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](0002-direct-to-s3-uploads-with-presigned-urls.md) | Upload originals directly to S3 with presigned POST forms | Accepted |
| [0003](0003-event-driven-image-processing-s3-sqs-lambda.md) | Process images with an S3 -> SQS -> Lambda pipeline | Accepted |
| [0004](0004-eager-preset-based-variants.md) | Generate variants eagerly from named presets | Accepted |
| [0005](0005-serve-images-through-cloudfront-with-oac.md) | Serve images through CloudFront with a private bucket (OAC) | Accepted |
| [0006](0006-postgresql-on-rds-with-raw-sql.md) | PostgreSQL on RDS, accessed with raw SQL | Accepted |
| [0007](0007-vpc-topology-public-api-private-data.md) | VPC with a public API subnet and private data subnets | Accepted |
| [0008](0008-single-ec2-api-server-behind-cloudfront.md) | Run the API on a single EC2 instance behind CloudFront | Accepted |
| [0009](0009-terraform-flat-root-module-with-local-state.md) | Flat Terraform root module with local state | Accepted |
| [0010](0010-shared-api-key-authentication.md) | Shared API key authentication | Accepted (interim) |
| [0011](0011-typescript-stack-and-feature-based-structure.md) | TypeScript end to end with a feature-based layout | Accepted |
| [0012](0012-async-asset-deletion-via-cleanup-worker.md) | Delete assets asynchronously through a cleanup worker | Proposed |

A point-in-time review of these decisions against the code is in
[../audit/2026-10-07-code-audit.md](../audit/2026-10-07-code-audit.md).
