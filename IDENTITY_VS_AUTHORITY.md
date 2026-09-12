# Identity vs Authority

Trust Fabric treats these as separate questions.

## Integrity

**Question:** Are these the exact bytes that were signed?

A valid Ed25519 signature over the canonical v1 envelope can answer yes for the referenced public key.

## Authorship / key possession

**Question:** Did the holder of this private key produce this signature?

A valid signature supports that narrow claim. It does not establish the signer's legal name, humanity, organization, device uniqueness, independence, or informed intent.

## Authority

**Question:** Is this exact subject allowed to perform this exact action against this exact target during this exact window?

A signature alone cannot answer that. v0.1 requires:

1. an explicitly accepted root issuer supplied by the consuming system;
2. a valid, unrevoked capability chain from that root;
3. exact target/action scope with no delegation widening; and
4. for live use, an exact capability-use envelope signed by the granted subject key.

A capability can therefore be `GRANT_VALID_FOR_SCOPE` without claiming that the current requester possesses the subject key. `AUTHORIZED_USE` is reserved for the additional subject-signed use proof.

## Identity continuity

**Question:** Does a later key represent the same continuing actor or project identity?

v0.1 does not infer continuity. Key rotation/recovery needs explicit prior evidence and is not implemented yet.

## Truth

**Question:** Is the signed content factually correct, safe, wise, or root-compliant?

Cryptography cannot answer this. A liar can sign a lie perfectly.

## Required presentation rule

Interfaces consuming Trust Fabric should prefer labels such as:

- `SIGNED_BYTES_MATCH`
- `GRANT_VALID_FOR_SCOPE`
- `AUTHORIZED_USE`
- `UNTRUSTED_ROOT_ISSUER`
- `HOLD_CLOCK_UNKNOWN`
- `REVOKED`
- `IDENTITY_CONTINUITY_NOT_ESTABLISHED`
- `TRUTH_NOT_EVALUATED`

Avoid a single green `TRUSTED` badge because it collapses independent claims into a misleading story.
