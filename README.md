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
- A supplied valid ancestor revocation invalidates authorization through a required delegation chain at that ancestor, without pretending the descendant packet itself was directly revoked.
- A bounded signed revocation-checkpoint experiment that binds an issuer's exact supplied revocation manifest to a historical `completeThrough` timestamp and distinguishes active attestation, stale checkpoint, unknown clock, wrong issuer, and manifest mismatch without claiming globally current revocation knowledge.
- Subject-signed capability-use requests, separating a valid grant from proof that the current actor controls the granted subject key.
- Explicit `CLOCK_UNKNOWN` hold rather than pretending offline time is trusted.
- Optional one-use capabilities with **local-only** replay detection.
- Separate claim-state labels for integrity, authorship, authority, identity continuity, and truth.
- A fixed non-secret interoperability vector that locks one key, canonical unsigned envelope, digest, signature, and scoped evaluation result.
- A second evidence-only JavaScript verifier that does not import the reference core and reproduces that fixed vector plus bounded negative cases.
- A Go standard-library verifier that independently reproduces the same fixed vector and bounded refusals without importing or executing either JavaScript verifier.

## v0.1 intentionally not implemented

- global accounts or legal identity;
- reputation or social ranking;
- centralized trust servers;
- automatic recovery of a lost root key;
- globally authoritative time;
- globally fresh revocation knowledge or automatic revocation synchronization;
- treating a checkpoint's historical `completeThrough` as proof that no newer revocation exists;
- automatic capability-authorization dependence on the checkpoint research primitive;
- delegated or threshold revokers;
- cross-device replay prevention while devices are disconnected;
- key rotation/recovery claims beyond the documented research contract;
- third-party or separately authored protocol conformance;
- broad conformance beyond the published root-capability vector;
- content truth or safety verification;
- automatic CANON, install, migration, or permission escalation.

## Run locally

JavaScript reference, checkpoint, and separate-verifier checks require Node 20+ and no package installation:

```bash
npm test
```

Cross-language evidence requires Go 1.23+ and no third-party modules:

```bash
cd crosslang/go
go test ./...
```

CI runs both suites independently.

## Core files

- `TRUST_MODEL.md` — semantic contract and root boundary.
- `IDENTITY_VS_AUTHORITY.md` — separates the five claim dimensions.
- `KEY_ROTATION.md` — unimplemented rotation/recovery research contract.
- `INTEROPERABILITY.md` — deterministic vector, verifier experiments, falsifiers, and truth boundary.
- `experiments/ANCESTOR_REVOCATION_V1.md` — falsifier-first ancestor-chain revocation experiment.
- `experiments/REVOCATION_CHECKPOINT_V1.md` — falsifier-first historical revocation-manifest checkpoint experiment.
- `experiments/INDEPENDENT_VERIFIER_V1.md` — same-language verifier question and falsifier.
- `experiments/CROSS_LANGUAGE_VERIFIER_V1.md` — Go verifier question and falsifier recorded before publication.
- `schema/` — machine-readable envelope, grant, revocation, checkpoint, and use-body schemas.
- `src/trust-core.js` — dependency-free reference implementation.
- `src/revocation-checkpoint.js` — separate bounded checkpoint research primitive; it does not alter capability authorization.
- `independent/vector-verifier-v1.js` — separate JavaScript evidence-only verifier; not the runtime core.
- `crosslang/go/vector_verifier.go` — Go standard-library evidence-only verifier for the fixed vector.
- `tests/trust-core.test.js` — executable adversarial fixtures, including explicit ancestor-revocation chain behavior.
- `tests/revocation-checkpoint.test.js` — checkpoint manifest binding, issuer, time, stale, unknown-clock, and duplicate-packet falsifiers.
- `tests/interop-vector.test.js` — locks the deterministic vector against the reference implementation and Node's Ed25519 verifier.
- `tests/independent-interop.test.js` — proves the second JavaScript path stays dependency-separated and reproduces/refuses bounded vector cases.
- `crosslang/go/vector_verifier_test.go` — seven cross-language fixed-vector and refusal checks.
- `evidence/adversarial_matrix.json` — what is proven, held, and unresolved.
- `evidence/interop_vector_v1.json` — fixed reproducible bytes and expected results; the included private seed is test-only and must never be real authority.
- `donors/` — bounded donor mappings; donors are not rewritten by this repo.

## Evidence level

Current claim: **fixture-tested local reference implementation with explicit supplied-chain ancestor-revocation behavior, bounded issuer-attested historical revocation-manifest checkpoints, and one deterministic vector reproduced by two JavaScript paths and one Go standard-library path in the same repository**.

The authored adversarial matrix now contains 46 bounded cases: 24 trust-core fixtures, eight revocation-checkpoint fixtures, one reference-vector check, six separate-JavaScript-verifier checks, and seven Go-verifier checks. The checkpoint fixtures can establish that an expected issuer signed an exact supplied revocation manifest as complete through a named historical timestamp while the checkpoint is still within its signed validity window. They do **not** establish that no newer revocation exists after that timestamp or on another peer.

The ancestor-revocation fixtures lock local chain semantics; they do not establish global revocation freshness or distribution. The Go path adds real language/runtime-library separation, but all implementations remain in the same repository and are not an independent third-party result.

The evidence does not establish hostile-deployment security, hardware-backed key custody, globally current revocation state, revocation synchronization, trustworthy clocks, legal/human identity, informed consent, content truth, third-party conformance, or AXM-wide CANON status.
