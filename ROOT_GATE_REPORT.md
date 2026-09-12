# Root Gate Report — trust-core v0.1

Status: candidate evidence for repository merge; not automatic CANON.

## Truth

PASS for this bounded claim.

- The implementation claims only local fixture-tested behavior.
- Signature validity is separated from truth, safety, legal identity, identity continuity, and constitutional authority.
- An arbitrary signer cannot self-authorize: root issuers are explicitly supplied by the consuming system.
- A valid grant is separated from live use; `AUTHORIZED_USE` requires a subject-signed request bound to the exact capability, target, and action.
- Missing trusted time becomes `HOLD_CLOCK_UNKNOWN`.
- One-use grants cannot delegate in v0.1, avoiding a false one-use claim through multiple children.
- A deterministic interoperability vector now fixes one exact key, canonical unsigned envelope, digest, signature, and scoped evaluation result.
- The vector is explicitly not called independent interoperability; no separate implementation has reproduced it yet.
- Offline revocation freshness, disconnected replay, key theft attribution, key rotation/recovery, independent interoperability, and hostile-environment review remain explicitly unresolved.

## Agency / non-domination

PASS for this bounded claim.

- No accounts, global registry, reputation score, central trust server, or ambient authority are introduced.
- Capability authority is explicit, scoped, expiring, and rooted in caller-selected trust roots rather than familiar identity.
- Delegation may narrow but cannot widen target, actions, time, reuse, or delegation depth.
- Delegated grants require the complete parent chain.
- One-use grants are non-delegable in v0.1.
- The current requester must prove possession of the granted subject key for live use.
- The fixed interoperability key is labeled test-only and grants no real authority by publication.

## Continuity

PASS for this bounded claim.

- Existing City Multiplayer and Collaboration Platform mechanisms are donor references only.
- No donor repository is rewritten or migrated.
- Existing bearer invite and authority-lease paths remain independently usable.
- Signed parent digests preserve capability lineage.
- Fixed canonical bytes and cryptographic outputs make future serialization drift detectable instead of silently rewriting old evidence.
- Repository merge does not silently promote Trust Fabric to CANON across AXM.

## Wisdom before speed

PASS for this bounded claim.

- v0.1 uses Node built-in Ed25519 instead of inventing cryptography.
- Key rotation/recovery is documented but intentionally not implemented.
- Unknown clock, incomplete delegation chain, untrusted root, invalid revocation window, ambiguous one-use delegation, and missing subject proof fail closed.
- Interoperability growth starts with one falsifiable fixed vector rather than a premature protocol or network service.
- The first implementation remains a dependency-free local reference primitive, not infrastructure.

## Evidence

Existing merged core evidence: `21 trust-core tests passed.`

New branch evidence adds one deterministic interoperability-vector check, bringing the authored matrix to 22 cases. The vector constants were generated and independently self-checked with Node's Ed25519 primitive before publication.

Repository verification command:

```bash
npm test
```

GitHub Actions repeats that command on Node 22. Remote CI must agree on the published branch before merge.

## Gate conclusion

The four roots permit merging this bounded deterministic-vector improvement **only if** the published branch and remote CI remain consistent with this report.

This conclusion grants no automatic installation, donor migration, release, deployment, security certification, independent-interoperability claim, or AXM-wide CANON status.
