# Interoperability Evidence v0.1

Status: **SAME-REPOSITORY JAVASCRIPT + GO AGREEMENT ON ONE FIXED VECTOR / NOT THIRD-PARTY CONFORMANCE**

## Question

Can independently implemented verifier paths reproduce the exact Trust Fabric v0.1 signed bytes, key identifier, envelope digest, signature verification, and bounded capability result without importing the reference runtime?

The current strongest experiment asks a narrower cross-language version:

> Can a Go implementation using only the Go standard library reproduce the published fixed vector and bounded refusal cases without importing, executing, or depending on either JavaScript verifier?

## Falsifier

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

## Vector

`evidence/interop_vector_v1.json` contains one fixed, deliberately non-secret Ed25519 test identity and one exact capability envelope.

The private seed exists only to make the vector reproducible. **It must never be used as real AXM authority.**

The vector fixes:

- Ed25519 PKCS8/SPKI encoding;
- UTF-8 canonical unsigned JSON bytes;
- SHA-256 digest over those unsigned bytes;
- Ed25519 signature over those unsigned bytes;
- evaluation time and local trusted-root set;
- exact expected authorization result.

## Implementation paths

### Reference JavaScript path

`src/trust-core.js` remains the reference research runtime and is exercised by the original fixture suite and reference-vector check.

### Separate JavaScript verifier

`independent/vector-verifier-v1.js` does not import the reference core. Its test statically enforces that boundary and independently reproduces the published vector using Node's cryptographic primitive plus its own canonicalizer, key-id derivation, time check, root check, and exact scope evaluation.

### Cross-language Go verifier

`crosslang/go/vector_verifier.go` is a second evidence-only implementation language and crypto-library path. It uses only the Go standard library, including `crypto/ed25519`, `crypto/x509`, `crypto/sha256`, and `encoding/json`.

It does not import either JavaScript verifier and does not shell out to Node, OpenSSL, or another crypto process. `crosslang/go/go.mod` has no third-party requirements.

`crosslang/go/vector_verifier_test.go` adds seven bounded checks:

1. Go-language / dependency separation;
2. exact published-vector reproduction;
3. signed-byte mutation rejection;
4. untrusted-root refusal;
5. expiry refusal;
6. wrong-target refusal;
7. wrong-action refusal.

Local prototype verification produced all seven passing Go tests before repository publication. CI runs the existing JavaScript suite and the Go suite independently.

## What changed in evidence strength

The earlier state established two JavaScript code paths in one repository agreeing on one fixed vector.

The Go verifier adds **cross-language and cross-standard-library agreement** on that same fixed vector. That is stronger evidence that the published bytes and bounded decisions are not artifacts of one JavaScript implementation path.

It is still same-repository evidence and therefore remains weaker than a separately authored or third-party implementation result.

## Claim boundary

Passing all current implementations proves that three code paths in this repository — the reference JavaScript runtime, the separate JavaScript verifier, and a Go standard-library verifier — agree on one deterministic fixture and bounded negative cases.

It does **not** prove:

- independent third-party interoperability;
- separately authored implementation independence;
- broad protocol conformance beyond this root-capability vector;
- production protocol certification;
- hostile-environment security;
- correct key custody or human identity;
- trustworthy global time, globally fresh revocation, or disconnected replay prevention;
- AXM-wide CANON status.

The next stronger interoperability evidence should come from a genuinely external or separately authored implementation context that reproduces the published vector without copying any in-repository verifier. A second vector family covering delegation or revocation is useful only after the current one-vector claim remains reproducible across that external boundary.
