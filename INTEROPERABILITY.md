# Interoperability Evidence v0.1

Status: **DETERMINISTIC REFERENCE VECTOR / NOT INDEPENDENTLY IMPLEMENTED**

## Question

Can another implementation reproduce the exact Trust Fabric v0.1 signed bytes, key identifier, envelope digest, signature verification, and bounded capability result without depending on hidden runtime state?

## Falsifier

This experiment fails if the published fixed vector cannot be reproduced byte-for-byte from the stated rules, or if the current reference implementation disagrees with any published constant.

In particular, a mismatch in any of these is a failure, not something to normalize silently:

- public key derived from the fixed test seed;
- key id;
- canonical unsigned envelope text;
- SHA-256 envelope digest;
- Ed25519 signature;
- signature verification result;
- capability evaluation result for the stated trusted-root/scope context.

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

## Claim boundary

Passing this vector proves consistency with one deterministic fixture. It does **not** prove independent interoperability until a separately implemented verifier or signer reproduces it without importing `src/trust-core.js`.

It also does not prove hostile-environment security, correct key custody, human identity, trustworthy time, revocation freshness, or AXM-wide CANON status.
