# 8. Run the API on a single EC2 instance behind CloudFront

- Status: Accepted
- Date: 2025-10-24 (updated 2026-10-08: CloudFront as the only entry point, systemd instead of PM2, hardened bootstrap)
- Deciders: Project maintainer

## Context

The API is a small stateless Express app: a few CRUD routes and a presign call. Early on the
goal was a working end-to-end system at low cost, with no requirement for high availability.
Browsers must call it over HTTPS (a page served over HTTPS cannot call a plain-HTTP API), and the API key
must not travel in clear text.

## Decision

Run the API on one `t3.small` Amazon Linux 2023 instance ([ec2.tf](../../infrastructure/terraform/ec2.tf)),
reachable only through the existing CloudFront distribution:

- **Entry point.** CloudFront forwards `/api/*` to the instance over HTTP on port 8080
  ([ADR 0005](0005-serve-images-through-cloudfront-with-oac.md)); viewers use HTTPS only. The security group
  accepts 8080 only from CloudFront's managed prefix list, so the port is not open to the internet. The
  app trusts one proxy hop (`TRUST_PROXY=1`) so rate limiting sees the real client address.
- **Stable address.** An Elastic IP is allocated before the instance; its public DNS name is the CloudFront
  origin. This also avoids a dependency cycle (the instance needs the CloudFront domain, CloudFront needs
  an origin). The IP survives stop and start.
- **Bootstrap.** `user_data` is the template
  [user_data.sh.tftpl](../../infrastructure/terraform/templates/user_data.sh.tftpl), run once at first
  boot with `set -euxo pipefail`. It installs Node.js 20 and git, creates an unprivileged `brandkit` user,
  clones `app_repo_url` at `app_git_ref` (a branch, tag or commit SHA), writes `server/.env` (mode 600,
  owned by that user), runs `npm ci`, `npm run build` and `npm prune --omit=dev`, installs a **systemd**
  unit, and finally waits for `/health` to succeed. A failed build or a service that does not start fails
  the script instead of leaving a half-working server.
- **Process management.** `brandkit-api.service` runs the compiled app as `brandkit` with `Restart=always`,
  `NoNewPrivileges`, `PrivateTmp` and `ProtectSystem=full`. PM2 is not used.
- **Host hardening.** The AMI is looked up (latest AL2023 x86_64) and not replaced on later AMI releases;
  IMDSv2 is required; the root volume is encrypted gp3 and EBS-optimised.
- **Access.** The instance profile allows only `s3:PutObject` under `originals/*` (to sign upload forms) and
  the SSM agent policy. Operators use Session Manager (`aws ssm start-session`); SSH is opened only if both
  `ssh_allowed_cidr` and `ec2_key_name` are set.

## Consequences

### Positive

- Cheap, fast to stand up and easy to debug.
- HTTPS everywhere on one domain, no CORS between images and API, and no public API port.
- The service no longer runs as root, secrets are readable only by the service user, and the boot fails
  loudly when something is wrong.
- Boots are reproducible when `app_git_ref` pins a tag or SHA, and the dependency install uses the lockfile.

### Negative

- `user_data` runs once, so shipping a change still means connecting (Session Manager), pulling, rebuilding and
  restarting the service. There is no deployment pipeline.
- The host clones from GitHub at boot, so the code must be pushed (and the repository reachable) before
  `terraform apply`.
- Secrets (DB password, API key) are still baked into `user_data` (readable by anyone who can describe the
  instance) and a `.env` file.
- One instance is a single point of failure, in one AZ.
- CloudFront reaches the origin over HTTP across the internet. The prefix list admits any CloudFront
  distribution, not just this one, so the API key remains the real access control.
- The in-memory rate limiter ([ADR 0010](0010-shared-api-key-authentication.md)) only works while there is
  exactly one instance.

## Alternatives considered

- **ECS Fargate or App Runner with a container image**: immutable deploys, health checks and
  rolling updates; worth moving to once there is a CI pipeline.
- **Lambda behind API Gateway or a function URL**: fits the stateless API and would reuse the
  existing tooling, at the cost of VPC cold starts for the database.
- **ALB + Auto Scaling group with ACM**: adds HA and TLS termination to the origin; heavier than the
  current need.
- **PM2**: used originally; systemd gives the same supervision with no extra dependency and proper
  sandboxing options.
- **A secret header between CloudFront and the origin**: would make the prefix list stricter; not
  implemented.
