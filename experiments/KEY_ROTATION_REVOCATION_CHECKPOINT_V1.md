# KEY_ROTATION_REVOCATION_CHECKPOINT_V1 — falsifier-first experiment

## Question

Can Trust Fabric let one exact predecessor key attest the exact supplied set of its own signed key-rotation-revocation packets through one historical `completeThrough` boundary, without turning that checkpoint into a claim of current global freshness, valid referenced rotations, authority transfer, discovery, or consensus?

This experiment is intentionally predecessor-local and historical. It does not define revocation distribution, automatic successor authority, recovery, or a global rotation registry.

## Falsifier first

The experiment fails if any of the following is possible:

1. omitting or substituting a checkpointed rotation-revocation packet still reproduces the checkpoint manifest;
2. a foreign signer can place its rotation-revocation packet inside another predecessor's checkpointed manifest;
3. a checkpoint signed by a foreign key can be accepted for an explicitly expected predecessor;
4. a manifest packet issued after `completeThrough` is accepted as covered by that checkpoint;
5. duplicate packet ids are silently normalized instead of rejected;
6. `completeThrough` can be later than the checkpoint's own signed `issuedAt`;
7. an expired checkpoint is treated as current freshness evidence, or an unknown verifier clock is treated as known;
8. successful evaluation is described as proving that no newer or unseen rotation revocation exists;
9. successful evaluation is described as proving that each referenced rotation exists, is valid, is the newest branch, or has transferred identity/root/capability/revocation/checkpoint authority;
10. implementation requires rewriting historical rotation/revocation packets, changing `src/trust-core.js`, changing existing rotation/ack/lineage/revocation semantics, changing donor behavior, introducing a network service/registry/consensus mechanism, or promoting repository evidence to AXM-wide CANON.

## Intended success state

A successful evaluation may return a state equivalent to `ROTATION_REVOCATION_SET_ATTESTED_THROUGH` only when:

- the checkpoint envelope is cryptographically valid and signed by the explicitly expected predecessor;
- every supplied manifest packet is a cryptographically valid `key-rotation-revocation` packet signed by that same predecessor;
- every supplied packet's signed `issuedAt` is at or before `completeThrough`;
- the exact sorted packet-id manifest matches the signed count and digest;
- the checkpoint itself is temporally usable under the verifier's supplied clock.

The result means only: **this predecessor signed this exact supplied rotation-revocation manifest through this historical boundary**.

It does not mean:

- no newer or unseen revocation exists;
- the peer has synchronized all revocation evidence;
- the referenced rotations were separately validated;
- a rotation branch is globally newest or unique;
- a successor inherited authority or identity;
- forks are resolved;
- a lost key can be recovered;
- the checkpoint signer controls global truth.

## Root gate before implementation

- **Truth:** exact packet ids/count/digest and the historical boundary must be verifiable; absence of later evidence remains unknown.
- **Agency / non-domination:** only one explicit predecessor may attest its own revocation packets; no registry or winner election is introduced.
- **Continuity:** checkpointing must bind existing immutable packet ids, not rewrite rotations, acknowledgements, or revocations.
- **Wisdom before speed:** solve only bounded historical attestation before revocation distribution, synchronization, arbitrary lineage, recovery, or consensus.
