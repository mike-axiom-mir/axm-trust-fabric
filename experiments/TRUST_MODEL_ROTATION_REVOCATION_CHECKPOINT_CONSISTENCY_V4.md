# Trust Model Rotation-Revocation Checkpoint Consistency v4

Status: falsifier-first evidence/governance experiment. No protocol semantics are changed by this contract.

## Question

Can the primary `TRUST_MODEL.md` be required to carry the same bounded truth boundaries already exercised by the key-rotation-revocation checkpoint and retained-head checkpoint-lineage fixtures, so later documentation drift cannot silently turn historical/local evidence into global freshness, discovery, synchronization, authority transfer, or fork resolution?

## Falsifier first

The experiment fails if CI can stay green while `TRUST_MODEL.md` loses any of these already-tested boundaries:

1. `ROTATION_REVOCATION_SET_ATTESTED_THROUGH` means only that the explicitly expected predecessor signed the exact supplied rotation-revocation manifest through one historical `completeThrough` boundary;
2. that checkpoint does not prove no newer or unseen revocation exists, separately validate referenced rotations, establish global freshness, transfer authority, or resolve a fork;
3. `ROTATION_REVOCATION_LINEAGE_ADVANCE_ACCEPTABLE` means only that an exact supplied checkpoint/link pair directly advances one exact locally retained predecessor head without moving `completeThrough` backward;
4. retained-head lineage does not discover unseen checkpoints or revocations, prove a globally newest/current state, survive loss/replacement of retained local state, synchronize peers, choose a fork winner, or transfer identity/authority;
5. foreign signers do not gain checkpoint or lineage authority for another predecessor.

It also fails if enforcing those statements changes runtime trust decisions, adds a protocol/security case, rewrites donor behavior, silently replaces earlier semantics, or promotes repository state to AXM-wide CANON.

## Bounded implementation target

- extend the existing evidence-consistency meta-guard with exact required Trust Model phrases for these already-executed checkpoint and checkpoint-lineage boundaries;
- add concise dedicated sections to `TRUST_MODEL.md` describing the existing behavior without changing it;
- keep the authored protocol/security matrix at 130 cases because this is documentation/evidence consistency plumbing, not a new protocol property;
- update the primary root-gate report so the guard scope is stated accurately.

## Truth boundary

A green guard proves only that selected repository documentation at one commit still states these bounded semantics already backed by executable fixtures. It does not prove documentation completeness, protocol completeness, global freshness, peer synchronization, fork resolution, external security, identity continuity, authority transfer, recovery, or AXM-wide CANON status.
