# Independent verifier experiment v1

Status: **QUESTION DEFINED / IMPLEMENTATION MUST NOT IMPORT THE REFERENCE CORE**

## Question

Can a separately implemented verifier reproduce the published Trust Fabric v0.1 interoperability vector without importing or calling `src/trust-core.js`?

## Falsifier

The experiment fails if any of the following occurs:

- the independent implementation imports, requires, evaluates, or otherwise calls `src/trust-core.js`;
- the derived Ed25519 key id differs from the published vector;
- the independently canonicalized unsigned envelope differs byte-for-byte from the published canonical text;
- the independently computed SHA-256 envelope digest differs from the published digest;
- the published signature does not verify over the independently canonicalized bytes;
- the independent bounded evaluator disagrees with the vector's expected trusted-root, time, target, or action result;
- a mutation of signed bytes is accepted as valid;
- an untrusted root, expired envelope, wrong target, or wrong action is accepted as authorized scope.

## Bounded success claim

If the falsifier is not triggered, the repo may claim **two implementations in this repository reproduce the same fixed v0.1 vector**.

It must still not claim:

- independent third-party interoperability;
- production protocol conformance;
- hostile-environment security review;
- correct key custody or human identity;
- globally fresh revocation, globally trusted time, or disconnected replay prevention;
- AXM-wide CANON status.

## Root boundary

The independent implementation exists as evidence, not as a replacement runtime. The reference implementation remains `src/trust-core.js`; donor systems remain unchanged.