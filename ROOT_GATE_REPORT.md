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
- A revocation packet still targets exactly one capability; descendants are not relabeled as directly revoked.
- Because a delegated grant requires every ancestor in its supplied chain to remain valid, a valid issuer-signed ancestor revocation invalidates authorization through the descendant chain at that ancestor.
- This ancestor behavior only applies to revocation evidence supplied to the evaluator; absence of local evidence does not establish global freshness.
- The checkpoint primitive still says only `REVOCATION_SET_ATTESTED_THROUGH`, binding an exact supplied same-issuer revocation manifest to a historical timestamp while its checkpoint envelope is temporally valid.
- Checkpoint expiry remains `STALE_REVOCATION_CHECKPOINT`; lack of trusted time remains `HOLD_CLOCK_UNKNOWN`.
- The new checkpoint-lineage primitive is deliberately narrower than global anti-rollback: it detects rollback only relative to an exact local signed lineage head the verifier retained.
- A non-genesis candidate without retained history becomes `HOLD_LINEAGE_HISTORY_REQUIRED` rather than inventing continuity.
- Relative to a retained head, an older sequence becomes `CHECKPOINT_ROLLBACK_DETECTED`; a conflicting same-sequence or wrong-predecessor successor becomes `CHECKPOINT_FORK_DETECTED`; a skipped sequence becomes `HOLD_LINEAGE_GAP`; a direct successor that moves `completeThrough` backward becomes `CHECKPOINT_COMPLETENESS_ROLLBACK`.
- The exact retained pair becomes `LINEAGE_HEAD_CURRENT`, and only the exact next linked sequence with non-regressing `completeThrough` becomes `LINEAGE_ADVANCE_ACCEPTABLE`.
- The lineage result does not claim that the retained head is globally newest, does not discover checkpoints never received, and cannot preserve anti-rollback memory after local retained state is lost/replaced.
- Two disconnected peers may retain different valid issuer-signed forks; this experiment exposes that conflict when compared but does not solve consensus.
- The checkpoint-lineage module verifies signed historical continuity separately from checkpoint temporal freshness; it does not turn expired historical links into current revocation-freshness evidence.
- The fixed interoperability vector remains byte-for-byte locked at the signed-envelope level.
- Separate JavaScript and Go standard-library verifiers continue to reproduce the same one fixed vector, with the claim limited to same-repository agreement rather than third-party conformance.
- Current revocation freshness after `completeThrough`, synchronization/discovery, anti-rollback after local-state loss, disconnected-fork resolution, disconnected replay, key theft attribution, key rotation/recovery, external third-party interoperability, and hostile-environment review remain explicitly unresolved.

## Agency / non-domination

PASS for this bounded claim.

- No accounts, global registry, reputation score, central trust server, or ambient authority are introduced.
- Capability authority remains explicit, scoped, expiring, and rooted in caller-selected trust roots rather than familiar identity.
- Delegation may narrow but cannot widen target, actions, time, reuse, or delegation depth.
- Delegated grants require the complete parent chain.
- Known loss of ancestor authority removes downstream authorization through that exact lineage; it does not grant unrelated actors revocation power.
- Foreign-signed revocations remain non-authoritative.
- Checkpoint evaluation requires an explicit `expectedIssuer`; a random valid signer cannot attest another issuer's revocation state.
- Checkpoint-lineage evaluation also requires that explicit expected issuer; a foreign signer cannot advance another issuer's retained continuity state.
- A signed sequence number is not treated as global authority. It is evaluated only against exact locally retained predecessor evidence.
- No automatic discovery, synchronization, capability escalation, donor migration, or checkpoint dependence is introduced.
- One-use grants remain non-delegable in v0.1.
- The current requester must still prove possession of the granted subject key for live use.
- Evidence-only JavaScript and Go verifiers remain authority-free evaluators of supplied evidence and local trust-root context.

## Continuity

PASS for this bounded claim.

- Existing City Multiplayer and Collaboration Platform mechanisms remain donor references only.
- No donor repository is rewritten or migrated.
- Existing bearer invite and authority-lease paths remain independently usable.
- Signed parent digests preserve capability lineage.
- Ancestor invalidation follows preserved lineage and does not rewrite descendant capability packets.
- Checkpoints bind exact revocation envelope ids; they do not rewrite, compact away, or silently replace historical revocation packets.
- `src/revocation-checkpoint.js` remains separate; `src/trust-core.js` authorization semantics are unchanged.
- The new `src/checkpoint-lineage.js` adds signed predecessor links around exact checkpoint ids rather than modifying existing checkpoint bytes.
- A retained head exposes rollback/fork/gap evidence instead of silently accepting historical replacement.
- Loss of retained local lineage state is explicitly admitted as loss of local anti-rollback memory rather than hidden by a fake persistence claim.
- Fixed canonical bytes and cryptographic outputs keep serialization drift visible.
- Repository merge does not silently promote Trust Fabric to CANON across AXM.

## Wisdom before speed

PASS for this bounded claim.

- v0.1 continues to use established Ed25519 implementations rather than inventing cryptography.
- The checkpoint manifest uses existing signed envelopes plus SHA-256 over canonical exact revocation ids; no new network service is introduced.
- The lineage experiment uses existing signed-envelope ids and exact predecessor binding rather than inventing consensus, blockchain, or a global monotonic counter service.
- Key rotation/recovery remains documented but intentionally not implemented.
- Unknown clock, incomplete delegation chain, untrusted root, invalid revocation window, ambiguous one-use delegation, missing subject proof, stale checkpoint, malformed checkpoint manifest, missing lineage history, lineage gap, rollback, fork, and completeness regression fail closed or remain explicit.
- Revocation-chain semantics and checkpoint semantics were locked with bounded fixtures before distributed infrastructure.
- Checkpoint anti-rollback is now tested first as local retained-state continuity before considering synchronization or durable shared state.
- Interoperability remains one bounded vector across same-repository JavaScript and Go paths rather than being promoted into a broad protocol claim.

## Evidence

Merged baseline before this change:

- 24 trust-core fixtures;
- 8 revocation-checkpoint fixtures;
- 1 deterministic reference-vector check;
- 6 separate-JavaScript-verifier checks;
- 7 Go-verifier checks;
- successful JavaScript + Go CI on `main`.

This branch adds 10 checkpoint-lineage fixtures:

1. sequence-zero local genesis -> `LINEAGE_GENESIS_ACCEPTABLE`;
2. non-genesis without retained history -> `HOLD_LINEAGE_HISTORY_REQUIRED`;
3. exact next signed predecessor -> `LINEAGE_ADVANCE_ACCEPTABLE`;
4. exact retained pair -> `LINEAGE_HEAD_CURRENT`;
5. older sequence relative to retained head -> `CHECKPOINT_ROLLBACK_DETECTED`;
6. conflicting same-sequence link -> `CHECKPOINT_FORK_DETECTED`;
7. missing intermediate sequence -> `HOLD_LINEAGE_GAP`;
8. next sequence naming a different predecessor -> `CHECKPOINT_FORK_DETECTED`;
9. direct successor with lower `completeThrough` -> `CHECKPOINT_COMPLETENESS_ROLLBACK`;
10. foreign signer attempting another issuer lineage -> `CHECKPOINT_LINEAGE_ISSUER_MISMATCH`.

That brings the authored adversarial matrix to 56 bounded cases total.

The branch also adds:

- `src/checkpoint-lineage.js` as a separate local continuity primitive;
- `schema/REVOCATION_CHECKPOINT_LINK.schema.json`;
- `experiments/CHECKPOINT_LINEAGE_V1.md`, with the falsifier recorded before implementation;
- explicit README, Trust Model, and evidence-matrix truth boundaries.

It does not modify `src/trust-core.js`, donor boundaries, capability authorization, revocation distribution, checkpoint synchronization, global discovery, or external consensus.

Repository CI must run both:

```bash
npm test
cd crosslang/go && go test ./...
```

The final published PR head must pass remote CI before merge.

## Gate conclusion

The four roots permit merging this bounded local checkpoint-lineage experiment **only if** the final published branch, PR diff, and remote CI remain consistent with this report.

This conclusion grants no automatic global checkpoint ordering, discovery, synchronization, anti-rollback after local-state loss, disconnected-fork resolution, current/global revocation freshness, capability-authorization dependency, donor migration, release, deployment, security certification, third-party interoperability claim, broad protocol conformance, or AXM-wide CANON status.
