# Interoperability Evidence v0.1

Status: **SAME-REPOSITORY JAVASCRIPT + GO AGREEMENT ON TWO FIXED VECTOR FAMILIES / NOT THIRD-PARTY CONFORMANCE**

## Question

Can independently implemented verifier paths reproduce exact Trust Fabric v0.1 signed bytes and bounded evaluation results without importing the reference runtime?

The repository now carries two deliberately narrow vector families:

1. a root-capability vector covering key id, canonical bytes, envelope digest, signature verification, trusted-root/time decisions, and exact target/action scope;
2. an exact two-hop `A -> B -> C` key-rotation-lineage vector covering two predecessor-signed rotations, two successor-signed acknowledgements, exact evidence digests, predecessor/domain continuity, possession binding, and the two-hop no-widening rule.

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

## Vectors

### Root-capability vector

`evidence/interop_vector_v1.json` contains one fixed, deliberately non-secret Ed25519 test identity and one exact capability envelope.

The private seed exists only to make the vector reproducible. **It must never be used as real AXM authority.**

The vector fixes Ed25519 PKCS8/SPKI encoding, UTF-8 canonical unsigned JSON bytes, SHA-256 digest, signature, evaluation time, local trusted-root set, and exact expected authorization result.

### Two-hop rotation-lineage vector

`evidence/two_hop_rotation_lineage_interop_v1.json` contains three deterministic test-only Ed25519 identities plus exactly four signed packets: `A -> B`, B's acknowledgement of that rotation, `B -> C`, and C's acknowledgement of that rotation.

It fixes all four signed packets, their exact SHA-256 envelope digests, the expected origin/domain/time context, and the bounded expected result `TWO_HOP_ROTATION_LINEAGE_CONFIRMED`.

Those keys are evidence fixtures only. **They must never become real authority.**

## Implementation paths

### Reference JavaScript path

`src/trust-core.js` remains the root-capability reference research runtime. `src/key-rotation-lineage.js` remains the bounded exact-two-hop lineage reference path. Neither was rewritten for the interoperability experiment.

`tests/key-rotation-lineage-interop.test.js` binds the new lineage vector to the existing JavaScript evaluator and checks exact origin/intermediate/terminal ids, validity boundary, all four evidence digests, and absence of any authority/fork-winner output.

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

The fixed vector and the separate Go implementation were also exercised locally before publication; repository CI remains the merge gate for the exact committed state.

## What changed in evidence strength

The earlier state established cross-language agreement on one root-capability vector only.

The new state freezes one already-tested two-hop lineage into exact portable bytes and asks a separate Go implementation to reproduce the same bounded result without importing the JavaScript evaluator. This is stronger evidence that the A -> B -> C continuity semantics and signed-byte interpretation are not artifacts of one JavaScript code path.

It is still same-repository evidence. The Go lineage verifier was authored inside the same experiment and has only the fixed vector plus selected refusals. Therefore it is **not** evidence of third-party independence or general lineage conformance.

## Claim boundary

Passing all current interoperability checks proves only that the repository's JavaScript and Go paths agree on:

- one fixed root-capability vector plus bounded root/scope/time/mutation refusals; and
- one fixed exact-two-hop rotation-lineage vector plus selected mutation/domain/acknowledgement refusals.

It does **not** prove:

- independent third-party interoperability;
- separately authored implementation independence;
- broad protocol conformance;
- arbitrary-length rotation-lineage conformance;
- same-person/device/legal identity across rotated keys;
- root, capability, revocation, or checkpoint authority transfer to successor keys;
- globally newest or unique rotation-branch knowledge;
- fork resolution or consensus;
- production protocol certification;
- hostile-environment security;
- trustworthy global time, globally fresh revocation, or disconnected replay prevention;
- AXM-wide CANON status.

The strongest next interoperability boundary is genuinely external or separately authored reproduction of the published bytes. Until that exists, adding many more same-repository vector families should not be mistaken for external independence.
