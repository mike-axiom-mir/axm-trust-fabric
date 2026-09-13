# Interoperability External-Independence Guard v1

Status: **FALSIFIER FIRST / EVIDENCE-GOVERNANCE EXPERIMENT**

## Question

Can Trust Fabric mechanically prevent its same-repository JavaScript + Go portability evidence from being described as external, third-party, separately authored protocol conformance before such evidence actually exists?

This experiment does not add a protocol primitive. It protects the claim boundary exposed by the current interoperability work.

## Falsifier

The experiment fails if any of the following is true:

1. `INTEROPERABILITY.md` can lose the explicit statement that external/third-party independence is not established and CI still passes.
2. The public `README.md` can lose its explicit statement that third-party or separately authored protocol conformance is not implemented and CI still passes.
3. The guard treats same-repository fixed-vector agreement as proof of broad conformance, production security, global freshness, synchronization, consensus, or AXM-wide CANON.
4. Enforcing the boundary changes runtime trust decisions, signed packet formats, donor behavior, cryptographic authority, or the authored protocol-case count.
5. The guard proves only that its own machine-readable declaration contains the boundary rather than checking the human-facing documents where an overclaim could appear.
6. A repository merge is interpreted as external validation or AXM-wide CANON promotion.

## Bounded target

Extend the existing evidence-consistency meta-guard so CI directly checks the already-published held-state language in `INTEROPERABILITY.md` and `README.md`.

The guarded interoperability claims must continue to say, in substance and in exact required phrases, that:

- current cross-language agreement is **same-repository evidence**;
- it is **not evidence of third-party independence**;
- the strongest next boundary requires genuinely external or separately authored reproduction;
- adding more same-repository vectors must not be mistaken for external independence; and
- the public README still lists third-party or separately authored protocol conformance as not implemented.

The meta-guard remains outside the protocol/security case count.

## Root boundary

- **Truth:** do not upgrade same-repository agreement into external independence.
- **Agency / non-domination:** the guard grants no signer, verifier, maintainer, repository, or implementation authority.
- **Continuity:** runtime code, signed evidence, protocol history, and donor boundaries remain unchanged.
- **Wisdom before speed:** preserve the honest hold before seeking broader interoperability claims.

Repository merge is not AXM-wide CANON.
