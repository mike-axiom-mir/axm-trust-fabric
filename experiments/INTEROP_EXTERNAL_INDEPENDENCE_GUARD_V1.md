# Interoperability External-Independence Guard v1

Status: **FALSIFIER FIRST / EVIDENCE-GOVERNANCE EXPERIMENT**

## Question

Can Trust Fabric mechanically prevent its same-repository JavaScript + Go portability evidence from being described as external, third-party, separately authored protocol conformance before such evidence actually exists?

This experiment does not add a protocol primitive. It protects the claim boundary exposed by the current interoperability work.

## Falsifier

The experiment fails if any of the following is true:

1. `INTEROPERABILITY.md` can lose the explicit statement that external/third-party independence is not established and CI still passes.
2. The public `README.md` can imply that same-repository JavaScript + Go agreement is third-party or separately authored external conformance and CI still passes.
3. The guard treats same-repository fixed-vector agreement as proof of broad conformance, production security, global freshness, synchronization, consensus, or AXM-wide CANON.
4. Enforcing the boundary changes runtime trust decisions, signed packet formats, donor behavior, cryptographic authority, or the authored protocol-case count.
5. The guard proves only that its own machine-readable declaration contains the phrase, rather than checking the human-facing documents where an overclaim could appear.
6. A repository merge is interpreted as external validation or AXM-wide CANON promotion.

A deliberate guard-first branch state should fail until the public documents carry the exact held-state marker required by the consistency contract.

## Bounded target

Add one CI meta-check that binds an explicit held state to both interoperability documentation and the public README:

`EXTERNAL_INTEROPERABILITY_NOT_ESTABLISHED`

The marker means only that current JavaScript + Go agreement was produced inside this repository and is not evidence of an independently authored external implementation.

The guard remains outside the protocol/security case count.

## Root boundary

- **Truth:** do not upgrade same-repository agreement into external independence.
- **Agency / non-domination:** the guard grants no signer, verifier, maintainer, repository, or implementation authority.
- **Continuity:** runtime code, signed evidence, protocol history, and donor boundaries remain unchanged.
- **Wisdom before speed:** preserve the honest hold before seeking broader interoperability claims.

Repository merge is not AXM-wide CANON.
