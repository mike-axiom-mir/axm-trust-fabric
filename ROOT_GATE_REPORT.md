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
- A revocation packet still targets exactly one capability; this change does not relabel descendants as directly revoked.
- Because a delegated grant requires every ancestor in its supplied chain to remain valid, a valid issuer-signed ancestor revocation invalidates authorization through the descendant chain at that ancestor.
- A foreign ancestor revocation is ignored as non-authoritative, and an ancestor revocation with an invalidly short window produces `HOLD_INVALID_REVOCATION_WINDOW` rather than a clean resurrection path.
- This ancestor behavior only applies to revocation evidence supplied to the evaluator; absence of local evidence does not establish global freshness.
- The fixed interoperability vector remains byte-for-byte locked at the signed-envelope level.
- A separate JavaScript verifier reproduces the fixed vector without importing the reference core.
- A Go standard-library verifier independently reproduces the same canonical bytes, SPKI-derived key id, SHA-256 digest, Ed25519 verification, trusted-root decision, time decision, and exact scope result without importing or executing either JavaScript verifier.
- The interoperability claim remains limited to three same-repository code paths agreeing on one fixed root-capability vector; no third-party, separately authored, broad protocol, production-conformance, or hostile-deployment claim is made.
- Offline revocation freshness/distribution, disconnected replay, key theft attribution, key rotation/recovery, external third-party interoperability, and hostile-environment review remain explicitly unresolved.

## Agency / non-domination

PASS for this bounded claim.

- No accounts, global registry, reputation score, central trust server, or ambient authority are introduced.
- Capability authority remains explicit, scoped, expiring, and rooted in caller-selected trust roots rather than familiar identity.
- Delegation may narrow but cannot widen target, actions, time, reuse, or delegation depth.
- Delegated grants require the complete parent chain.
- Known loss of ancestor authority removes downstream authorization through that exact lineage; it does not grant unrelated actors revocation power.
- Foreign-signed revocations remain non-authoritative.
- One-use grants are non-delegable in v0.1.
- The current requester must prove possession of the granted subject key for live use.
- The fixed interoperability key remains test-only and grants no real authority by publication.
- Evidence-only JavaScript and Go verifiers have no authority of their own; they evaluate supplied evidence and local trust-root context only.

## Continuity

PASS for this bounded claim.

- Existing City Multiplayer and Collaboration Platform mechanisms remain donor references only.
- No donor repository is rewritten or migrated.
- Existing bearer invite and authority-lease paths remain independently usable.
- Signed parent digests preserve capability lineage.
- Ancestor invalidation follows that preserved lineage and does not rewrite descendant capability packets.
- This change locks an already-existing chain-evaluation behavior with explicit fixtures and documentation rather than silently changing runtime semantics.
- Fixed canonical bytes and cryptographic outputs make serialization drift detectable instead of silently rewriting old evidence.
- The separate JavaScript and Go verifiers are explicitly evidence-only and do not replace `src/trust-core.js`.
- The published vector itself is not rewritten to make implementations agree; mismatches are falsifiers.
- Repository merge does not silently promote Trust Fabric to CANON across AXM.

## Wisdom before speed

PASS for this bounded claim.

- v0.1 uses established Ed25519 implementations rather than inventing cryptography: Node's built-in crypto for the reference paths and Go's standard-library `crypto/ed25519` / `crypto/x509` path for the cross-language check.
- The Go verifier has no third-party modules and does not shell out to another crypto implementation.
- Key rotation/recovery remains documented but intentionally not implemented.
- Unknown clock, incomplete delegation chain, untrusted root, invalid revocation window, ambiguous one-use delegation, and missing subject proof fail closed.
- Revocation-chain semantics are made explicit with three narrow falsifier-driven fixtures before attempting any distributed revocation service or synchronization layer.
- Interoperability growth moved from one fixed vector, to a separate same-language verifier, to one narrow cross-language verifier before any protocol service, account layer, or broad compatibility claim.
- The Go verifier covers only the published root-capability vector and bounded negative cases; it is not falsely promoted into a second full Trust Fabric runtime.

## Evidence

Merged baseline before this change:

- 21 trust-core fixtures;
- one deterministic reference-vector check;
- 6 separate-JavaScript-verifier checks;
- 7 Go-verifier checks;
- successful JavaScript + Go CI on `main`.

This branch adds 3 trust-core fixtures:

1. issuer-signed ancestor revocation invalidates descendant authorization through the supplied chain and reports the ancestor chain index;
2. a foreign ancestor revocation does not invalidate the descendant chain;
3. an invalidly short ancestor revocation produces `HOLD_INVALID_REVOCATION_WINDOW` at the ancestor rather than allowing a resurrection path.

That brings the authored adversarial matrix to 38 bounded cases total.

No runtime implementation or donor boundary is modified by this branch; the improvement is an explicit semantic contract plus regression evidence for behavior already produced by complete-chain evaluation.

Repository CI must still run both:

```bash
npm test
cd crosslang/go && go test ./...
```

The final published PR head must pass remote CI before merge.

## Gate conclusion

The four roots permit merging this bounded ancestor-revocation-chain clarification **only if** the final published branch, PR diff, and remote CI remain consistent with this report.

This conclusion grants no automatic revocation distribution, synchronization, global freshness, donor migration, release, deployment, security certification, third-party interoperability claim, broad protocol conformance, or AXM-wide CANON status.
