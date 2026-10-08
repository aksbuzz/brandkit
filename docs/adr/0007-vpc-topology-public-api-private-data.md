# 7. VPC with a public API subnet and private data subnets

- Status: Accepted
- Date: 2025-10-24 (updated 2026-10-08: NAT gateway replaced by an S3 gateway endpoint, tighter security groups)
- Deciders: Project maintainer

## Context

The API must be reachable by browsers. The database and the image worker must not be. The
worker needs the database (inside the VPC) and S3 (outside it). SQS polling and CloudWatch Logs delivery
are performed by the Lambda service itself, so they do not need a network path from the function.

## Decision

One VPC (`10.0.0.0/16`, [vpc.tf](../../infrastructure/terraform/vpc.tf)) with:

| Subnet | CIDR | AZ | Holds |
| --- | --- | --- | --- |
| public | 10.0.2.0/24 | first AZ | EC2 API server |
| private_a | 10.0.1.0/24 | first AZ | RDS, Lambda |
| private_b | 10.0.3.0/24 | second AZ | RDS (subnet group needs two AZs), Lambda |

The public route table sends `0.0.0.0/0` to an internet gateway. The private subnets have **no route to
the internet**: their route table contains only the route added by an **S3 gateway endpoint**, which is how
the Lambda reads and writes images. There is no NAT gateway. VPC endpoints for other services are not used.

Security groups ([sg.tf](../../infrastructure/terraform/sg.tf)) reference each other rather than CIDRs:

- `ec2_sg`: 8080/tcp only from CloudFront's origin-facing managed prefix list
  ([ADR 0008](0008-single-ec2-api-server-behind-cloudfront.md)); 22/tcp only if `ssh_allowed_cidr` is set;
  all egress (the host installs packages and clones the repository).
- `rds_sg`: 5432/tcp from `ec2_sg` and `lambda_sg` only, and no egress rules.
- `lambda_sg`: no ingress; all egress.
- The VPC's default security group has every rule removed.

## Consequences

### Positive

- The data tier has no route from the internet; reaching it requires a compromised EC2 or Lambda.
- A compromised worker cannot call out to the internet, because its subnets have no route.
- No NAT gateway means no hourly or per-GB NAT charge and one fewer single-AZ dependency.
- Security-group-to-security-group rules survive IP changes, and the API port is not open to the world.

### Negative

- Anything added later that needs the internet or another AWS API from a private subnet (a third-party
  service, Secrets Manager) needs a NAT gateway or an interface endpoint then.
- One public subnet means the API host is single-AZ; an AZ failure takes it down.
- The worker's egress rule is still wide open. Tightening it to the database and the S3 prefix list needs
  separate rule resources to avoid a dependency cycle with `rds_sg`.
- There are no VPC flow logs.

## Alternatives considered

- **NAT gateway for the private subnets**: simple and flexible, but paid for a capability the worker does
  not use (the original design).
- **Lambda outside the VPC**: removes any VPC networking for the worker, but then the database would need
  a public endpoint or a data API/proxy, which is worse.
- **API in a private subnet behind an ALB**: the usual production layout; costs an ALB and
  needs a certificate.
