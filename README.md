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
- A separate signed checkpoint-lineage experiment that can detect older-checkpoint rollback, same-sequence forks, missing intermediate links, wrong predecessors, and `completeThrough` regression **relative to an exact local lineage head the verifier already retained**.
- A bounded checkpoint-lineage comparator that independently validates two supplied complete histories and classifies exact identity, exact-prefix descent, fork after an exact common ancestor, or conflicting genesis **without choosing a winner or claiming either head is globally newest**.
- A bounded single-step key-rotation experiment: an explicitly expected predecessor key may sign one exact successor public key for one exact domain and effective window; old signatures remain independently verifiable and competing simultaneously usable rotations are exposed as conflict with no winner.
- A separate successor-possession acknowledgement experiment: the exact successor key may sign evidence bound to the exact predecessor-signed rotation, predecessor, successor, domain, and contained validity window; possession does not transfer root/capability authority or resolve a competing rotation fork.
- A bounded **two-hop** key-rotation-lineage experiment: one explicitly supplied `A -> B -> C` branch is accepted only when both rotations are independently usable, B and C each acknowledge possession for their exact hop, the same domain is preserved, and the second hop neither begins before the first hop becomes effective nor outlives it. This still grants no authority and elects no fork winner.
- Subject-signed capability-use requests, separating a valid grant from proof that the current actor controls the granted subject key.
- Explicit `CLOCK_UNKNOWN` hold rather than pretending offline time is trusted.
- Optional one-use capabilities with **local-only** replay detection.
- Separate claim-state labels for integrity, authorship, authority, identity continuity, and truth.
- A fixed non-secret root-capability interoperability vector that locks one key, canonical unsigned envelope, digest, signature, and scoped evaluation result.
- A second evidence-only JavaScript verifier that does not import the reference core and reproduces that fixed root-capability vector plus bounded negative cases.
- A Go standard-library verifier that independently reproduces the same root-capability vector and bounded refusals without importing or executing either JavaScript verifier.
- A second fixed non-secret interoperability vector for the exact bounded `A -> B -> C` rotation lineage, checked by the existing JavaScript lineage evaluator and a separate Go standard-library lineage verifier that does not import or execute the JavaScript lineage evaluator.

## v0.1 intentionally not implemented

- global accounts or legal identity;
- reputation or social ranking;
- centralized trust servers;
- automatic recovery of a lost root key;
- globally authoritative time;
- globally fresh revocation knowledge or automatic revocation synchronization;
- treating a checkpoint's historical `completeThrough` as proof that no newer revocation exists;
- discovering newer checkpoints that a verifier has never received;
- preserving anti-rollback memory after the verifier loses or replaces its retained local lineage state;
- automatically selecting a winning checkpoint fork or creating consensus across disconnected peers;
- knowing whether an unseen lineage exists beyond the complete histories actually supplied for comparison;
- automatic capability-authorization dependence on the checkpoint research primitives;
- delegated or threshold revokers;
- cross-device replay prevention while devices are disconnected;
- arbitrary-length key-rotation lineage beyond the bounded two-hop experiment, rotation discovery/freshness/revocation, automatic successor root/capability authority, or lost-key recovery;
- third-party or separately authored protocol conformance;
- broad conformance beyond the published root-capability and exact two-hop rotation-lineage vectors;
- content truth or safety verification;
- automatic CANON, install, migration, or permission escalation.

## Run locally

JavaScript reference, checkpoint, checkpoint-lineage, lineage-comparison, key-rotation, successor-possession, two-hop rotation-lineage, interoperability-vector, and separate-verifier checks require Node 20+ and no package installation:

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
- `KEY_ROTATION.md` — bounded single-step rotation, successor-possession, two-hop lineage, and unresolved recovery contract.
- `INTEROPERABILITY.md` — deterministic vectors, verifier experiments, falsifiers, and truth boundary.
- `experiments/ANCESTOR_REVOCATION_V1.md` — falsifier-first ancestor-chain revocation experiment.
- `experiments/REVOCATION_CHECKPOINT_V1.md` — falsifier-first historical revocation-manifest checkpoint experiment.
- `experiments/CHECKPOINT_LINEAGE_V1.md` — falsifier-first local checkpoint anti-rollback experiment.
- `experiments/CHECKPOINT_LINEAGE_COMPARE_V1.md` — falsifier-first complete-lineage comparison experiment.
- `experiments/KEY_ROTATION_V1.md` — falsifier-first bounded predecessor-to-successor rotation experiment.
- `experiments/KEY_ROTATION_ACK_V1.md` — falsifier-first exact-successor possession acknowledgement experiment.
- `experiments/KEY_ROTATION_LINEAGE_V1.md` — falsifier-first exact two-hop `A -> B -> C` composition experiment.
- `experiments/TWO_HOP_ROTATION_LINEAGE_INTEROP_V1.md` — falsifier-first same-repository cross-language portability test for the exact two-hop lineage.
- `experiments/PUBLIC_EVIDENCE_CONSISTENCY_V2.md` — falsifier-first public evidence-summary consistency repair.
- `experiments/INDEPENDENT_VERIFIER_V1.md` — same-language verifier question and falsifier.
- `experiments/CROSS_LANGUAGE_VERIFIER_V1.md` — Go verifier question and falsifier recorded before publication.
- `schema/` — machine-readable envelope, grant, revocation, checkpoint, checkpoint-link, key-rotation, key-rotation-ack, and use-body schemas.
- `src/trust-core.js` — dependency-free reference implementation.
- `src/revocation-checkpoint.js` — separate bounded checkpoint research primitive; it does not alter capability authorization.
- `src/checkpoint-lineage.js` — separate local continuity primitive for exact retained checkpoint heads; it adds no discovery or consensus.
- `src/checkpoint-lineage-compare.js` — evidence-only comparison of two supplied complete valid checkpoint histories; it elects no fork winner.
- `src/key-rotation.js` — isolated single-step predecessor-signed successor evidence; it does not alter trusted-root/capability policy.
- `src/key-rotation-ack.js` — isolated exact-successor possession evidence bound to one accepted rotation; it grants no authority.
- `src/key-rotation-lineage.js` — isolated exact two-hop rotation/acknowledgement composition; it does not generalize to arbitrary lineage or grant successor authority.
- `independent/vector-verifier-v1.js` — separate JavaScript evidence-only verifier; not the runtime core.
- `crosslang/go/vector_verifier.go` — Go standard-library evidence-only verifier for the fixed root-capability vector.
- `crosslang/go/rotation_lineage_verifier.go` — separate Go standard-library verifier for the fixed two-hop rotation-lineage evidence and selected refusal states.
- `tests/trust-core.test.js` — executable adversarial fixtures, including explicit ancestor-revocation chain behavior.
- `tests/revocation-checkpoint.test.js` — checkpoint manifest binding, issuer, time, stale, unknown-clock, and duplicate-packet falsifiers.
- `tests/checkpoint-lineage.test.js` — local genesis/head/advance, rollback, fork, gap, predecessor, completeness-regression, and foreign-issuer falsifiers.
- `tests/checkpoint-lineage-compare.test.js` — complete-history identity/descent/fork/genesis-conflict classification plus invalid-evidence refusal cases.
- `tests/key-rotation.test.js` — predecessor/successor binding, effective-window, clock, domain, old-evidence preservation, and competing-rotation falsifiers.
- `tests/key-rotation-ack.test.js` — exact successor possession, binding, validity-window, expiry, and no-fork-resolution falsifiers.
- `tests/key-rotation-lineage.test.js` — exact two-hop composition, possession-at-each-hop, no-domain/window-widening, clock, history-preservation, and fork-remains-unresolved falsifiers.
- `tests/key-rotation-lineage-interop.test.js` — binds the published two-hop lineage vector to the existing JavaScript lineage evaluator and exact evidence digests.
- `tests/interop-vector.test.js` — locks the root-capability deterministic vector against the reference implementation and Node's Ed25519 verifier.
- `tests/independent-interop.test.js` — proves the second JavaScript path stays dependency-separated and reproduces/refuses bounded root-capability vector cases.
- `tests/evidence-consistency.test.js` — CI meta-guard that keeps matrix, executable fixture count, primary root-gate report, and public README evidence count aligned without inflating protocol evidence.
- `crosslang/go/vector_verifier_test.go` — seven cross-language root-capability fixed-vector and refusal checks.
- `crosslang/go/rotation_lineage_verifier_test.go` — five cross-language two-hop-lineage dependency, exact-vector, mutation, domain, and acknowledgement-substitution checks.
- `evidence/adversarial_matrix.json` — what is proven, held, and unresolved.
- `evidence/consistency_guard_v1.json` — machine-readable evidence-accounting contract; the guard is not a protocol/security case.
- `evidence/interop_vector_v1.json` — fixed root-capability bytes and expected results; the included private seed is test-only and must never be real authority.
- `evidence/two_hop_rotation_lineage_interop_v1.json` — fixed signed `A -> B -> C` rotations/acknowledgements, exact digests, and expected bounded result; all deterministic keys are test-only.
- `donors/` — bounded donor mappings; donors are not rewritten by this repo.

## Evidence level

Current claim: **fixture-tested local reference implementation with explicit supplied-chain ancestor-revocation behavior, bounded issuer-attested historical revocation-manifest checkpoints, local retained-head checkpoint anti-rollback evidence, bounded comparison of two supplied complete checkpoint histories, bounded single-step predecessor-signed successor evidence plus exact-successor possession acknowledgement, bounded exact two-hop rotation-lineage composition, one root-capability vector reproduced by two JavaScript paths and one Go standard-library path, and one exact two-hop rotation-lineage vector reproduced by the JavaScript reference lineage path and a separate Go standard-library lineage path in the same repository**.

Current authored adversarial matrix: **100 bounded cases**.

Those 100 protocol/security cases are composed of 24 trust-core fixtures, eight revocation-checkpoint fixtures, ten checkpoint-lineage fixtures, ten complete-lineage comparison fixtures, nine key-rotation fixtures, nine successor-possession acknowledgement fixtures, ten two-hop rotation-lineage fixtures, one root-capability reference-vector check, six separate-JavaScript-verifier checks, seven root-capability Go-verifier checks, one two-hop-lineage reference-vector check, and five two-hop-lineage Go-verifier checks. The evidence-consistency meta-test is deliberately outside that count.

The checkpoint fixtures can establish that an expected issuer signed an exact supplied revocation manifest as complete through a named historical timestamp while the checkpoint is still within its signed validity window. They do **not** establish that no newer revocation exists after that timestamp or on another peer.

The checkpoint-lineage fixtures add a narrower continuity claim: when a verifier has retained an exact signed lineage head, an older sequence cannot silently replace it, a conflicting same-sequence or wrong-predecessor successor is exposed, sequence gaps hold, and `completeThrough` cannot move backward. This does **not** discover unseen newer checkpoints or survive loss of local retained state.

The comparison fixtures add a separate relationship claim: when two complete supplied histories independently pass those lineage rules, the comparator can prove exact equality, exact-prefix descendant relation, divergence after an exact common ancestor, or different valid genesis. A fork result is evidence of conflict, not a consensus decision; no result proves either supplied head globally newest or discovers another history that was not supplied.

The key-rotation fixtures add one bounded continuity claim: an explicitly expected predecessor key can attest an exact successor public key for one exact domain during one active signed window, while unknown time and pre-effective use fail closed, old predecessor signatures remain unchanged, and competing simultaneously usable rotations remain visible as conflict. The successor-possession fixtures add only that the exact named successor key controls the private key used to acknowledge that exact rotation during a contained signed window.

The two-hop rotation-lineage fixtures compose exactly `A -> B -> C` only when B and C each acknowledge possession for their exact hop, B is exactly both the first successor and second predecessor, the domain stays exact, trusted time is present, and the second rotation stays inside the first rotation's effective/expiry bounds. A successful supplied branch still does **not** prove same-person/device identity, transfer root/capability/revocation/checkpoint authority, establish a globally newest or unique branch, discover unseen rotations, generalize to arbitrary chain length, recover a lost predecessor, or resolve a fork.

The new lineage interoperability vector adds portability evidence for those exact two-hop bytes: the existing JavaScript evaluator and a separate Go standard-library implementation reproduce the expected lineage, while the Go path also refuses a signed-byte mutation, wrong domain, and substituted acknowledgement. That is stronger than one-language self-consistency but remains same-repository fixed-vector evidence, not general two-hop conformance or third-party independence.

The ancestor-revocation fixtures lock local chain semantics; they do not establish global revocation freshness or distribution. The Go paths add real language/runtime-library separation, but all implementations remain in the same repository and are not an independent third-party result.

The evidence-consistency guard makes public README count drift fail CI and still requires the bounded successor-possession truth boundary in `TRUST_MODEL.md`. That proves selected evidence declarations agree at one commit; it does not prove the underlying fixture set is complete or the public prose captures every semantic nuance.

The evidence does not establish hostile-deployment security, hardware-backed key custody, globally current revocation state, revocation synchronization, globally persistent anti-rollback state, fork resolution/consensus, globally current rotation state, arbitrary-length rotation lineage or authority integration, lost-key recovery, trustworthy clocks, legal/human identity, informed consent, content truth, third-party conformance, or AXM-wide CANON status.
