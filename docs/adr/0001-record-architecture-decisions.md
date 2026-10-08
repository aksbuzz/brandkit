# 1. Record architecture decisions

- Status: Accepted
- Date: 2026-10-07 (updated 2026-10-08)
- Deciders: Project maintainer

## Context

BrandKit spans an Express API, two Lambda workers, a React app and a Terraform stack. The
reasoning behind the main choices (why S3 + SQS + Lambda, why EC2, why a shared API key) lived
only in the original author's head and in the commit history. ADRs 0002 to 0012 were first written
retroactively from the code on 2026-10-07, so the "why" in them is reconstructed rather than quoted.
Anyone who remembers a different rationale should correct the record.

Those ADRs were then brought in line with the code after the first code audit
([docs/audit](../audit/2026-10-07-code-audit.md)). Nothing has been deployed to AWS yet, so there is
no running system whose history needs preserving.

## Decision

We will keep Architecture Decision Records in `docs/adr/`, one file per decision, using the
format in [0000-template.md](0000-template.md).

- Files are named `NNNN-short-title.md` with a zero-padded, never-reused number.
- **Before the first deployment**, an ADR is edited in place so it always describes the design as it
  is built. Note significant revisions in the `Date` line.
- **After the first deployment**, an Accepted ADR is only edited for typos and status. To change a
  decision, write a new ADR and mark the old one `Superseded by NNNN`.
- Write an ADR when a choice is expensive to reverse or would surprise a new contributor:
  new AWS service, data model shape, auth model, deployment target, major dependency.
- Link the ADR from the pull request that implements it.
- Update the index in [README.md](README.md) in the same change.

## Consequences

### Positive

- New contributors can learn the system's shape and constraints without archaeology.
- Trade-offs that were accepted on purpose are distinguishable from oversights.
- While the design is still moving, the ADRs never describe something that no longer exists.

### Negative

- A small recurring cost: each significant change needs a short write-up.
- Retroactive ADRs can drift from original intent; mitigated by the correction rule above.
- Editing in place loses the record of what was decided first. That is acceptable only until the
  first deployment; git history keeps the earlier text.

## Alternatives considered

- **Keep everything in the README**: it already describes components and flows, but it mixes
  "what exists" with "why", and it gets rewritten rather than appended to.
- **Wiki or issue tracker**: decisions would live apart from the code and be harder to review
  alongside the change that implements them.
- **Always supersede, never edit**: the usual rule, but it would leave a chain of obsolete ADRs
  for a system that has never run.
