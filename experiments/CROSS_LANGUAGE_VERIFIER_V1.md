# Cross-language verifier experiment v1

Status: falsifier recorded before repository publication.

## Question

Can a Go implementation using only the Go standard library reproduce the published Trust Fabric v0.1 fixed vector and bounded refusal cases without importing, executing, or depending on either JavaScript verifier?

## Falsifier

The experiment fails if any of the following occurs:

- the Go verifier imports/calls `src/trust-core.js` or `independent/vector-verifier-v1.js`;
- it requires a third-party Go module or shells out to another crypto implementation;
- canonical unsigned bytes differ from the published vector;
- derived key id or SHA-256 envelope digest differs;
- the Ed25519 signature does not verify with Go's `crypto/ed25519` and `crypto/x509` path;
- trusted-root, expiry, target, or action decisions disagree with the published bounded expectation;
- mutated signed bytes are accepted.

A mismatch is evidence against interoperability. It must not be normalized or patched by changing the published vector.

## Scope

This is deliberately one fixed root-capability vector, not a second full Trust Fabric runtime. It does not implement delegation, revocation, capability-use proof, replay state, recovery, or donor adapters.

Success would establish cross-language and cross-crypto-library agreement inside the same repository for one deterministic fixture. It would still not establish third-party authorship, independent security review, hostile-deployment safety, or broad protocol conformance.
