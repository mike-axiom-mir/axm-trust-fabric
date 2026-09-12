# Root Gate Report — trust-core v0.1

Status: candidate evidence for repository merge; not automatic CANON.

## Truth

PASS for this bounded claim.

- The reference implementation still claims only local fixture-tested behavior.
- Signature validity remains separated from truth, safety, legal identity, identity continuity, and constitutional authority.
- An arbitrary signer cannot self-authorize: root issuers are explicitly supplied by the consuming system.
- A valid grant remains separated from live use; `AUTHORIZED_USE` requires a subject-signed request bound to the exact capability, target, and action.
- Missing trusted time becomes `HOLD_CLOCK_UNKNOWN`.
- One-use grants cannot delegate in v0.1, avoiding a false one-use claim through multiple children.
- The fixed interoperability vector remains byte-for-byte locked.
- A second verifier implementation now reproduces the fixed vector without importing the reference core and rejects bounded negative cases.
- The claim is limited to **two code paths in the same repository/runtime agreeing on one fixed vector**; no third-party, cross-language, production-conformance, or hostile-deployment claim is made.
- Offline revocation freshness, disconnected replay, key theft attribution, key rotation/recovery, external interoperability, and hostile-environment review remain explicitly unresolved.

## Agency / non-domination

PASS for this bounded claim.

- No accounts, global registry, reputation score, central trust server, or ambient authority are introduced.
- Capability authority remains explicit, scoped, expiring, and rooted in caller-selected trust roots rather than familiar identity.
- Delegation may narrow but cannot widen target, actions, time, reuse, or delegation depth.
- Delegated grants require the complete parent chain.
- One-use grants are non-delegable in v0.1.
- The current requester must prove possession of the granted subject key for live use.
- The fixed interoperability key remains test-only and grants no real authority by publication.
- The second verifier has no authority of its own; it evaluates supplied evidence and local trust-root context only.

## Continuity

PASS for this bounded claim.

- Existing City Multiplayer and Collaboration Platform mechanisms remain donor references only.
- No donor repository is rewritten or migrated.
- Existing bearer invite and authority-lease paths remain independently usable.
- Signed parent digests preserve capability lineage.
- Fixed canonical bytes and cryptographic outputs make serialization drift detectable instead of silently rewriting old evidence.
- The second verifier is explicitly evidence-only and does not replace `src/trust-core.js`.
- Repository merge does not silently promote Trust Fabric to CANON across AXM.

## Wisdom before speed

PASS for this bounded claim.

- v0.1 uses Node built-in Ed25519 instead of inventing cryptography.
- Key rotation/recovery remains documented but intentionally not implemented.
- Unknown clock, incomplete delegation chain, untrusted root, invalid revocation window, ambiguous one-use delegation, and missing subject proof fail closed.
- Interoperability growth moved from one fixed vector to one narrow separate verifier before any protocol service, account layer, or broad compatibility claim.
- The second verifier covers only the published root-capability vector and bounded negative cases; it is not falsely promoted into a second full Trust Fabric runtime.

## Evidence

Merged baseline before this change:

- `21 trust-core tests passed.`
- one deterministic reference-vector check.

This branch adds 6 separate-verifier checks, bringing the authored adversarial matrix to 28 cases total.

Repository verification command:

```bash
npm test
```

The branch has already produced a successful GitHub Actions `npm test` run with the separate verifier enabled. The final published PR head must also pass remote CI before merge.

## Gate conclusion

The four roots permit merging this bounded same-repository independent-verifier improvement **only if** the final published branch, PR diff, and remote CI remain consistent with this report.

This conclusion grants no automatic installation, donor migration, release, deployment, security certification, external-interoperability claim, or AXM-wide CANON status.
