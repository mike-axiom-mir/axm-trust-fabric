# AXM Trust Fabric

Status: **RESEARCH / v0.1 reference implementation**

AXM Trust Fabric experiments with one narrow question:

> Can AXM prove that an explicitly trusted key authorized an exact subject to perform an exact action for an exact scope, without turning identity into centralized ownership, permanent surveillance, global accounts, or blanket trust?

It is a local-first cryptographic authorization primitive. It is **not** an identity provider, reputation system, truth oracle, account service, blockchain, or automatic authority escalator.

## Constitutional merge gate

AXM's merge gate is the four roots:

1. **Truth** — claims must not outrun evidence; unknowns and conflicts remain visible.
2. **Agency / non-domination** — possession of a key must not create hidden or inherited authority beyond explicit scope.
3. **Continuity** — source identity, lineage, donor boundaries, rollback, and old evidence must remain preservable.
4. **Wisdom before speed** — narrow falsifiable primitives outrank premature infrastructure.

No human or machine actor is the constitutional merge gate by category. A grounded change either satisfies the roots or it does not. Repository merge is not automatic CANON promotion.

## v0.1 implemented

- Ed25519 keypairs using Node's built-in cryptography.
- Deterministic canonical JSON subset for signed bytes.
- Signed envelopes with explicit issuer, time window, nonce, body, and signature.
- Caller-supplied trusted root issuers: an arbitrary key cannot self-authorize merely by signing a grant.
- Scoped capability grants: exact subject, target, and action set.
- Delegation chains with exact parent binding and narrowing ceilings.
- One-use grants are non-delegable in v0.1 so a one-use parent cannot multiply into several children.
- Issuer-signed revocation packets for exact capability IDs, with a hold if a revocation would expire before the capability.
- Subject-signed capability-use requests, separating a valid grant from proof that the current actor controls the granted subject key.
- Explicit `CLOCK_UNKNOWN` hold rather than pretending offline time is trusted.
- Optional one-use capabilities with **local-only** replay detection.
- Separate claim-state labels for integrity, authorship, authority, identity continuity, and truth.
- A fixed non-secret interoperability vector that locks one key, canonical unsigned envelope, digest, signature, and scoped evaluation result.
- A second evidence-only verifier implementation that does not import the reference core and reproduces that fixed vector plus bounded negative cases.

## v0.1 intentionally not implemented

- global accounts or legal identity;
- reputation or social ranking;
- centralized trust servers;
- automatic recovery of a lost root key;
- globally authoritative time;
- cross-device replay prevention while devices are disconnected;
- key rotation/recovery claims beyond the documented research contract;
- third-party or cross-language protocol conformance;
- content truth or safety verification;
- automatic CANON, install, migration, or permission escalation.

## Run locally

Requires Node 20+ and no package installation.

```bash
npm test
```

## Core files

- `TRUST_MODEL.md` — semantic contract and root boundary.
- `IDENTITY_VS_AUTHORITY.md` — separates the five claim dimensions.
- `KEY_ROTATION.md` — unimplemented rotation/recovery research contract.
- `INTEROPERABILITY.md` — deterministic vector, separate-verifier experiment, falsifier, and truth boundary.
- `experiments/INDEPENDENT_VERIFIER_V1.md` — question and falsifier recorded before implementation.
- `schema/` — machine-readable envelope, grant, revocation, and use-body schemas.
- `src/trust-core.js` — dependency-free reference implementation.
- `independent/vector-verifier-v1.js` — separate evidence-only verifier for the fixed vector; not the runtime core.
- `tests/trust-core.test.js` — executable adversarial fixtures.
- `tests/interop-vector.test.js` — locks the deterministic vector against the reference implementation and Node's Ed25519 verifier.
- `tests/independent-interop.test.js` — proves the second implementation path stays dependency-separated and reproduces/refuses the bounded vector cases.
- `evidence/adversarial_matrix.json` — what is proven, held, and unresolved.
- `evidence/interop_vector_v1.json` — fixed reproducible bytes and expected results; the included private seed is test-only and must never be real authority.
- `donors/` — bounded donor mappings; donors are not rewritten by this repo.

## Evidence level

Current claim: **fixture-tested local reference implementation with a deterministic vector reproduced by two same-repository code paths**.

`npm test` runs 21 trust-core fixtures, the reference-vector check, and 6 separate-verifier checks. The second verifier is source-level independent from `src/trust-core.js`, but it remains authored in the same repository and uses the same Node runtime. This is stronger than a single-code-path fixture and weaker than external or cross-language interoperability evidence.

The evidence does not establish hostile-deployment security, hardware-backed key custody, globally fresh revocation, trustworthy clocks, legal/human identity, informed consent, content truth, or AXM-wide CANON status.
