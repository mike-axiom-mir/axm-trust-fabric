# Interoperability Evidence v0.1

Status: **TWO SAME-REPOSITORY IMPLEMENTATIONS AGREE ON ONE FIXED VECTOR / NOT THIRD-PARTY CONFORMANCE**

## Question

Can a separately implemented verifier reproduce the exact Trust Fabric v0.1 signed bytes, key identifier, envelope digest, signature verification, and bounded capability result without importing the reference runtime?

## Falsifier

The experiment fails if the separate verifier imports or calls `src/trust-core.js`, or if it disagrees with any published fixed-vector constant or bounded authorization result.

In particular, a mismatch in any of these is a failure, not something to normalize silently:

- public key derived from the fixed test seed;
- key id;
- canonical unsigned envelope text;
- SHA-256 envelope digest;
- Ed25519 signature verification;
- trusted-root decision;
- temporal decision;
- exact target/action capability result.

The adversarial side also fails the experiment if the separate verifier accepts mutated signed bytes, an untrusted root, an expired envelope, a wrong target, or a wrong action.

## Vector

`evidence/interop_vector_v1.json` contains one fixed, deliberately non-secret Ed25519 test identity and one exact capability envelope.

The private seed exists only to make the vector independently reproducible. **It must never be used as real AXM authority.**

The vector fixes:

- Ed25519 PKCS8/SPKI encoding;
- UTF-8 canonical unsigned JSON bytes;
- SHA-256 digest over those unsigned bytes;
- Ed25519 signature over those unsigned bytes;
- evaluation time and local trusted-root set;
- exact expected authorization result.

## Separate implementation

`independent/vector-verifier-v1.js` is an intentionally separate implementation path. It does not import the reference core. Its test statically enforces that dependency boundary and then reproduces the published vector using Node's cryptographic primitive plus its own canonicalizer, key-id derivation, time check, root check, and exact scope evaluation.

`tests/independent-interop.test.js` adds six bounded checks:

1. no reference-core import;
2. exact vector reproduction;
3. signed-byte mutation rejection;
4. untrusted-root refusal;
5. expiry refusal;
6. exact target/action scope refusal.

This closes the previous **same-code-path** gap for the fixed vector. It establishes source-level implementation separation inside this repository.

## Claim boundary

Passing both implementations proves that two code paths in this repository agree on one deterministic fixture and its bounded negative cases.

It does **not** prove:

- independent third-party interoperability;
- cross-language conformance;
- production protocol conformance;
- hostile-environment security;
- correct key custody or human identity;
- trustworthy global time, globally fresh revocation, or disconnected replay prevention;
- AXM-wide CANON status.

The next stronger interoperability evidence must come from a genuinely external or independently authored implementation context, ideally in another language or runtime, reproducing the same published vector without copying either verifier implementation.
