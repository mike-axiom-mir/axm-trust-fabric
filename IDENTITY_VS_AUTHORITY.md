# Identity vs Authority

Trust Fabric treats these as separate questions.

## Integrity

**Question:** Are these the exact bytes that were signed?

A valid Ed25519 signature over the canonical v1 envelope can answer yes for the referenced public key.

## Authorship / key possession

**Question:** Did the holder of this private key produce this signature?

A valid signature supports that narrow claim. It does not establish the signer's legal name, humanity, organization, device uniqueness, independence, or informed intent.

## Authority

**Question:** Was this key allowed to perform this exact action against this exact target during this exact window?

That requires a capability evaluation, not merely a valid signature.

## Identity continuity

**Question:** Does a later key represent the same continuing actor or project identity?

v0.1 does not infer continuity. Key rotation/recovery needs explicit prior evidence and is not implemented yet.

## Truth

**Question:** Is the signed content factually correct, safe, wise, or root-compliant?

Cryptography cannot answer this. A liar can sign a lie perfectly.

## Required presentation rule

Interfaces consuming Trust Fabric should prefer labels such as:

- `SIGNED_BYTES_MATCH`
- `AUTHORIZED_FOR_SCOPE`
- `HOLD_CLOCK_UNKNOWN`
- `REVOKED`
- `IDENTITY_CONTINUITY_NOT_ESTABLISHED`
- `TRUTH_NOT_EVALUATED`

Avoid a single green `TRUSTED` badge because it collapses independent claims into a misleading story.
