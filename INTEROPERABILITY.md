# Interoperability Evidence v0.1

Status: **SAME-REPOSITORY JAVASCRIPT + GO AGREEMENT ON THREE FIXED VECTOR FAMILIES / NOT THIRD-PARTY CONFORMANCE**

## Question

Can separately implemented verifier paths reproduce exact Trust Fabric v0.1 signed bytes and bounded evaluation results without importing the reference runtime?

The repository now carries three deliberately narrow vector families:

1. a root-capability vector covering key id, canonical bytes, envelope digest, signature verification, trusted-root/time decisions, and exact target/action scope;
2. an exact two-hop `A -> B -> C` key-rotation-lineage vector covering two predecessor-signed rotations, two successor-signed acknowledgements, exact evidence digests, predecessor/domain continuity, possession binding, and the two-hop no-widening rule;
3. a fixed complete rotation-revocation checkpoint-lineage comparison vector covering identical history, exact-prefix descent in both directions, fork after an exact common ancestor, conflicting genesis, plus selected mutation/gap/wrong-predecessor refusals.

The third family is recorded as **supplemental portability evidence**, not as six new trust-protocol cases. It reproduces already-bounded comparator semantics through a second standard-library implementation path, so the authored protocol matrix remains 130 cases.

## Falsifiers

### Root-capability vector

The cross-language experiment fails if the Go verifier imports/calls either JavaScript verifier, shells out to another crypto implementation, requires third-party Go modules, or disagrees with any published fixed-vector constant or bounded authorization result.

A mismatch in any of these is a failure, not something to normalize silently:

- public key / key id derived from the published SPKI bytes;
- canonical unsigned envelope text;
- SHA-256 envelope digest;
- Ed25519 signature verification;
- trusted-root decision;
- temporal decision;
- exact target/action capability result.

The adversarial side also fails the experiment if the Go verifier accepts mutated signed bytes, an untrusted root, an expired envelope, a wrong target, or a wrong action.

### Two-hop rotation-lineage vector

`experiments/TWO_HOP_ROTATION_LINEAGE_INTEROP_V1.md` records this falsifier before implementation. The experiment fails if the separate Go path:

- accepts a bad Ed25519 signature over changed signed bytes;
- derives different key ids or envelope digests from the fixed bytes;
- accepts the wrong expected origin or domain;
- accepts missing/substituted acknowledgement evidence;
- accepts a second rotation whose predecessor is not the exact first successor;
- accepts second-hop time widening outside the first signed boundary;
- imports/executes `src/key-rotation-lineage.js` or turns into a JavaScript wrapper;
- produces a success claim broader than `TWO_HOP_ROTATION_LINEAGE_CONFIRMED` for the supplied evidence.

The experiment is also falsified by documentation that turns same-repository fixed-vector agreement into claims of identity continuity, authority transfer, branch freshness/uniqueness, fork resolution, arbitrary-length lineage conformance, third-party independence, or production security.

### Rotation-revocation checkpoint-lineage comparison vector

`experiments/ROTATION_REVOCATION_LINEAGE_COMPARE_INTEROP_V1.md` records the falsifier before implementation. The portable comparison experiment fails if the separate Go path:

- classifies any fixed supplied history pair differently from the existing JavaScript comparator;
- imports, executes, shells out to, or mechanically wraps the JavaScript comparator/reference runtime;
- accepts mutation of signed checkpoint/link bytes;
- normalizes a missing intermediate signed link into a relationship result;
- accepts a predecessor different from the caller-supplied expected predecessor;
- reports exact-prefix descent without an exact shared signed-link prefix;
- hides the exact common ancestor of a supplied fork or elects a winning branch;
- invents a common ancestor for different valid genesis histories;
- widens fixed-evidence agreement into discovery, synchronization, globally newest/current state, authority transfer, recovery, consensus, broad conformance, or production-security claims.

## Vectors

### Root-capability vector

`evidence/interop_vector_v1.json` contains one fixed, deliberately non-secret Ed25519 test identity and one exact capability envelope.

The private seed exists only to make the vector reproducible. **It must never be used as real AXM authority.**

The vector fixes Ed25519 PKCS8/SPKI encoding, UTF-8 canonical unsigned JSON bytes, SHA-256 digest, signature, evaluation time, local trusted-root set, and exact expected authorization result.

### Two-hop rotation-lineage vector

`evidence/two_hop_rotation_lineage_interop_v1.json` contains three deterministic test-only Ed25519 identities plus exactly four signed packets: `A -> B`, B's acknowledgement of that rotation, `B -> C`, and C's acknowledgement of that rotation.

It fixes all four signed packets, their exact SHA-256 envelope digests, the expected origin/domain/time context, and the bounded expected result `TWO_HOP_ROTATION_LINEAGE_CONFIRMED`.

Those keys are evidence fixtures only. **They must never become real authority.**

### Rotation-revocation lineage-comparison vector

`evidence/rotation_revocation_lineage_compare_interop_v1.json` fixes one deliberately non-secret predecessor key plus deterministic checkpoint/link packet specifications, exact packet digests/signatures, five supplied complete histories, and five expected bounded relationship classifications.

The fixed relationships are:

- `ROTATION_REVOCATION_LINEAGES_IDENTICAL`;
- `ROTATION_REVOCATION_RIGHT_DESCENDS_FROM_LEFT`;
- `ROTATION_REVOCATION_LEFT_DESCENDS_FROM_RIGHT`;
- `ROTATION_REVOCATION_LINEAGE_FORK_EVIDENCE` with the exact shared sequence-one ancestor and both first divergent links;
- `ROTATION_REVOCATION_LINEAGE_GENESIS_CONFLICT` with no invented ancestor.

The vector key is evidence-only. **It must never become real authority.**

`evidence/rotation_revocation_lineage_compare_portability_v1.json` records the machine-readable result boundary and explicitly keeps these implementation-portability checks outside the 130-case protocol matrix.

## Implementation paths

### Reference JavaScript paths

`src/trust-core.js` remains the root-capability reference research runtime. `src/key-rotation-lineage.js` remains the bounded exact-two-hop lineage reference path. `src/key-rotation-revocation-checkpoint-lineage-compare.js` remains the existing complete-history comparator. None was rewritten for the interoperability experiments.

`tests/key-rotation-lineage-interop.test.js` binds the two-hop lineage vector to the existing JavaScript evaluator and checks exact origin/intermediate/terminal ids, validity boundary, all four evidence digests, and absence of any authority/fork-winner output.

`tests/key-rotation-revocation-lineage-compare-interop.test.js` reconstructs the fixed checkpoint/link packets from the published deterministic test identity and packet specifications, requires exact published signatures/digests, and sends the resulting exact histories through the existing JavaScript comparator. It asserts all five bounded relationship labels, exact common-ancestor/divergence evidence, and absence of a winner field.

### Separate JavaScript root-capability verifier

`independent/vector-verifier-v1.js` does not import the reference core. Its test statically enforces that boundary and independently reproduces the published root-capability vector using Node's cryptographic primitive plus its own canonicalizer, key-id derivation, time check, root check, and exact scope evaluation.

### Cross-language Go root-capability verifier

`crosslang/go/vector_verifier.go` is an evidence-only implementation using only the Go standard library, including `crypto/ed25519`, `crypto/x509`, `crypto/sha256`, and `encoding/json`.

It does not import either JavaScript verifier and does not shell out to Node, OpenSSL, or another crypto process. `crosslang/go/go.mod` has no third-party requirements.

`crosslang/go/vector_verifier_test.go` carries seven bounded checks: dependency separation, exact vector reproduction, signed-byte mutation, untrusted root, expiry, wrong target, and wrong action.

### Cross-language Go two-hop lineage verifier

`crosslang/go/rotation_lineage_verifier.go` is a separate evidence-only Go implementation of the exact bounded two-hop checks needed by the published lineage vector. It independently performs canonical JSON serialization, SHA-256 envelope digests, SPKI-derived Ed25519 key ids, Ed25519 signature verification, exact predecessor/domain binding, acknowledgement-to-rotation binding, temporal usability, and the second-hop no-widening constraint.

It does not import, execute, or shell out to the JavaScript lineage evaluator. It remains standard-library only.

`crosslang/go/rotation_lineage_verifier_test.go` carries five bounded checks:

1. Go dependency separation from JavaScript/reference execution;
2. exact published two-hop vector reproduction;
3. signed-byte mutation rejection;
4. wrong-domain refusal;
5. substituted acknowledgement refusal.

### Cross-language Go rotation-revocation lineage comparator

`crosslang/go/rotation_revocation_lineage_compare_verifier.go` is a separate evidence-only Go implementation for the fixed comparison vector. It independently canonicalizes and verifies envelope signatures, checks exact predecessor, checkpoint/link binding, genesis/direct-link replay, exact previous-link continuity, and monotonic `completeThrough`, then classifies exact signed-link prefixes/divergence.

It does not import, execute, shell out to, or mechanically wrap the JavaScript comparator. It uses only standard-library cryptography plus canonicalization/key helpers already present in the Go evidence package.

`crosslang/go/rotation_revocation_lineage_compare_verifier_test.go` carries supplemental checks for:

1. dependency separation from JavaScript/reference execution;
2. all five fixed relationship classifications and exact ancestor/divergence ids;
3. signed-byte mutation rejection;
4. omitted-intermediate history refusal;
5. wrong explicitly expected predecessor refusal.

These checks exercise implementation portability. They do not add a new protocol success state and are therefore declared supplemental rather than added to the 130-case protocol matrix.

## What changed in evidence strength

The repository first established cross-language agreement on one root-capability vector, then froze one already-tested two-hop lineage into exact portable bytes and reproduced it through a separate Go implementation.

The current bounded increment repeats that method for the already-tested complete rotation-revocation checkpoint-lineage comparator. It is stronger evidence that exact-prefix/fork/genesis-conflict classification and signed-history interpretation are not artifacts of only the JavaScript comparator path.

It is still same-repository evidence. The Go comparator verifier was authored inside the same experiment and is exercised against one fixed vector plus selected refusals. Therefore it is **not** evidence of third-party independence, broad comparator conformance, global state knowledge, or fork-resolution correctness beyond the supplied evidence.

## Claim boundary

Passing all current interoperability checks proves only that the repository's JavaScript and Go paths agree on:

- one fixed root-capability vector plus bounded root/scope/time/mutation refusals;
- one fixed exact-two-hop rotation-lineage vector plus selected mutation/domain/acknowledgement refusals; and
- one fixed rotation-revocation checkpoint-lineage comparison vector covering the five already-bounded relationship states plus selected mutation/gap/expected-predecessor refusals.

It does **not** prove:

- independent third-party interoperability;
- separately authored external implementation independence;
- broad protocol conformance;
- arbitrary-length rotation-lineage conformance;
- same-person/device/legal identity across rotated keys;
- root, capability, revocation, or checkpoint authority transfer to successor keys;
- globally newest or unique rotation/checkpoint/revocation knowledge;
- discovery or synchronization of unseen histories;
- fork resolution, branch winner selection, or consensus;
- recovery after retained-state loss or lost keys;
- production protocol certification;
- hostile-environment security;
- trustworthy global time, globally fresh revocation, or disconnected replay prevention;
- AXM-wide CANON status.

The strongest next interoperability boundary is genuinely external or separately authored reproduction of the published bytes. Until that exists, adding more same-repository vector families should not be mistaken for external independence.
