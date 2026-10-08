# 9. Provision with a flat Terraform root module and local state

- Status: Accepted
- Date: 2025-10-24 (updated 2026-10-08: pinned providers, untracked secrets, input validation, bundled worker)
- Deciders: Project maintainer

## Context

All infrastructure is AWS in one region and one environment. The team is small and wants a
single command to create or destroy the whole stack. Nothing has been deployed yet.

## Decision

- Infrastructure lives in [infrastructure/terraform](../../infrastructure/terraform/) as one
  flat root module with a file per concern: `vpc`, `sg`, `iam`, `rds`, `s3_sqs`, `lambda`,
  `cloudfront`, `ec2`, `monitoring`, `outputs`, plus `templates/user_data.sh.tftpl`.
- Terraform `>= 1.5`. Providers: `hashicorp/aws ~> 6.18.0`, `hashicorp/archive ~> 2.7` and
  `hashicorp/random ~> 3.6`, all declared. `.terraform.lock.hcl` **is committed** with hashes for Windows,
  Linux and macOS (Intel and Apple silicon), so every machine uses the same provider builds.
- Region defaults to `ap-south-1`. Resource names are prefixed with `var.project_name`, and the provider's
  `default_tags` add `Project` and `ManagedBy` to everything.
- State is local. `*.tfstate*`, `.terraform/` and `terraform.tfvars` are git-ignored **and untracked**.
  [terraform.tfvars.example](../../infrastructure/terraform/terraform.tfvars.example) documents every input.
- Required inputs with no default: `db_username`, `db_password`, `lambda_layer_arn`, `api_key`.
  `db_password` and `api_key` are `sensitive` and validated (minimum length and a character set that is
  safe in the dotenv file the server reads). SSH inputs are optional.
- The worker is bundled with esbuild into `lambdas/image-processor/dist` (`npm run build`), zipped by
  `data.archive_file` to `infrastructure/terraform/dist/worker.zip` (without the source map), and deployed
  with `source_code_hash`. The bundle contains `pg-promise` and the RDS CA bundle; the AWS SDK comes from the
  runtime.
- `sharp` is not in the zip. It comes from a Lambda layer that the operator builds by hand from a
  community release and passes in as `lambda_layer_arn` (Node.js 22, x86_64).
- `skip_final_snapshot` (default `false`) controls both the final snapshot name and `deletion_protection`
  on RDS, so a stack can only be destroyed in two steps unless it is explicitly marked throwaway.
- The checks that need no AWS credentials are `terraform fmt -check`, `terraform validate` and a static
  scan (checkov); see the README.

## Consequences

### Positive

- Everything is readable in a handful of files; `plan`/`apply`/`destroy` are one step each.
- Secrets stay out of git, and weak or malformed secrets are rejected at plan time.
- Provider versions are identical on every machine.
- The Lambda artifact is self-contained apart from `sharp`, so deploys do not depend on what a layer
  happens to contain.
- Source-hash based deploys mean Lambda updates only when code changes.

### Negative

- Local state has no locking, no sharing and no history, and it contains secrets in clear text.
  One lost laptop or two concurrent applies is enough to cause trouble.
- The `sharp` layer is a manual prerequisite.
- The worker must be built before `terraform plan`, or `archive_file` fails (the README says so).
- The server host clones this repository at boot, so the commit it should run must be pushed first.
- The password that was committed in the first two commits is still in git history. Treat it as leaked and
  never reuse it.
- One environment only; there is no staging copy to test changes against.
- Several static-scan findings are accepted for cost or scope: single-AZ database, no WAF or CloudFront
  logging, no VPC flow logs, no customer-managed KMS keys, no bucket versioning.

## Alternatives considered

- **Remote state in S3 with locking (or Terraform Cloud)**: the standard fix for the state concerns above;
  the next step before more than one person applies.
- **Modules per layer or environment**: worthwhile once there is a second environment.
- **A layer containing every dependency**: avoids bundling, but ties the function to a manual artifact.
- **CDK, SAM or Serverless Framework**: better Lambda ergonomics; would add a second IaC tool
  next to Terraform.
